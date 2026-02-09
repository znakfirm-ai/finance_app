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
const TELEGRAM_INITDATA_MAX_AGE_SEC = 24 * 60 * 60;

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

const defaultAccounts = ["Кошелек", "Карта"];

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
let dbPool = null;

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
      created_at timestamptz NOT NULL,
      label text,
      label_emoji text,
      amount_text text,
      flow_line text
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
    "UPDATE operations SET amount_cents = ROUND(amount * 100) WHERE amount_cents IS NULL;"
  );
  await dbPool.query(
    "CREATE INDEX IF NOT EXISTS operations_telegram_user_id_idx ON operations(telegram_user_id);"
  );

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      owner_id text PRIMARY KEY,
      currency_code text NOT NULL DEFAULT 'RUB',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
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
    "CREATE INDEX IF NOT EXISTS categories_owner_id_idx ON categories(owner_id);"
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
    "CREATE INDEX IF NOT EXISTS accounts_owner_id_idx ON accounts(owner_id);"
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
      telegram_user_id, created_at, label, label_emoji, amount_text, flow_line
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
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
  ];
  await dbPool.query(query, values);
  return operation;
}

async function listOperations(limit = 100, telegramUserId = null) {
  if (!dbPool) {
    const data = telegramUserId
      ? memoryOperations.filter((op) => String(op.telegramUserId) === String(telegramUserId))
      : memoryOperations;
    return data.slice(0, limit);
  }
  let query = `
    SELECT id, text, type, amount, amount_cents, category, account, account_specified,
           telegram_user_id, created_at, label, label_emoji, amount_text, flow_line
    FROM operations
  `;
  const params = [];
  if (telegramUserId) {
    params.push(String(telegramUserId));
    query += ` WHERE telegram_user_id = $${params.length}`;
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
  }));
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

function getOwnerFromRequest(req) {
  const initData =
    req.header("x-telegram-init-data") ||
    req.body?.initData ||
    req.query?.initData ||
    null;
  if (initData) {
    const verified = verifyTelegramInitData(initData);
    if (!verified.ok) {
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
      keywords: cat.keywords,
    }));
  }
  const { rows } = await dbPool.query(
    "SELECT id, name FROM categories WHERE owner_id = $1 ORDER BY created_at ASC",
    [ownerId]
  );
  if (!rows.length) {
    const now = Date.now();
    const values = defaultCategories.map((cat, index) => [
      `cat_${now}_${index}`,
      ownerId,
      cat.name,
    ]);
    const placeholders = values
      .map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`)
      .join(",");
    const flat = values.flat();
    await dbPool.query(
      `INSERT INTO categories (id, owner_id, name) VALUES ${placeholders}`,
      flat
    );
    return defaultCategories.map((cat, index) => ({
      id: `cat_${now}_${index}`,
      name: cat.name,
      keywords: cat.keywords,
    }));
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    keywords:
      row.name === "Другое"
        ? []
        : [String(row.name || "").toLowerCase().replace(/ё/g, "е")],
  }));
}

async function getAccountsForOwner(ownerId) {
  if (!ownerId || !dbPool) {
    return defaultAccounts.map((name, index) => ({
      id: `acc_default_${index}`,
      name,
    }));
  }
  const { rows } = await dbPool.query(
    "SELECT id, name FROM accounts WHERE owner_id = $1 ORDER BY created_at ASC",
    [ownerId]
  );
  if (!rows.length) {
    const now = Date.now();
    const values = defaultAccounts.map((name, index) => [
      `acc_${now}_${index}`,
      ownerId,
      name,
    ]);
    const placeholders = values
      .map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`)
      .join(",");
    await dbPool.query(
      `INSERT INTO accounts (id, owner_id, name) VALUES ${placeholders}`,
      values.flat()
    );
    return defaultAccounts.map((name, index) => ({
      id: `acc_${now}_${index}`,
      name,
    }));
  }
  return rows.map((row) => ({ id: row.id, name: row.name }));
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
  accountsList = defaultAccounts
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

  const accountNames = Array.isArray(accountsList)
    ? accountsList
        .map((acc) => (typeof acc === "string" ? acc : acc.name))
        .filter(Boolean)
    : defaultAccounts;
  const defaultAccount = accountNames[0] || "Кошелек";
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
  const { text, category, account } = req.body || {};
  const owner = getOwnerFromRequest(req);
  if (owner?.error) {
    return res.status(401).json({ error: "Invalid Telegram data" });
  }
  if (!owner?.ownerId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const categoriesList = await getCategoriesForOwner(owner.ownerId);
  const accountsList = await getAccountsForOwner(owner.ownerId);
  const parsed = parseOperation(text, categoriesList, accountsList);
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
      if (update.callback_query) {
        const cq = update.callback_query;
        const chatId = cq.message?.chat?.id;
        const data = cq.data || "";
        if (!chatId) return;

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
            await saveOperation(pending.parsed);
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
          });
          await telegramApi("answerCallbackQuery", {
            callback_query_id: cq.id,
          });
          pendingOperations.delete(chatId);
        }
        return;
      }

      const message = update.message || update.edited_message;
      if (!message) return;

      const chatId = message.chat?.id;
      if (!chatId) return;
      const telegramUserId = message.from?.id ? String(message.from.id) : null;

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

      const categoriesList = telegramUserId
        ? await getCategoriesForOwner(telegramUserId)
        : defaultCategories;
      const accountsList = telegramUserId
        ? await getAccountsForOwner(telegramUserId)
        : defaultAccounts.map((name, index) => ({ id: `acc_default_${index}`, name }));
      const parsed = parseOperation(text, categoriesList, accountsList);
      if (!parsed) {
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: "Не понял сумму. Напиши проще, например: \"потратил 350 на кофе\".",
        });
        return;
      }
      if (telegramUserId) {
        parsed.telegramUserId = telegramUserId;
      }

      const settings = telegramUserId
        ? await getUserSettings(telegramUserId)
        : { currencyCode: "RUB" };
      const currencySymbol = getCurrencySymbol(settings.currencyCode);
      const label = extractLabel(text, parsed);
      if (!parsed.accountSpecified) {
        pendingOperations.set(chatId, { parsed, label, text, currencySymbol });
        const prompt =
          parsed.type === "income"
            ? "Уточни, куда зачислить:"
            : "Уточни, с какого счета списать:";
        await telegramApi("sendMessage", {
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
        return;
      }

      Object.assign(parsed, buildDisplayFields(text, parsed, currencySymbol));
      try {
        await saveOperation(parsed);
      } catch (err) {
        console.error("Save operation failed:", err?.message || err);
      }
      const messageText =
        `${parsed.labelEmoji} ${label}\n` +
        `💸 ${parsed.amountText}\n` +
        `${parsed.flowLine}\n` +
        `🗂️ Категория: ${parsed.category}`;
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: messageText,
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
    const data = await listOperations(200, owner.ownerId);
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
    res.json(categoriesList.map((c) => ({ id: c.id, name: c.name })));
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
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await dbPool.query(
      "INSERT INTO categories (id, owner_id, name) VALUES ($1, $2, $3)",
      [id, owner.ownerId, name]
    );
    res.json({ id, name });
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
    if (!id || !name) {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const result = await dbPool.query(
      "UPDATE categories SET name = $1 WHERE id = $2 AND owner_id = $3",
      [name, id, owner.ownerId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ id, name });
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
    const result = await dbPool.query(
      "DELETE FROM categories WHERE id = $1 AND owner_id = $2",
      [id, owner.ownerId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete category failed:", err?.message || err);
    res.status(500).json({ error: "Failed to delete category" });
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
    res.json(accountsList.map((acc) => ({ id: acc.id, name: acc.name })));
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
    if (!dbPool) {
      return res.status(400).json({ error: "Database unavailable" });
    }
    const existing = await dbPool.query(
      "SELECT id, name FROM accounts WHERE owner_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1",
      [owner.ownerId, name]
    );
    if (existing.rows.length) {
      return res.json(existing.rows[0]);
    }
    const id = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await dbPool.query(
      "INSERT INTO accounts (id, owner_id, name) VALUES ($1, $2, $3)",
      [id, owner.ownerId, name]
    );
    res.json({ id, name });
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
      "UPDATE accounts SET name = $1 WHERE id = $2 AND owner_id = $3",
      [name, id, owner.ownerId]
    );
    await dbPool.query(
      "UPDATE operations SET account = $1 WHERE telegram_user_id = $2 AND account = $3",
      [name, owner.ownerId, oldName]
    );
    res.json({ id, name });
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
    const count = await dbPool.query(
      "SELECT COUNT(*)::int AS count FROM accounts WHERE owner_id = $1",
      [owner.ownerId]
    );
    if (count.rows[0]?.count <= 1) {
      return res.status(400).json({ error: "Нужен хотя бы один счет" });
    }
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
  })
  .catch((err) => {
    console.error("DB init failed:", err?.message || err);
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  });
