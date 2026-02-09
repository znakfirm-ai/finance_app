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

const categories = [
  { name: "Еда", keywords: ["еда", "кафе", "кофе", "обед", "ужин", "завтрак", "пицца"] },
  { name: "Транспорт", keywords: ["такси", "метро", "автобус", "бензин", "транспорт"] },
  { name: "Жильё", keywords: ["аренда", "квартира", "коммунал", "жкх", "жилье"] },
  { name: "Развлечения", keywords: ["кино", "игры", "развлеч", "музыка"] },
  { name: "Другое", keywords: [] },
];

const accounts = ["Кошелек", "Карта"];

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

async function getTelegramVoiceText(fileId) {
  if (!TELEGRAM_API) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  const file = await telegramApi("getFile", { file_id: fileId });
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error("Failed to download voice file");
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return transcribeBuffer(buffer, file.file_path || "voice.ogg");
}

function formatAmount(amount) {
  if (!Number.isFinite(amount)) return String(amount || "");
  const value = Number(amount);
  const abs = Math.abs(value);
  const rubles = Math.trunc(abs);
  const cents = Math.round((abs - rubles) * 100);
  const formattedRubles = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sign = value < 0 ? "-" : "";
  if (cents > 0) {
    return `${sign}${formattedRubles},${String(cents).padStart(2, "0")}₽`;
  }
  return `${sign}${formattedRubles}₽`;
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
    .map(normalizeLemmaToken);
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

function buildDisplayFields(text, parsed) {
  const label = extractLabel(text, parsed);
  const labelEmoji = pickLabelEmoji(text);
  const amountText = formatAmount(parsed.amount);
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

function parseOperation(text) {
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
  for (const c of categories) {
    if (c.keywords.some((k) => lower.includes(k))) {
      category = c.name;
      break;
    }
  }

  let account = "Кошелек";
  let accountSpecified = false;
  if (/(карта|с карты|по карте|на карту)/.test(lower)) {
    account = "Карта";
    accountSpecified = true;
  }
  if (/(налич|кошел|налом|кеш|кэш)/.test(lower)) {
    account = "Кошелек";
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
  const { text } = req.body || {};
  const parsed = parseOperation(text);
  if (!parsed) {
    return res.status(400).json({ error: "Could not parse operation" });
  }
  const owner = getOwnerFromRequest(req);
  if (owner?.error) {
    return res.status(401).json({ error: "Invalid Telegram data" });
  }
  if (!owner?.ownerId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  parsed.telegramUserId = owner.ownerId;
  Object.assign(parsed, buildDisplayFields(text, parsed));
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
          Object.assign(pending.parsed, buildDisplayFields(pending.text, pending.parsed));
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

      const parsed = parseOperation(text);
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

      const label = extractLabel(text, parsed);
      if (!parsed.accountSpecified) {
        pendingOperations.set(chatId, { parsed, label, text });
        const prompt =
          parsed.type === "income"
            ? "Уточни, куда зачислить:"
            : "Уточни, с какого счета списать:";
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: prompt,
          reply_markup: {
            inline_keyboard: [
              accounts.map((acc) => ({
                text: acc,
                callback_data: `account:${acc}`,
              })),
            ],
          },
        });
        return;
      }

      Object.assign(parsed, buildDisplayFields(text, parsed));
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
    const data = await listOperations(200, owner.ownerId);
    res.json(data);
  } catch (err) {
    console.error("Load operations failed:", err?.message || err);
    res.status(500).json({ error: "Failed to load operations" });
  }
});

app.get("/api/meta", (req, res) => {
  res.json({
    categories: categories.map((c) => c.name),
    accounts,
  });
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
