const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const LEMONFOX_URL = "https://api.lemonfox.ai/v1/audio/transcriptions";
const TRANSCRIBE_PROMPT =
  "Русский язык. Финансовые операции: зарплата, аванс, премия, кэшбек, перевод, оплата, " +
  "медклиника, медицина, аптека, коммуналка, еда, транспорт. Пиши естественные русские формы.";
const TELEGRAM_API = process.env.TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
  : null;
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
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

const operations = [];
const pendingOperations = new Map();

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
  const isInt = Math.abs(amount % 1) < 0.000001;
  const value = isInt ? Math.round(amount) : amount;
  const formatted = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${formatted}₽`;
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

function normalizeLabelToken(token) {
  const indeclinable = new Set([
    "кофе",
    "метро",
    "такси",
    "кино",
    "радио",
    "какао",
    "шоссе",
  ]);
  if (!token) return "";
  if (indeclinable.has(token)) return token;
  if (token.length < 6) return token;

  const endings = [
    "ями",
    "ами",
    "ого",
    "его",
    "ому",
    "ему",
    "ыми",
    "ими",
    "ах",
    "ях",
    "ов",
    "ев",
    "ам",
    "ям",
    "ой",
    "ей",
    "ою",
    "ею",
    "ую",
    "юю",
    "ая",
    "яя",
    "ие",
    "ые",
    "ий",
    "ый",
    "ой",
    "а",
    "у",
    "е",
    "ы",
    "и",
  ];

  for (const end of endings) {
    if (token.endsWith(end) && token.length - end.length >= 3) {
      return token.slice(0, -end.length);
    }
  }
  return token;
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

  const label = filtered.map(normalizeLabelToken).filter(Boolean).join(" ").trim();
  if (!label) {
    return parsed?.category ? parsed.category : "Операция";
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
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
  let merged = lower;
  let prev = null;
  while (prev !== merged) {
    prev = merged;
    merged = merged.replace(/(\d)\s+(?=\d)/g, "$1");
  }

  const numeric = merged.match(
    /(\d+[\.,]?\d*)\s*(к|кк|тыс\.?|тысяч[а-я]*|тыщ[а-я]*|косар[а-я]*|млн|миллион[а-я]*|муль[её]н[а-я]*|миль[её]н[а-я]*|лимон[а-я]*)?/i
  );
  if (numeric) {
    const rawNumber = numeric[1];
    let normalized = rawNumber;
    if (/^\d{1,3}([.,]\d{3})+$/.test(rawNumber)) {
      normalized = rawNumber.replace(/[.,]/g, "");
    } else {
      normalized = rawNumber.replace(",", ".");
    }
    let value = Number(normalized);
    const suffix = numeric[2] || "";
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
    if (Number.isFinite(value) && value > 0) return value;
  }

  const tokens = tokenizeWords(lower);
  return wordsToNumber(tokens);
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

  return {
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: raw,
    type,
    amount,
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

app.post("/api/operations", (req, res) => {
  const { text } = req.body || {};
  const parsed = parseOperation(text);
  if (!parsed) {
    return res.status(400).json({ error: "Could not parse operation" });
  }
  operations.unshift(parsed);
  res.json(parsed);
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
          operations.unshift(pending.parsed);
          const label = pending.label;
          const labelEmoji = pickLabelEmoji(pending.text);
          const amountText = formatAmount(pending.parsed.amount);
          const flowLine =
            pending.parsed.type === "income"
              ? `📉 Доход: ${pending.parsed.account}`
              : `📈 Расход: ${pending.parsed.account}`;
          const messageText =
            `${labelEmoji} ${label}\n` +
            `💸 ${amountText}\n` +
            `${flowLine}\n` +
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

      operations.unshift(parsed);
      const labelEmoji = pickLabelEmoji(text);
      const amountText = formatAmount(parsed.amount);
      const flowLine =
        parsed.type === "income"
          ? `📉 Доход: ${parsed.account}`
          : `📈 Расход: ${parsed.account}`;
      const messageText =
        `${labelEmoji} ${label}\n` +
        `💸 ${amountText}\n` +
        `${flowLine}\n` +
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

app.get("/api/operations", (req, res) => {
  res.json(operations);
});

app.get("/api/meta", (req, res) => {
  res.json({
    categories: categories.map((c) => c.name),
    accounts,
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${port}`);
});
