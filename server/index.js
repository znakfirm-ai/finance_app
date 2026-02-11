const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { Pool } = require("pg");
require("dotenv").config();
const LEMONFOX_URL = "https://api.lemonfox.ai/v1/audio/transcriptions";
const TRANSCRIBE_PROMPT =
  "Русский язык. Финансовые операции: зарплата, аванс, премия, кэшбек, перевод, оплата, " +
  "медклиника, медицина, аптека, коммуналка, еда, транспорт. Пиши естественные русские формы. " +
  "Числа пиши цифрами без пробелов и разделителей (например 2930, 18545). " +
  "Нули сохраняй как в речи. Пример: \"сто тысяч\" -> 100000. " +
  "Не добавляй лишние нули к суммам.";
const TELEGRAM_API = process.env.TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
  : null;
const LEMMATIZE_SCRIPT = path.join(__dirname, "lemmatize.py");
const DATABASE_URL = process.env.DATABASE_URL || process.env.RENDER_DATABASE_URL;
const TELEGRAM_INITDATA_MAX_AGE_SEC = 7 * 24 * 60 * 60;

const app = express();
const port = process.env.PORT || 3001;

app.use(
  cors({
    origin: true,
    allowedHeaders: ["Content-Type", "x-telegram-init-data"],
  })
);
app.use(express.json());

const uploadDir = path.join(process.env.TMPDIR || "/tmp", "finance_app_uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const defaultCategories = [
  { name: "Еда", keywords: ["еда", "кафе", "кофе", "обед", "ужин", "завтрак", "пицца"] },
  { name: "Транспорт", keywords: ["такси", "метро", "автобус", "бензин", "транспорт"] },
  { name: "Жильё", keywords: ["аренда", "квартира", "коммунал", "жкх", "жилье"] },
  { name: "Развлечения", keywords: ["кино", "игры", "развлеч", "музыка"] },
  { name: "Другое", keywords: [] },
];

const defaultAccounts = ["Банковская карта", "Наличные"];
const defaultIncomeSources = ["Зарплата", "Бизнес", "Прочее"];
const DEFAULT_ACCOUNT_COLOR = "#0f172a";

const currencyOptions = [
  { code: "RUB", symbol: "₽", name: "RUB" },
  { code: "USD", symbol: "$", name: "USD" },
  { code: "EUR", symbol: "€", name: "EUR" },
  { code: "GBP", symbol: "£", name: "GBP" },
  { code: "JPY", symbol: "¥", name: "JPY" },
  { code: "CNY", symbol: "¥", name: "CNY" },
  { code: "CHF", symbol: "CHF", name: "CHF" },
  { code: "AUD", symbol: "A$", name: "AUD" },
  { code: "CAD", symbol: "C$", name: "CAD" },
  { code: "SEK", symbol: "kr", name: "SEK" },
  { code: "NOK", symbol: "kr", name: "NOK" },
  { code: "DKK", symbol: "kr", name: "DKK" },
  { code: "PLN", symbol: "zł", name: "PLN" },
  { code: "CZK", symbol: "Kč", name: "CZK" },
  { code: "HUF", symbol: "Ft", name: "HUF" },
  { code: "TRY", symbol: "₺", name: "TRY" },
  { code: "INR", symbol: "₹", name: "INR" },
  { code: "BRL", symbol: "R$", name: "BRL" },
  { code: "MXN", symbol: "Mex$", name: "MXN" },
  { code: "KRW", symbol: "₩", name: "KRW" },
  { code: "SGD", symbol: "S$", name: "SGD" },
  { code: "HKD", symbol: "HK$", name: "HKD" },
  { code: "AED", symbol: "AED", name: "AED" },
  { code: "SAR", symbol: "SAR", name: "SAR" },
  { code: "ZAR", symbol: "R", name: "ZAR" },
  { code: "THB", symbol: "฿", name: "THB" },
  { code: "IDR", symbol: "Rp", name: "IDR" },
  { code: "MYR", symbol: "RM", name: "MYR" },
  { code: "PHP", symbol: "₱", name: "PHP" },
  { code: "VND", symbol: "₫", name: "VND" },
  { code: "UAH", symbol: "₴", name: "UAH" },
  { code: "KZT", symbol: "₸", name: "KZT" },
];

const memoryOperations = [];
const pendingOperations = new Map();
const pendingEdits = new Map();
const pendingEditConfirm = new Map();
const operationSourceMessages = new Map();
const processedUpdates = new Map();
const UPDATE_TTL_MS = 5 * 60 * 1000;
let dbPool = null;

function shouldProcessUpdate(update) {
  const updateId = update?.update_id;
  if (updateId == null) return true;
  const now = Date.now();
  for (const [id, ts] of processedUpdates.entries()) {
    if (now - ts > UPDATE_TTL_MS) processedUpdates.delete(id);
  }
  if (processedUpdates.has(updateId)) return false;
  processedUpdates.set(updateId, now);
  return true;
}

function needsSsl(connectionString) {
  if (!connectionString) return false;
  if (/sslmode=require/i.test(connectionString)) return true;
  if (process.env.PGSSLMODE === "require") return true;
  return process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1";
}

async function initDb() {
  if (!DATABASE_URL) {
    console.warn("DATABASE_URL is missing. Using in-memory storage.");
    return;
  }
  const config = { connectionString: DATABASE_URL };
  if (needsSsl(DATABASE_URL)) {
    config.ssl = { rejectUnauthorized: false };
  }
  dbPool = new Pool(config);
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS operations (
      id text PRIMARY KEY,
      text text NOT NULL,
      type text NOT NULL,
      amount numeric(12,2) NOT NULL,
      category text NOT NULL,
      account text NOT NULL,
      account_specified boolean NOT NULL DEFAULT false,
      telegram_user_id text,
      amount_cents integer,
      source_message_id bigint,
      created_at timestamptz NOT NULL,
      label text,
      label_emoji text,
      amount_text text,
      flow_line text,
      exclude_from_summary boolean NOT NULL DEFAULT false,
      source_type text,
      source_id text
    );
  `);
  try {
    await dbPool.query(
      "ALTER TABLE operations ALTER COLUMN amount TYPE numeric(12,2) USING amount::numeric;"
    );
  } catch (err) {
    console.error("Alter amount type failed:", err?.message || err);
  }
  await dbPool.query(
    "ALTER TABLE operations ADD COLUMN IF NOT EXISTS telegram_user_id text;"
  );
  await dbPool.query("ALTER TABLE operations ADD COLUMN IF NOT EXISTS amount_cents integer;");
  await dbPool.query(
    "ALTER TABLE operations ADD COLUMN IF NOT EXISTS source_message_id bigint;"
  );
  await dbPool.query(
    "ALTER TABLE operations ADD COLUMN IF NOT EXISTS income_source text;"
  );
  await dbPool.query(
    "ALTER TABLE operations ADD COLUMN IF NOT EXISTS exclude_from_summary boolean NOT NULL DEFAULT false;"
  );
  await dbPool.query(
    "ALTER TABLE operations ADD COLUMN IF NOT EXISTS source_type text;"
  );
  await dbPool.query(
    "ALTER TABLE operations ADD COLUMN IF NOT EXISTS source_id text;"
  );
  await dbPool.query(
    "UPDATE operations SET amount_cents = ROUND(amount * 100) WHERE amount_cents IS NULL;"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS operations_telegram_user_id_idx ON operations(telegram_user_id);"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS operations_income_source_idx ON operations(telegram_user_id, income_source);"
  );

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      owner_id text PRIMARY KEY,
      currency_code text NOT NULL DEFAULT 'RUB',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await dbPool.query(
    "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS onboarding_greeting_message_id bigint;"
  );
  await dbPool.query(
    "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS onboarding_prompt_message_id bigint;"
  );
  try {
    await dbPool.query(`
      WITH ranked AS (
        SELECT ctid, owner_id,
               row_number() OVER (
                 PARTITION BY owner_id
                 ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
               ) AS rn
        FROM user_settings
      )
      DELETE FROM user_settings u
      USING ranked r
      WHERE u.ctid = r.ctid AND r.rn > 1;
    `);
  } catch (err) {
    console.error("User settings dedupe failed:", err?.message || err);
  }
  try {
    await dbPool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS user_settings_owner_id_unique ON user_settings(owner_id);"
    );
  } catch (err) {
    console.error("User settings unique index failed:", err?.message || err);
  }

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await dbPool.query(
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS budget numeric(12,2);"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS categories_owner_id_idx ON categories(owner_id);"
  );

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS income_sources (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS income_sources_owner_id_idx ON income_sources(owner_id);"
  );

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await dbPool.query(
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'RUB';"
  );
  await dbPool.query(
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '${DEFAULT_ACCOUNT_COLOR}';`
  );
  await dbPool.query(
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) NOT NULL DEFAULT 0;"
  );
  await dbPool.query(
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS include_in_balance boolean NOT NULL DEFAULT true;"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS accounts_owner_id_idx ON accounts(owner_id);"
  );

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      name text NOT NULL,
      target_amount numeric(12,2) NOT NULL DEFAULT 0,
      color text NOT NULL DEFAULT '${DEFAULT_ACCOUNT_COLOR}',
      target_date date,
      notify boolean NOT NULL DEFAULT false,
      notify_frequency text,
      notify_start_date date,
      notify_time text,
      notify_last_sent timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await dbPool.query(
    "ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_amount numeric(12,2) NOT NULL DEFAULT 0;"
  );
  await dbPool.query(
    `ALTER TABLE goals ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '${DEFAULT_ACCOUNT_COLOR}';`
  );
  await dbPool.query("ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_date date;");
  await dbPool.query(
    "ALTER TABLE goals ADD COLUMN IF NOT EXISTS notify boolean NOT NULL DEFAULT false;"
  );
  await dbPool.query(
    "ALTER TABLE goals ADD COLUMN IF NOT EXISTS notify_frequency text;"
  );
  await dbPool.query(
    "ALTER TABLE goals ADD COLUMN IF NOT EXISTS notify_start_date date;"
  );
  await dbPool.query(
    "ALTER TABLE goals ADD COLUMN IF NOT EXISTS notify_time text;"
  );
  await dbPool.query(
    "ALTER TABLE goals ADD COLUMN IF NOT EXISTS notify_last_sent timestamptz;"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS goals_owner_id_idx ON goals(owner_id);"
  );

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS goal_transactions (
      id text PRIMARY KEY,
      goal_id text NOT NULL,
      owner_id text NOT NULL,
      type text NOT NULL,
      amount numeric(12,2) NOT NULL,
      account text,
      label text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await dbPool.query(
    "ALTER TABLE goal_transactions ADD COLUMN IF NOT EXISTS account text;"
  );
  await dbPool.query(
    "ALTER TABLE goal_transactions ADD COLUMN IF NOT EXISTS operation_id text;"
  );
  await dbPool.query(
    "ALTER TABLE goal_transactions ADD COLUMN IF NOT EXISTS label text;"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS goal_transactions_owner_id_idx ON goal_transactions(owner_id);"
  );

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS debts (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      kind text NOT NULL,
      name text NOT NULL,
      principal_amount numeric(12,2) NOT NULL DEFAULT 0,
      total_amount numeric(12,2) NOT NULL DEFAULT 0,
      schedule_enabled boolean NOT NULL DEFAULT true,
      payments_count integer,
      frequency text,
      first_payment_date date,
      currency_code text,
      issued_date date,
      due_date date,
      rate numeric(8,4),
      term_months integer,
      payment_type text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await dbPool.query(
    "ALTER TABLE debts ADD COLUMN IF NOT EXISTS schedule_enabled boolean NOT NULL DEFAULT true;"
  );
  await dbPool.query(
    "ALTER TABLE debts ADD COLUMN IF NOT EXISTS payments_count integer;"
  );
  await dbPool.query("ALTER TABLE debts ADD COLUMN IF NOT EXISTS frequency text;");
  await dbPool.query(
    "ALTER TABLE debts ADD COLUMN IF NOT EXISTS first_payment_date date;"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS debts_owner_id_idx ON debts(owner_id);"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS debts_kind_idx ON debts(owner_id, kind);"
  );

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS debt_schedule (
      id text PRIMARY KEY,
      debt_id text NOT NULL,
      owner_id text NOT NULL,
      due_date date,
      amount numeric(12,2) NOT NULL DEFAULT 0,
      paid boolean NOT NULL DEFAULT false,
      paid_amount numeric(12,2),
      paid_at timestamptz,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS debt_schedule_owner_id_idx ON debt_schedule(owner_id);"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS debt_schedule_debt_id_idx ON debt_schedule(debt_id);"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS goal_transactions_goal_id_idx ON goal_transactions(goal_id);"
  );
}

async function saveOperation(operation) {
  if (!dbPool) {
    memoryOperations.unshift(operation);
    return operation;
  }
  const amountValue = Number(operation.amount);
  const amountCents = Number.isFinite(operation.amountCents)
    ? operation.amountCents
    : Number.isFinite(amountValue)
      ? Math.round(amountValue * 100)
      : null;
  const query = `
    INSERT INTO operations (
      id, text, type, amount, amount_cents, category, account, account_specified,
      telegram_user_id, created_at, label, label_emoji, amount_text, flow_line, source_message_id,
      income_source, exclude_from_summary, source_type, source_id
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    )
  `;
  const values = [
    operation.id,
    operation.text,
    operation.type,
    amountValue,
    amountCents,
    operation.category,
    operation.account,
    operation.accountSpecified,
    operation.telegramUserId || null,
    operation.createdAt,
    operation.label,
    operation.labelEmoji,
    operation.amountText,
    operation.flowLine,
    operation.sourceMessageId || null,
    operation.incomeSource || null,
    operation.excludeFromSummary === true,
    operation.sourceType || null,
    operation.sourceId || null,
  ];
  await dbPool.query(query, values);
  return operation;
}

async function listOperations({
  limit = 100,
  telegramUserId = null,
  account = null,
  type = null,
  incomeSource = null,
  category = null,
  includeInternal = false,
  search = null,
  before = null,
  from = null,
  to = null,
} = {}) {
  if (!dbPool) {
    let data = telegramUserId
      ? memoryOperations.filter((op) => String(op.telegramUserId) === String(telegramUserId))
      : memoryOperations;
    if (account) {
      data = data.filter((op) => op.account === account);
    }
    if (type) {
      data = data.filter((op) => op.type === type);
    }
    if (incomeSource) {
      data = data.filter((op) => (op.incomeSource || op.category) === incomeSource);
    }
    if (category) {
      data = data.filter((op) => op.category === category);
    }
    if (search) {
      const q = String(search).toLowerCase();
      data = data.filter((op) => {
        const label = String(op.label || op.text || "").toLowerCase();
        const amount = String(op.amount || op.amountText || "");
        return label.includes(q) || amount.includes(q);
      });
    }
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        data = data.filter((op) => new Date(op.createdAt) >= fromDate);
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        data = data.filter((op) => new Date(op.createdAt) <= toDate);
      }
    }
    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        data = data.filter((op) => new Date(op.createdAt) < beforeDate);
      }
    }
    return data
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }
  let query = `
    SELECT id, text, type, amount, amount_cents, category, account, account_specified,
           telegram_user_id, created_at, label, label_emoji, amount_text, flow_line,
           source_message_id, income_source, exclude_from_summary, source_type, source_id
    FROM operations
  `;
  const params = [];
  const where = [];
  if (telegramUserId) {
    params.push(String(telegramUserId));
    where.push(`telegram_user_id = $${params.length}`);
  }
  if (account) {
    params.push(account);
    where.push(`account = $${params.length}`);
  }
  if (type) {
    params.push(type);
    where.push(`type = $${params.length}`);
  }
  if (incomeSource) {
    params.push(incomeSource);
    params.push(incomeSource);
    where.push(
      `(income_source = $${params.length - 1} OR (income_source IS NULL AND category = $${params.length}))`
    );
  }
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (search) {
    const like = `%${String(search).toLowerCase()}%`;
    params.push(like);
    const idx = params.length;
    where.push(
      `(LOWER(COALESCE(label, text, '')) LIKE $${idx} OR CAST(amount AS text) LIKE $${idx} OR CAST(amount_cents AS text) LIKE $${idx})`
    );
  }
  if (from) {
    params.push(from);
    where.push(`created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`created_at <= $${params.length}`);
  }
  if (before) {
    params.push(before);
    where.push(`created_at < $${params.length}`);
  }
  if (where.length) {
    query += ` WHERE ${where.join(" AND ")}`;
  }
  if (!includeInternal) {
    query += where.length ? " AND exclude_from_summary = false" : " WHERE exclude_from_summary = false";
  }
  params.push(limit);
  query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
  const { rows } = await dbPool.query(query, params);
  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    type: row.type,
    amount:
      row.amount_cents !== null && row.amount_cents !== undefined
        ? Number(row.amount_cents) / 100
        : Number(row.amount),
    amountCents:
      row.amount_cents !== null && row.amount_cents !== undefined
        ? Number(row.amount_cents)
        : Math.round(Number(row.amount) * 100),
    category: row.category,
    account: row.account,
    accountSpecified: row.account_specified,
    telegramUserId: row.telegram_user_id,
    createdAt: row.created_at,
    label: row.label,
    labelEmoji: row.label_emoji,
    amountText: row.amount_text,
    flowLine: row.flow_line,
    sourceMessageId: row.source_message_id,
    incomeSource: row.income_source || null,
    excludeFromSummary: row.exclude_from_summary === true,
    sourceType: row.source_type || null,
    sourceId: row.source_id || null,
  }));
}

async function getOperationById(operationId, telegramUserId) {
  if (!dbPool) {
    return (
      memoryOperations.find(
        (op) =>
          op.id === operationId &&
          String(op.telegramUserId || "") === String(telegramUserId || "")
      ) || null
    );
  }
  const result = await dbPool.query(
    `SELECT id, text, type, amount, amount_cents, category, account, account_specified,
            telegram_user_id, created_at, label, label_emoji, amount_text, flow_line,
            source_message_id, income_source, exclude_from_summary, source_type, source_id
     FROM operations
     WHERE id = $1 AND telegram_user_id = $2
     LIMIT 1`,
    [operationId, telegramUserId || null]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    text: row.text,
    type: row.type,
    amount:
      row.amount_cents !== null && row.amount_cents !== undefined
        ? Number(row.amount_cents) / 100
        : Number(row.amount),
    amountCents:
      row.amount_cents !== null && row.amount_cents !== undefined
        ? Number(row.amount_cents)
        : Math.round(Number(row.amount) * 100),
    category: row.category,
    account: row.account,
    accountSpecified: row.account_specified,
    telegramUserId: row.telegram_user_id,
    createdAt: row.created_at,
    label: row.label,
    labelEmoji: row.label_emoji,
    amountText: row.amount_text,
    flowLine: row.flow_line,
    sourceMessageId: row.source_message_id,
    incomeSource: row.income_source || null,
    excludeFromSummary: row.exclude_from_summary === true,
    sourceType: row.source_type || null,
    sourceId: row.source_id || null,
  };
}

async function updateOperation(operation, telegramUserId) {
  if (!dbPool) {
    const idx = memoryOperations.findIndex(
      (op) =>
        op.id === operation.id &&
        String(op.telegramUserId || "") === String(telegramUserId || "")
    );
    if (idx === -1) return false;
    memoryOperations[idx] = { ...memoryOperations[idx], ...operation };
    return true;
  }
  const amountValue = Number(operation.amount);
  const amountCents = Number.isFinite(operation.amountCents)
    ? operation.amountCents
    : Number.isFinite(amountValue)
      ? Math.round(amountValue * 100)
      : null;
  const query = `
    UPDATE operations
    SET text=$1, type=$2, amount=$3, amount_cents=$4, category=$5, account=$6,
        account_specified=$7, label=$8, label_emoji=$9, amount_text=$10, flow_line=$11,
        income_source=$12
    WHERE id=$13 AND telegram_user_id=$14
    RETURNING id
  `;
  const values = [
    operation.text,
    operation.type,
    amountValue,
    amountCents,
    operation.category,
    operation.account,
    operation.accountSpecified,
    operation.label,
    operation.labelEmoji,
    operation.amountText,
    operation.flowLine,
    operation.incomeSource || null,
    operation.id,
    telegramUserId || null,
  ];
  const result = await dbPool.query(query, values);
  return result.rowCount > 0;
}

async function deleteOperationById(operationId, telegramUserId) {
  if (!dbPool) {
    const before = memoryOperations.length;
    for (let i = memoryOperations.length - 1; i >= 0; i -= 1) {
      const op = memoryOperations[i];
      if (
        op.id === operationId &&
        String(op.telegramUserId || "") === String(telegramUserId || "")
      ) {
        memoryOperations.splice(i, 1);
      }
    }
    return memoryOperations.length < before;
  }
  const result = await dbPool.query(
    "DELETE FROM operations WHERE id = $1 AND telegram_user_id = $2",
    [operationId, telegramUserId || null]
  );
  return result.rowCount > 0;
}

async function getEditableOperation(opId, ownerId) {
  const staged = pendingEditConfirm.get(opId);
  if (staged && staged.ownerId === ownerId) return staged.op;
  return getOperationById(opId, ownerId);
}

async function sendEditPreview(chatId, ownerId, op, context = {}) {
  const existing = pendingEditConfirm.get(op.id);
  if (existing?.previewMessageId) {
    await safeDeleteMessage(chatId, existing.previewMessageId);
  }
  const source = operationSourceMessages.get(op.id);
  const opSourceId = op.sourceMessageId || null;
  const messageText =
    `${op.labelEmoji} ${op.label}\n` +
    `💸 ${op.amountText}\n` +
    `${op.flowLine}\n` +
    `🗂️ Категория: ${op.category}`;
  const previewMessage = await telegramApi("sendMessage", {
    chat_id: chatId,
    text: messageText,
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Подтвердить", callback_data: `confirm:${op.id}` }],
        [
          { text: "✏️ Исправить", callback_data: `edit:${op.id}` },
          { text: "🗑️ Удалить", callback_data: `delete:${op.id}` },
        ],
      ],
    },
  });
  pendingEditConfirm.set(op.id, {
    op,
    ownerId,
    chatId,
    previewMessageId: previewMessage?.message_id,
    sourceUserMessageId:
      context.sourceUserMessageId ||
      existing?.sourceUserMessageId ||
      opSourceId ||
      source?.messageId ||
      null,
  });
}

async function transcribeBuffer(buffer, filename) {
  if (!process.env.LEMONFOX_API_KEY) {
    throw new Error("LEMONFOX_API_KEY is missing");
  }
  const form = new FormData();
  form.append("file", new Blob([buffer]), filename || "audio.webm");
  form.append("response_format", "json");
  form.append("language", "ru");
  form.append("prompt", TRANSCRIBE_PROMPT);

  const response = await fetch(LEMONFOX_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LEMONFOX_API_KEY}`,
    },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error || `Lemonfox error ${response.status}`;
    throw new Error(message);
  }

  return data.text || "";
}

async function telegramApi(method, payload) {
  if (!TELEGRAM_API) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
  }
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data?.description || "Telegram API error");
  }
  return data.result;
}

async function safeDeleteMessage(chatId, messageId) {
  if (!chatId || !messageId) return;
  try {
    await telegramApi("deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    });
  } catch (err) {
    // ignore delete failures (message might be too old or already deleted)
  }
}

async function clearOnboardingMessages(chatId, ownerId) {
  let greetingId = null;
  let promptId = null;
  if (ownerId) {
    const ids = await getOnboardingMessageIds(ownerId);
    greetingId = ids.greetingId;
    promptId = ids.promptId;
  }
  if (greetingId) await safeDeleteMessage(chatId, greetingId);
  if (promptId) await safeDeleteMessage(chatId, promptId);
  if (ownerId) {
    await clearOnboardingMessageIds(ownerId);
  }
}


function verifyTelegramInitData(initData) {
  if (!initData || !process.env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: "Missing init data or bot token" };
  }
  let params;
  try {
    params = new URLSearchParams(initData);
  } catch (err) {
    return { ok: false, error: "Invalid init data format" };
  }
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "Missing hash" };
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  const hashBuffer = Buffer.from(hash, "hex");
  const computedBuffer = Buffer.from(computedHash, "hex");
  if (
    hashBuffer.length !== computedBuffer.length ||
    !crypto.timingSafeEqual(hashBuffer, computedBuffer)
  ) {
    return { ok: false, error: "Hash mismatch" };
  }
  const authDate = Number(params.get("auth_date") || 0);
  if (authDate) {
    const age = Math.floor(Date.now() / 1000) - authDate;
    if (age > TELEGRAM_INITDATA_MAX_AGE_SEC) {
      return { ok: false, error: "Init data expired" };
    }
  }
  let user = null;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch (err) {
      return { ok: false, error: "Invalid user data" };
    }
  }
  if (!user?.id) {
    return { ok: false, error: "Missing user id" };
  }
  return { ok: true, userId: String(user.id), user };
}

async function sendGoalNotification(goal, total) {
  if (!TELEGRAM_API || !goal?.owner_id) return;
  if (String(goal.owner_id || "").startsWith("web_")) return;
  const percent =
    goal.target_amount && Number(goal.target_amount) > 0
      ? Math.round((Number(total) / Number(goal.target_amount)) * 100)
      : 0;
  const text =
    `Напоминание по цели: ${goal.name}\n` +
    `Прогресс: ${formatAmount(total)} из ${formatAmount(goal.target_amount)} (${percent}%)`;
  await telegramApi("sendMessage", {
    chat_id: goal.owner_id,
    text,
  });
}

function getPeriodMs(freq) {
  if (freq === "daily") return 24 * 60 * 60 * 1000;
  if (freq === "weekly") return 7 * 24 * 60 * 60 * 1000;
  if (freq === "monthly") return 30 * 24 * 60 * 60 * 1000;
  return null;
}

function parseNotifyTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? raw : null;
}

const DEBT_KIND_MAP = {
  owed: "owed_to_me",
  owe: "i_owe",
  credit: "credit",
  owed_to_me: "owed_to_me",
  i_owe: "i_owe",
};

function normalizeDebtKind(value) {
  const key = String(value || "").toLowerCase();
  return DEBT_KIND_MAP[key] || null;
}

function roundMoney(value) {
  const num = Number(value) || 0;
  return Math.round(num * 100) / 100;
}

function addMonths(baseDate, count) {
  const date = new Date(baseDate);
  if (Number.isNaN(date.getTime())) return new Date();
  const day = date.getDate();
  date.setMonth(date.getMonth() + count);
  if (date.getDate() !== day) {
    date.setDate(0);
  }
  return date;
}

function addDays(baseDate, count) {
  const date = new Date(baseDate);
  if (Number.isNaN(date.getTime())) return new Date();
  date.setDate(date.getDate() + count);
  return date;
}

function normalizeDateOnly(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addInterval(baseDate, frequency) {
  if (frequency === "daily") return addDays(baseDate, 1);
  if (frequency === "weekly") return addDays(baseDate, 7);
  if (frequency === "quarterly") return addMonths(baseDate, 3);
  return addMonths(baseDate, 1);
}

function generateScheduleByDates({ totalAmount, issuedDate, dueDate, frequency = "monthly" }) {
  const total = roundMoney(totalAmount);
  if (!total) return [];
  let start = normalizeDateOnly(issuedDate);
  let end = normalizeDateOnly(dueDate);
  if (!start || !end) return [];
  if (end < start) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const dates = [];
  let current = addInterval(start, frequency);
  if (!current || Number.isNaN(current.getTime())) return [];
  while (current <= end) {
    dates.push(current);
    current = addInterval(current, frequency);
    if (dates.length > 2000) break;
  }
  if (!dates.length) {
    dates.push(end);
  } else {
    const last = dates[dates.length - 1];
    if (last.getTime() !== end.getTime()) {
      dates.push(end);
    }
  }
  const uniqueDates = [];
  const seen = new Set();
  dates.forEach((date) => {
    const key = date.toISOString().slice(0, 10);
    if (seen.has(key)) return;
    seen.add(key);
    uniqueDates.push(date);
  });
  const count = Math.max(1, uniqueDates.length);
  const base = roundMoney(total / count);
  let remainder = roundMoney(total - base * count);
  return uniqueDates.map((date, idx) => ({
    dueDate: date,
    amount: idx === count - 1 ? roundMoney(base + remainder) : base,
  }));
}

function generateEqualSchedule({
  totalAmount,
  paymentsCount,
  firstPaymentDate,
  frequency = "monthly",
}) {
  const count = Math.max(1, Number(paymentsCount) || 1);
  const total = roundMoney(totalAmount);
  if (!total) return [];
  const base = roundMoney(total / count);
  let remainder = roundMoney(total - base * count);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const amount = i === count - 1 ? roundMoney(base + remainder) : base;
    let dueDate;
    if (frequency === "daily") {
      dueDate = addDays(firstPaymentDate, i);
    } else if (frequency === "weekly") {
      dueDate = addDays(firstPaymentDate, i * 7);
    } else if (frequency === "quarterly") {
      dueDate = addMonths(firstPaymentDate, i * 3);
    } else {
      dueDate = addMonths(firstPaymentDate, i);
    }
    entries.push({
      dueDate,
      amount,
    });
  }
  return entries;
}

function generateCreditSchedule({
  principal,
  rate,
  termMonths,
  firstPaymentDate,
  paymentType = "annuity",
}) {
  const months = Math.max(1, Number(termMonths) || 1);
  const baseDate = firstPaymentDate || new Date();
  const monthlyRate = Number(rate) ? Number(rate) / 12 / 100 : 0;
  let remaining = Number(principal) || 0;
  const entries = [];
  if (!remaining) return entries;
  if (paymentType === "diff") {
    const principalPart = remaining / months;
    for (let i = 0; i < months; i += 1) {
      const interest = remaining * monthlyRate;
      const amount = roundMoney(principalPart + interest);
      const dueDate = addMonths(baseDate, i);
      entries.push({ dueDate, amount });
      remaining -= principalPart;
    }
  } else {
    if (monthlyRate === 0) {
      return generateEqualSchedule({
        totalAmount: remaining,
        paymentsCount: months,
        firstPaymentDate: baseDate,
        frequency: "monthly",
      });
    }
    const pow = Math.pow(1 + monthlyRate, months);
    const payment = roundMoney((remaining * monthlyRate * pow) / (pow - 1));
    for (let i = 0; i < months; i += 1) {
      const dueDate = addMonths(baseDate, i);
      entries.push({ dueDate, amount: payment });
    }
  }
  return entries;
}

async function runGoalNotificationCheck() {
  if (!dbPool || !TELEGRAM_API) return;
  const { rows } = await dbPool.query(`
    SELECT g.id,
           g.owner_id,
           g.name,
           g.target_amount,
           g.notify,
           g.notify_frequency,
           g.notify_start_date,
           g.notify_time,
           g.notify_last_sent,
           COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) AS total
    FROM goals g
    LEFT JOIN goal_transactions t
      ON t.goal_id = g.id AND t.owner_id = g.owner_id
    WHERE g.notify = true AND g.notify_frequency IS NOT NULL AND g.notify_start_date IS NOT NULL
    GROUP BY g.id
  `);
  const now = new Date();
  for (const row of rows) {
    const startDate = row.notify_start_date ? new Date(row.notify_start_date) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) continue;
    const notifyTime = parseNotifyTime(row.notify_time);
    if (notifyTime) {
      const [hours, minutes] = notifyTime.split(":").map((part) => Number(part));
      startDate.setHours(hours, minutes, 0, 0);
    }
    if (now < startDate) continue;
    const freq = row.notify_frequency;
    const periodMs = getPeriodMs(freq);
    if (!periodMs) continue;
    const lastSent = row.notify_last_sent ? new Date(row.notify_last_sent) : null;
    if (lastSent && now.getTime() - lastSent.getTime() < periodMs) continue;
    if (notifyTime) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const [hours, minutes] = notifyTime.split(":").map((part) => Number(part));
      const targetMinutes = hours * 60 + minutes;
      if (nowMinutes < targetMinutes) continue;
    }
    try {
      await sendGoalNotification(row, Number(row.total || 0));
      await dbPool.query(
        "UPDATE goals SET notify_last_sent = $1 WHERE id = $2 AND owner_id = $3",
        [now.toISOString(), row.id, row.owner_id]
      );
    } catch (err) {
      console.error("Goal notify failed:", err?.message || err);
    }
  }
}

function startGoalNotificationLoop() {
  if (!dbPool || !TELEGRAM_API) return;
  const intervalMs = 60 * 1000;
  setInterval(() => {
    runGoalNotificationCheck().catch((err) =>
      console.error("Goal notification check failed:", err?.message || err)
    );
  }, intervalMs);
  runGoalNotificationCheck().catch((err) =>
    console.error("Goal notification check failed:", err?.message || err)
  );
}

function getOwnerFromRequest(req) {
  const initData =
    req.header("x-telegram-init-data") ||
    req.body?.initData ||
    req.query?.initData ||
    null;
  if (initData) {
    const verified = verifyTelegramInitData(initData);
    if (!verified.ok) {
      console.warn("Telegram init data verification failed:", verified.error);
      const webUserIdFallback = req.body?.webUserId || req.query?.webUserId || null;
      if (webUserIdFallback) {
        return { ownerId: String(webUserIdFallback), source: "fallback" };
      }
      return { error: verified.error };
    }
    return { ownerId: verified.userId, source: "telegram" };
  }
  const webUserId = req.body?.webUserId || req.query?.webUserId || null;
  if (webUserId) {
    return { ownerId: String(webUserId), source: "web" };
  }
  return { ownerId: null, source: null };
}

function getCurrencySymbol(code) {
  const entry = currencyOptions.find((c) => c.code === code);
  return entry?.symbol || "₽";
}

async function getUserSettings(ownerId) {
  const defaultSettings = { currencyCode: "RUB" };
  if (!ownerId || !dbPool) return defaultSettings;
  const { rows } = await dbPool.query(
    "SELECT currency_code FROM user_settings WHERE owner_id = $1 LIMIT 1",
    [ownerId]
  );
  if (rows.length) {
    return { currencyCode: rows[0].currency_code || "RUB" };
  }
  const inserted = await dbPool.query(
    `
    INSERT INTO user_settings (owner_id, currency_code)
    VALUES ($1, $2)
    ON CONFLICT (owner_id) DO UPDATE
    SET updated_at = now()
    RETURNING currency_code
  `,
    [ownerId, "RUB"]
  );
  if (inserted.rows.length) {
    return { currencyCode: inserted.rows[0].currency_code || "RUB" };
  }
  return defaultSettings;
}

async function getOnboardingMessageIds(ownerId) {
  if (!ownerId || !dbPool) {
    return { greetingId: null, promptId: null };
  }
  const { rows } = await dbPool.query(
    `SELECT onboarding_greeting_message_id, onboarding_prompt_message_id
     FROM user_settings WHERE owner_id = $1 LIMIT 1`,
    [ownerId]
  );
  if (!rows.length) {
    return { greetingId: null, promptId: null };
  }
  return {
    greetingId: rows[0].onboarding_greeting_message_id || null,
    promptId: rows[0].onboarding_prompt_message_id || null,
  };
}

async function updateOnboardingMessageIds(ownerId, greetingId, promptId) {
  if (!ownerId || !dbPool) return;
  await dbPool.query(
    `
    INSERT INTO user_settings (owner_id, currency_code, onboarding_greeting_message_id, onboarding_prompt_message_id)
    VALUES ($1, 'RUB', $2, $3)
    ON CONFLICT (owner_id) DO UPDATE
    SET onboarding_greeting_message_id = $2,
        onboarding_prompt_message_id = $3,
        updated_at = now()
  `,
    [ownerId, greetingId, promptId]
  );
}

async function clearOnboardingMessageIds(ownerId) {
  if (!ownerId || !dbPool) return;
  await dbPool.query(
    `
    UPDATE user_settings
    SET onboarding_greeting_message_id = NULL,
        onboarding_prompt_message_id = NULL,
        updated_at = now()
    WHERE owner_id = $1
  `,
    [ownerId]
  );
}

async function updateUserSettings(ownerId, currencyCode) {
  if (!ownerId || !dbPool) return { currencyCode };
  await dbPool.query(
    `
    INSERT INTO user_settings (owner_id, currency_code)
    VALUES ($1, $2)
    ON CONFLICT (owner_id) DO UPDATE
    SET currency_code = EXCLUDED.currency_code, updated_at = now()
  `,
    [ownerId, currencyCode]
  );
  return { currencyCode };
}

async function getCategoriesForOwner(ownerId) {
  if (!ownerId || !dbPool) {
    return defaultCategories.map((cat, index) => ({
      id: `cat_default_${index}`,
      name: cat.name,
      budget: null,
      keywords: cat.keywords,
    }));
  }
  const { rows } = await dbPool.query(
    "SELECT id, name, budget FROM categories WHERE owner_id = $1 ORDER BY created_at ASC",
    [ownerId]
  );
  if (!rows.length) {
    const now = Date.now();
    const values = defaultCategories.map((cat, index) => [
      `cat_${now}_${index}`,
      ownerId,
      cat.name,
      null,
    ]);
    const placeholders = values
      .map((_, idx) => `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`)
      .join(",");
    const flat = values.flat();
    await dbPool.query(
      `INSERT INTO categories (id, owner_id, name, budget) VALUES ${placeholders}`,
      flat
    );
    return defaultCategories.map((cat, index) => ({
      id: `cat_${now}_${index}`,
      name: cat.name,
      budget: null,
      keywords: cat.keywords,
    }));
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    budget:
      row.budget !== null && row.budget !== undefined ? Number(row.budget) : null,
    keywords:
      row.name === "Другое"
        ? []
        : [String(row.name || "").toLowerCase().replace(/ё/g, "е")],
  }));
}

async function getIncomeSourcesForOwner(ownerId) {
  if (!ownerId || !dbPool) {
    return defaultIncomeSources.map((name, index) => ({
      id: `inc_default_${index}`,
      name,
    }));
  }
  const { rows } = await dbPool.query(
    "SELECT id, name FROM income_sources WHERE owner_id = $1 ORDER BY created_at ASC",
    [ownerId]
  );
  if (!rows.length) {
    const now = Date.now();
    const values = defaultIncomeSources.map((name, index) => [
      `inc_${now}_${index}`,
      ownerId,
      name,
    ]);
    const placeholders = values
      .map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`)
      .join(",");
    await dbPool.query(
      `INSERT INTO income_sources (id, owner_id, name) VALUES ${placeholders}`,
      values.flat()
    );
    return defaultIncomeSources.map((name, index) => ({
      id: `inc_${now}_${index}`,
      name,
    }));
  }
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function getAccountsForOwner(ownerId) {
  if (!ownerId || !dbPool) {
    return defaultAccounts.map((name, index) => ({
      id: `acc_default_${index}`,
      name,
      currencyCode: "RUB",
      color: DEFAULT_ACCOUNT_COLOR,
      openingBalance: 0,
      includeInBalance: true,
    }));
  }
  const { rows } = await dbPool.query(
    `SELECT id, name, currency_code, color, include_in_balance, opening_balance
     FROM accounts WHERE owner_id = $1 ORDER BY created_at ASC`,
    [ownerId]
  );
  if (!rows.length) {
    const now = Date.now();
    const values = defaultAccounts.map((name, index) => [
      `acc_${now}_${index}`,
      ownerId,
      name,
      "RUB",
      DEFAULT_ACCOUNT_COLOR,
      0,
      true,
    ]);
    const placeholders = values
      .map(
        (_, idx) =>
          `($${idx * 7 + 1}, $${idx * 7 + 2}, $${idx * 7 + 3}, $${idx * 7 + 4}, $${idx * 7 + 5}, $${idx * 7 + 6}, $${idx * 7 + 7})`
      )
      .join(",");
    await dbPool.query(
      `INSERT INTO accounts (id, owner_id, name, currency_code, color, opening_balance, include_in_balance)
       VALUES ${placeholders}`,
      values.flat()
    );
    return defaultAccounts.map((name, index) => ({
      id: `acc_${now}_${index}`,
      name,
      currencyCode: "RUB",
      color: DEFAULT_ACCOUNT_COLOR,
      openingBalance: 0,
      includeInBalance: true,
    }));
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    currencyCode: row.currency_code || "RUB",
    color: row.color || DEFAULT_ACCOUNT_COLOR,
    openingBalance:
      row.opening_balance !== null && row.opening_balance !== undefined
        ? Number(row.opening_balance)
        : 0,
    includeInBalance: row.include_in_balance !== false,
  }));
}

async function getGoalsForOwner(ownerId) {
  if (!ownerId || !dbPool) {
    return [];
  }
  const { rows } = await dbPool.query(
    `
    SELECT g.id,
           g.name,
           g.target_amount,
           g.color,
           g.target_date,
           g.notify,
           g.notify_frequency,
           g.notify_start_date,
           g.notify_time,
           g.notify_last_sent,
           g.created_at,
           COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) AS total
    FROM goals g
    LEFT JOIN goal_transactions t
      ON t.goal_id = g.id AND t.owner_id = g.owner_id
    WHERE g.owner_id = $1
    GROUP BY g.id
    ORDER BY g.created_at ASC
    `,
    [ownerId]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    targetAmount:
      row.target_amount !== null && row.target_amount !== undefined
        ? Number(row.target_amount)
        : 0,
    color: row.color || DEFAULT_ACCOUNT_COLOR,
    targetDate: row.target_date ? new Date(row.target_date).toISOString() : null,
    notify: row.notify === true,
    notifyFrequency: row.notify_frequency || null,
    notifyStartDate: row.notify_start_date
      ? new Date(row.notify_start_date).toISOString()
      : null,
    notifyTime: row.notify_time || null,
    notifyLastSent: row.notify_last_sent ? row.notify_last_sent.toISOString() : null,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    total: row.total !== null && row.total !== undefined ? Number(row.total) : 0,
  }));
}

async function listGoalTransactions({
  ownerId,
  goalId,
  limit = 100,
  search = null,
  before = null,
  from = null,
  to = null,
} = {}) {
  if (!ownerId || !goalId) return [];
  if (!dbPool) return [];
  let query = `
    SELECT id, type, amount, label, account, created_at
    FROM goal_transactions
    WHERE owner_id = $1 AND goal_id = $2
  `;
  const params = [ownerId, goalId];
  if (search) {
    const like = `%${String(search).toLowerCase()}%`;
    params.push(like);
    const idx = params.length;
    query += ` AND (LOWER(COALESCE(label, type, account, '')) LIKE $${idx} OR CAST(amount AS text) LIKE $${idx})`;
  }
  if (from) {
    params.push(from);
    query += ` AND created_at >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    query += ` AND created_at <= $${params.length}`;
  }
  if (before) {
    params.push(before);
    query += ` AND created_at < $${params.length}`;
  }
  params.push(limit);
  query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
  const { rows } = await dbPool.query(query, params);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    label: row.label || (row.type === "income" ? "Пополнение" : "Изъятие"),
    account: row.account || "",
    createdAt: row.created_at,
    labelEmoji: row.type === "income" ? "🎯" : "↘️",
  }));
}

async function listDebtsForOwner(ownerId, kind) {
  if (!ownerId || !dbPool) return [];
  const params = [ownerId, kind];
  const { rows } = await dbPool.query(
    `SELECT id, name, kind, principal_amount, total_amount, currency_code, issued_date, due_date,
            rate, term_months, payment_type, notes, schedule_enabled, payments_count, frequency,
            first_payment_date, created_at, updated_at
     FROM debts
     WHERE owner_id = $1 AND kind = $2
     ORDER BY created_at DESC`,
    params
  );
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const { rows: scheduleRows } = await dbPool.query(
    `SELECT debt_id, amount, paid, paid_amount, due_date
     FROM debt_schedule
     WHERE owner_id = $1 AND debt_id = ANY($2::text[])`,
    [ownerId, ids]
  );
  const scheduleMap = new Map();
  scheduleRows.forEach((row) => {
    if (!scheduleMap.has(row.debt_id)) {
      scheduleMap.set(row.debt_id, []);
    }
    scheduleMap.get(row.debt_id).push(row);
  });
  return rows.map((row) => {
    const schedule = scheduleMap.get(row.id) || [];
    const plannedTotal =
      row.total_amount !== null && row.total_amount !== undefined && Number(row.total_amount) > 0
        ? Number(row.total_amount)
        : schedule.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidTotal = schedule.reduce((sum, item) => {
      if (!item.paid) return sum;
      const value =
        item.paid_amount !== null && item.paid_amount !== undefined
          ? Number(item.paid_amount)
          : Number(item.amount || 0);
      return sum + value;
    }, 0);
    const remaining = Math.max(0, plannedTotal - paidTotal);
    const nextPayment = schedule
      .filter((item) => !item.paid && item.due_date)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      principalAmount:
        row.principal_amount !== null && row.principal_amount !== undefined
          ? Number(row.principal_amount)
          : 0,
      totalAmount: plannedTotal,
      paidTotal,
      remaining,
      currencyCode: row.currency_code || null,
      issuedDate: row.issued_date ? new Date(row.issued_date).toISOString() : null,
      dueDate: row.due_date ? new Date(row.due_date).toISOString() : null,
      rate: row.rate !== null && row.rate !== undefined ? Number(row.rate) : null,
      termMonths: row.term_months !== null && row.term_months !== undefined ? Number(row.term_months) : null,
      paymentType: row.payment_type || null,
      notes: row.notes || "",
      scheduleEnabled: row.schedule_enabled !== false,
      paymentsCount:
        row.payments_count !== null && row.payments_count !== undefined
          ? Number(row.payments_count)
          : null,
      frequency: row.frequency || null,
      firstPaymentDate: row.first_payment_date
        ? new Date(row.first_payment_date).toISOString()
        : null,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
      nextPaymentDate: nextPayment?.due_date ? new Date(nextPayment.due_date).toISOString() : null,
      nextPaymentAmount:
        nextPayment?.amount !== null && nextPayment?.amount !== undefined
          ? Number(nextPayment.amount)
          : null,
    };
  });
}

async function listDebtSchedule({
  ownerId,
  debtId,
  limit = 200,
  search = null,
  before = null,
  from = null,
  to = null,
} = {}) {
  if (!ownerId || !debtId || !dbPool) return [];
  let query = `
    SELECT id, due_date, amount, paid, paid_amount, paid_at, note, created_at
    FROM debt_schedule
    WHERE owner_id = $1 AND debt_id = $2
  `;
  const params = [ownerId, debtId];
  if (search) {
    const like = `%${String(search).toLowerCase()}%`;
    params.push(like);
    const idx = params.length;
    query += ` AND (LOWER(COALESCE(note, '')) LIKE $${idx} OR CAST(amount AS text) LIKE $${idx})`;
  }
  if (from) {
    params.push(from);
    query += ` AND due_date >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    query += ` AND due_date <= $${params.length}`;
  }
  if (before) {
    params.push(before);
    query += ` AND due_date < $${params.length}`;
  }
  params.push(limit);
  query += ` ORDER BY due_date DESC NULLS LAST, created_at DESC LIMIT $${params.length}`;
  const { rows } = await dbPool.query(query, params);
  return rows.map((row) => ({
    id: row.id,
    dueDate: row.due_date ? new Date(row.due_date).toISOString() : null,
    amount: Number(row.amount),
    paid: row.paid === true,
    paidAmount:
      row.paid_amount !== null && row.paid_amount !== undefined
        ? Number(row.paid_amount)
        : null,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
    note: row.note || "",
    createdAt: row.created_at ? row.created_at.toISOString() : null,
  }));
}

async function getGoalTotal(ownerId, goalId, excludeId = null) {
  if (!dbPool) return 0;
  const params = [ownerId, goalId];
  let query =
    "SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS total FROM goal_transactions WHERE owner_id = $1 AND goal_id = $2";
  if (excludeId) {
    params.push(excludeId);
    query += ` AND id <> $${params.length}`;
  }
  const { rows } = await dbPool.query(query, params);
  const total = rows[0]?.total;
  return total !== null && total !== undefined ? Number(total) : 0;
}

async function upsertGoalTransferOperation(client, payload) {
  const {
    opId,
    ownerId,
    account,
    type,
    amount,
    createdAt,
    goalName,
    sourceId,
  } = payload;
  if (!client || !opId || !ownerId || !account) return;
  const amountValue = Number(amount || 0);
  const amountCents = Math.round(amountValue * 100);
  const label = goalName ? `Цель: ${goalName}` : "Цель";
  const flowLine = type === "income" ? `${account} → Цель` : `Цель → ${account}`;
  await client.query(
    `INSERT INTO operations (
        id, text, type, amount, amount_cents, category, account, account_specified,
        telegram_user_id, created_at, label, label_emoji, amount_text, flow_line, source_message_id,
        income_source, exclude_from_summary, source_type, source_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        type = EXCLUDED.type,
        amount = EXCLUDED.amount,
        amount_cents = EXCLUDED.amount_cents,
        category = EXCLUDED.category,
        account = EXCLUDED.account,
        account_specified = EXCLUDED.account_specified,
        created_at = EXCLUDED.created_at,
        label = EXCLUDED.label,
        label_emoji = EXCLUDED.label_emoji,
        amount_text = EXCLUDED.amount_text,
        flow_line = EXCLUDED.flow_line,
        income_source = EXCLUDED.income_source,
        exclude_from_summary = EXCLUDED.exclude_from_summary,
        source_type = EXCLUDED.source_type,
        source_id = EXCLUDED.source_id`,
    [
      opId,
      label,
      type,
      amountValue,
      amountCents,
      "Цели",
      account,
      true,
      ownerId,
      createdAt,
      label,
      null,
      null,
      flowLine,
      null,
      null,
      true,
      "goal",
      sourceId,
    ]
  );
}

async function deleteGoalTransferOperation(client, opId, ownerId) {
  if (!client || !opId || !ownerId) return;
  await client.query(
    "DELETE FROM operations WHERE id = $1 AND telegram_user_id = $2",
    [opId, ownerId]
  );
}

async function getTelegramVoiceText(fileId) {
  if (!TELEGRAM_API) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  const file = await telegramApi("getFile", { file_id: fileId });
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error("Failed to download voice file");
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return transcribeBuffer(buffer, file.file_path || "voice.ogg");
}

function formatAmount(amount, currencySymbol = "₽") {
  if (!Number.isFinite(amount)) return String(amount || "");
  const value = Number(amount);
  const abs = Math.abs(value);
  const rubles = Math.trunc(abs);
  const cents = Math.round((abs - rubles) * 100);
  const formattedRubles = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sign = value < 0 ? "-" : "";
  if (cents > 0) {
    return `${sign}${formattedRubles},${String(cents).padStart(2, "0")}${currencySymbol}`;
  }
  return `${sign}${formattedRubles}${currencySymbol}`;
}

function lemmatizeTokens(tokens) {
  if (!tokens || tokens.length === 0) return tokens;
  try {
    const result = spawnSync("python3", [LEMMATIZE_SCRIPT], {
      input: JSON.stringify({ tokens }),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    if (result.status === 0 && result.stdout) {
      const data = JSON.parse(result.stdout);
      if (Array.isArray(data.lemmas) && data.lemmas.length) {
        return data.lemmas;
      }
    } else if (result.status !== 0) {
      console.error("Lemmatize error:", result.stderr || "unknown error");
    }
  } catch (err) {
    console.error("Lemmatize failed:", err?.message || err);
  }
  return tokens;
}

function normalizeLemmaToken(token) {
  const lower = String(token || "").toLowerCase().replace(/ё/g, "е");
  const map = [
    { re: /^стоматолог/i, lemma: "стоматолог" },
    { re: /^медклиник/i, lemma: "медклиника" },
    { re: /^кружк/i, lemma: "кружок" },
    { re: /^плаван/i, lemma: "плавание" },
    { re: /^танц/i, lemma: "танцы" },
    { re: /^саш/i, lemma: "саша" },
  ];
  for (const item of map) {
    if (item.re.test(lower)) return item.lemma;
  }
  return lower || token;
}

function pickLabelEmoji(text) {
  const lower = String(text || "").toLowerCase().replace(/ё/g, "е");
  if (/кофе|кафе/.test(lower)) return "☕";
  if (/аптек|медиц|клин(ик|икa)|стоматолог/.test(lower)) return "💊";
  if (/такси/.test(lower)) return "🚕";
  if (/метро|автобус|транспорт|проезд/.test(lower)) return "🚌";
  if (/еда|обед|ужин|завтрак|пицц/.test(lower)) return "🍽️";
  if (/жиль|аренд|квартир|коммун|жкх/.test(lower)) return "🏠";
  if (/кино|игр|развлеч|музык/.test(lower)) return "🎬";
  if (/инвест|акци|облиг|крипт/.test(lower)) return "📈";
  return "🧾";
}

function extractLabel(text, parsed) {
  const amountWords = new Set([
    "ноль",
    "один",
    "одна",
    "одно",
    "два",
    "две",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьсот",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
    "тысяча",
    "тысячи",
    "тысяч",
    "тыща",
    "тыщи",
    "тыщ",
    "косарь",
    "косаря",
    "косарей",
    "миллион",
    "миллиона",
    "миллионов",
    "мульон",
    "мульен",
    "мульенов",
    "мильон",
    "мильен",
    "лимон",
  ]);

  const stopWords = new Set([
    "доход",
    "расход",
    "получил",
    "получила",
    "получили",
    "потратил",
    "потратила",
    "потратили",
    "купил",
    "купила",
    "купили",
    "оплатил",
    "оплатила",
    "оплатили",
    "аванс",
    "зарплата",
    "премия",
    "на",
    "за",
    "в",
    "во",
    "с",
    "со",
    "из",
    "по",
    "к",
    "от",
    "для",
    "это",
    "мне",
    "мой",
    "моя",
    "мое",
    "мою",
    "руб",
    "рубль",
    "рубля",
    "рублей",
    "руб.",
    "р",
    "р.",
    "коп",
    "копейка",
    "копейки",
    "копеек",
    "карта",
    "карты",
    "карте",
    "картой",
    "кошелек",
    "кошелька",
    "кошельке",
    "наличные",
    "наличка",
    "налом",
    "кэш",
    "кеш",
    "с",
    "по",
    "на",
  ]);

  const tokens = tokenizeWords(text);
  const filtered = tokens.filter((token) => {
    if (!token) return false;
    if (/^\d/.test(token)) return false;
    if (amountWords.has(token)) return false;
    if (stopWords.has(token)) return false;
    if (/^налич/i.test(token)) return false;
    if (/^кошел/i.test(token)) return false;
    if (/^карт/i.test(token)) return false;
    if (/^(тыс|тыщ|кк|косар|млн|миллион|муль|миль|лимон)/i.test(token)) return false;
    return true;
  });

  const lemmas = lemmatizeTokens(filtered)
    .filter(Boolean)
    .map(normalizeLemmaToken)
    .filter((lemma) => !/^коп/i.test(lemma));
  const label = lemmas.join(" ").trim();
  if (!label) {
    const fallback = pickFallbackLabel(text);
    if (fallback) return fallback;
    return parsed?.category ? parsed.category : "Операция";
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function pickFallbackLabel(text) {
  const lower = String(text || "").toLowerCase().replace(/ё/g, "е");
  const map = [
    { re: /зарплат/i, label: "Зарплата" },
    { re: /\bзп\b/i, label: "Зарплата" },
    { re: /аванс/i, label: "Аванс" },
    { re: /преми/i, label: "Премия" },
    { re: /кэшбек|кешбек/i, label: "Кэшбек" },
    { re: /доход/i, label: "Доход" },
    { re: /возврат/i, label: "Возврат" },
  ];
  for (const item of map) {
    if (item.re.test(lower)) return item.label;
  }
  return null;
}

function buildDisplayFields(text, parsed, currencySymbol = "₽") {
  const label = extractLabel(text, parsed);
  const labelEmoji = pickLabelEmoji(text);
  const amountText = formatAmount(parsed.amount, currencySymbol);
  const flowLine =
    parsed.type === "income"
      ? `📉 Доход: ${parsed.account}`
      : `📈 Расход: ${parsed.account}`;
  return { label, labelEmoji, amountText, flowLine };
}

function tokenizeWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/i)
    .filter(Boolean);
}

function wordsToNumber(tokens) {
  const units = {
    ноль: 0,
    один: 1,
    одна: 1,
    одно: 1,
    два: 2,
    две: 2,
    три: 3,
    четыре: 4,
    пять: 5,
    шесть: 6,
    семь: 7,
    восемь: 8,
    девять: 9,
  };

  const teens = {
    десять: 10,
    одиннадцать: 11,
    двенадцать: 12,
    тринадцать: 13,
    четырнадцать: 14,
    пятнадцать: 15,
    шестнадцать: 16,
    семнадцать: 17,
    восемнадцать: 18,
    девятнадцать: 19,
  };

  const tens = {
    двадцать: 20,
    тридцать: 30,
    сорок: 40,
    пятьдесят: 50,
    шестьдесят: 60,
    семьдесят: 70,
    восемьдесят: 80,
    девяносто: 90,
  };

  const hundreds = {
    сто: 100,
    двести: 200,
    триста: 300,
    четыреста: 400,
    пятьсот: 500,
    шестьсот: 600,
    семьсот: 700,
    восемьсот: 800,
    девятьсот: 900,
  };

  const scales = {
    тысяча: 1000,
    тысячи: 1000,
    тысяч: 1000,
    тыща: 1000,
    тыщи: 1000,
    тыщ: 1000,
    косарь: 1000,
    косаря: 1000,
    косарей: 1000,
    миллион: 1000000,
    миллиона: 1000000,
    миллионов: 1000000,
    мульон: 1000000,
    мульен: 1000000,
    мульенов: 1000000,
    мильон: 1000000,
    мильен: 1000000,
    лимон: 1000000,
  };

  const hasScaleWord = tokens.some(
    (token) =>
      token in scales ||
      /^тыщ/i.test(token) ||
      /^косар/i.test(token) ||
      /^млн/i.test(token) ||
      /^миллион/i.test(token) ||
      /^муль/i.test(token) ||
      /^миль/i.test(token) ||
      /^лимон/i.test(token)
  );

  const computeNoScale = (list) => {
    let total = 0;
    let used = false;
    for (const token of list) {
      if (token in hundreds) {
        total += hundreds[token];
        used = true;
        continue;
      }
      if (token in teens) {
        total += teens[token];
        used = true;
        continue;
      }
      if (token in tens) {
        total += tens[token];
        used = true;
        continue;
      }
      if (token in units) {
        total += units[token];
        used = true;
      }
    }
    return { total, used };
  };

  if (!hasScaleWord && tokens.length >= 2 && tokens[0] in units && units[tokens[0]] > 0) {
    const rest = computeNoScale(tokens.slice(1));
    if (rest.used && rest.total >= 100) {
      return units[tokens[0]] * 1000 + rest.total;
    }
  }

  let total = 0;
  let current = 0;
  let used = false;

  for (const token of tokens) {
    if (token in hundreds) {
      current += hundreds[token];
      used = true;
      continue;
    }
    if (token in teens) {
      current += teens[token];
      used = true;
      continue;
    }
    if (token in tens) {
      current += tens[token];
      used = true;
      continue;
    }
    if (token in units) {
      current += units[token];
      used = true;
      continue;
    }
    if (token in scales || /^тыщ/i.test(token) || /^косар/i.test(token) || /^мул(ь|е)/i.test(token) || /^мил(ь|л)/i.test(token) || /^лимон/i.test(token)) {
      const scale =
        scales[token] ||
        (/^тыщ/i.test(token) || /^косар/i.test(token) ? 1000 : 1000000);
      if (current === 0) current = 1;
      total += current * scale;
      current = 0;
      used = true;
      continue;
    }
  }

  total += current;
  return used && total > 0 ? total : null;
}

function parseAmount(text) {
  let lower = String(text || "").toLowerCase().replace(/ё/g, "е");
  lower = lower.replace(/[\u00a0\u202f]/g, " ");
  const tokens = tokenizeWords(lower);
  const hasScaleWord = /(тыс|тысяч|тыщ|косар|млн|миллион|муль|миль|лимон)/i.test(lower);
  const largeAmountHints =
    /(зарплат|зп|аванс|преми|кэшбек|кешбек|доход|поступлен|поступило|перевод|возврат|инвест|вклад|аренд|ипотек|кредит|долг|квартир|дом|машин|авто|ремонт|продаж|покупк|услуг)/i.test(
      lower
    );
  const kopTokenIndex = tokens.findIndex((token) => /^коп/.test(token));
  if (kopTokenIndex !== -1) {
    const rubIndex = tokens.findIndex((token) => /^руб/.test(token) || token === "р");
    if (rubIndex !== -1 && rubIndex < kopTokenIndex) {
      const rubTokens = tokens.slice(0, rubIndex).filter((t) => !/^на$/.test(t));
      const kopTokens = tokens.slice(rubIndex + 1, kopTokenIndex);
      const rubValue = wordsToNumber(rubTokens);
      const kopValue = wordsToNumber(kopTokens);
      if (rubValue && Number.isFinite(kopValue)) {
        const kop = Math.max(0, Math.min(99, kopValue));
        return rubValue + kop / 100;
      }
    }
    const rubKopRe =
      /(\d[\d\s.,]*\d|\d)\s*(?:рубл[яей]?|р|₽)?[^\d]{0,10}(\d{1,2})\s*коп/;
    const match = lower.match(rubKopRe);
    if (match) {
      const rubRaw = match[1].replace(/[\s\u00a0\u202f]/g, "");
      const rub = Number(rubRaw.replace(/[.,]/g, ""));
      const kop = Number(match[2]);
      if (Number.isFinite(rub) && Number.isFinite(kop)) {
        return rub + Math.max(0, Math.min(99, kop)) / 100;
      }
    }
  }

  const strongIncomeHints = /(зарплат|зп|аванс|преми)/i.test(lower);
  if (strongIncomeHints) {
    const quickRe = /(\d[\d\s.,]*\d|\d)/g;
    let match;
    let best = null;
    while ((match = quickRe.exec(lower)) !== null) {
      const compact = match[1].replace(/[\s\u00a0\u202f]/g, "");
      const normalized = compact.replace(/[.,]/g, "");
      if (!/^\d+$/.test(normalized)) continue;
      if (normalized.length >= 5) {
        best = normalized;
        break;
      }
    }
    if (best) return Number(best);
  }

  const wordValue = wordsToNumber(tokens);
  if (wordValue) return wordValue;

  const candidateRe =
    /(\d[\d\s.,]*\d|\d)\s*(к|кк|тыс\.?|тысяч[а-я]*|тыщ[а-я]*|косар[а-я]*|млн|миллион[а-я]*|муль[её]н[а-я]*|миль[её]н[а-я]*|лимон[а-я]*)?/gi;
  const candidates = [];
  let match;
  while ((match = candidateRe.exec(lower)) !== null) {
    const rawNumber = match[1];
    const suffix = match[2] || "";
    const compact = rawNumber.replace(/[\s\u00a0\u202f]/g, "");
    let normalized = compact;
    if (/^\d{1,3}([.,]\d{3})+$/.test(compact)) {
      normalized = compact.replace(/[.,]/g, "");
    } else {
      normalized = compact.replace(",", ".");
    }
    let value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) continue;

    const hasSuffix =
      /^к$/i.test(suffix) ||
      /^кк$/i.test(suffix) ||
      /^тыс/i.test(suffix) ||
      /^тыщ/i.test(suffix) ||
      /^косар/i.test(suffix) ||
      /^млн/i.test(suffix) ||
      /^миллион/i.test(suffix) ||
      /^муль/i.test(suffix) ||
      /^миль/i.test(suffix) ||
      /^лимон/i.test(suffix);

    if (/^к$/i.test(suffix) || /^тыс/i.test(suffix) || /^тыщ/i.test(suffix) || /^косар/i.test(suffix))
      value *= 1000;
    if (
      /^кк$/i.test(suffix) ||
      /^млн/i.test(suffix) ||
      /^миллион/i.test(suffix) ||
      /^муль/i.test(suffix) ||
      /^миль/i.test(suffix) ||
      /^лимон/i.test(suffix)
    )
      value *= 1000000;

    const hasGrouping = /[ \t.,]/.test(rawNumber) && /\d{1,3}([ \t.,]\d{3})+/.test(rawNumber);
    if (
      !hasScaleWord &&
      !largeAmountHints &&
      !hasSuffix &&
      hasGrouping &&
      /\b000$/.test(normalized) &&
      value >= 100000
    ) {
      value = value / 1000;
    }

    const digitsCount = compact.replace(/[.,]/g, "").length;
    const context = lower.slice(
      Math.max(0, match.index - 8),
      match.index + rawNumber.length + 8
    );
    const hasCurrency = /руб|₽|\bр\b|рубл/i.test(context);
    let score = digitsCount;
    if (hasSuffix) score += 4;
    if (hasCurrency) score += 3;
    if (value >= 1000) score += 1;
    candidates.push({ value, score, index: match.index });
  }
  if (candidates.length) {
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.index - a.index;
    });
    let best = candidates[0].value;
    if (
      !hasScaleWord &&
      !largeAmountHints &&
      best >= 100000 &&
      best % 1000 === 0 &&
      best <= 10000000
    ) {
      best = best / 1000;
    }
    return best;
  }

  return null;
}

const incomePatterns = [
  /зарплат/i,
  /\bзп\b/i,
  /аванс/i,
  /преми/i,
  /кэшбек|кешбек/i,
  /возврат/i,
  /поступлен/i,
  /доход/i,
  /прибыл/i,
  /получил|получила|получили/i,
  /поступило|пришли|пришел|пришла/i,
  /перевод от/i,
  /оплата от/i,
];

const expensePatterns = [
  /потрат/i,
  /купил|купила|купили/i,
  /расход/i,
  /оплатил|оплатила/i,
  /подписк/i,
  /комисс/i,
  /снял|сняла/i,
  /платеж|платёж/i,
  /перевел|перевела/i,
  /списан|списали/i,
];

function parseOperation(
  text,
  categoriesList = defaultCategories,
  accountsList = defaultAccounts,
  incomeSourcesList = defaultIncomeSources
) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase().replace(/ё/g, "е");
  const amount = parseAmount(raw);
  if (!amount) return null;

  let type = "expense";
  const incomeHit = incomePatterns.some((re) => re.test(lower));
  const expenseHit = expensePatterns.some((re) => re.test(lower));
  if (incomeHit && !expenseHit) type = "income";
  if (expenseHit && !incomeHit) type = "expense";
  if (incomeHit && expenseHit) {
    if (/(зарплат|зп|аванс|преми|кэшбек|возврат|поступлен|доход|прибыл)/.test(lower)) {
      type = "income";
    }
  }

  let category = "Другое";
  let incomeSource = null;
  if (type === "income") {
    const incomeNames = Array.isArray(incomeSourcesList)
      ? incomeSourcesList
          .map((src) => (typeof src === "string" ? src : src?.name))
          .filter(Boolean)
      : defaultIncomeSources;
    const matched = incomeNames.find((name) =>
      lower.includes(String(name).toLowerCase().replace(/ё/g, "е"))
    );
    if (matched) {
      incomeSource = matched;
    } else {
      incomeSource =
        incomeNames.find((name) =>
          String(name).toLowerCase().replace(/ё/g, "е").includes("проч")
        ) ||
        incomeNames.find((name) =>
          String(name).toLowerCase().replace(/ё/g, "е").includes("друг")
        ) ||
        incomeNames[0] ||
        "Прочее";
    }
    category = incomeSource || "Прочее";
  } else {
    for (const c of categoriesList) {
      if (c.keywords && c.keywords.some((k) => lower.includes(k))) {
        category = c.name;
        break;
      }
      if (!c.keywords && c.name && c.name !== "Другое") {
        const nameLower = String(c.name).toLowerCase().replace(/ё/g, "е");
        if (nameLower && lower.includes(nameLower)) {
          category = c.name;
          break;
        }
      }
    }
  }

  const accountNames = Array.isArray(accountsList)
    ? accountsList
        .map((acc) => (typeof acc === "string" ? acc : acc.name))
        .filter(Boolean)
    : defaultAccounts;
  const defaultAccount = accountNames[0] || "Наличные";
  let account = defaultAccount;
  let accountSpecified = false;
  const cardAccount = accountNames.find((name) => /карт/i.test(name));
  const cashAccount = accountNames.find((name) =>
    /(кошел|налич|налом|кеш|кэш)/i.test(name)
  );
  if (/(карта|с карты|по карте|на карту)/.test(lower) && cardAccount) {
    account = cardAccount;
    accountSpecified = true;
  }
  if (/(налич|кошел|налом|кеш|кэш)/.test(lower) && cashAccount) {
    account = cashAccount;
    accountSpecified = true;
  }

  const amountCents = Math.round(amount * 100);

  return {
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: raw,
    type,
    amount,
    amountCents,
    category,
    account,
    accountSpecified,
    incomeSource,
    createdAt: new Date().toISOString(),
  };
}

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Audio file is required" });
  }

  try {
    const buffer = await fs.promises.readFile(req.file.path);
    const text = await transcribeBuffer(buffer, req.file.originalname || "audio.webm");
    res.json({ text });
  } catch (err) {
    console.error("Transcription failed:", {
      status: err?.status,
      message: err?.message,
      error: err?.error,
    });
    res.status(500).json({
      error: "Transcription failed",
      details: err?.message || "Unknown error",
    });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.post("/api/operations", async (req, res) => {
  const { text, category, account, type, amount, label, incomeSource, date } = req.body || {};
  const owner = getOwnerFromRequest(req);
  if (owner?.error) {
    return res.status(401).json({ error: "Invalid Telegram data" });
  }
  if (!owner?.ownerId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const categoriesList = await getCategoriesForOwner(owner.ownerId);
  const accountsList = await getAccountsForOwner(owner.ownerId);
  const incomeSourcesList = await getIncomeSourcesForOwner(owner.ownerId);

  if (!text) {
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue)) {
      return res.status(400).json({ error: "Amount is required" });
    }
    const typeValue = String(type || "expense");
    const accountMatch = account
      ? accountsList.find(
          (a) => String(a.name).toLowerCase() === String(account).toLowerCase()
        )
      : null;
    const defaultAccount = accountsList[0]?.name || "Наличные";
    const accountName = accountMatch?.name || defaultAccount;
    const pickIncomeSourceName = () => {
      if (incomeSource) return incomeSource;
      if (category) return category;
      if (label) return label;
      return "Прочее";
    };
    const incomeNames = incomeSourcesList.map((s) => s.name);
    const incomeMatch = incomeNames.find(
      (name) => String(name).toLowerCase() === String(pickIncomeSourceName()).toLowerCase()
    );
    const resolvedIncomeSource =
      typeValue === "income"
        ? incomeMatch ||
          incomeNames.find((name) =>
            String(name).toLowerCase().includes("проч")
          ) ||
          incomeNames[0] ||
          "Прочее"
        : null;
    const resolvedCategory =
      typeValue === "income"
        ? resolvedIncomeSource || "Прочее"
        : category ||
          categoriesList.find((c) => c.name)?.name ||
          "Другое";
    const opLabel =
      String(label || "").trim() ||
      (typeValue === "income" ? resolvedIncomeSource : resolvedCategory) ||
      "Операция";
    const parseDateOnly = (value) => {
      if (!value) return null;
      const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        return new Date(Date.UTC(year, month, day, 12, 0, 0));
      }
      const dateParsed = new Date(value);
      if (Number.isNaN(dateParsed.getTime())) return null;
      return dateParsed;
    };
    const createdAt = parseDateOnly(date) || new Date();
    const op = {
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: opLabel,
      type: typeValue,
      amount: amountValue,
      amountCents: Math.round(amountValue * 100),
      category: resolvedCategory,
      account: accountName,
      accountSpecified: Boolean(accountMatch),
      incomeSource: resolvedIncomeSource,
      createdAt: createdAt.toISOString(),
      telegramUserId: owner.ownerId,
    };
    const settings = await getUserSettings(owner.ownerId);
    const currencySymbol = getCurrencySymbol(settings.currencyCode);
    Object.assign(op, buildDisplayFields(opLabel, op, currencySymbol));
    try {
      await saveOperation(op);
      return res.json(op);
    } catch (err) {
      console.error("Save operation failed:", err?.message || err);
      return res.status(500).json({ error: "Failed to save operation" });
    }
  }

  const parsed = parseOperation(text, categoriesList, accountsList, incomeSourcesList);
  if (!parsed) {
    return res.status(400).json({ error: "Could not parse operation" });
  }
  parsed.telegramUserId = owner.ownerId;
  if (category) {
    const match = categoriesList.find(
      (c) => String(c.name).toLowerCase() === String(category).toLowerCase()
    );
    if (match) parsed.category = match.name;
  }
  if (account) {
    const acc = accountsList.find(
      (a) => String(a.name).toLowerCase() === String(account).toLowerCase()
    );
    if (acc) {
      parsed.account = acc.name;
      parsed.accountSpecified = true;
    }
  }
  const settings = await getUserSettings(owner.ownerId);
  const currencySymbol = getCurrencySymbol(settings.currencyCode);
  Object.assign(parsed, buildDisplayFields(text, parsed, currencySymbol));
  try {
    await saveOperation(parsed);
    res.json(parsed);
  } catch (err) {
    console.error("Save operation failed:", err?.message || err);
    res.status(500).json({ error: "Failed to save operation" });
  }
});

app.post("/telegram/webhook", (req, res) => {
  if (process.env.TELEGRAM_WEBHOOK_SECRET) {
    const secret = req.header("x-telegram-bot-api-secret-token");
    if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return res.sendStatus(401);
    }
  }

  res.sendStatus(200);
  const update = req.body || {};
  setImmediate(async () => {
    try {
      if (!shouldProcessUpdate(update)) return;
      if (update.callback_query) {
        const cq = update.callback_query;
        const chatId = cq.message?.chat?.id;
        const data = cq.data || "";
        if (!chatId) return;

        if (data.startsWith("editfield:")) {
          const [_, field, opId] = data.split(":");
          const ownerId = cq.from?.id ? String(cq.from.id) : null;
          if (!opId || !ownerId) {
            await telegramApi("answerCallbackQuery", { callback_query_id: cq.id });
            return;
          }
          await safeDeleteMessage(chatId, cq.message?.message_id);
          if (field === "account") {
            const accountsList = await getAccountsForOwner(ownerId);
            await telegramApi("answerCallbackQuery", {
              callback_query_id: cq.id,
            });
            await telegramApi("sendMessage", {
              chat_id: chatId,
              text: "Выбери счет:",
              reply_markup: {
                inline_keyboard: [
                  accountsList.map((acc) => ({
                    text: acc.name,
                    callback_data: `setaccount:${opId}:${acc.name}`,
                  })),
                ],
              },
            });
            return;
          }
          if (field === "category") {
            const op = await getEditableOperation(opId, ownerId);
            const categoriesList =
              op?.type === "income"
                ? await getIncomeSourcesForOwner(ownerId)
                : await getCategoriesForOwner(ownerId);
            await telegramApi("answerCallbackQuery", {
              callback_query_id: cq.id,
            });
            await telegramApi("sendMessage", {
              chat_id: chatId,
              text: op?.type === "income" ? "Выбери источник дохода:" : "Выбери категорию:",
              reply_markup: {
                inline_keyboard: [
                  categoriesList.map((cat) => ({
                    text: cat.name,
                    callback_data: `setcategory:${opId}:${cat.name}`,
                  })),
                ],
              },
            });
            return;
          }
          pendingEdits.set(chatId, { opId, ownerId, field });
          await telegramApi("answerCallbackQuery", {
            callback_query_id: cq.id,
          });
          const prompt =
            field === "name"
              ? "Напиши новое наименование."
              : "Напиши новую сумму, например: 450 или 450.50";
          const promptMessage = await telegramApi("sendMessage", {
            chat_id: chatId,
            text: prompt,
          });
          pendingEdits.set(chatId, {
            opId,
            ownerId,
            field,
            promptMessageId: promptMessage?.message_id,
          });
          return;
        }
        if (data.startsWith("confirm:")) {
          const opId = data.replace("confirm:", "").trim();
          const ownerId = cq.from?.id ? String(cq.from.id) : null;
          const staged = pendingEditConfirm.get(opId);
          await telegramApi("answerCallbackQuery", {
            callback_query_id: cq.id,
          });
          await safeDeleteMessage(chatId, cq.message?.message_id);
          if (!staged || staged.ownerId !== ownerId) {
            await telegramApi("sendMessage", {
              chat_id: chatId,
              text: "Не удалось подтвердить операцию.",
            });
            return;
          }
          await updateOperation(staged.op, ownerId);
          await safeDeleteMessage(chatId, staged.sourceUserMessageId);
          operationSourceMessages.delete(opId);
          pendingEditConfirm.delete(opId);
          const messageText =
            `${staged.op.labelEmoji} ${staged.op.label}\n` +
            `💸 ${staged.op.amountText}\n` +
            `${staged.op.flowLine}\n` +
            `🗂️ Категория: ${staged.op.category}`;
          await telegramApi("sendMessage", {
            chat_id: chatId,
            text: messageText,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✏️ Исправить", callback_data: `edit:${staged.op.id}` },
                  { text: "🗑️ Удалить", callback_data: `delete:${staged.op.id}` },
                ],
              ],
            },
          });
          return;
        }
        if (data.startsWith("setaccount:")) {
          const parts = data.split(":");
          const opId = parts[1];
          const accountName = parts.slice(2).join(":");
          const ownerId = cq.from?.id ? String(cq.from.id) : null;
          const op = await getEditableOperation(opId, ownerId);
          await telegramApi("answerCallbackQuery", {
            callback_query_id: cq.id,
          });
          await safeDeleteMessage(chatId, cq.message?.message_id);
          if (!op) {
            await telegramApi("sendMessage", {
              chat_id: chatId,
              text: "Не удалось найти операцию.",
            });
            return;
          }
          const settings = await getUserSettings(ownerId);
          op.account = accountName;
          op.accountSpecified = true;
          op.amountText = formatAmount(op.amount, getCurrencySymbol(settings.currencyCode));
          op.flowLine = op.type === "income" ? `📉 Доход: ${op.account}` : `📈 Расход: ${op.account}`;
          await sendEditPreview(chatId, ownerId, op);
          return;
        }
        if (data.startsWith("setcategory:")) {
          const parts = data.split(":");
          const opId = parts[1];
          const categoryName = parts.slice(2).join(":");
          const ownerId = cq.from?.id ? String(cq.from.id) : null;
          const op = await getEditableOperation(opId, ownerId);
          await telegramApi("answerCallbackQuery", {
            callback_query_id: cq.id,
          });
          await safeDeleteMessage(chatId, cq.message?.message_id);
          if (!op) {
            await telegramApi("sendMessage", {
              chat_id: chatId,
              text: "Не удалось найти операцию.",
            });
            return;
          }
          const settings = await getUserSettings(ownerId);
          if (op.type === "income") {
            op.incomeSource = categoryName;
            op.category = categoryName;
          } else {
            op.category = categoryName;
          }
          op.amountText = formatAmount(op.amount, getCurrencySymbol(settings.currencyCode));
          await sendEditPreview(chatId, ownerId, op);
          return;
        }
        if (data.startsWith("edit:")) {
          await safeDeleteMessage(chatId, cq.message?.message_id);
          pendingEdits.set(chatId, {
            opId: data.replace("edit:", "").trim(),
            ownerId: cq.from?.id ? String(cq.from.id) : null,
          });
          await telegramApi("answerCallbackQuery", {
            callback_query_id: cq.id,
          });
          await telegramApi("sendMessage", {
            chat_id: chatId,
            text: "Что исправить?",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Наименование", callback_data: `editfield:name:${data.replace("edit:", "").trim()}` },
                  { text: "Сумма", callback_data: `editfield:amount:${data.replace("edit:", "").trim()}` },
                ],
                [
                  { text: "Счет", callback_data: `editfield:account:${data.replace("edit:", "").trim()}` },
                  { text: "Категория", callback_data: `editfield:category:${data.replace("edit:", "").trim()}` },
                ],
              ],
            },
          });
          return;
        }
        if (data.startsWith("delete:")) {
          const opId = data.replace("delete:", "").trim();
          const ownerId = cq.from?.id ? String(cq.from.id) : null;
          const deleted = await deleteOperationById(opId, ownerId);
          await telegramApi("answerCallbackQuery", {
            callback_query_id: cq.id,
          });
          await safeDeleteMessage(chatId, cq.message?.message_id);
          pendingEditConfirm.delete(opId);
          operationSourceMessages.delete(opId);
          await telegramApi("sendMessage", {
            chat_id: chatId,
            text: deleted ? "Удалил операцию." : "Не удалось найти операцию.",
          });
          return;
        }
        if (data.startsWith("account:")) {
          const account = data.replace("account:", "").trim();
          const pending = pendingOperations.get(chatId);
          if (!pending) {
            await telegramApi("answerCallbackQuery", {
              callback_query_id: cq.id,
              text: "Операция не найдена. Отправь сообщение еще раз.",
              show_alert: true,
            });
            return;
          }

          pending.parsed.account = account;
          pending.parsed.accountSpecified = true;
          if (!pending.parsed.telegramUserId && cq.from?.id) {
            pending.parsed.telegramUserId = String(cq.from.id);
          }
          const settings = pending.parsed.telegramUserId
            ? await getUserSettings(pending.parsed.telegramUserId)
            : { currencyCode: "RUB" };
          const currencySymbol = getCurrencySymbol(settings.currencyCode);
          Object.assign(
            pending.parsed,
            buildDisplayFields(pending.text, pending.parsed, currencySymbol)
          );
          try {
            if (pending.editId) {
              await updateOperation(pending.parsed, pending.ownerId);
            } else {
              pending.parsed.sourceMessageId = pending.sourceUserMessageId;
              await saveOperation(pending.parsed);
              operationSourceMessages.set(pending.parsed.id, {
                chatId,
                messageId: pending.sourceUserMessageId,
              });
            }
          } catch (err) {
            console.error("Save operation failed:", err?.message || err);
          }
          const messageText =
            `${pending.parsed.labelEmoji} ${pending.parsed.label}\n` +
            `💸 ${pending.parsed.amountText}\n` +
            `${pending.parsed.flowLine}\n` +
            `🗂️ Категория: ${pending.parsed.category}`;

          await telegramApi("sendMessage", {
            chat_id: chatId,
            text: messageText,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✏️ Исправить", callback_data: `edit:${pending.parsed.id}` },
                  { text: "🗑️ Удалить", callback_data: `delete:${pending.parsed.id}` },
                ],
              ],
            },
          });
          await telegramApi("answerCallbackQuery", {
            callback_query_id: cq.id,
          });
          await safeDeleteMessage(chatId, pending.promptMessageId);
          pendingOperations.delete(chatId);
          return;
        }
        if (data === "onboard:yes") {
          await telegramApi("answerCallbackQuery", {
            callback_query_id: cq.id,
          });
          const promptMessage = await telegramApi("sendMessage", {
            chat_id: chatId,
            text: 'Запиши мне голосовое или отправь текстом "Кофе капучино 200".',
          });
          if (cq.from?.id) {
            const ownerId = String(cq.from.id);
            const ids = await getOnboardingMessageIds(ownerId);
            await updateOnboardingMessageIds(
              ownerId,
              ids.greetingId,
              promptMessage?.message_id || null
            );
          }
          return;
        }
        return;
      }

      const message = update.message || update.edited_message;
      if (!message) return;

      const chatId = message.chat?.id;
      if (!chatId) return;
      const telegramUserId = message.from?.id ? String(message.from.id) : null;
      const editContext = pendingEdits.get(chatId);
      const effectiveOwnerId = editContext?.ownerId || telegramUserId;

      let text = "";
      if (message.text) {
        text = message.text;
      } else if (message.voice?.file_id) {
        text = await getTelegramVoiceText(message.voice.file_id);
      }

      if (!text) {
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: "Не удалось распознать сообщение. Попробуй еще раз.",
        });
        return;
      }

      if (message.text && message.text.trim() === "/start") {
        await clearOnboardingMessages(chatId, telegramUserId);
        const greetingMessage = await telegramApi("sendMessage", {
          chat_id: chatId,
          text: "Привет! Давай устроим порядок в твоих финансах?",
          reply_markup: {
            inline_keyboard: [[{ text: "Давай", callback_data: "onboard:yes" }]],
          },
        });
        if (telegramUserId) {
          await updateOnboardingMessageIds(
            telegramUserId,
            greetingMessage?.message_id || null,
            null
          );
        }
        await safeDeleteMessage(chatId, message.message_id);
        return;
      }

      await clearOnboardingMessages(chatId, telegramUserId);

      if (editContext?.opId && editContext?.field) {
        const op = await getEditableOperation(editContext.opId, effectiveOwnerId);
        if (!op) {
          pendingEdits.delete(chatId);
          await telegramApi("sendMessage", {
            chat_id: chatId,
            text: "Не удалось найти операцию.",
          });
          return;
        }
        const settings = effectiveOwnerId
          ? await getUserSettings(effectiveOwnerId)
          : { currencyCode: "RUB" };
        const currencySymbol = getCurrencySymbol(settings.currencyCode);
        if (editContext.field === "name") {
          const labelRaw = String(text || "").trim();
          if (!labelRaw) {
            await telegramApi("sendMessage", {
              chat_id: chatId,
              text: "Не вижу наименование. Напиши еще раз.",
            });
            return;
          }
          const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
          op.label = label;
          op.labelEmoji = pickLabelEmoji(label);
          op.text = label;
        }
        if (editContext.field === "amount") {
          const amount = parseAmount(text);
          if (!amount) {
            await telegramApi("sendMessage", {
              chat_id: chatId,
              text: "Не понял сумму. Напиши только цифры, например: 450 или 450.50",
            });
            return;
          }
          op.amount = amount;
          op.amountCents = Math.round(amount * 100);
        }
        op.amountText = formatAmount(op.amount, currencySymbol);
        op.flowLine =
          op.type === "income" ? `📉 Доход: ${op.account}` : `📈 Расход: ${op.account}`;
        pendingEdits.delete(chatId);
        await safeDeleteMessage(chatId, editContext.promptMessageId);
        await safeDeleteMessage(chatId, message.message_id);
        await sendEditPreview(chatId, effectiveOwnerId, op, {
          sourceUserMessageId: message.message_id,
        });
        return;
      }

      const categoriesList = effectiveOwnerId
        ? await getCategoriesForOwner(effectiveOwnerId)
        : defaultCategories;
      const accountsList = effectiveOwnerId
        ? await getAccountsForOwner(effectiveOwnerId)
        : defaultAccounts.map((name, index) => ({ id: `acc_default_${index}`, name }));
      const incomeSourcesList = effectiveOwnerId
        ? await getIncomeSourcesForOwner(effectiveOwnerId)
        : defaultIncomeSources;
      const parsed = parseOperation(text, categoriesList, accountsList, incomeSourcesList);
      if (!parsed) {
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: "Не понял сумму. Напиши проще, например: \"потратил 350 на кофе\".",
        });
        return;
      }
      if (effectiveOwnerId) {
        parsed.telegramUserId = effectiveOwnerId;
      }
      if (editContext?.opId) {
        parsed.id = editContext.opId;
      }

      const settings = effectiveOwnerId
        ? await getUserSettings(effectiveOwnerId)
        : { currencyCode: "RUB" };
      const currencySymbol = getCurrencySymbol(settings.currencyCode);
      const label = extractLabel(text, parsed);
      if (!parsed.accountSpecified) {
        pendingOperations.set(chatId, {
          parsed,
          label,
          text,
          currencySymbol,
          editId: editContext?.opId || null,
          ownerId: effectiveOwnerId,
          sourceUserMessageId: message.message_id,
        });
        pendingEdits.delete(chatId);
        const prompt =
          parsed.type === "income"
            ? "Уточни, куда зачислить:"
            : "Уточни, с какого счета списать:";
        const promptMessage = await telegramApi("sendMessage", {
          chat_id: chatId,
          text: prompt,
          reply_markup: {
            inline_keyboard: [
              accountsList.map((acc) => ({
                text: acc.name,
                callback_data: `account:${acc.name}`,
              })),
            ],
          },
        });
        pendingOperations.get(chatId).promptMessageId = promptMessage?.message_id;
        return;
      }

      Object.assign(parsed, buildDisplayFields(text, parsed, currencySymbol));
      try {
        if (editContext?.opId) {
          await updateOperation(parsed, effectiveOwnerId);
        } else {
          parsed.sourceMessageId = message.message_id;
          await saveOperation(parsed);
          operationSourceMessages.set(parsed.id, {
            chatId,
            messageId: message.message_id,
          });
        }
      } catch (err) {
        console.error("Save operation failed:", err?.message || err);
      }
      pendingEdits.delete(chatId);
      const messageText =
        `${parsed.labelEmoji} ${label}\n` +
        `💸 ${parsed.amountText}\n` +
        `${parsed.flowLine}\n` +
        `🗂️ Категория: ${parsed.category}`;
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: messageText,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✏️ Исправить", callback_data: `edit:${parsed.id}` },
              { text: "🗑️ Удалить", callback_data: `delete:${parsed.id}` },
            ],
          ],
        },
      });
    } catch (err) {
      console.error("Telegram webhook error:", err?.message || err);
    }
  });
});

app.get("/api/operations", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.json([]);
    }
    const settings = await getUserSettings(owner.ownerId);
    const currencySymbol = getCurrencySymbol(settings.currencyCode);
    const limitRaw = Number(req.query?.limit || 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const account = req.query?.account ? String(req.query.account) : null;
    const type = req.query?.type ? String(req.query.type) : null;
    const category = req.query?.category ? String(req.query.category) : null;
    const search = req.query?.q ? String(req.query.q) : req.query?.search ? String(req.query.search) : null;
    const incomeSource = req.query?.incomeSource
      ? String(req.query.incomeSource)
      : null;
    const includeInternal =
      req.query?.includeInternal === "1" ||
      req.query?.includeInternal === "true";
    const parseDateParam = (value) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString();
    };
    const before = parseDateParam(req.query?.before);
    const from = parseDateParam(req.query?.from);
    const to = parseDateParam(req.query?.to);
    const data = await listOperations({
      limit,
      telegramUserId: owner.ownerId,
      account,
      type,
      category,
      incomeSource,
      includeInternal,
      search,
      before,
      from,
      to,
    });
    const withCurrency = data.map((op) => ({
      ...op,
      amountText: formatAmount(op.amount, currencySymbol),
    }));
    res.json(withCurrency);
  } catch (err) {
    console.error("Load operations failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load operations" });
  }
});

app.put("/api/operations/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    const labelInput = String(req.body?.label || "").trim();
    const category = String(req.body?.category || "").trim();
    const account = String(req.body?.account || "").trim();
    const incomeSourceInput = String(req.body?.incomeSource || "").trim();
    const amountValue = Number(req.body?.amount);
    const dateInput = String(req.body?.date || "").trim();
    if (!id || !account || !Number.isFinite(amountValue)) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const existing = await getOperationById(id, owner.ownerId);
    if (!existing) {
      return res.status(404).json({ error: "Operation not found" });
    }
    const settings = await getUserSettings(owner.ownerId);
    const currencySymbol = getCurrencySymbol(settings.currencyCode);
    if (existing.type !== "income" && !category) {
      return res.status(400).json({ error: "Category is required" });
    }
    const resolvedIncomeSource =
      existing.type === "income"
        ? incomeSourceInput || existing.incomeSource || category || "Прочее"
        : null;
    const resolvedCategory =
      existing.type === "income" ? resolvedIncomeSource || category : category;
    const label =
      labelInput ||
      (existing.type === "income" ? resolvedIncomeSource : null) ||
      existing.label ||
      existing.text ||
      "Операция";
    const labelEmoji = pickLabelEmoji(label);
    const amountCents = Math.round(amountValue * 100);
    const flowLine =
      existing.type === "income"
        ? `📉 Доход: ${account}`
        : `📈 Расход: ${account}`;
    const amountText = formatAmount(amountValue, currencySymbol);
    const parseDateOnly = (value) => {
      if (!value) return null;
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        return new Date(Date.UTC(year, month, day, 12, 0, 0));
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    };
    const createdAt = dateInput ? parseDateOnly(dateInput) : null;

    if (!dbPool) {
      const idx = memoryOperations.findIndex(
        (op) =>
          op.id === id &&
          String(op.telegramUserId || "") === String(owner.ownerId || "")
      );
      if (idx === -1) return res.status(404).json({ error: "Operation not found" });
    const updated = {
        ...memoryOperations[idx],
        text: label,
        amount: amountValue,
        amountCents,
        category: resolvedCategory,
        account,
        accountSpecified: true,
        label,
        labelEmoji,
        amountText,
        flowLine,
        incomeSource: resolvedIncomeSource,
        createdAt: createdAt || memoryOperations[idx].createdAt,
      };
      memoryOperations[idx] = updated;
      return res.json(updated);
    }

    const setParts = [
      "text=$1",
      "type=$2",
      "amount=$3",
      "amount_cents=$4",
      "category=$5",
      "account=$6",
      "account_specified=$7",
      "label=$8",
      "label_emoji=$9",
      "amount_text=$10",
      "flow_line=$11",
      "income_source=$12",
    ];
    const values = [
      label,
      existing.type,
      amountValue,
      amountCents,
      resolvedCategory,
      account,
      true,
      label,
      labelEmoji,
      amountText,
      flowLine,
      resolvedIncomeSource,
    ];
    if (createdAt) {
      values.push(createdAt);
      setParts.push(`created_at=$${values.length}`);
    }
    values.push(id, owner.ownerId);
    const idPos = values.length - 1;
    const ownerPos = values.length;
    const result = await dbPool.query(
      `
      UPDATE operations
      SET ${setParts.join(", ")}
      WHERE id = $${idPos} AND telegram_user_id = $${ownerPos}
      RETURNING id, text, type, amount, amount_cents, category, account, account_specified,
                telegram_user_id, created_at, label, label_emoji, amount_text, flow_line,
                source_message_id, income_source
    `,
      values
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Operation not found" });
    }
    const row = result.rows[0];
    res.json({
      id: row.id,
      text: row.text,
      type: row.type,
      amount:
        row.amount_cents !== null && row.amount_cents !== undefined
          ? Number(row.amount_cents) / 100
          : Number(row.amount),
      amountCents:
        row.amount_cents !== null && row.amount_cents !== undefined
          ? Number(row.amount_cents)
          : Math.round(Number(row.amount) * 100),
      category: row.category,
      account: row.account,
      accountSpecified: row.account_specified,
      telegramUserId: row.telegram_user_id,
      createdAt: row.created_at,
      label: row.label,
      labelEmoji: row.label_emoji,
      amountText: row.amount_text,
      flowLine: row.flow_line,
      sourceMessageId: row.source_message_id,
      incomeSource: row.income_source || null,
    });
  } catch (err) {
    console.error("Update operation failed:", err?.message || err);
    res.status(500).json({ error: "Failed to update operation" });
  }
});

app.delete("/api/operations/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const deleted = await deleteOperationById(id, owner.ownerId);
    if (!deleted) {
      return res.status(404).json({ error: "Operation not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete operation failed:", err?.message || err);
    res.status(500).json({ error: "Failed to delete operation" });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const categoriesList = await getCategoriesForOwner(owner.ownerId);
    res.json(
      categoriesList.map((c) => ({
        id: c.id,
        name: c.name,
        budget: c.budget ?? null,
      }))
    );
  } catch (err) {
    console.error("Load categories failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const budgetRaw = req.body?.budget;
    const budgetValue =
      budgetRaw === null || budgetRaw === undefined || budgetRaw === ""
        ? null
        : Number(budgetRaw);
    const budget = Number.isFinite(budgetValue) ? budgetValue : null;
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await dbPool.query(
      "INSERT INTO categories (id, owner_id, name, budget) VALUES ($1, $2, $3, $4)",
      [id, owner.ownerId, name, budget]
    );
    res.json({ id, name, budget });
  } catch (err) {
    console.error("Create category failed:", err?.message || err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    const name = String(req.body?.name || "").trim();
    const budgetRaw = req.body?.budget;
    const budgetValue =
      budgetRaw === null || budgetRaw === undefined || budgetRaw === ""
        ? null
        : Number(budgetRaw);
    const budget = Number.isFinite(budgetValue) ? budgetValue : null;
    if (!id || !name) {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const current = await dbPool.query(
      "SELECT name FROM categories WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!current.rows.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    const oldName = current.rows[0].name;
    const result = await dbPool.query(
      "UPDATE categories SET name = $1, budget = $2 WHERE id = $3 AND owner_id = $4",
      [name, budget, id, owner.ownerId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Category not found" });
    }
    await dbPool.query(
      "UPDATE operations SET category = $1 WHERE telegram_user_id = $2 AND type = 'expense' AND category = $3",
      [name, owner.ownerId, oldName]
    );
    res.json({ id, name, budget });
  } catch (err) {
    console.error("Update category failed:", err?.message || err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const current = await dbPool.query(
      "SELECT name FROM categories WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!current.rows.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    const fallback = await dbPool.query(
      "SELECT name FROM categories WHERE owner_id = $1 AND id <> $2 ORDER BY created_at ASC LIMIT 1",
      [owner.ownerId, id]
    );
    if (!fallback.rows.length) {
      return res.status(400).json({ error: "Cannot delete last category" });
    }
    const fallbackName = fallback.rows[0].name;
    await dbPool.query(
      "UPDATE operations SET category = $1 WHERE telegram_user_id = $2 AND type = 'expense' AND category = $3",
      [fallbackName, owner.ownerId, current.rows[0].name]
    );
    const result = await dbPool.query(
      "DELETE FROM categories WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ ok: true, reassignedTo: fallbackName });
  } catch (err) {
    console.error("Delete category failed:", err?.message || err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

app.get("/api/income-sources", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const list = await getIncomeSourcesForOwner(owner.ownerId);
    res.json(list.map((s) => ({ id: s.id, name: s.name })));
  } catch (err) {
    console.error("Load income sources failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load income sources" });
  }
});

app.post("/api/income-sources", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const id = `inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await dbPool.query(
      "INSERT INTO income_sources (id, owner_id, name) VALUES ($1, $2, $3)",
      [id, owner.ownerId, name]
    );
    res.json({ id, name });
  } catch (err) {
    console.error("Create income source failed:", err?.message || err);
    res.status(500).json({ error: "Failed to create income source" });
  }
});

app.put("/api/income-sources/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    const name = String(req.body?.name || "").trim();
    if (!id || !name) {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const current = await dbPool.query(
      "SELECT name FROM income_sources WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!current.rows.length) {
      return res.status(404).json({ error: "Income source not found" });
    }
    const oldName = current.rows[0].name;
    await dbPool.query(
      "UPDATE income_sources SET name = $1 WHERE id = $2 AND owner_id = $3",
      [name, id, owner.ownerId]
    );
    await dbPool.query(
      `UPDATE operations
       SET income_source = $1, category = CASE WHEN type = 'income' THEN $1 ELSE category END
       WHERE telegram_user_id = $2
         AND (income_source = $3 OR (income_source IS NULL AND category = $3))`,
      [name, owner.ownerId, oldName]
    );
    res.json({ id, name });
  } catch (err) {
    console.error("Update income source failed:", err?.message || err);
    res.status(500).json({ error: "Failed to update income source" });
  }
});

app.delete("/api/income-sources/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const sourceRow = await dbPool.query(
      "SELECT name FROM income_sources WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!sourceRow.rows.length) {
      return res.status(404).json({ error: "Income source not found" });
    }
    const fallback = await dbPool.query(
      "SELECT name FROM income_sources WHERE owner_id = $1 AND id <> $2 ORDER BY created_at ASC LIMIT 1",
      [owner.ownerId, id]
    );
    if (!fallback.rows.length) {
      return res.status(400).json({ error: "Нужен хотя бы один источник дохода" });
    }
    const oldName = sourceRow.rows[0].name;
    const nextName = fallback.rows[0].name;
    await dbPool.query(
      `UPDATE operations
       SET income_source = $1, category = CASE WHEN type = 'income' THEN $1 ELSE category END
       WHERE telegram_user_id = $2
         AND (income_source = $3 OR (income_source IS NULL AND category = $3))`,
      [nextName, owner.ownerId, oldName]
    );
    await dbPool.query("DELETE FROM income_sources WHERE id = $1 AND owner_id = $2", [
      id,
      owner.ownerId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete income source failed:", err?.message || err);
    res.status(500).json({ error: "Failed to delete income source" });
  }
});

app.get("/api/accounts", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const accountsList = await getAccountsForOwner(owner.ownerId);
    res.json(
      accountsList.map((acc) => ({
        id: acc.id,
        name: acc.name,
        currencyCode: acc.currencyCode || "RUB",
        color: acc.color || DEFAULT_ACCOUNT_COLOR,
        openingBalance: Number(acc.openingBalance || 0),
        includeInBalance: acc.includeInBalance !== false,
      }))
    );
  } catch (err) {
    console.error("Load accounts failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const currencyCode = String(req.body?.currencyCode || "RUB").toUpperCase();
    const allowedCurrency = currencyOptions.some((c) => c.code === currencyCode);
    const color = String(req.body?.color || DEFAULT_ACCOUNT_COLOR).trim();
    const includeInBalance =
      req.body?.includeInBalance === false || req.body?.includeInBalance === "false"
        ? false
        : true;
    const openingBalanceRaw = Number(req.body?.openingBalance || 0);
    const openingBalance = Number.isFinite(openingBalanceRaw) ? openingBalanceRaw : 0;
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const existing = await dbPool.query(
      `SELECT id, name, currency_code, color, include_in_balance, opening_balance
       FROM accounts WHERE owner_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [owner.ownerId, name]
    );
    if (existing.rows.length) {
      return res.json({
        id: existing.rows[0].id,
        name: existing.rows[0].name,
        currencyCode: existing.rows[0].currency_code || "RUB",
        color: existing.rows[0].color || DEFAULT_ACCOUNT_COLOR,
        openingBalance:
          existing.rows[0].opening_balance !== null &&
          existing.rows[0].opening_balance !== undefined
            ? Number(existing.rows[0].opening_balance)
            : 0,
        includeInBalance: existing.rows[0].include_in_balance !== false,
      });
    }
    const id = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await dbPool.query(
      "INSERT INTO accounts (id, owner_id, name, currency_code, color, opening_balance, include_in_balance) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        id,
        owner.ownerId,
        name,
        allowedCurrency ? currencyCode : "RUB",
        color,
        openingBalance,
        includeInBalance,
      ]
    );
    res.json({
      id,
      name,
      currencyCode: allowedCurrency ? currencyCode : "RUB",
      color,
      openingBalance,
      includeInBalance,
    });
  } catch (err) {
    console.error("Create account failed:", err?.message || err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

app.put("/api/accounts/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    const name = String(req.body?.name || "").trim();
    const currencyCode = String(req.body?.currencyCode || "RUB").toUpperCase();
    const allowedCurrency = currencyOptions.some((c) => c.code === currencyCode);
    const color = String(req.body?.color || DEFAULT_ACCOUNT_COLOR).trim();
    const includeInBalance =
      req.body?.includeInBalance === false || req.body?.includeInBalance === "false"
        ? false
        : true;
    const openingBalanceRaw = Number(req.body?.openingBalance || 0);
    const openingBalance = Number.isFinite(openingBalanceRaw) ? openingBalanceRaw : 0;
    if (!id || !name) {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const current = await dbPool.query(
      "SELECT name FROM accounts WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!current.rows.length) {
      return res.status(404).json({ error: "Account not found" });
    }
    const oldName = current.rows[0].name;
    await dbPool.query(
      `UPDATE accounts
       SET name = $1, currency_code = $2, color = $3, opening_balance = $4, include_in_balance = $5
       WHERE id = $6 AND owner_id = $7`,
      [
        name,
        allowedCurrency ? currencyCode : "RUB",
        color,
        openingBalance,
        includeInBalance,
        id,
        owner.ownerId,
      ]
    );
    await dbPool.query(
      "UPDATE operations SET account = $1 WHERE telegram_user_id = $2 AND account = $3",
      [name, owner.ownerId, oldName]
    );
    await dbPool.query(
      "UPDATE goal_transactions SET account = $1 WHERE owner_id = $2 AND account = $3",
      [name, owner.ownerId, oldName]
    );
    res.json({
      id,
      name,
      currencyCode: allowedCurrency ? currencyCode : "RUB",
      color,
      openingBalance,
      includeInBalance,
    });
  } catch (err) {
    console.error("Update account failed:", err?.message || err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

app.delete("/api/accounts/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const accountRow = await dbPool.query(
      "SELECT name FROM accounts WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!accountRow.rows.length) {
      return res.status(404).json({ error: "Account not found" });
    }
    const fallback = await dbPool.query(
      "SELECT name FROM accounts WHERE owner_id = $1 AND id <> $2 ORDER BY created_at ASC LIMIT 1",
      [owner.ownerId, id]
    );
    if (!fallback.rows.length) {
      return res.status(400).json({ error: "Нужен хотя бы один счет" });
    }
    const oldName = accountRow.rows[0].name;
    const newName = fallback.rows[0].name;
    await dbPool.query(
      "UPDATE operations SET account = $1 WHERE telegram_user_id = $2 AND account = $3",
      [newName, owner.ownerId, oldName]
    );
    await dbPool.query(
      "UPDATE goal_transactions SET account = $1 WHERE owner_id = $2 AND account = $3",
      [newName, owner.ownerId, oldName]
    );
    const result = await dbPool.query(
      "DELETE FROM accounts WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete account failed:", err?.message || err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

app.get("/api/goals", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const goals = await getGoalsForOwner(owner.ownerId);
    res.json(goals);
  } catch (err) {
    console.error("Load goals failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load goals" });
  }
});

app.post("/api/goals", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const targetRaw = Number(req.body?.targetAmount || 0);
    const targetAmount = Number.isFinite(targetRaw) ? targetRaw : 0;
    const color = String(req.body?.color || DEFAULT_ACCOUNT_COLOR).trim();
    const targetDateRaw = String(req.body?.targetDate || "").trim();
    const targetDate = targetDateRaw ? new Date(targetDateRaw) : null;
    const notify = req.body?.notify === true || req.body?.notify === "true";
    const notifyFrequencyRaw = String(req.body?.notifyFrequency || "").trim().toLowerCase();
    const notifyFrequency = ["daily", "weekly", "monthly"].includes(notifyFrequencyRaw)
      ? notifyFrequencyRaw
      : null;
    const notifyStartRaw = String(req.body?.notifyStartDate || "").trim();
    const notifyStartDate = notifyStartRaw ? new Date(notifyStartRaw) : null;
    const notifyTime = parseNotifyTime(req.body?.notifyTime);
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await dbPool.query(
      `INSERT INTO goals (id, owner_id, name, target_amount, color, target_date, notify, notify_frequency, notify_start_date, notify_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        owner.ownerId,
        name,
        targetAmount,
        color,
        targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate.toISOString() : null,
        notify,
        notifyFrequency,
        notifyStartDate && !Number.isNaN(notifyStartDate.getTime())
          ? notifyStartDate.toISOString()
          : null,
        notifyTime,
      ]
    );
    res.json({
      id,
      name,
      targetAmount,
      color,
      targetDate: targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate.toISOString() : null,
      notify,
      notifyFrequency,
      notifyStartDate:
        notifyStartDate && !Number.isNaN(notifyStartDate.getTime())
          ? notifyStartDate.toISOString()
          : null,
      notifyTime: notifyTime || null,
      createdAt: new Date().toISOString(),
      total: 0,
    });
  } catch (err) {
    console.error("Create goal failed:", err?.message || err);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

app.put("/api/goals/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    const name = String(req.body?.name || "").trim();
    if (!id || !name) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const targetRaw = Number(req.body?.targetAmount || 0);
    const targetAmount = Number.isFinite(targetRaw) ? targetRaw : 0;
    const color = String(req.body?.color || DEFAULT_ACCOUNT_COLOR).trim();
    const targetDateRaw = String(req.body?.targetDate || "").trim();
    const targetDate = targetDateRaw ? new Date(targetDateRaw) : null;
    const notify = req.body?.notify === true || req.body?.notify === "true";
    const notifyFrequencyRaw = String(req.body?.notifyFrequency || "").trim().toLowerCase();
    const notifyFrequency = ["daily", "weekly", "monthly"].includes(notifyFrequencyRaw)
      ? notifyFrequencyRaw
      : null;
    const notifyStartRaw = String(req.body?.notifyStartDate || "").trim();
    const notifyStartDate = notifyStartRaw ? new Date(notifyStartRaw) : null;
    const notifyTime = parseNotifyTime(req.body?.notifyTime);
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const result = await dbPool.query(
      `UPDATE goals
       SET name = $1,
           target_amount = $2,
           color = $3,
           target_date = $4,
           notify = $5,
           notify_frequency = $6,
           notify_start_date = $7,
           notify_time = $8
       WHERE id = $9 AND owner_id = $10`,
      [
        name,
        targetAmount,
        color,
        targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate.toISOString() : null,
        notify,
        notifyFrequency,
        notifyStartDate && !Number.isNaN(notifyStartDate.getTime())
          ? notifyStartDate.toISOString()
          : null,
        notifyTime,
        id,
        owner.ownerId,
      ]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Goal not found" });
    }
    res.json({
      id,
      name,
      targetAmount,
      color,
      targetDate: targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate.toISOString() : null,
      notify,
      notifyFrequency,
      notifyStartDate:
        notifyStartDate && !Number.isNaN(notifyStartDate.getTime())
          ? notifyStartDate.toISOString()
          : null,
      notifyTime: notifyTime || null,
    });
  } catch (err) {
    console.error("Update goal failed:", err?.message || err);
    res.status(500).json({ error: "Failed to update goal" });
  }
});

app.delete("/api/goals/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const goalRow = await dbPool.query(
      "SELECT name FROM goals WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!goalRow.rows.length) {
      return res.status(404).json({ error: "Goal not found" });
    }
    const goalName = goalRow.rows[0]?.name || "Цель";
    const mode = String(req.body?.mode || "zero").toLowerCase();
    const transferAccount = String(req.body?.transferAccount || "").trim();
    if (mode === "transfer" && !transferAccount) {
      return res.status(400).json({ error: "Account is required" });
    }
    if (mode === "transfer" && transferAccount) {
      const accountCheck = await dbPool.query(
        "SELECT id FROM accounts WHERE owner_id = $1 AND name = $2",
        [owner.ownerId, transferAccount]
      );
      if (!accountCheck.rows.length) {
        return res.status(400).json({ error: "Account not found" });
      }
    }
    const total = await getGoalTotal(owner.ownerId, id);
    const client = await dbPool.connect();
    let transferred = 0;
    try {
      await client.query("BEGIN");
      if (mode === "transfer" && transferAccount && total > 0) {
        const opId = `op_goal_close_${id}_${Date.now()}`;
        await upsertGoalTransferOperation(client, {
          opId,
          ownerId: owner.ownerId,
          account: transferAccount,
          type: "income",
          amount: total,
          createdAt: new Date().toISOString(),
          goalName,
          sourceId: `goal_close_${id}`,
        });
        transferred = total;
      }
      await client.query(
        `DELETE FROM operations
         WHERE telegram_user_id = $1
           AND source_type = 'goal'
           AND source_id IN (
             SELECT id FROM goal_transactions WHERE goal_id = $2 AND owner_id = $1
           )`,
        [owner.ownerId, id]
      );
      await client.query(
        "DELETE FROM goal_transactions WHERE goal_id = $1 AND owner_id = $2",
        [id, owner.ownerId]
      );
      await client.query("DELETE FROM goals WHERE id = $1 AND owner_id = $2", [
        id,
        owner.ownerId,
      ]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    res.json({ ok: true, transferred });
  } catch (err) {
    console.error("Delete goal failed:", err?.message || err);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

app.get("/api/goals/:id/transactions", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const limit = Number(req.query?.limit || 100);
    const search = req.query?.q ? String(req.query.q) : null;
    const before = req.query?.before ? String(req.query.before) : null;
    const from = req.query?.from ? String(req.query.from) : null;
    const to = req.query?.to ? String(req.query.to) : null;
    const items = await listGoalTransactions({
      ownerId: owner.ownerId,
      goalId: id,
      limit: Number.isFinite(limit) ? limit : 100,
      search,
      before,
      from,
      to,
    });
    res.json(items);
  } catch (err) {
    console.error("Load goal transactions failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load goal transactions" });
  }
});

app.post("/api/goals/:id/transactions", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const goalId = String(req.params.id || "");
    if (!goalId) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const amountRaw = Number(req.body?.amount || 0);
    const amount = Number.isFinite(amountRaw) ? Math.abs(amountRaw) : 0;
    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }
    let type = String(req.body?.type || "income").toLowerCase();
    if (type === "deposit") type = "income";
    if (type === "withdraw") type = "expense";
    if (type !== "income" && type !== "expense") {
      type = "income";
    }
    const label = type === "income" ? "Пополнение" : "Изъятие";
    const account = String(req.body?.account || "").trim() || null;
    const dateRaw = String(req.body?.date || "").trim();
    const dateValue = dateRaw ? new Date(dateRaw) : null;
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const goalCheck = await dbPool.query(
      "SELECT id, name FROM goals WHERE id = $1 AND owner_id = $2",
      [goalId, owner.ownerId]
    );
    if (!goalCheck.rows.length) {
      return res.status(404).json({ error: "Goal not found" });
    }
    const goalName = goalCheck.rows[0]?.name || "Цель";
    if (type === "expense") {
      const currentTotal = await getGoalTotal(owner.ownerId, goalId);
      if (amount > currentTotal) {
        return res.status(400).json({ error: "Недостаточно средств в цели" });
      }
    }
    const id = `gtrx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const createdAtValue =
      dateValue && !Number.isNaN(dateValue.getTime())
        ? dateValue.toISOString()
        : new Date().toISOString();
    const operationId = account ? `op_goal_${id}` : null;
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      if (account && operationId) {
        await upsertGoalTransferOperation(client, {
          opId: operationId,
          ownerId: owner.ownerId,
          account,
          type,
          amount,
          createdAt: createdAtValue,
          goalName,
          sourceId: id,
        });
      }
      await client.query(
        `INSERT INTO goal_transactions (id, goal_id, owner_id, type, amount, label, account, operation_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          goalId,
          owner.ownerId,
          type,
          amount,
          label,
          account,
          operationId,
          createdAtValue,
        ]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    res.json({
      id,
      goalId,
      type,
      amount,
      label,
      account: account || "",
    });
  } catch (err) {
    console.error("Create goal transaction failed:", err?.message || err);
    res.status(500).json({ error: "Failed to create goal transaction" });
  }
});

app.put("/api/goals/:id/transactions/:txId", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const goalId = String(req.params.id || "");
    const txId = String(req.params.txId || "");
    if (!goalId || !txId) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const amountRaw = Number(req.body?.amount || 0);
    const amount = Number.isFinite(amountRaw) ? Math.abs(amountRaw) : 0;
    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }
    let type = String(req.body?.type || "income").toLowerCase();
    if (type === "deposit") type = "income";
    if (type === "withdraw") type = "expense";
    if (type !== "income" && type !== "expense") type = "income";
    const label = type === "income" ? "Пополнение" : "Изъятие";
    const account = String(req.body?.account || "").trim() || null;
    const dateRaw = String(req.body?.date || "").trim();
    const dateValue = dateRaw ? new Date(dateRaw) : null;
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const row = await dbPool.query(
      "SELECT id, operation_id FROM goal_transactions WHERE id = $1 AND owner_id = $2 AND goal_id = $3",
      [txId, owner.ownerId, goalId]
    );
    if (!row.rows.length) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    const existingOperationId = row.rows[0]?.operation_id || null;
    const goalRow = await dbPool.query(
      "SELECT name FROM goals WHERE id = $1 AND owner_id = $2",
      [goalId, owner.ownerId]
    );
    const goalName = goalRow.rows[0]?.name || "Цель";
    if (type === "expense") {
      const totalWithout = await getGoalTotal(owner.ownerId, goalId, txId);
      if (amount > totalWithout) {
        return res.status(400).json({ error: "Недостаточно средств в цели" });
      }
    }
    const createdAtValue =
      dateValue && !Number.isNaN(dateValue.getTime())
        ? dateValue.toISOString()
        : new Date().toISOString();
    const nextOperationId = account
      ? existingOperationId || `op_goal_${txId}`
      : null;
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      if (account && nextOperationId) {
        await upsertGoalTransferOperation(client, {
          opId: nextOperationId,
          ownerId: owner.ownerId,
          account,
          type,
          amount,
          createdAt: createdAtValue,
          goalName,
          sourceId: txId,
        });
      } else if (!account && existingOperationId) {
        await deleteGoalTransferOperation(client, existingOperationId, owner.ownerId);
      }
      await client.query(
        `UPDATE goal_transactions
         SET type = $1, amount = $2, label = $3, account = $4, operation_id = $5, created_at = $6
         WHERE id = $7 AND owner_id = $8 AND goal_id = $9`,
        [
          type,
          amount,
          label,
          account,
          nextOperationId,
          createdAtValue,
          txId,
          owner.ownerId,
          goalId,
        ]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    res.json({ id: txId, goalId, type, amount, label, account: account || "" });
  } catch (err) {
    console.error("Update goal transaction failed:", err?.message || err);
    res.status(500).json({ error: "Failed to update goal transaction" });
  }
});

app.delete("/api/goals/:id/transactions/:txId", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const goalId = String(req.params.id || "");
    const txId = String(req.params.txId || "");
    if (!goalId || !txId) {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const existing = await dbPool.query(
      "SELECT operation_id FROM goal_transactions WHERE id = $1 AND owner_id = $2 AND goal_id = $3",
      [txId, owner.ownerId, goalId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    const operationId = existing.rows[0]?.operation_id || null;
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      if (operationId) {
        await deleteGoalTransferOperation(client, operationId, owner.ownerId);
      }
      await client.query(
        "DELETE FROM goal_transactions WHERE id = $1 AND owner_id = $2 AND goal_id = $3",
        [txId, owner.ownerId, goalId]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete goal transaction failed:", err?.message || err);
    res.status(500).json({ error: "Failed to delete goal transaction" });
  }
});

app.get("/api/debts", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const kind = normalizeDebtKind(req.query?.kind);
    if (!kind) {
      return res.status(400).json({ error: "Invalid kind" });
    }
    const items = await listDebtsForOwner(owner.ownerId, kind);
    res.json(items);
  } catch (err) {
    console.error("Load debts failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load debts" });
  }
});

app.post("/api/debts", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const kind = normalizeDebtKind(req.body?.kind);
    if (!kind) return res.status(400).json({ error: "Invalid kind" });
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Name is required" });
    const principalAmount = roundMoney(req.body?.principalAmount || 0);
    const totalAmount = roundMoney(req.body?.totalAmount || 0);
    const currencyCode = String(req.body?.currencyCode || "").trim() || null;
    const issuedDate = req.body?.issuedDate ? new Date(req.body.issuedDate) : null;
    const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : null;
    const rate = Number(req.body?.rate);
    const termMonths = Number(req.body?.termMonths);
    const paymentType = String(req.body?.paymentType || "").trim().toLowerCase();
    const paymentsCount = Number(req.body?.paymentsCount);
    const firstPaymentDate = req.body?.firstPaymentDate
      ? new Date(req.body.firstPaymentDate)
      : null;
    const frequency = String(req.body?.frequency || "monthly").toLowerCase();
    const scheduleEnabled = req.body?.scheduleEnabled !== false;
    const notes = String(req.body?.notes || "").trim();
    if (!dbPool) return res.status(400).json({ error: "Database unavailable" });
    const id = `debt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const issuedBase =
      issuedDate && !Number.isNaN(issuedDate.getTime()) ? issuedDate : new Date();
    const computedDueDate =
      dueDate && !Number.isNaN(dueDate.getTime())
        ? dueDate
        : Number.isFinite(termMonths)
          ? addMonths(issuedBase, termMonths)
          : null;
    const scheduleBaseDate =
      firstPaymentDate && !Number.isNaN(firstPaymentDate.getTime())
        ? firstPaymentDate
        : issuedBase;
    let schedule = [];
    if (!scheduleEnabled) {
      schedule = [];
    } else if (kind === "credit") {
      schedule = generateCreditSchedule({
        principal: principalAmount || totalAmount,
        rate: Number.isFinite(rate) ? rate : 0,
        termMonths: Number.isFinite(termMonths) ? termMonths : paymentsCount || 1,
        firstPaymentDate: scheduleBaseDate,
        paymentType: paymentType === "diff" ? "diff" : "annuity",
      });
    } else if (totalAmount || principalAmount) {
      const baseAmount = totalAmount || principalAmount;
      if (computedDueDate) {
        schedule = generateScheduleByDates({
          totalAmount: baseAmount,
          issuedDate: issuedBase,
          dueDate: computedDueDate,
          frequency: ["daily", "weekly", "monthly", "quarterly"].includes(frequency)
            ? frequency
            : "monthly",
        });
      } else {
        schedule = generateEqualSchedule({
          totalAmount: baseAmount,
          paymentsCount: Number.isFinite(paymentsCount) ? paymentsCount : termMonths || 1,
          firstPaymentDate: scheduleBaseDate,
          frequency: ["daily", "weekly", "monthly", "quarterly"].includes(frequency)
            ? frequency
            : "monthly",
        });
      }
    }
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO debts (id, owner_id, kind, name, principal_amount, total_amount, currency_code,
                            schedule_enabled, payments_count, frequency, first_payment_date,
                            issued_date, due_date, rate, term_months, payment_type, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          id,
          owner.ownerId,
          kind,
          name,
          principalAmount,
          totalAmount || principalAmount,
          currencyCode,
          scheduleEnabled,
          Number.isFinite(paymentsCount)
            ? paymentsCount
            : schedule.length
              ? schedule.length
              : null,
          frequency || null,
          firstPaymentDate && !Number.isNaN(firstPaymentDate.getTime())
            ? firstPaymentDate.toISOString()
            : issuedBase.toISOString(),
          issuedBase.toISOString(),
          computedDueDate ? computedDueDate.toISOString() : null,
          Number.isFinite(rate) ? rate : null,
          Number.isFinite(termMonths) ? termMonths : null,
          paymentType || null,
          notes || null,
        ]
      );
      if (schedule.length) {
        const values = schedule.map((entry, idx) => [
          `sched_${id}_${idx}`,
          id,
          owner.ownerId,
          entry.dueDate && !Number.isNaN(entry.dueDate.getTime())
            ? entry.dueDate.toISOString()
            : null,
          roundMoney(entry.amount),
        ]);
        const placeholders = values
          .map(
            (_, idx) =>
              `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`
          )
          .join(",");
        await client.query(
          `INSERT INTO debt_schedule (id, debt_id, owner_id, due_date, amount)
           VALUES ${placeholders}`,
          values.flat()
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    const items = await listDebtsForOwner(owner.ownerId, kind);
    const created = items.find((item) => item.id === id);
    res.json(created || { id, name, kind });
  } catch (err) {
    console.error("Create debt failed:", err?.message || err);
    res.status(500).json({ error: "Failed to create debt" });
  }
});

app.put("/api/debts/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    const name = String(req.body?.name || "").trim();
    if (!id || !name) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const kind = normalizeDebtKind(req.body?.kind);
    if (!kind) return res.status(400).json({ error: "Invalid kind" });
    const principalAmount = roundMoney(req.body?.principalAmount || 0);
    const totalAmount = roundMoney(req.body?.totalAmount || 0);
    const currencyCode = String(req.body?.currencyCode || "").trim() || null;
    const issuedDate = req.body?.issuedDate ? new Date(req.body.issuedDate) : null;
    const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : null;
    const rate = Number(req.body?.rate);
    const termMonths = Number(req.body?.termMonths);
    const paymentType = String(req.body?.paymentType || "").trim().toLowerCase();
    const notes = String(req.body?.notes || "").trim();
    const scheduleEnabled = req.body?.scheduleEnabled !== false;
    const paymentsCount = Number(req.body?.paymentsCount);
    const frequency = String(req.body?.frequency || "").trim().toLowerCase();
    const firstPaymentDate = req.body?.firstPaymentDate
      ? new Date(req.body.firstPaymentDate)
      : null;
    const issuedBase =
      issuedDate && !Number.isNaN(issuedDate.getTime()) ? issuedDate : new Date();
    const computedDueDate =
      dueDate && !Number.isNaN(dueDate.getTime())
        ? dueDate
        : Number.isFinite(termMonths)
          ? addMonths(issuedBase, termMonths)
          : null;
    if (!dbPool) return res.status(400).json({ error: "Database unavailable" });
    const result = await dbPool.query(
      `UPDATE debts
       SET name = $1,
           kind = $2,
           principal_amount = $3,
           total_amount = $4,
           currency_code = $5,
           schedule_enabled = $6,
           payments_count = $7,
           frequency = $8,
           first_payment_date = $9,
           issued_date = $10,
           due_date = $11,
           rate = $12,
           term_months = $13,
           payment_type = $14,
           notes = $15,
           updated_at = now()
       WHERE id = $16 AND owner_id = $17`,
      [
        name,
        kind,
        principalAmount,
        totalAmount || principalAmount,
        currencyCode,
        scheduleEnabled,
        Number.isFinite(paymentsCount) ? paymentsCount : null,
        frequency || null,
        firstPaymentDate && !Number.isNaN(firstPaymentDate.getTime())
          ? firstPaymentDate.toISOString()
          : issuedBase.toISOString(),
        issuedBase.toISOString(),
        computedDueDate ? computedDueDate.toISOString() : null,
        Number.isFinite(rate) ? rate : null,
        Number.isFinite(termMonths) ? termMonths : null,
        paymentType || null,
        notes || null,
        id,
        owner.ownerId,
      ]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Not found" });
    }
    if (!scheduleEnabled) {
      await dbPool.query("DELETE FROM debt_schedule WHERE debt_id = $1 AND owner_id = $2", [
        id,
        owner.ownerId,
      ]);
    } else {
      let schedule = [];
      if (kind === "credit") {
        schedule = generateCreditSchedule({
          principal: principalAmount || totalAmount,
          rate: Number.isFinite(rate) ? rate : 0,
          termMonths: Number.isFinite(termMonths) ? termMonths : paymentsCount || 1,
          firstPaymentDate: issuedBase,
          paymentType: paymentType === "diff" ? "diff" : "annuity",
        });
      } else if (totalAmount || principalAmount) {
        const baseAmount = totalAmount || principalAmount;
        if (computedDueDate) {
          schedule = generateScheduleByDates({
            totalAmount: baseAmount,
            issuedDate: issuedBase,
            dueDate: computedDueDate,
            frequency: ["daily", "weekly", "monthly", "quarterly"].includes(frequency)
              ? frequency
              : "monthly",
          });
        } else {
          schedule = generateEqualSchedule({
            totalAmount: baseAmount,
            paymentsCount: Number.isFinite(paymentsCount) ? paymentsCount : termMonths || 1,
            firstPaymentDate: issuedBase,
            frequency: ["daily", "weekly", "monthly", "quarterly"].includes(frequency)
              ? frequency
              : "monthly",
          });
        }
      }
      const { rows: existing } = await dbPool.query(
        `SELECT due_date, paid, paid_amount, paid_at
         FROM debt_schedule
         WHERE debt_id = $1 AND owner_id = $2`,
        [id, owner.ownerId]
      );
      const existingMap = new Map();
      existing.forEach((row) => {
        if (!row.due_date) return;
        const key = new Date(row.due_date).toISOString().slice(0, 10);
        existingMap.set(key, row);
      });
      await dbPool.query("DELETE FROM debt_schedule WHERE debt_id = $1 AND owner_id = $2", [
        id,
        owner.ownerId,
      ]);
      if (schedule.length) {
        const values = schedule.map((entry, idx) => {
          const dateKey = entry.dueDate
            ? new Date(entry.dueDate).toISOString().slice(0, 10)
            : null;
          const existingEntry = dateKey ? existingMap.get(dateKey) : null;
          return [
            `sched_${id}_${idx}`,
            id,
            owner.ownerId,
            entry.dueDate && !Number.isNaN(entry.dueDate.getTime())
              ? entry.dueDate.toISOString()
              : null,
            roundMoney(entry.amount),
            existingEntry?.paid === true,
            existingEntry?.paid_amount !== null && existingEntry?.paid_amount !== undefined
              ? Number(existingEntry.paid_amount)
              : null,
            existingEntry?.paid_at || null,
          ];
        });
        const placeholders = values
          .map(
            (_, idx) =>
              `($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8})`
          )
          .join(",");
        await dbPool.query(
          `INSERT INTO debt_schedule (id, debt_id, owner_id, due_date, amount, paid, paid_amount, paid_at)
           VALUES ${placeholders}`,
          values.flat()
        );
      }
    }
    const items = await listDebtsForOwner(owner.ownerId, kind);
    const updated = items.find((item) => item.id === id);
    res.json(updated || { id, name, kind });
  } catch (err) {
    console.error("Update debt failed:", err?.message || err);
    res.status(500).json({ error: "Failed to update debt" });
  }
});

app.delete("/api/debts/:id", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    if (!id || !dbPool) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const mode = String(req.body?.mode || "zero").toLowerCase();
    const transferAccount = String(req.body?.transferAccount || "").trim();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      let remaining = 0;
      let debtKind = null;
      let debtName = "";
      if (mode === "transfer") {
        const debtRow = await client.query(
          "SELECT id, kind, name, total_amount FROM debts WHERE id = $1 AND owner_id = $2",
          [id, owner.ownerId]
        );
        if (!debtRow.rows.length) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Not found" });
        }
        debtKind = debtRow.rows[0].kind;
        debtName = debtRow.rows[0].name || "";
        const totalAmountRaw = debtRow.rows[0].total_amount;
        const scheduleRows = await client.query(
          "SELECT amount, paid, paid_amount FROM debt_schedule WHERE debt_id = $1 AND owner_id = $2",
          [id, owner.ownerId]
        );
        const plannedTotal =
          totalAmountRaw !== null && totalAmountRaw !== undefined && Number(totalAmountRaw) > 0
            ? Number(totalAmountRaw)
            : scheduleRows.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const paidTotal = scheduleRows.rows.reduce((sum, row) => {
          if (!row.paid) return sum;
          const value =
            row.paid_amount !== null && row.paid_amount !== undefined
              ? Number(row.paid_amount)
              : Number(row.amount || 0);
          return sum + value;
        }, 0);
        remaining = Math.max(0, roundMoney(plannedTotal - paidTotal));
        if (remaining > 0) {
          if (!transferAccount) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Выберите счет" });
          }
          const accountRow = await client.query(
            "SELECT name FROM accounts WHERE owner_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1",
            [owner.ownerId, transferAccount]
          );
          if (!accountRow.rows.length) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Счет не найден" });
          }
          const accountName = accountRow.rows[0].name;
          const categoriesList = await getCategoriesForOwner(owner.ownerId);
          const incomeSourcesList = await getIncomeSourcesForOwner(owner.ownerId);
          const opType = debtKind === "owed_to_me" ? "income" : "expense";
          const incomeSourceName =
            opType === "income"
              ? incomeSourcesList.find((s) =>
                  String(s.name || "").toLowerCase().includes("проч")
                )?.name ||
                incomeSourcesList[0]?.name ||
                "Прочее"
              : null;
          const categoryName =
            opType === "expense"
              ? categoriesList.find((c) =>
                  String(c.name || "").toLowerCase().includes("друг")
                )?.name ||
                categoriesList[0]?.name ||
                "Другое"
              : incomeSourceName || "Прочее";
          const label =
            opType === "income" ? `Возврат долга: ${debtName}` : `Списание долга: ${debtName}`;
          const opId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await client.query(
            `INSERT INTO operations (
              id, text, type, amount, category, account, account_specified,
              telegram_user_id, amount_cents, created_at, label, income_source,
              exclude_from_summary, source_type, source_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [
              opId,
              label,
              opType,
              remaining,
              categoryName,
              accountName,
              true,
              owner.ownerId,
              Math.round(remaining * 100),
              new Date().toISOString(),
              label,
              incomeSourceName,
              false,
              "debt",
              id,
            ]
          );
        }
      }
      await client.query("DELETE FROM debt_schedule WHERE debt_id = $1 AND owner_id = $2", [
        id,
        owner.ownerId,
      ]);
      const result = await client.query("DELETE FROM debts WHERE id = $1 AND owner_id = $2", [
        id,
        owner.ownerId,
      ]);
      await client.query("COMMIT");
      if (!result.rowCount) {
        return res.status(404).json({ error: "Not found" });
      }
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete debt failed:", err?.message || err);
    res.status(500).json({ error: "Failed to delete debt" });
  }
});

app.get("/api/debts/:id/schedule", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = String(req.params.id || "");
    const limit = Number(req.query?.limit || 200);
    const search = req.query?.q ? String(req.query.q) : null;
    const before = req.query?.before ? String(req.query.before) : null;
    const from = req.query?.from ? String(req.query.from) : null;
    const to = req.query?.to ? String(req.query.to) : null;
    const items = await listDebtSchedule({
      ownerId: owner.ownerId,
      debtId: id,
      limit: Number.isFinite(limit) ? limit : 200,
      search,
      before,
      from,
      to,
    });
    res.json(items);
  } catch (err) {
    console.error("Load debt schedule failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load schedule" });
  }
});

app.post("/api/debts/:id/schedule", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const debtId = String(req.params.id || "");
    const amount = roundMoney(req.body?.amount || 0);
    if (!debtId || !amount) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : null;
    const note = String(req.body?.note || "").trim();
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await dbPool.query(
      `INSERT INTO debt_schedule (id, debt_id, owner_id, due_date, amount, note)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        debtId,
        owner.ownerId,
        dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString() : null,
        amount,
        note || null,
      ]
    );
    res.json({ id, debtId, amount, note, dueDate: dueDate?.toISOString() || null });
  } catch (err) {
    console.error("Create schedule entry failed:", err?.message || err);
    res.status(500).json({ error: "Failed to create entry" });
  }
});

app.put("/api/debts/:id/schedule/:sid", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const debtId = String(req.params.id || "");
    const sid = String(req.params.sid || "");
    const amount = roundMoney(req.body?.amount || 0);
    if (!debtId || !sid || !amount) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : null;
    const note = String(req.body?.note || "").trim();
    const paid = req.body?.paid === true || req.body?.paid === "true";
    const paidAmount = req.body?.paidAmount !== undefined ? roundMoney(req.body.paidAmount) : null;
    const result = await dbPool.query(
      `UPDATE debt_schedule
       SET due_date = $1,
           amount = $2,
           note = $3,
           paid = $4,
           paid_amount = $5,
           paid_at = $6
       WHERE id = $7 AND owner_id = $8 AND debt_id = $9`,
      [
        dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString() : null,
        amount,
        note || null,
        paid,
        paidAmount,
        paid ? new Date().toISOString() : null,
        sid,
        owner.ownerId,
        debtId,
      ]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Update schedule entry failed:", err?.message || err);
    res.status(500).json({ error: "Failed to update entry" });
  }
});

app.delete("/api/debts/:id/schedule/:sid", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const debtId = String(req.params.id || "");
    const sid = String(req.params.sid || "");
    if (!debtId || !sid) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const result = await dbPool.query(
      "DELETE FROM debt_schedule WHERE id = $1 AND owner_id = $2 AND debt_id = $3",
      [sid, owner.ownerId, debtId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete schedule entry failed:", err?.message || err);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const settings = await getUserSettings(owner.ownerId);
    res.json({
      currencyCode: settings.currencyCode,
      currencySymbol: getCurrencySymbol(settings.currencyCode),
    });
  } catch (err) {
    console.error("Load settings failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    if (owner?.error) {
      return res.status(401).json({ error: "Invalid Telegram data" });
    }
    if (!owner?.ownerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const currencyCode = String(req.body?.currencyCode || "").toUpperCase();
    const allowed = currencyOptions.some((c) => c.code === currencyCode);
    if (!allowed) {
      return res.status(400).json({ error: "Unsupported currency" });
    }
    const settings = await updateUserSettings(owner.ownerId, currencyCode);
    res.json({
      currencyCode: settings.currencyCode,
      currencySymbol: getCurrencySymbol(settings.currencyCode),
    });
  } catch (err) {
    console.error("Update settings failed:", err?.message || err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

app.get("/api/meta", async (req, res) => {
  try {
    const owner = getOwnerFromRequest(req);
    const accountsList = owner?.ownerId
      ? await getAccountsForOwner(owner.ownerId)
      : defaultAccounts.map((name, index) => ({ id: `acc_default_${index}`, name }));
    res.json({
      accounts: accountsList.map((acc) => acc.name),
      currencyOptions,
      defaultCategories: defaultCategories.map((c) => c.name),
    });
  } catch (err) {
    res.json({
      accounts: defaultAccounts,
      currencyOptions,
      defaultCategories: defaultCategories.map((c) => c.name),
    });
  }
});

initDb()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });
    startGoalNotificationLoop();
  })
  .catch((err) => {
    console.error("DB init failed:", err?.message || err);
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });
    startGoalNotificationLoop();
  });
