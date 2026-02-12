import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const normalizeApiBase = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/")) return raw.replace(/\/$/, "");
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
};

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
const apiUrl = (path) => {
  try {
    const base =
      API_BASE || (typeof window !== "undefined" ? window.location.origin : "");
    const fallback =
      typeof window !== "undefined" ? window.location.href : "http://localhost";
    return new URL(path, base || fallback || "http://localhost").toString();
  } catch (_) {
    return API_BASE ? `${API_BASE}${path}` : path;
  }
};

const IconHome = () => (
  <svg viewBox="0 0 24 24" className="quick-icon" aria-hidden="true">
    <path
      d="M4 10.5L12 4l8 6.5v7.5a1 1 0 0 1-1 1h-5.5v-6h-3v6H5a1 1 0 0 1-1-1v-7.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const IconGrid = () => (
  <svg viewBox="0 0 24 24" className="quick-icon" aria-hidden="true">
    <path
      d="M5 5h4v4H5V5zm10 0h4v4h-4V5zM5 15h4v4H5v-4zm10 0h4v4h-4v-4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 24 24" className="quick-icon" aria-hidden="true">
    <path
      d="M12 5v14M5 12h14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconChart = () => (
  <svg viewBox="0 0 24 24" className="quick-icon" aria-hidden="true">
    <path
      d="M4 19h16M7 16v-6m5 6V8m5 8v-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" className="quick-icon" aria-hidden="true">
    <path
      d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm7 3.5a7.02 7.02 0 0 0-.2-1.7l2-1.5-2-3.5-2.3.7a7.2 7.2 0 0 0-2.9-1.7L11 2h-4l-.6 2.3a7.2 7.2 0 0 0-2.9 1.7L1.2 5.3l-2 3.5 2 1.5c-.1.6-.2 1.1-.2 1.7s.1 1.1.2 1.7l-2 1.5 2 3.5 2.3-.7a7.2 7.2 0 0 0 2.9 1.7L7 22h4l.6-2.3a7.2 7.2 0 0 0 2.9-1.7l2.3.7 2-3.5-2-1.5c.1-.6.2-1.1.2-1.7z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

const IconChevron = ({ direction = "right" }) => (
  <svg
    viewBox="0 0 24 24"
    className={`balance-chevron ${direction}`}
    aria-hidden="true"
  >
    <path
      d="M9 5l7 7-7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconWallet = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M4 7h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 0V6a2 2 0 0 1 2-2h10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <circle cx="17" cy="12" r="1.2" fill="currentColor" />
  </svg>
);

const IconIncome = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M12 4v8m0 0l-3-3m3 3l3-3M5 14h14v6H5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconTag = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M3 12V4h8l10 10-8 8L3 12zm5-5h.01"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconFood = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M6 4v6m3-6v6M6 10h3M12 4v6m0 0v10m4-16h2v6a2 2 0 0 1-2 2v8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconTransport = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M5 13l1.5-5.5A2 2 0 0 1 8.4 6h7.2a2 2 0 0 1 1.9 1.5L19 13v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="8.5" cy="14.5" r="1.2" fill="currentColor" />
    <circle cx="15.5" cy="14.5" r="1.2" fill="currentColor" />
  </svg>
);

const IconHouse = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const IconHealth = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M12 5v14M5 12h14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

const IconLeisure = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.5L12 16.8 7.2 18l.9-5.5-3.9-3.8 5.4-.8z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const IconShopping = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M6 7h12l-1 13H7L6 7zm3-3h6v3H9V4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const IconEducation = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M4 6l8-3 8 3-8 3-8-3zm0 4l8 3 8-3v7l-8 3-8-3v-7z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const getCategoryIcon = (name) => {
  const value = String(name || "").toLowerCase();
  if (
    value.includes("еда") ||
    value.includes("кофе") ||
    value.includes("кафе") ||
    value.includes("ресторан") ||
    value.includes("продукт")
  )
    return IconFood;
  if (
    value.includes("транспорт") ||
    value.includes("такси") ||
    value.includes("метро") ||
    value.includes("авто") ||
    value.includes("бензин") ||
    value.includes("каршер") ||
    value.includes("парков")
  )
    return IconTransport;
  if (
    value.includes("дом") ||
    value.includes("квартир") ||
    value.includes("аренд") ||
    value.includes("жкх") ||
    value.includes("коммун")
  )
    return IconHouse;
  if (
    value.includes("здоров") ||
    value.includes("мед") ||
    value.includes("аптек") ||
    value.includes("стомат")
  )
    return IconHealth;
  if (
    value.includes("развлеч") ||
    value.includes("кино") ||
    value.includes("спорт") ||
    value.includes("фитнес") ||
    value.includes("игр")
  )
    return IconLeisure;
  if (
    value.includes("покуп") ||
    value.includes("шоп") ||
    value.includes("одеж") ||
    value.includes("маркет") ||
    value.includes("магаз")
  )
    return IconShopping;
  if (
    value.includes("образ") ||
    value.includes("учеб") ||
    value.includes("курс") ||
    value.includes("школ")
  )
    return IconEducation;
  return IconTag;
};

const CategoryIcon = ({ name }) => {
  const IconComponent = getCategoryIcon(name);
  return <IconComponent />;
};

const IconTarget = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M12 5V2m7 10h3M12 22v-3M2 12h3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const IconDebt = () => (
  <svg viewBox="0 0 24 24" className="tile-icon" aria-hidden="true">
    <path
      d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M4 8l3-4h10l3 4M7.5 14h9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function App() {
  const [view, setView] = useState("home");
  const [operations, setOperations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [goals, setGoals] = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [settings, setSettings] = useState({ currencyCode: "RUB", currencySymbol: "₽" });
  const [historyFilter, setHistoryFilter] = useState({
    type: "all",
    category: null,
  });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [entryText, setEntryText] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initData, setInitData] = useState(null);
  const [webUserId, setWebUserId] = useState(null);
  const [telegramReady, setTelegramReady] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryEditor, setCategoryEditor] = useState(null);
  const [categoryDetail, setCategoryDetail] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryBudget, setEditingCategoryBudget] = useState("");
  const [newCategoryBudget, setNewCategoryBudget] = useState("");
  const [categorySaveMessage, setCategorySaveMessage] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newIncomeSourceName, setNewIncomeSourceName] = useState("");
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editingAccountName, setEditingAccountName] = useState("");
  const [editingAccountBalance, setEditingAccountBalance] = useState("");
  const [newAccountBalance, setNewAccountBalance] = useState("");
  const [showAccountEditPanel, setShowAccountEditPanel] = useState(false);
  const [accountSaveMessage, setAccountSaveMessage] = useState("");
  const [accountEditor, setAccountEditor] = useState(null);
  const [accountDetail, setAccountDetail] = useState(null);
  const [incomeSourceEditor, setIncomeSourceEditor] = useState(null);
  const [incomeSourceDetail, setIncomeSourceDetail] = useState(null);
  const [goalEditor, setGoalEditor] = useState(null);
  const [goalDetail, setGoalDetail] = useState(null);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalColor, setGoalColor] = useState("#0f172a");
  const [goalNotify, setGoalNotify] = useState(false);
  const [goalNotifyOpen, setGoalNotifyOpen] = useState(false);
  const [goalNotifyFrequency, setGoalNotifyFrequency] = useState("monthly");
  const [goalNotifyStartDate, setGoalNotifyStartDate] = useState("");
  const [goalNotifyTime, setGoalNotifyTime] = useState("");
  const [goalErrors, setGoalErrors] = useState({});
  const [goalSaveMessage, setGoalSaveMessage] = useState("");
  const [goalDeleteOpen, setGoalDeleteOpen] = useState(false);
  const [goalDeleteMode, setGoalDeleteMode] = useState("transfer");
  const [goalDeleteAccount, setGoalDeleteAccount] = useState("");
  const [goalDeleteMessage, setGoalDeleteMessage] = useState("");
  const [debtsOwed, setDebtsOwed] = useState([]);
  const [debtsOwe, setDebtsOwe] = useState([]);
  const [debtsCredit, setDebtsCredit] = useState([]);
  const [debtSection, setDebtSection] = useState(null);
  const [debtTab, setDebtTab] = useState("debts");
  const [debtDetail, setDebtDetail] = useState(null);
  const [debtEditor, setDebtEditor] = useState(null);
  const [debtEditorMessage, setDebtEditorMessage] = useState("");
  const [debtName, setDebtName] = useState("");
  const [debtPrincipal, setDebtPrincipal] = useState("");
  const [debtTotal, setDebtTotal] = useState("");
  const [debtIssuedDate, setDebtIssuedDate] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtNotes, setDebtNotes] = useState("");
  const [debtCurrencyCode, setDebtCurrencyCode] = useState("RUB");
  const [debtPaymentFormOpen, setDebtPaymentFormOpen] = useState(false);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState("");
  const [debtPaymentDate, setDebtPaymentDate] = useState("");
  const [debtPaymentAccount, setDebtPaymentAccount] = useState("");
  const [debtPaymentNote, setDebtPaymentNote] = useState("");
  const [debtPaymentMessage, setDebtPaymentMessage] = useState("");
  const [debtDeleteOpen, setDebtDeleteOpen] = useState(false);
  const [debtDeleteMode, setDebtDeleteMode] = useState("transfer");
  const [debtDeleteAccount, setDebtDeleteAccount] = useState("");
  const [debtDeleteMessage, setDebtDeleteMessage] = useState("");
  const [debtDeleteTarget, setDebtDeleteTarget] = useState(null);
  const [goalTransfer, setGoalTransfer] = useState(null);
  const [goalTransferAmount, setGoalTransferAmount] = useState("");
  const [goalTransferAccount, setGoalTransferAccount] = useState("");
  const [goalTransferMessage, setGoalTransferMessage] = useState("");
  const [goalTxEditor, setGoalTxEditor] = useState(null);
  const [goalTxError, setGoalTxError] = useState("");
  const [editingIncomeSourceName, setEditingIncomeSourceName] = useState("");
  const [incomeSourceSaveMessage, setIncomeSourceSaveMessage] = useState("");
  const [operationEditor, setOperationEditor] = useState(null);
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyQueryDebounced, setHistoryQueryDebounced] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState("month");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [customRangeDraft, setCustomRangeDraft] = useState({ from: "", to: "" });
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyBefore, setHistoryBefore] = useState(null);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyListRef = useRef(null);
  const balanceScrollRef = useRef(null);
  const [showBalanceLeft, setShowBalanceLeft] = useState(false);
  const [showBalanceRight, setShowBalanceRight] = useState(false);

  const openDebtDelete = (target) => {
    if (!target?.id) return;
    const allDebts = [...debtsOwed, ...debtsOwe, ...debtsCredit];
    const found = allDebts.find((item) => item.id === target.id);
    const remaining =
      found?.remaining ??
      target.remaining ??
      0;
    const currencyCode =
      found?.currencyCode ||
      target.currencyCode ||
      settings.currencyCode ||
      "RUB";
    const defaultAccount = accounts[0]?.name || "";
    const mode = defaultAccount ? "transfer" : "zero";
    setDebtDeleteTarget({
      id: target.id,
      kind: target.kind || found?.kind,
      name: target.name || found?.name || "",
      remaining,
      currencyCode,
    });
    setDebtDeleteMode(mode);
    setDebtDeleteAccount(defaultAccount);
    setDebtDeleteMessage("");
    setDebtDeleteOpen(true);
  };

  const closeDebtDelete = () => {
    setDebtDeleteOpen(false);
    setDebtDeleteTarget(null);
    setDebtDeleteMessage("");
  };


  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      if (tg.initData) setInitData(tg.initData);
      const tgUserId = tg.initDataUnsafe?.user?.id;
      if (tgUserId) {
        setWebUserId(String(tgUserId));
        setTelegramReady(true);
        return;
      }
    }
    if (!tg) {
      const storageKey = "finance_web_user_id";
      let id = localStorage.getItem(storageKey);
      if (!id) {
        id =
          (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
          `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(storageKey, id);
      }
      setWebUserId(id);
    }
    setTelegramReady(true);
  }, []);

  const authHeaders = useMemo(() => {
    return initData ? { "x-telegram-init-data": initData } : {};
  }, [initData]);

  function withWebQuery(path) {
    if (!webUserId) return path;
    const joiner = path.includes("?") ? "&" : "?";
    return `${path}${joiner}webUserId=${encodeURIComponent(webUserId)}`;
  }

  async function loadMeta() {
    try {
      const res = await fetch(apiUrl(withWebQuery("/api/meta")), {
        headers: authHeaders,
      });
      const data = await res.json();
      setCurrencyOptions(Array.isArray(data?.currencyOptions) ? data.currencyOptions : []);
    } catch (_) {}
  }

  async function loadAccounts() {
    try {
      const res = await fetch(apiUrl(withWebQuery("/api/accounts")), {
        headers: authHeaders,
      });
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (_) {}
  }

  async function loadIncomeSources() {
    try {
      const res = await fetch(apiUrl(withWebQuery("/api/income-sources")), {
        headers: authHeaders,
      });
      const data = await res.json();
      setIncomeSources(Array.isArray(data) ? data : []);
    } catch (_) {}
  }

  async function loadCategories() {
    try {
      const res = await fetch(apiUrl(withWebQuery("/api/categories")), {
        headers: authHeaders,
      });
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (_) {}
  }

  async function loadGoals() {
    try {
      const res = await fetch(apiUrl(withWebQuery("/api/goals")), {
        headers: authHeaders,
      });
      const data = await res.json();
      setGoals(Array.isArray(data) ? data : []);
    } catch (_) {}
  }

  async function loadDebts(kind) {
    try {
      const res = await fetch(apiUrl(withWebQuery(`/api/debts?kind=${kind}`)), {
        headers: authHeaders,
      });
      const data = await res.json();
      if (!Array.isArray(data)) return;
      if (kind === "owed") setDebtsOwed(data);
      else if (kind === "owe") setDebtsOwe(data);
      else if (kind === "credit") setDebtsCredit(data);
    } catch (_) {}
  }

  async function loadAllDebts() {
    await Promise.all([loadDebts("owed"), loadDebts("owe"), loadDebts("credit")]);
  }

  async function loadOperations() {
    try {
      const res = await fetch(apiUrl(withWebQuery("/api/operations?includeInternal=1")), {
        headers: authHeaders,
      });
      const data = await res.json();
      setOperations(Array.isArray(data) ? data : []);
    } catch (_) {}
  }

  async function loadHistory(reset = true) {
    const target = accountDetail || incomeSourceDetail || categoryDetail || goalDetail;
    if (!target) return;
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      const searchQuery = historyQueryDebounced.trim();
      const params = new URLSearchParams();
      params.set("limit", searchQuery ? "500" : "50");
      if (accountDetail) {
        params.set("account", accountDetail.name);
        params.set("includeInternal", "1");
      } else if (incomeSourceDetail) {
        params.set("type", "income");
        params.set("incomeSource", incomeSourceDetail.name);
        params.set("includeInternal", "1");
      } else if (categoryDetail) {
        params.set("type", "expense");
        params.set("category", categoryDetail.name);
      }
      if (searchQuery) {
        params.set("q", searchQuery);
      }
      if (!reset && historyBefore) {
        params.set("before", historyBefore);
      }
      const range = getPeriodRange();
      if (range) {
        params.set("from", range.start.toISOString());
        params.set("to", range.end.toISOString());
      }
      const endpoint = goalDetail
        ? `/api/goals/${goalDetail.id}/transactions?${params}`
        : `/api/operations?${params}`;
      const res = await fetch(apiUrl(withWebQuery(endpoint)), {
        headers: authHeaders,
      });
      const data = await res.json();
      let items = Array.isArray(data) ? data : [];
      if (reset) {
        setHistoryItems(items);
      } else {
        setHistoryItems((prev) => [...prev, ...items]);
      }
      const last = items[items.length - 1];
      setHistoryBefore(last ? last.createdAt || last.created_at || null : null);
      setHistoryHasMore(searchQuery ? false : items.length === 50);
    } catch (_) {
      if (reset) setHistoryItems([]);
      setHistoryHasMore(false);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadDebtPayments() {
    if (!debtDetail?.id) return;
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      const searchQuery = historyQueryDebounced.trim();
      const params = new URLSearchParams();
      params.set("limit", "500");
      if (searchQuery) {
        params.set("q", searchQuery);
      }
      const range = getPeriodRange();
      if (range) {
        params.set("from", range.start.toISOString());
        params.set("to", range.end.toISOString());
      }
      const res = await fetch(
        apiUrl(withWebQuery(`/api/debts/${debtDetail.id}/payments?${params}`)),
        { headers: authHeaders }
      );
      const data = await res.json();
      const items = Array.isArray(data) ? data : [];
      setHistoryItems(items);
      setHistoryBefore(null);
      setHistoryHasMore(false);
    } catch (_) {
      setHistoryItems([]);
      setHistoryHasMore(false);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch(apiUrl(withWebQuery("/api/settings")), {
        headers: authHeaders,
      });
      const data = await res.json();
      if (data?.currencyCode) {
        setSettings({
          currencyCode: data.currencyCode,
          currencySymbol: data.currencySymbol || "₽",
        });
      }
    } catch (_) {}
  }

  useEffect(() => {
    if (!telegramReady) return;
    loadMeta();
    loadSettings();
    loadCategories();
    loadAccounts();
    loadIncomeSources();
    loadGoals();
    loadAllDebts();
    loadOperations();
  }, [telegramReady, initData, webUserId]);

  useEffect(() => {
    const isEditable = (el) => {
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      return !!el.isContentEditable;
    };
    let blurTimer = null;
    const handleFocusIn = (event) => {
      if (isEditable(event.target)) {
        setHideBottomNav(true);
      }
    };
    const handleFocusOut = () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        const active = document.activeElement;
        if (!isEditable(active)) {
          setHideBottomNav(false);
        }
      }, 120);
    };
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      if (blurTimer) clearTimeout(blurTimer);
    };
  }, []);

  useEffect(() => {
    if (!selectedAccount && accounts.length) {
      setSelectedAccount(accounts[0].name);
    }
  }, [accounts, selectedAccount]);

  useEffect(() => {
    if (view !== "overview") {
      setAccountEditor(null);
      setEditingAccountId(null);
      setEditingAccountName("");
      setEditingAccountBalance("");
      setNewAccountBalance("");
      setShowAccountEditPanel(false);
      setAccountDetail(null);
      setIncomeSourceEditor(null);
      setIncomeSourceDetail(null);
      setEditingIncomeSourceName("");
      setNewIncomeSourceName("");
      setCategoryEditor(null);
      setCategoryDetail(null);
      setEditingCategoryName("");
      setEditingCategoryBudget("");
      setNewCategoryName("");
      setNewCategoryBudget("");
      setOperationEditor(null);
      setDebtSection(null);
      setDebtDetail(null);
      setDebtEditor(null);
    }
  }, [view]);

  useEffect(() => {
    const target =
      accountDetail || incomeSourceDetail || categoryDetail || goalDetail || debtDetail;
    if (!target) return;
    setHistoryBefore(null);
    setHistoryHasMore(true);
    setHistoryQuery("");
    setHistoryQueryDebounced("");
    setHistoryPeriod("month");
    setCustomRange({ from: "", to: "" });
    setCustomRangeDraft({ from: "", to: "" });
    setShowCustomRange(false);
  }, [
    accountDetail?.id,
    incomeSourceDetail?.id,
    categoryDetail?.id,
    goalDetail?.id,
    debtDetail?.id,
    initData,
    webUserId,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHistoryQueryDebounced(historyQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [historyQuery]);

  useEffect(() => {
    if (!debtDetail) return;
    setDebtPaymentFormOpen(false);
    setDebtPaymentAmount("");
    setDebtPaymentNote("");
    setDebtPaymentMessage("");
    setDebtPaymentDate(formatDateInput(new Date()));
    if (accounts.length) {
      setDebtPaymentAccount(accounts[0].name);
    }
  }, [debtDetail?.id, accounts]);

  useEffect(() => {
    if (!debtDetail) return;
    loadDebtPayments();
  }, [
    debtDetail?.id,
    historyPeriod,
    customRange.from,
    customRange.to,
    historyQueryDebounced,
    initData,
    webUserId,
  ]);

  useEffect(() => {
    const target = accountDetail || incomeSourceDetail || categoryDetail || goalDetail;
    if (!target) return;
    setHistoryBefore(null);
    setHistoryHasMore(true);
    loadHistory(true);
  }, [
    historyPeriod,
    customRange.from,
    customRange.to,
    historyQueryDebounced,
    accountDetail?.id,
    incomeSourceDetail?.id,
    categoryDetail?.id,
    goalDetail?.id,
    initData,
    webUserId,
  ]);

  useEffect(() => {
    if (!accountEditor) return;
    if (accountEditor.mode === "create") {
      setNewAccountName("");
      setNewAccountBalance("0");
      setShowAccountEditPanel(true);
      return;
    }
    const baseName = accountEditor.originalName || accountEditor.name;
    const net = getAccountNet(baseName);
    const currentBalance = Number(accountEditor.openingBalance || 0) + net;
    setEditingAccountName(accountEditor.name || "");
    setEditingAccountBalance(
      Number.isFinite(currentBalance)
        ? String(Math.round(currentBalance * 100) / 100)
        : ""
    );
    setShowAccountEditPanel(false);
  }, [accountEditor?.id, accountEditor?.mode, accountEditor?.openingBalance, operations]);

  useEffect(() => {
    if (!incomeSourceEditor) return;
    if (incomeSourceEditor.mode === "create") {
      setNewIncomeSourceName("");
      setEditingIncomeSourceName("");
      return;
    }
    setEditingIncomeSourceName(incomeSourceEditor.name || "");
  }, [incomeSourceEditor?.id, incomeSourceEditor?.mode, incomeSourceEditor?.name]);

  useEffect(() => {
    if (!categoryEditor) return;
    if (categoryEditor.mode === "create") {
      setNewCategoryName("");
      setNewCategoryBudget("");
      setEditingCategoryName("");
      setEditingCategoryBudget("");
      return;
    }
    setEditingCategoryName(categoryEditor.name || "");
    setEditingCategoryBudget(
      categoryEditor.budget !== null && categoryEditor.budget !== undefined
        ? String(categoryEditor.budget)
        : ""
    );
  }, [categoryEditor?.id, categoryEditor?.mode, categoryEditor?.name]);

  useEffect(() => {
    if (!goalEditor) return;
    setGoalSaveMessage("");
    setGoalErrors({});
    setGoalNotifyOpen(false);
    setGoalDeleteOpen(false);
    setGoalDeleteMode("transfer");
    setGoalDeleteAccount("");
    setGoalDeleteMessage("");
    if (goalEditor.mode === "create") {
      setGoalName("");
      setGoalTarget("");
      setGoalDate("");
      setGoalColor("#0f172a");
      setGoalNotify(false);
      setGoalNotifyFrequency("monthly");
      setGoalNotifyStartDate("");
      setGoalNotifyTime("");
      return;
    }
    setGoalName(goalEditor.name || "");
    setGoalTarget(
      goalEditor.targetAmount !== null && goalEditor.targetAmount !== undefined
        ? String(goalEditor.targetAmount)
        : ""
    );
    setGoalDate(goalEditor.targetDate ? formatDateInput(goalEditor.targetDate) : "");
    setGoalColor(goalEditor.color || "#0f172a");
    setGoalNotify(goalEditor.notify === true);
    setGoalNotifyFrequency(goalEditor.notifyFrequency || "monthly");
    setGoalNotifyStartDate(
      goalEditor.notifyStartDate ? formatDateInput(goalEditor.notifyStartDate) : ""
    );
    setGoalNotifyTime(goalEditor.notifyTime || "");
  }, [goalEditor?.id, goalEditor?.mode, goalEditor?.name]);

  useEffect(() => {
    if (!debtEditor) return;
    setDebtEditorMessage("");
    if (debtEditor.mode === "create") {
      const defaultDate = formatDateInput(new Date());
      setDebtName("");
      setDebtPrincipal("");
      setDebtTotal("");
      setDebtIssuedDate(defaultDate);
      setDebtDueDate(defaultDate);
      setDebtNotes("");
      setDebtCurrencyCode(settings.currencyCode || "RUB");
      return;
    }
    setDebtName(debtEditor.name || "");
    setDebtPrincipal(
      debtEditor.principalAmount !== null && debtEditor.principalAmount !== undefined
        ? String(debtEditor.principalAmount)
        : ""
    );
    setDebtTotal(
      debtEditor.totalAmount !== null && debtEditor.totalAmount !== undefined
        ? String(debtEditor.totalAmount)
        : ""
    );
    const fallbackDate = formatDateInput(new Date());
    setDebtIssuedDate(
      debtEditor.issuedDate ? formatDateInput(debtEditor.issuedDate) : fallbackDate
    );
    setDebtDueDate(
      debtEditor.dueDate ? formatDateInput(debtEditor.dueDate) : fallbackDate
    );
    setDebtNotes(debtEditor.notes || "");
    setDebtCurrencyCode(debtEditor.currencyCode || settings.currencyCode || "RUB");
  }, [debtEditor?.id, debtEditor?.mode, debtEditor?.name]);

  useEffect(() => {
    if (!goalDetail) return;
    const latest = goals.find((g) => g.id === goalDetail.id);
    if (!latest) return;
    setGoalDetail((prev) => ({
      ...prev,
      name: latest.name,
      targetAmount: latest.targetAmount,
      color: latest.color,
      targetDate: latest.targetDate,
      notify: latest.notify === true,
      notifyFrequency: latest.notifyFrequency || null,
      notifyStartDate: latest.notifyStartDate || null,
      notifyTime: latest.notifyTime || null,
      createdAt: latest.createdAt || null,
      total: latest.total,
    }));
  }, [goals, goalDetail?.id]);

  const currencySymbolByCode = (code) => {
    const entry = currencyOptions.find((c) => c.code === code);
    return entry?.symbol || settings.currencySymbol || "₽";
  };

  const normalizeDate = (value) => {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const startOfDay = (value) => {
    const date = normalizeDate(value);
    if (!date) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const endOfDay = (value) => {
    const date = normalizeDate(value);
    if (!date) return null;
    date.setHours(23, 59, 59, 999);
    return date;
  };

  const getPeriodRange = () => {
    if (historyPeriod === "all") return null;
    const now = new Date();
    let start = null;
    let end = endOfDay(now);
    if (historyPeriod === "today") {
      start = startOfDay(now);
    } else if (historyPeriod === "week") {
      const day = now.getDay();
      const diff = (day + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      start = startOfDay(monday);
    } else if (historyPeriod === "month") {
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    } else if (historyPeriod === "quarter") {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      start = startOfDay(new Date(now.getFullYear(), quarterStart, 1));
    } else if (historyPeriod === "year") {
      start = startOfDay(new Date(now.getFullYear(), 0, 1));
    } else if (historyPeriod === "custom" && customRange.from) {
      const [y, m, d] = customRange.from.split("-").map(Number);
      if (y && m && d) {
        start = startOfDay(new Date(y, m - 1, d));
      }
      if (customRange.to) {
        const [ty, tm, td] = customRange.to.split("-").map(Number);
        if (ty && tm && td) {
          end = endOfDay(new Date(ty, tm - 1, td));
        }
      }
    }
    if (!start || Number.isNaN(start.getTime())) return null;
    if (!end || Number.isNaN(end.getTime())) return null;
    if (end < start) {
      const temp = start;
      start = end;
      end = temp;
    }
    return { start, end };
  };

  const formatDateInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const dateToParts = (value) => {
    const base = value ? new Date(value) : new Date();
    const date = Number.isNaN(base.getTime()) ? new Date() : base;
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  };

  const maxDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const buildDateString = (year, month, day) =>
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const updateDateValue = (currentValue, part, nextValue) => {
    const parts = dateToParts(currentValue);
    const next = { ...parts, [part]: Number(nextValue) };
    const maxDay = maxDaysInMonth(next.year, next.month);
    if (next.day > maxDay) next.day = maxDay;
    return buildDateString(next.year, next.month, next.day);
  };

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const start = now - 10;
    const end = now + 2;
    const years = [];
    for (let year = start; year <= end; year += 1) {
      years.push(year);
    }
    return years;
  }, []);

  const monthOptions = useMemo(
    () => [
      { value: 1, label: "Янв" },
      { value: 2, label: "Фев" },
      { value: 3, label: "Мар" },
      { value: 4, label: "Апр" },
      { value: 5, label: "Май" },
      { value: 6, label: "Июн" },
      { value: 7, label: "Июл" },
      { value: 8, label: "Авг" },
      { value: 9, label: "Сен" },
      { value: 10, label: "Окт" },
      { value: 11, label: "Ноя" },
      { value: 12, label: "Дек" },
    ],
    []
  );

  const DateSlotPicker = ({ value, onChange, ariaLabel }) => {
    const parts = dateToParts(value);
    const daysInMonth = maxDaysInMonth(parts.year, parts.month);
    const dayOptions = Array.from({ length: daysInMonth }, (_, idx) => idx + 1);
    return (
      <div className="date-slot" aria-label={ariaLabel}>
        <select
          className="date-slot-select day"
          value={parts.day}
          onChange={(e) => onChange(updateDateValue(value, "day", e.target.value))}
        >
          {dayOptions.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
        <select
          className="date-slot-select month"
          value={parts.month}
          onChange={(e) => onChange(updateDateValue(value, "month", e.target.value))}
        >
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <select
          className="date-slot-select year"
          value={parts.year}
          onChange={(e) => onChange(updateDateValue(value, "year", e.target.value))}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const accountMapById = useMemo(() => {
    const map = new Map();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  const getAccountNet = (name) => {
    if (!name) return 0;
    return operations.reduce((sum, op) => {
      if (op.account !== name) return sum;
      const value = Number(op.amount || 0);
      return op.type === "income" ? sum + value : sum - value;
    }, 0);
  };

  const parseNumberInput = (value) => {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).replace(/\s/g, "").replace(/,/g, ".");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const roundMoney = (value) => {
    const num = Number(value) || 0;
    return Math.round(num * 100) / 100;
  };

  async function saveOperation() {
    const trimmed = entryText.trim();
    if (!trimmed) {
      setError("Введите текст операции");
      return;
    }
    if (!selectedCategory) {
      setError("Выберите категорию");
      return;
    }
    if (!selectedAccount) {
      setError("Выберите счет");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        text: trimmed,
        category: selectedCategory.name,
        account: selectedAccount,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;

      const res = await fetch(apiUrl("/api/operations"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка сохранения");
      setOperations((prev) => [data, ...prev]);
      setEntryText("");
      setView("history");
    } catch (e) {
      setError(e.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const budgetValue = parseNumberInput(newCategoryBudget);
      const payload = { name, budget: budgetValue ?? null };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl("/api/categories"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setCategories((prev) => [...prev, data]);
      setNewCategoryName("");
      setNewCategoryBudget("");
      setCategoryEditor({ ...data, mode: "edit", originalName: data.name });
      setEditingCategoryName(data.name || "");
      setEditingCategoryBudget(
        data.budget !== null && data.budget !== undefined ? String(data.budget) : ""
      );
      setCategorySaveMessage("Категория создана");
      setTimeout(() => setCategorySaveMessage(""), 2000);
      await loadOperations();
    } catch (e) {
      setError(e.message || "Ошибка создания категории");
    }
  }

  async function updateCategory(id) {
    const name = editingCategoryName.trim();
    if (!name) return;
    try {
      const budgetValue = parseNumberInput(editingCategoryBudget);
      const payload = { name, budget: budgetValue ?? null };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(`/api/categories/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setCategories((prev) => prev.map((c) => (c.id === id ? data : c)));
      if (categoryDetail?.id === id) {
        setCategoryDetail({ ...categoryDetail, name: data.name });
      }
      setCategoryEditor({ ...data, mode: "edit", originalName: data.name });
      setCategorySaveMessage("Сохранено");
      setTimeout(() => setCategorySaveMessage(""), 2000);
      await loadOperations();
    } catch (e) {
      setError(e.message || "Ошибка обновления категории");
    }
  }

  async function deleteCategory(id) {
    if (!confirm("Удалить категорию?")) return;
    try {
      const payload = {};
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(withWebQuery(`/api/categories/${id}`)), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (categoryDetail?.id === id) {
        setCategoryDetail(null);
      }
      if (categoryEditor?.id === id) {
        setCategoryEditor(null);
      }
      await loadOperations();
    } catch (e) {
      setError(e.message || "Ошибка удаления категории");
    }
  }

  async function updateCurrency(code) {
    try {
      const payload = { currencyCode: code };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl("/api/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setSettings({
        currencyCode: data.currencyCode,
        currencySymbol: data.currencySymbol || "₽",
      });
      await loadOperations();
    } catch (e) {
      setError(e.message || "Ошибка обновления настроек");
    }
  }

  async function createAccount() {
    const name = newAccountName.trim();
    if (!name) return;
    try {
      const parsedBalance = parseNumberInput(newAccountBalance);
      const payload = {
        name,
        currencyCode: accountEditor?.currencyCode || settings.currencyCode,
        color: accountEditor?.color || "#0f172a",
        includeInBalance: accountEditor?.includeInBalance !== false,
        openingBalance: parsedBalance ?? 0,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl("/api/accounts"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setAccounts((prev) => [...prev, data]);
      setNewAccountName("");
      setNewAccountBalance("");
      setAccountSaveMessage("Счет создан");
      setAccountEditor({ ...data, mode: "edit", originalName: data.name });
      await loadOperations();
      setTimeout(() => setAccountSaveMessage(""), 2000);
    } catch (e) {
      setError(e.message || "Ошибка создания счета");
    }
  }

  async function createIncomeSource() {
    const name = newIncomeSourceName.trim();
    if (!name) return;
    try {
      const payload = { name };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl("/api/income-sources"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setIncomeSources((prev) => [...prev, data]);
      setNewIncomeSourceName("");
      setIncomeSourceEditor({ ...data, mode: "edit", originalName: data.name });
      setEditingIncomeSourceName(data.name);
      setIncomeSourceSaveMessage("Источник создан");
      setTimeout(() => setIncomeSourceSaveMessage(""), 2000);
    } catch (e) {
      setError(e.message || "Ошибка создания источника");
    }
  }

  async function updateIncomeSource(id) {
    const name = editingIncomeSourceName.trim();
    if (!name) return;
    try {
      const payload = { name };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(`/api/income-sources/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setIncomeSources((prev) => prev.map((src) => (src.id === id ? data : src)));
      if (incomeSourceDetail && incomeSourceDetail.id === id) {
        setIncomeSourceDetail({ ...incomeSourceDetail, name: data.name });
      }
      setIncomeSourceEditor({ ...data, mode: "edit", originalName: data.name });
      await loadOperations();
      setIncomeSourceSaveMessage("Сохранено");
      setTimeout(() => setIncomeSourceSaveMessage(""), 2000);
    } catch (e) {
      setError(e.message || "Ошибка обновления источника");
    }
  }

  async function deleteIncomeSource(id) {
    if (!confirm("Удалить источник дохода?")) return;
    try {
      const payload = {};
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(withWebQuery(`/api/income-sources/${id}`)), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setIncomeSources((prev) => prev.filter((src) => src.id !== id));
      if (incomeSourceDetail?.id === id) {
        setIncomeSourceDetail(null);
      }
      if (incomeSourceEditor?.id === id) {
        setIncomeSourceEditor(null);
      }
      await loadOperations();
    } catch (e) {
      setError(e.message || "Ошибка удаления источника");
    }
  }

  async function createGoal() {
    const name = goalName.trim();
    const targetAmountValue = parseNumberInput(goalTarget);
    const nextErrors = {};
    if (!name) nextErrors.name = true;
    if (targetAmountValue === null || targetAmountValue === undefined) {
      nextErrors.target = true;
    }
    if (goalNotify) {
      if (!goalNotifyFrequency) nextErrors.notifyFrequency = true;
      if (!goalNotifyStartDate) nextErrors.notifyStartDate = true;
      if (!goalNotifyTime) nextErrors.notifyTime = true;
    }
    setGoalErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setGoalSaveMessage("Заполните обязательные поля");
      return;
    }
    try {
      const targetAmount = targetAmountValue ?? 0;
      const payload = {
        name,
        targetAmount,
        targetDate: goalDate || null,
        color: goalColor || "#0f172a",
        notify: goalNotify === true,
        notifyFrequency: goalNotifyFrequency || null,
        notifyStartDate: goalNotifyStartDate || null,
        notifyTime: goalNotifyTime || null,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl("/api/goals"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      await loadGoals();
      setGoalEditor({ ...data, mode: "edit" });
      setGoalDetail({ ...data });
      setGoalSaveMessage("Цель создана");
      setTimeout(() => setGoalSaveMessage(""), 2000);
    } catch (e) {
      setError(e.message || "Ошибка создания цели");
    }
  }

  async function updateGoal(id) {
    const name = goalName.trim();
    const targetAmountValue = parseNumberInput(goalTarget);
    const nextErrors = {};
    if (!name) nextErrors.name = true;
    if (targetAmountValue === null || targetAmountValue === undefined) {
      nextErrors.target = true;
    }
    if (goalNotify) {
      if (!goalNotifyFrequency) nextErrors.notifyFrequency = true;
      if (!goalNotifyStartDate) nextErrors.notifyStartDate = true;
      if (!goalNotifyTime) nextErrors.notifyTime = true;
    }
    setGoalErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setGoalSaveMessage("Заполните обязательные поля");
      return;
    }
    try {
      const targetAmount = targetAmountValue ?? 0;
      const payload = {
        name,
        targetAmount,
        targetDate: goalDate || null,
        color: goalColor || "#0f172a",
        notify: goalNotify === true,
        notifyFrequency: goalNotifyFrequency || null,
        notifyStartDate: goalNotifyStartDate || null,
        notifyTime: goalNotifyTime || null,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(`/api/goals/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...data } : g)));
      if (goalDetail?.id === id) {
        setGoalDetail((prev) => ({
          ...prev,
          name: data.name,
          targetAmount: data.targetAmount,
          color: data.color,
          targetDate: data.targetDate,
          notify: data.notify,
          notifyFrequency: data.notifyFrequency || null,
          notifyStartDate: data.notifyStartDate || null,
          notifyTime: data.notifyTime || null,
        }));
      }
      setGoalSaveMessage("Сохранено");
      setTimeout(() => setGoalSaveMessage(""), 2000);
    } catch (e) {
      setError(e.message || "Ошибка обновления цели");
    }
  }

  async function createDebt() {
    const name = debtName.trim();
    if (!name) {
      setDebtEditorMessage("Укажите имя");
      return;
    }
    const issuedDateValue = debtIssuedDate || "";
    if (!issuedDateValue) {
      setDebtEditorMessage("Укажите дату выдачи");
      return;
    }
    const principalAmount = parseNumberInput(debtPrincipal);
    if (!principalAmount) {
      setDebtEditorMessage("Укажите сумму займа");
      return;
    }
    const totalAmount = parseNumberInput(debtTotal);
    if (!totalAmount) {
      setDebtEditorMessage("Укажите сумму к возврату");
      return;
    }
    if (!debtCurrencyCode) {
      setDebtEditorMessage("Укажите валюту");
      return;
    }
    const payload = {
      kind: debtEditor?.kind,
      name,
      principalAmount,
      totalAmount,
      issuedDate: issuedDateValue,
      dueDate: debtDueDate || null,
      notes: debtNotes || "",
      currencyCode: debtCurrencyCode,
      scheduleEnabled: false,
    };
    if (webUserId) payload.webUserId = webUserId;
    if (initData) payload.initData = initData;
    try {
      const res = await fetch(apiUrl(withWebQuery("/api/debts")), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      await loadAllDebts();
      setDebtEditor(null);
      setDebtDetail(null);
    } catch (e) {
      setDebtEditorMessage(e.message || "Ошибка");
    }
  }

  async function updateDebt(id) {
    const name = debtName.trim();
    if (!name) {
      setDebtEditorMessage("Укажите имя");
      return;
    }
    const issuedDateValue = debtIssuedDate || "";
    if (!issuedDateValue) {
      setDebtEditorMessage("Укажите дату выдачи");
      return;
    }
    const principalAmount = parseNumberInput(debtPrincipal);
    if (!principalAmount) {
      setDebtEditorMessage("Укажите сумму займа");
      return;
    }
    const totalAmount = parseNumberInput(debtTotal);
    if (!totalAmount) {
      setDebtEditorMessage("Укажите сумму к возврату");
      return;
    }
    if (!debtCurrencyCode) {
      setDebtEditorMessage("Укажите валюту");
      return;
    }
    const payload = {
      kind: debtEditor?.kind,
      name,
      principalAmount,
      totalAmount,
      issuedDate: issuedDateValue,
      dueDate: debtDueDate || null,
      notes: debtNotes || "",
      currencyCode: debtCurrencyCode,
      scheduleEnabled: false,
    };
    if (webUserId) payload.webUserId = webUserId;
    if (initData) payload.initData = initData;
    try {
      const res = await fetch(apiUrl(withWebQuery(`/api/debts/${id}`)), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      await loadAllDebts();
      setDebtEditor(null);
      setDebtDetail(null);
    } catch (e) {
      setDebtEditorMessage(e.message || "Ошибка");
    }
  }

  async function addDebtPayment() {
    if (!debtDetail?.id) return;
    const amount = parseNumberInput(debtPaymentAmount);
    if (!amount) {
      setDebtPaymentMessage("Введите сумму");
      return;
    }
    if (accounts.length && !debtPaymentAccount) {
      setDebtPaymentMessage("Выберите счет");
      return;
    }
    const endpoint = `/api/debts/${debtDetail.id}/payments`;
    const targetUrl = apiUrl(endpoint);
    const payload = {
      amount,
      account: debtPaymentAccount,
      date: debtPaymentDate || formatDateInput(new Date()),
      note: debtPaymentNote || "",
    };
    if (webUserId) payload.webUserId = webUserId;
    if (initData) payload.initData = initData;
    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setDebtPaymentMessage("Сохранено");
      setDebtPaymentAmount("");
      setDebtPaymentNote("");
      setTimeout(() => setDebtPaymentMessage(""), 2000);
      setDebtPaymentFormOpen(false);
      await loadAllDebts();
      await loadOperations();
      await loadDebtPayments();
    } catch (e) {
      const message = e?.message || "Ошибка";
      if (/pattern/i.test(message)) {
        setDebtPaymentMessage(`Ошибка адреса запроса. ${message}. ${targetUrl}`);
      } else {
        setDebtPaymentMessage(message);
      }
    }
  }

  async function deleteDebt(id) {
    if (!id) return;
    if (debtDeleteMode === "transfer" && accounts.length && !debtDeleteAccount) {
      setDebtDeleteMessage("Выберите счет");
      return;
    }
    try {
      const payload = {
        mode: debtDeleteMode,
        transferAccount: debtDeleteMode === "transfer" ? debtDeleteAccount || null : null,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(withWebQuery(`/api/debts/${id}`)), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      await loadAllDebts();
      await loadAccounts();
      await loadOperations();
      await loadHistory(true);
      if (debtDetail?.id === id) setDebtDetail(null);
      if (debtEditor?.id === id) setDebtEditor(null);
      setDebtDeleteOpen(false);
      setDebtDeleteTarget(null);
      setDebtDeleteMessage("");
    } catch (e) {
      setDebtDeleteMessage(e.message || "Ошибка");
    }
  }

  async function deleteGoal(id) {
    if (!id) return;
    if (goalDeleteMode === "transfer" && accounts.length && !goalDeleteAccount) {
      setGoalDeleteMessage("Выберите счет");
      return;
    }
    try {
      const payload = {
        mode: goalDeleteMode,
        transferAccount: goalDeleteMode === "transfer" ? goalDeleteAccount || null : null,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(withWebQuery(`/api/goals/${id}`)), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setGoals((prev) => prev.filter((g) => g.id !== id));
      if (goalDetail?.id === id) {
        setGoalDetail(null);
      }
      if (goalEditor?.id === id) {
        setGoalEditor(null);
      }
      setGoalDeleteOpen(false);
      setGoalDeleteMessage("");
      await loadGoals();
      await loadAccounts();
      await loadOperations();
      await loadHistory(true);
    } catch (e) {
      setGoalDeleteMessage(e.message || "Ошибка удаления цели");
    }
  }

  async function addGoalTransaction(goalId, type) {
    const amount = parseNumberInput(goalTransferAmount);
    if (!goalId || !amount) {
      setGoalTransferMessage("Введите сумму");
      return;
    }
    const accountValue = accounts.length ? goalTransferAccount : "";
    if (accounts.length && !accountValue) {
      setGoalTransferMessage("Выберите счет");
      return;
    }
    try {
      const payload = {
        amount,
        type,
        account: accountValue || null,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(`/api/goals/${goalId}/transactions`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setGoalTransferAmount("");
      setGoalTransferMessage(type === "income" ? "Пополнение сохранено" : "Изъятие сохранено");
      setTimeout(() => setGoalTransferMessage(""), 2000);
      await loadGoals();
      await loadHistory(true);
    } catch (e) {
      setGoalTransferMessage(e.message || "Ошибка операции по цели");
    }
  }

  async function updateGoalTransactionEntry(entry) {
    if (!entry?.goalId || !entry?.id) return;
    const amount = parseNumberInput(entry.amount);
    if (!amount) {
      setGoalTxError("Введите сумму");
      return;
    }
    if (accounts.length && !entry.account) {
      setGoalTxError("Выберите счет");
      return;
    }
    setGoalTxError("");
    try {
      const payload = {
        amount,
        type: entry.type,
        date: entry.date,
        account: entry.account || null,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(
        apiUrl(`/api/goals/${entry.goalId}/transactions/${entry.id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setGoalTxEditor(null);
      await loadGoals();
      await loadHistory(true);
    } catch (e) {
      setGoalTxError(e.message || "Ошибка обновления");
    }
  }

  async function deleteGoalTransactionEntry(entry) {
    if (!entry?.goalId || !entry?.id) return;
    if (!confirm("Удалить операцию?")) return;
    try {
      const payload = {};
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(
        apiUrl(withWebQuery(`/api/goals/${entry.goalId}/transactions/${entry.id}`)),
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setGoalTxEditor(null);
      await loadGoals();
      await loadHistory(true);
    } catch (e) {
      setGoalTxError(e.message || "Ошибка удаления");
    }
  }

  async function updateAccount(id) {
    const name = editingAccountName.trim();
    if (!name) return;
    try {
      const net = getAccountNet(accountEditor?.originalName || name);
      const desiredBalance = parseNumberInput(editingAccountBalance);
      const openingBalance = Number.isFinite(desiredBalance)
        ? desiredBalance - net
        : accountEditor?.openingBalance || 0;
      const payload = {
        name,
        currencyCode: accountEditor?.currencyCode || settings.currencyCode,
        color: accountEditor?.color || "#0f172a",
        includeInBalance: accountEditor?.includeInBalance !== false,
        openingBalance,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const current = accounts.find((acc) => acc.id === id);
      const res = await fetch(apiUrl(`/api/accounts/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setAccounts((prev) => prev.map((acc) => (acc.id === id ? data : acc)));
      if (current && selectedAccount === current.name) {
        setSelectedAccount(data.name);
      }
      setAccountEditor({ ...data, mode: "edit", originalName: data.name });
      await loadOperations();
      setEditingAccountId(null);
      setEditingAccountName("");
      setEditingAccountBalance("");
      setShowAccountEditPanel(false);
      setAccountSaveMessage("Сохранено");
      setTimeout(() => setAccountSaveMessage(""), 2000);
    } catch (e) {
      setError(e.message || "Ошибка обновления счета");
    }
  }

  async function deleteAccount(id) {
    if (!confirm("Удалить счет?")) return;
    try {
      const payload = {};
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const current = accounts.find((acc) => acc.id === id);
      const res = await fetch(apiUrl(withWebQuery(`/api/accounts/${id}`)), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
      if (current && selectedAccount === current.name) {
        const next = accounts.filter((acc) => acc.id !== id);
        setSelectedAccount(next[0]?.name || "");
      }
      setAccountEditor(null);
      await loadOperations();
    } catch (e) {
      setError(e.message || "Ошибка удаления счета");
    }
  }

  async function updateOperationEntry(entry) {
    try {
      const payload = {
        label: entry.label,
        amount: entry.amount,
        account: entry.account,
        category: entry.category,
        incomeSource: entry.incomeSource,
      };
      if (entry.date) payload.date = entry.date;
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(withWebQuery(`/api/operations/${entry.id}`)), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setOperations((prev) =>
        prev.map((op) => (op.id === data.id ? { ...op, ...data } : op))
      );
      setOperationEditor(null);
      await loadOperations();
      if (accountDetail || incomeSourceDetail) {
        await loadHistory(true);
      }
    } catch (e) {
      setError(e.message || "Ошибка обновления операции");
    }
  }

  async function createOperationEntry(entry) {
    try {
      const payload = {
        type: entry.type,
        amount: entry.amount,
        account: entry.account,
        category: entry.category,
        incomeSource: entry.incomeSource,
        label: entry.label,
        date: entry.date,
      };
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(withWebQuery(`/api/operations`)), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setOperations((prev) => [data, ...prev]);
      setOperationEditor(null);
      await loadOperations();
      if (accountDetail || incomeSourceDetail) {
        await loadHistory(true);
      }
    } catch (e) {
      setError(e.message || "Ошибка создания операции");
    }
  }

  async function deleteOperationEntry(entry) {
    if (!entry?.id) return;
    if (!confirm("Удалить операцию?")) return;
    try {
      const payload = {};
      if (webUserId) payload.webUserId = webUserId;
      if (initData) payload.initData = initData;
      const res = await fetch(apiUrl(withWebQuery(`/api/operations/${entry.id}`)), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setOperations((prev) => prev.filter((op) => op.id !== entry.id));
      setOperationEditor(null);
      await loadOperations();
      if (accountDetail || incomeSourceDetail || categoryDetail) {
        await loadHistory(true);
      }
    } catch (e) {
      setError(e.message || "Ошибка удаления операции");
    }
  }

  const totalsByCategory = useMemo(() => {
    const totals = {};
    // Business rule: income sources (incomeSource) are analytics-only and must NOT affect balance.
    // Only operations excluded via excludeFromSummary are ignored; balance is based on account ops.
    operations.forEach((op) => {
      if (op.excludeFromSummary) return;
      if (op.type !== "expense") return;
      const key = op.category || "Другое";
      totals[key] = (totals[key] || 0) + Number(op.amount || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [operations]);

  const incomeByCategory = useMemo(() => {
    const totals = {};
    operations.forEach((op) => {
      if (op.type !== "income") return;
      if (!op.incomeSource) return;
      const key = op.incomeSource;
      totals[key] = (totals[key] || 0) + Number(op.amount || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [operations]);

  const incomeSourceTotals = useMemo(() => {
    const totals = new Map();
    incomeSources.forEach((src) => totals.set(src.name, 0));
    operations.forEach((op) => {
      if (op.type !== "income") return;
      if (!op.incomeSource) return;
      const key = op.incomeSource;
      totals.set(key, (totals.get(key) || 0) + Number(op.amount || 0));
    });
    return incomeSources.map((src) => ({
      id: src.id,
      name: src.name,
      total: totals.get(src.name) || 0,
    }));
  }, [incomeSources, operations]);

  const categoryTotals = useMemo(() => {
    const totals = new Map();
    categories.forEach((cat) => totals.set(cat.name, 0));
    totalsByCategory.forEach(([name, value]) => totals.set(name, value));
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      total: totals.get(cat.name) || 0,
      budget: cat.budget ?? null,
    }));
  }, [categories, totalsByCategory]);

  const summary = useMemo(() => {
    const includeMap = new Map();
    accounts.forEach((acc) => {
      includeMap.set(acc.name, acc.includeInBalance !== false);
    });
    let openingTotal = 0;
    accounts.forEach((acc) => {
      if (acc.includeInBalance === false) return;
      openingTotal += Number(acc.openingBalance || 0);
    });
    let income = 0;
    let expense = 0;
    operations.forEach((op) => {
      if (op.excludeFromSummary) return;
      const value = Number(op.amount || 0);
      const include = includeMap.has(op.account)
        ? includeMap.get(op.account)
        : true;
      if (!include) return;
      if (op.type === "income") income += value;
      else expense += value;
    });
    return {
      income,
      expense,
      balance: openingTotal + income - expense,
      expenseCount: operations.filter(
        (op) => op.type === "expense" && !op.excludeFromSummary
      ).length,
    };
  }, [operations, accounts]);

  const accountSummaries = useMemo(() => {
    const map = new Map();
    accounts.forEach((acc) => {
      map.set(acc.name, { income: 0, expense: 0 });
    });
    operations.forEach((op) => {
      const acc = op.account || accounts[0]?.name || "Наличные";
      if (!map.has(acc)) return;
      const bucket = map.get(acc);
      const value = Number(op.amount || 0);
      if (op.type === "income") bucket.income += value;
      else bucket.expense += value;
    });
    const includeMap = new Map();
    accounts.forEach((acc) => {
      includeMap.set(acc.name, acc.includeInBalance !== false);
    });
    let totalIncome = 0;
    let totalExpense = 0;
    operations.forEach((op) => {
      if (op.excludeFromSummary) return;
      const include = includeMap.has(op.account)
        ? includeMap.get(op.account)
        : true;
      if (!include) return;
      const value = Number(op.amount || 0);
      if (op.type === "income") totalIncome += value;
      else totalExpense += value;
    });
    let totalOpening = 0;
    accounts.forEach((acc) => {
      if (acc.includeInBalance === false) return;
      totalOpening += Number(acc.openingBalance || 0);
    });
    const items = [
      {
        key: "all",
        label: "Все счета",
        income: totalIncome,
        expense: totalExpense,
        balance: totalOpening + totalIncome - totalExpense,
      },
    ];
    accounts.forEach((acc) => {
      const value = map.get(acc.name) || { income: 0, expense: 0 };
      const openingBalance = Number(acc.openingBalance || 0);
      items.push({
        key: acc.id,
        label: acc.name,
        income: value.income,
        expense: value.expense,
        balance: openingBalance + value.income - value.expense,
        color: acc.color,
        currencyCode: acc.currencyCode,
        includeInBalance: acc.includeInBalance !== false,
        openingBalance,
      });
    });
    return items;
  }, [accounts, operations]);

  const accountTiles = useMemo(
    () => accountSummaries.filter((item) => item.key !== "all"),
    [accountSummaries]
  );

  const historyPeriodLabel =
    historyPeriod === "today"
      ? "Сегодня"
      : historyPeriod === "week"
        ? "Неделя"
        : historyPeriod === "month"
          ? "Месяц"
          : historyPeriod === "quarter"
            ? "Квартал"
            : historyPeriod === "year"
              ? "Год"
              : historyPeriod === "custom"
                ? "Свой период"
                : "Все время";

  const periodRange = useMemo(() => getPeriodRange(), [
    historyPeriod,
    customRange.from,
    customRange.to,
  ]);

  const periodRangeText = useMemo(() => {
    if (!periodRange) return "";
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${fmt.format(periodRange.start)} - ${fmt.format(periodRange.end)}`;
  }, [periodRange]);

  const filteredHistory = useMemo(() => {
    let items = historyItems;
    if (periodRange) {
      items = items.filter((op) => {
        const opDate = new Date(op.createdAt || op.date || op.created_at);
        if (Number.isNaN(opDate.getTime())) return true;
        return opDate >= periodRange.start && opDate <= periodRange.end;
      });
    }
    return items;
  }, [historyItems, historyPeriod, customRange.from, customRange.to]);

  const groupedHistory = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const groups = [];
    let currentKey = null;
    filteredHistory.forEach((op) => {
      const date = new Date(op.createdAt || op.date || op.created_at);
      const key = Number.isNaN(date.getTime()) ? "Без даты" : fmt.format(date);
      const amount = Number(op.amount || 0);
      const expenseAmount = op.type === "income" ? 0 : amount;
      const incomeAmount = op.type === "income" ? amount : 0;
      if (key !== currentKey) {
        currentKey = key;
        groups.push({
          key,
          items: [op],
          expenseTotal: expenseAmount,
          incomeTotal: incomeAmount,
        });
      } else {
        const group = groups[groups.length - 1];
        group.items.push(op);
        group.expenseTotal += expenseAmount;
        group.incomeTotal += incomeAmount;
      }
    });
    return groups;
  }, [filteredHistory]);

  const accountPages = Math.max(1, Math.ceil(accountTiles.length / 4));
  const incomePages = Math.max(1, Math.ceil(incomeSourceTotals.length / 4));
  const categoryPages = Math.max(1, Math.ceil(categoryTotals.length / 4));
  const goalTiles = goals.map((goal) => {
    const targetAmount = Number(goal.targetAmount || 0);
    const currentAmount = Number(goal.total || 0);
    const progress =
      targetAmount > 0 ? Math.min(1, Math.max(0, currentAmount / targetAmount)) : 0;
    const createdAt = goal.createdAt ? new Date(goal.createdAt) : null;
    const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
    let timeStatus = "";
    if (targetDate && !Number.isNaN(targetDate.getTime())) {
      const now = new Date();
      if (now > targetDate) {
        timeStatus = "overdue";
      } else if (createdAt && !Number.isNaN(createdAt.getTime())) {
        const totalMs = targetDate.getTime() - createdAt.getTime();
        const remainingMs = targetDate.getTime() - now.getTime();
        if (totalMs > 0 && remainingMs / totalMs <= 0.2) {
          timeStatus = "warn";
        }
      }
    }
    return {
      ...goal,
      targetAmount,
      currentAmount,
      progress,
      timeStatus,
    };
  });
  const debtOwedTotal = debtsOwed.reduce((sum, item) => sum + Number(item.remaining || 0), 0);
  const debtOweTotal =
    debtsOwe.reduce((sum, item) => sum + Number(item.remaining || 0), 0) +
    debtsCredit.reduce((sum, item) => sum + Number(item.remaining || 0), 0);
  const debtTiles = [
    { id: "owed", name: "Мне должны", amount: debtOwedTotal, tone: "positive" },
    { id: "owe", name: "Я должен", amount: debtOweTotal, tone: "negative" },
  ];
  const debtSectionTitle =
    debtSection === "owed" ? "Мне должны" : debtSection === "owe" ? "Я должен" : "";
  const debtListItems =
    debtSection === "owed"
      ? debtsOwed
      : debtTab === "credits"
        ? debtsCredit
        : debtsOwe;
  const goalPages = Math.max(1, Math.ceil((goalTiles.length + 1) / 4));
  const debtPages = Math.max(1, Math.ceil((debtTiles.length + 1) / 4));
  const isDebtInterest =
    incomeSourceDetail?.id && String(incomeSourceDetail.id).startsWith("interest_");

  const updateBalanceArrows = () => {
    const el = balanceScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setShowBalanceLeft(el.scrollLeft > 6);
    setShowBalanceRight(el.scrollLeft < maxScroll - 6);
  };

  const handleHistoryScroll = () => {
    const el = historyListRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
    if (
      nearBottom &&
      historyHasMore &&
      !historyLoading &&
      !historyQuery
    ) {
      loadHistory(false);
    }
  };

  const scrollBalanceBy = (direction) => {
    const el = balanceScrollRef.current;
    if (!el) return;
    const card = el.querySelector(".balance-card");
    const offset = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * offset, behavior: "smooth" });
  };

  useEffect(() => {
    if (view !== "home") return;
    const el = balanceScrollRef.current;
    if (!el) return;
    const handleResize = () => updateBalanceArrows();
    const raf = requestAnimationFrame(updateBalanceArrows);
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }, [view, accountSummaries.length]);

  const visibleOperations = useMemo(() => {
    return operations.filter((op) => {
      if (op.excludeFromSummary) return false;
      if (historyFilter.type !== "all" && op.type !== historyFilter.type) return false;
      if (historyFilter.category && op.category !== historyFilter.category) return false;
      return true;
    });
  }, [operations, historyFilter]);

  const categoryList =
    categories.length > 0
      ? categories.map((c) => c.name)
      : ["Еда", "Транспорт", "Жильё", "Развлечения", "Другое"];

  const accountColors = [
    "#0f172a",
    "#1e293b",
    "#0f766e",
    "#1d4ed8",
    "#6d28d9",
    "#be123c",
    "#f59e0b",
    "#f97316",
    "#facc15",
    "#22c55e",
    "#14b8a6",
    "#15803d",
    "#b45309",
  ];

  const formatMoney = (value, symbolOverride) => {
    const amount = Number(value || 0);
    const hasCents = Math.abs(amount % 1) > 0.001;
    const formatted = amount.toLocaleString("ru-RU", {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    });
    const symbol = symbolOverride || settings.currencySymbol || "₽";
    return `${formatted} ${symbol}`;
  };

  const formatMoneyShort = (value, currencyCode) => {
    const amount = Number(value || 0);
    const hasCents = Math.abs(amount % 1) > 0.001;
    const formatted = amount.toLocaleString("ru-RU", {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    });
    const code = String(currencyCode || "").toUpperCase();
    const symbol = code === "RUB" ? "₽" : currencySymbolByCode(code);
    return `${formatted} ${symbol}`;
  };

  const formatDisplayDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const getDebtAlertTone = (debt) => {
    if (!debt?.nextPaymentDate) return "";
    const today = startOfDay(new Date());
    const due = startOfDay(debt.nextPaymentDate);
    if (!today || !due) return "";
    const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return "overdue";
    if (diffDays <= 2) return "warning";
    return "";
  };

  const formatSignedMoney = (value, type, symbolOverride) => {
    const sign = type === "income" ? "+" : "-";
    return `${sign}${formatMoney(Math.abs(value || 0), symbolOverride)}`;
  };

  const getOperationFlowLine = (op) => {
    if (!op) return "";
    const account = op.account || "";
    const category = op.category || "";
    const incomeSource = op.incomeSource || (op.type === "income" ? category : "");
    if (op.type === "income") {
      return [incomeSource, account].filter(Boolean).join(" → ");
    }
    return [account, category].filter(Boolean).join(" → ");
  };

  const getGoalFlowLine = (op) => {
    if (!op) return "";
    const account = op.account || "";
    if (op.type === "income") {
      return [account, "Цель"].filter(Boolean).join(" → ");
    }
    return ["Цель", account].filter(Boolean).join(" → ");
  };

  const quickActive = {
    home: view === "home",
    overview: view === "overview",
    add: view === "categories",
    reports: view === "analytics",
    settings: view === "settings",
  };

  const content = (() => {
    if (operationEditor) {
      const isIncome = operationEditor.type === "income";
      const isCreate = operationEditor.mode === "create";
      const labelTitle = "Наименование";
      const incomeSourceValue =
        operationEditor.incomeSource ||
        (isIncome ? operationEditor.category : null) ||
        "";
      const incomeSourceOptions = (() => {
        const names = incomeSources.map((src) => src.name);
        if (incomeSourceValue && !names.includes(incomeSourceValue)) {
          return [incomeSourceValue, ...names];
        }
        return names;
      })();
      const operationPath = isIncome
        ? `${incomeSourceValue || operationEditor.label || "Источник"} → ${operationEditor.account || ""}`
        : `${operationEditor.account || ""} → ${operationEditor.category || ""}`;
      return (
        <section className="card">
          <div className="section-title operation-title">
            <button
              className="link"
              onClick={() => {
                setOperationEditor(null);
              }}
            >
              ← Назад
            </button>
            <div className="operation-meta">{operationPath}</div>
          </div>
          <label className="label">{labelTitle}</label>
          <input
            className="input"
            value={operationEditor.label}
            onChange={(e) =>
              setOperationEditor((prev) => ({ ...prev, label: e.target.value }))
            }
            placeholder="Например: кофе"
          />
          {isIncome && (
            <>
              <label className="label">Источник дохода</label>
              <select
                className="select"
                value={incomeSourceValue}
                onChange={(e) =>
                  setOperationEditor((prev) => ({
                    ...prev,
                    incomeSource: e.target.value,
                    category: e.target.value,
                  }))
                }
              >
                {incomeSourceOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          )}
          <label className="label">Дата операции</label>
          <DateSlotPicker
            value={operationEditor.date || formatDateInput(new Date())}
            ariaLabel="Дата операции"
            onChange={(value) =>
              setOperationEditor((prev) => ({ ...prev, date: value }))
            }
          />
          <label className="label">Сумма</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={operationEditor.amount}
            onChange={(e) =>
              setOperationEditor((prev) => ({
                ...prev,
                amount: e.target.value,
              }))
            }
          />
          <label className="label">{isIncome ? "На какой счет" : "Счет"}</label>
          <select
            className="select"
            value={operationEditor.account}
            onChange={(e) =>
              setOperationEditor((prev) => ({ ...prev, account: e.target.value }))
            }
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.name}>
                {acc.name}
              </option>
            ))}
          </select>
          {!isIncome && (
            <>
              <label className="label">Категория</label>
              <select
                className="select"
                value={operationEditor.category}
                onChange={(e) =>
                  setOperationEditor((prev) => ({ ...prev, category: e.target.value }))
                }
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                const payload = {
                  id: operationEditor.id,
                  label: operationEditor.label,
                  amount: operationEditor.amount,
                  account: operationEditor.account,
                  category: operationEditor.category,
                  incomeSource: operationEditor.incomeSource,
                  date: operationEditor.date,
                  type: operationEditor.type,
                };
                if (isCreate) {
                  createOperationEntry(payload);
                } else {
                  updateOperationEntry(payload);
                }
              }}
            >
              {isCreate ? "Добавить" : "Сохранить"}
            </button>
            <button className="btn ghost" onClick={() => setOperationEditor(null)}>
              Отмена
            </button>
          </div>
          {!isCreate && (
            <button
              className="btn danger"
              onClick={() => deleteOperationEntry(operationEditor)}
            >
              Удалить операцию
            </button>
          )}
        </section>
      );
    }
    if (view === "category" && selectedCategory) {
      return (
        <section className="card">
          <div className="section-title">
            <button className="link" onClick={() => setView("home")}>
              ← Назад
            </button>
            <h2>{selectedCategory.name}</h2>
          </div>
          <label className="label">Текст операции</label>
          <textarea
            className="input"
            rows={3}
            value={entryText}
            onChange={(e) => setEntryText(e.target.value)}
            placeholder="Например: 250 кофе"
          />
          <label className="label">Счет</label>
          <div className="chips">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                className={acc.name === selectedAccount ? "chip active" : "chip"}
                onClick={() => setSelectedAccount(acc.name)}
              >
                {acc.name}
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn primary" onClick={saveOperation} disabled={saving}>
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
            {error && <div className="error">{error}</div>}
          </div>
        </section>
      );
    }

    if (view === "categories") {
      return (
        <section className="card">
          <h2>Категории</h2>
          <div className="category-grid">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className="category-card"
                onClick={() => {
                  setSelectedCategory(cat);
                  setEntryText("");
                  setView("category");
                }}
              >
                <span className="category-icon">
                  <CategoryIcon name={cat.name} />
                </span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (view === "overview") {
      const accountOps = accountEditor
        ? operations.filter(
            (op) => op.account === (accountEditor.originalName || accountEditor.name)
          )
        : [];
      const accountIncome = accountOps
        .filter((op) => op.type === "income")
        .reduce((sum, op) => sum + Number(op.amount || 0), 0);
      const accountExpense = accountOps
        .filter((op) => op.type === "expense")
        .reduce((sum, op) => sum + Number(op.amount || 0), 0);
      const accountNet = accountIncome - accountExpense;
      const accountBalance = Number(accountEditor?.openingBalance || 0) + accountNet;
      const accountCurrencySymbol = accountEditor
        ? currencySymbolByCode(accountEditor.currencyCode || settings.currencyCode)
        : settings.currencySymbol;
      const accountEditorView = accountEditor ? (
        <div className="overview-manage">
          <div className="overview-manage-header">
            <div className="overview-manage-title">
              {accountEditor.mode === "create" ? "Новый счет" : "Счет"}
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                setAccountEditor(null);
                setEditingAccountId(null);
                setEditingAccountName("");
                setEditingAccountBalance("");
                setNewAccountBalance("");
                setShowAccountEditPanel(false);
              }}
            >
              Закрыть
            </button>
          </div>
          {error && <div className="error">{error}</div>}
          {accountEditor.mode === "create" ? (
            <div className="account-edit-panel">
              <label className="label">Название счета</label>
              <input
                className="input"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Новый счет"
              />
              <label className="label">Текущий баланс</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={newAccountBalance}
                onChange={(e) => setNewAccountBalance(e.target.value)}
                placeholder="0"
              />
              <button className="btn" onClick={createAccount}>
                Добавить
              </button>
            </div>
          ) : (
            <>
              <div className="account-preview">
                <div
                  className="account-preview-card large"
                  style={{ background: accountEditor.color || "#0f172a" }}
                >
                  <button
                    className="account-edit-icon"
                    onClick={() => setShowAccountEditPanel(true)}
                    aria-label="Редактировать счет"
                  >
                    ✎
                  </button>
                  <div className="balance-title">{accountEditor.name}</div>
                  <div className="balance-value">
                    {formatMoney(accountBalance, accountCurrencySymbol)}
                  </div>
                </div>
              </div>
              {accountSaveMessage && (
                <div className="status success">{accountSaveMessage}</div>
              )}
              {showAccountEditPanel && (
                <div className="account-edit-panel">
                  <label className="label">Название счета</label>
                  <input
                    className="input"
                    value={editingAccountName}
                    onChange={(e) => setEditingAccountName(e.target.value)}
                    placeholder="Название счета"
                  />
                  <label className="label">Текущий баланс</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={editingAccountBalance}
                    onChange={(e) => setEditingAccountBalance(e.target.value)}
                    placeholder="0"
                  />
                  <div className="row">
                    <button className="btn" onClick={() => updateAccount(accountEditor.id)}>
                      Сохранить
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => setShowAccountEditPanel(false)}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <label className="toggle large">
            <input
              type="checkbox"
              checked={accountEditor.includeInBalance !== false}
              onChange={(e) =>
                setAccountEditor((prev) => ({
                  ...prev,
                  includeInBalance: e.target.checked,
                }))
              }
            />
            Учитывать в общем балансе
          </label>
          <div className="row">
            <label className="label">Валюта</label>
            <select
              className="select"
              value={accountEditor.currencyCode}
              onChange={(e) =>
                setAccountEditor((prev) => ({
                  ...prev,
                  currencyCode: e.target.value,
                }))
              }
            >
              {currencyOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.symbol}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label className="label">Цвет</label>
            <div className="color-row">
              {accountColors.map((color) => (
                <button
                  key={color}
                  className={accountEditor.color === color ? "color-dot active" : "color-dot"}
                  style={{ background: color }}
                  onClick={() =>
                    setAccountEditor((prev) => ({
                      ...prev,
                      color,
                    }))
                  }
                />
              ))}
            </div>
          </div>
          {accountEditor.mode === "edit" && !showAccountEditPanel && (
            <button className="btn" onClick={() => updateAccount(accountEditor.id)}>
              Сохранить изменения
            </button>
          )}
          {accountEditor.mode === "create" && accountSaveMessage && (
            <div className="status success">{accountSaveMessage}</div>
          )}
          {accountEditor.mode === "edit" && (
            <button className="btn danger" onClick={() => deleteAccount(accountEditor.id)}>
              Удалить счет
            </button>
          )}
        </div>
      ) : null;

      if (accountEditorView) {
        return <section className="overview-shell">{accountEditorView}</section>;
      }

      const incomeSourceEditorView = incomeSourceEditor ? (
        <div className="overview-manage">
          <div className="overview-manage-header">
            <div className="overview-manage-title">
              {incomeSourceEditor.mode === "create"
                ? "Новый источник дохода"
                : "Источник дохода"}
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                setIncomeSourceEditor(null);
                setEditingIncomeSourceName("");
                setNewIncomeSourceName("");
              }}
            >
              Закрыть
            </button>
          </div>
          {incomeSourceEditor.mode === "create" ? (
            <div className="account-edit-panel">
              <label className="label">Название источника</label>
              <input
                className="input"
                value={newIncomeSourceName}
                onChange={(e) => setNewIncomeSourceName(e.target.value)}
                placeholder="Например: Зарплата"
              />
              <button className="btn" onClick={createIncomeSource}>
                Добавить
              </button>
            </div>
          ) : (
            <div className="account-edit-panel">
              <label className="label">Название источника</label>
              <input
                className="input"
                value={editingIncomeSourceName}
                onChange={(e) => setEditingIncomeSourceName(e.target.value)}
              />
              <div className="row">
                <button
                  className="btn"
                  onClick={() => updateIncomeSource(incomeSourceEditor.id)}
                >
                  Сохранить
                </button>
              </div>
            </div>
          )}
          {incomeSourceSaveMessage && (
            <div className="status success">{incomeSourceSaveMessage}</div>
          )}
          {incomeSourceEditor.mode === "edit" && (
            <button
              className="btn danger"
              onClick={() => deleteIncomeSource(incomeSourceEditor.id)}
            >
              Удалить источник
            </button>
          )}
        </div>
      ) : null;

      if (incomeSourceEditorView) {
        return <section className="overview-shell">{incomeSourceEditorView}</section>;
      }

      const categoryEditorView = categoryEditor ? (
        <div className="overview-manage">
          <div className="overview-manage-header">
            <div className="overview-manage-title">
              {categoryEditor.mode === "create" ? "Новая категория" : "Категория"}
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                setCategoryEditor(null);
                setEditingCategoryName("");
                setNewCategoryName("");
              }}
            >
              Закрыть
            </button>
          </div>
          {categoryEditor.mode === "create" ? (
            <div className="account-edit-panel">
              <label className="label">Название категории</label>
              <input
                className="input"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Например: Еда"
              />
              <label className="label">Бюджет на категорию</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={newCategoryBudget}
                onChange={(e) => setNewCategoryBudget(e.target.value)}
                placeholder="Не задан"
              />
              <button className="btn" onClick={createCategory}>
                Добавить
              </button>
            </div>
          ) : (
            <div className="account-edit-panel">
              <label className="label">Название категории</label>
              <input
                className="input"
                value={editingCategoryName}
                onChange={(e) => setEditingCategoryName(e.target.value)}
              />
              <label className="label">Бюджет на категорию</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={editingCategoryBudget}
                onChange={(e) => setEditingCategoryBudget(e.target.value)}
                placeholder="Не задан"
              />
              <div className="row">
                <button className="btn" onClick={() => updateCategory(categoryEditor.id)}>
                  Сохранить
                </button>
              </div>
            </div>
          )}
          {categorySaveMessage && (
            <div className="status success">{categorySaveMessage}</div>
          )}
          {categoryEditor.mode === "edit" && (
            <button
              className="btn danger"
              onClick={() => deleteCategory(categoryEditor.id)}
            >
              Удалить категорию
            </button>
          )}
        </div>
      ) : null;

      if (categoryEditorView) {
        return <section className="overview-shell">{categoryEditorView}</section>;
      }

      const goalEditorView = goalEditor ? (
        <div className="overview-manage">
          <div className="overview-manage-header">
            <div className="overview-manage-title">
              {goalEditor.mode === "create" ? "Новая цель" : "Цель"}
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                setGoalEditor(null);
                setGoalSaveMessage("");
              }}
            >
              Закрыть
            </button>
          </div>
          <div className="account-edit-panel">
            <label className="label">Название цели</label>
            <input
              className={`input ${goalErrors.name ? "invalid" : ""}`}
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="Например: Отпуск"
            />
            <label className="label">Сумма цели</label>
            <input
              className={`input ${goalErrors.target ? "invalid" : ""}`}
              type="number"
              step="0.01"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
              placeholder="0"
            />
            <div className="row">
              <label className="label">Срок</label>
              <button
                className="btn ghost"
                onClick={() =>
                  setGoalDate(
                    goalDate ? "" : formatDateInput(new Date())
                  )
                }
              >
                {goalDate ? "Сбросить" : "Задать"}
              </button>
            </div>
            {goalDate && (
              <DateSlotPicker
                value={goalDate}
                ariaLabel="Срок цели"
                onChange={(value) => setGoalDate(value)}
              />
            )}
            <div className="row">
              <label className="label">Цвет</label>
              <div className="color-row">
                {accountColors.map((color) => (
                  <button
                    key={color}
                    className={goalColor === color ? "color-dot active" : "color-dot"}
                    style={{ background: color }}
                    onClick={() => setGoalColor(color)}
                  />
                ))}
              </div>
            </div>
            <button
              className="btn ghost"
              onClick={() =>
                setGoalNotifyOpen((prev) => {
                  const next = !prev;
                  if (next && !goalNotifyStartDate) {
                    setGoalNotifyStartDate(formatDateInput(new Date()));
                  }
                  if (next && !goalNotifyFrequency) {
                    setGoalNotifyFrequency("monthly");
                  }
                  if (next && !goalNotifyTime) {
                    setGoalNotifyTime("09:00");
                  }
                  return next;
                })
              }
            >
              Уведомления
            </button>
            {goalNotifyOpen && (
              <div className="goal-notify">
                <label className="toggle large">
                  <input
                    type="checkbox"
                    checked={goalNotify}
                    onChange={(e) => setGoalNotify(e.target.checked)}
                  />
                  Включить уведомления
                </label>
                <label className="label">Напоминать</label>
                <select
                  className={`select ${goalErrors.notifyFrequency ? "invalid" : ""}`}
                  value={goalNotifyFrequency}
                  onChange={(e) => setGoalNotifyFrequency(e.target.value)}
                >
                  <option value="daily">Каждый день</option>
                  <option value="weekly">Каждую неделю</option>
                  <option value="monthly">Каждый месяц</option>
                </select>
                <label className="label">Начать с даты</label>
                <DateSlotPicker
                  value={goalNotifyStartDate || formatDateInput(new Date())}
                  ariaLabel="Дата начала уведомлений"
                  onChange={(value) => setGoalNotifyStartDate(value)}
                />
                {goalErrors.notifyStartDate && (
                  <div className="error">Укажите дату</div>
                )}
                <label className="label">Время</label>
                <input
                  className={`input ${goalErrors.notifyTime ? "invalid" : ""}`}
                  type="time"
                  value={goalNotifyTime || "09:00"}
                  onChange={(e) => setGoalNotifyTime(e.target.value)}
                />
                {goalErrors.notifyTime && <div className="error">Укажите время</div>}
              </div>
            )}
            <div className="row">
              <button
                className="btn"
                onClick={() =>
                  goalEditor.mode === "create"
                    ? createGoal()
                    : updateGoal(goalEditor.id)
                }
              >
                Сохранить
              </button>
            </div>
          </div>
          {goalSaveMessage && <div className="status success">{goalSaveMessage}</div>}
          {goalEditor.mode === "edit" && (
            <div className="goal-delete">
              <button
                className="btn danger"
                onClick={() => setGoalDeleteOpen((prev) => !prev)}
              >
                Удалить цель
              </button>
              {goalDeleteOpen && (
                <div className="goal-delete-panel">
                  <div className="label">Что сделать с остатком?</div>
                  <div className="goal-delete-choice">
                    <button
                      className={`btn ${goalDeleteMode === "transfer" ? "" : "ghost"}`}
                      onClick={() => {
                        setGoalDeleteMode("transfer");
                        setGoalDeleteMessage("");
                      }}
                    >
                      Перевести на счет
                    </button>
                    <button
                      className={`btn ${goalDeleteMode === "zero" ? "" : "ghost"}`}
                      onClick={() => {
                        setGoalDeleteMode("zero");
                        setGoalDeleteMessage("");
                      }}
                    >
                      Обнулить
                    </button>
                  </div>
                  {goalDeleteMode === "transfer" && (
                    <>
                      {accounts.length ? (
                        <select
                          className="select"
                          value={goalDeleteAccount}
                          onChange={(e) => setGoalDeleteAccount(e.target.value)}
                        >
                          <option value="">Выберите счет</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.name}>
                              {acc.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="muted">Нет счетов для перевода</div>
                      )}
                    </>
                  )}
                  {goalDeleteMessage && <div className="error">{goalDeleteMessage}</div>}
                  <div className="row">
                    <button
                      className="btn danger"
                      onClick={() => deleteGoal(goalEditor.id)}
                    >
                      Удалить
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => setGoalDeleteOpen(false)}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null;

      if (goalEditorView) {
        return <section className="overview-shell">{goalEditorView}</section>;
      }

      const debtDeletePanel =
        debtDeleteOpen && debtDeleteTarget ? (
          <div className="goal-delete">
            <div className="muted">
              Остаток:{" "}
              {formatMoney(
                debtDeleteTarget.remaining,
                currencySymbolByCode(debtDeleteTarget.currencyCode)
              )}
            </div>
            <div className="goal-delete-panel">
              <div className="goal-delete-choice">
                <button
                  className={`btn ${debtDeleteMode === "transfer" ? "" : "ghost"}`}
                  onClick={() => setDebtDeleteMode("transfer")}
                >
                  Перевести на счет
                </button>
                <button
                  className={`btn ${debtDeleteMode === "zero" ? "" : "ghost"}`}
                  onClick={() => setDebtDeleteMode("zero")}
                >
                  Обнулить остаток
                </button>
              </div>
              {debtDeleteMode === "transfer" && (
                <>
                  <label className="label">Счет</label>
                  {accounts.length ? (
                    <select
                      className="select"
                      value={debtDeleteAccount}
                      onChange={(e) => setDebtDeleteAccount(e.target.value)}
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.name}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="muted">Нет счетов для перевода</div>
                  )}
                </>
              )}
              {debtDeleteMessage && <div className="error">{debtDeleteMessage}</div>}
              <div className="row">
                <button
                  className="btn danger"
                  onClick={() => deleteDebt(debtDeleteTarget.id)}
                >
                  Удалить
                </button>
                <button className="btn ghost" onClick={closeDebtDelete}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        ) : null;

      const debtEditorView = debtEditor ? (
        <div className="overview-manage">
          <div className="overview-manage-header">
            <div className="overview-manage-title">
              {debtEditor.mode === "create" ? "Новая запись" : "Редактирование"}
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                setDebtEditor(null);
                setDebtEditorMessage("");
              }}
            >
              Закрыть
            </button>
          </div>
          <div className="account-edit-panel">
            <label className="label">Имя / Компания</label>
            <input
              className="input"
              value={debtName}
              onChange={(e) => setDebtName(e.target.value)}
              placeholder="Например: Роман"
            />
            <label className="label">Дата выдачи</label>
            <DateSlotPicker
              value={debtIssuedDate || formatDateInput(new Date())}
              ariaLabel="Дата выдачи"
              onChange={(value) => setDebtIssuedDate(value)}
            />
            <label className="label">Сумма займа</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={debtPrincipal}
              onChange={(e) => setDebtPrincipal(e.target.value)}
            />
            <label className="label">Сумма к возврату</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={debtTotal}
              onChange={(e) => setDebtTotal(e.target.value)}
            />
            <label className="label">Дата возврата</label>
            <DateSlotPicker
              value={debtDueDate || formatDateInput(new Date())}
              ariaLabel="Дата возврата"
              onChange={(value) => setDebtDueDate(value)}
            />
            <label className="label">Валюта</label>
            <select
              className="select"
              value={debtCurrencyCode}
              onChange={(e) => setDebtCurrencyCode(e.target.value)}
            >
              {currencyOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.code} {opt.symbol}
                </option>
              ))}
            </select>
            <label className="label">Примечание</label>
            <input
              className="input"
              value={debtNotes}
              onChange={(e) => setDebtNotes(e.target.value)}
              placeholder="Комментарий"
            />
            <div className="row">
              <button
                className="btn"
                onClick={() =>
                  debtEditor.mode === "create"
                    ? createDebt()
                    : updateDebt(debtEditor.id)
                }
              >
                Сохранить
              </button>
            </div>
            {debtEditorMessage && (
              <div className="status success">{debtEditorMessage}</div>
            )}
            {debtEditor.mode === "edit" && (
              <>
                <button
                  className="btn danger"
                  onClick={() => openDebtDelete(debtEditor)}
                >
                  Удалить
                </button>
                {debtDeleteTarget?.id === debtEditor.id ? debtDeletePanel : null}
              </>
            )}
          </div>
        </div>
      ) : null;

      if (debtEditorView) {
        return <section className="overview-shell">{debtEditorView}</section>;
      }

      if (debtDetail) {
        const debtCurrencySymbol = currencySymbolByCode(debtDetail.currencyCode);
        return (
          <section className="overview-shell">
            <div className="overview-manage-header">
              <div className="overview-manage-title">{debtDetail.name}</div>
              <button className="btn ghost" onClick={() => setDebtDetail(null)}>
                Закрыть
              </button>
            </div>
            <div className="debt-summary">
              <div className="debt-summary-amount">
                {formatMoney(debtDetail.totalAmount, debtCurrencySymbol)}
              </div>
              <div className="debt-summary-meta">
                <div className="debt-summary-next">
                  Сумма займа: {formatMoney(debtDetail.principalAmount, debtCurrencySymbol)}
                </div>
                <div className="debt-summary-next">
                  Дата выдачи:{" "}
                  {debtDetail.issuedDate ? formatDisplayDate(debtDetail.issuedDate) : "—"}
                </div>
                <div className="debt-summary-next">
                  Дата возврата:{" "}
                  {debtDetail.dueDate ? formatDisplayDate(debtDetail.dueDate) : "—"}
                </div>
                {debtDetail.notes && (
                  <div className="debt-summary-next">Комментарий: {debtDetail.notes}</div>
                )}
              </div>
            </div>

            <div className="row">
              <input
                className="input"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Поиск по названию или сумме"
              />
              <button
                className="btn ghost"
                onClick={() => {
                  setCustomRangeDraft(customRange);
                  setShowCustomRange(historyPeriod === "custom");
                  setShowPeriodSheet(true);
                }}
              >
                Период
              </button>
            </div>
            {periodRangeText && <div className="history-range">{periodRangeText}</div>}

            <button
              className="btn"
              onClick={() => {
                const next = !debtPaymentFormOpen;
                setDebtPaymentFormOpen(next);
                if (next) {
                  setDebtPaymentAmount("");
                  setDebtPaymentNote("");
                  setDebtPaymentMessage("");
                  setDebtPaymentDate(formatDateInput(new Date()));
                  if (accounts.length) {
                    setDebtPaymentAccount(accounts[0].name);
                  }
                }
              }}
            >
              Добавить платеж
            </button>

            {debtPaymentFormOpen && (
              <div className="goal-transfer">
                <label className="label">Сумма платежа</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={debtPaymentAmount}
                  onChange={(e) => setDebtPaymentAmount(e.target.value)}
                />
                <label className="label">Дата платежа</label>
                <DateSlotPicker
                  value={debtPaymentDate || formatDateInput(new Date())}
                  ariaLabel="Дата платежа"
                  onChange={(value) => setDebtPaymentDate(value)}
                />
                <label className="label">Счет</label>
                {accounts.length ? (
                  <select
                    className="select"
                    value={debtPaymentAccount}
                    onChange={(e) => setDebtPaymentAccount(e.target.value)}
                  >
                    <option value="">Выберите счет</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="muted">Нет счетов</div>
                )}
                <label className="label">Комментарий</label>
                <input
                  className="input"
                  value={debtPaymentNote}
                  onChange={(e) => setDebtPaymentNote(e.target.value)}
                  placeholder="Комментарий"
                />
                <button className="btn" onClick={addDebtPayment}>
                  Сохранить
                </button>
                {debtPaymentMessage && (
                  <div
                    className={
                      /ошиб|выберите|введите/i.test(debtPaymentMessage)
                        ? "error"
                        : "status success"
                    }
                  >
                    {debtPaymentMessage}
                  </div>
                )}
              </div>
            )}

            <div className="history-list" ref={historyListRef} onScroll={handleHistoryScroll}>
              {groupedHistory.length === 0 ? (
                <div className="muted">Пока нет операций</div>
              ) : (
                groupedHistory.map((group) => (
                  <div key={group.key} className="history-group">
                    <div className="history-date-row">
                      <div className="history-date">{group.key}</div>
                    </div>
                    <div className="history-rows">
                      {group.items.map((op) => (
                        <button
                          key={op.id}
                          className="history-row"
                          onClick={() =>
                            setOperationEditor({
                              mode: "edit",
                              id: op.id,
                              label: op.label || op.text || "",
                              amount: op.amount,
                              account: op.account,
                              category: op.category || "Прочее",
                              incomeSource: op.incomeSource || op.category || "",
                              type: op.type,
                              date: formatDateInput(
                                op.createdAt || op.date || op.created_at || ""
                              ),
                            })
                          }
                        >
                          <div className="history-row-main">
                            <span className="history-label">{op.label || op.text}</span>
                            <span className="history-meta">{getOperationFlowLine(op)}</span>
                          </div>
                          <span
                            className={`history-amount ${op.type === "income" ? "income" : "expense"}`}
                          >
                            {formatSignedMoney(op.amount, op.type, settings.currencySymbol)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              className="btn ghost"
              onClick={() =>
                setDebtEditor({
                  mode: "edit",
                  id: debtDetail.id,
                  kind: debtDetail.kind,
                  name: debtDetail.name,
                  principalAmount: debtDetail.principalAmount,
                  totalAmount: debtDetail.totalAmount,
                  issuedDate: debtDetail.issuedDate,
                  dueDate: debtDetail.dueDate,
                  notes: debtDetail.notes || "",
                  currencyCode: debtDetail.currencyCode,
                })
              }
            >
              Редактировать
            </button>
            <button className="btn danger" onClick={() => openDebtDelete(debtDetail)}>
              Удалить
            </button>
            {debtDeleteTarget?.id === debtDetail.id ? debtDeletePanel : null}
          </section>
        );
      }

      if (debtSection) {
        return (
          <section className="overview-shell">
            <div className="overview-manage-header">
              <div className="overview-manage-title">{debtSectionTitle}</div>
              <button className="btn ghost" onClick={() => setDebtSection(null)}>
                Закрыть
              </button>
            </div>
            {debtSection === "owe" && (
              <div className="pill-tabs">
                <button
                  className={`pill ${debtTab === "debts" ? "active" : ""}`}
                  onClick={() => setDebtTab("debts")}
                >
                  Долги
                </button>
                <button
                  className={`pill ${debtTab === "credits" ? "active" : ""}`}
                  onClick={() => setDebtTab("credits")}
                >
                  Кредиты
                </button>
              </div>
            )}
            <div className="debt-list">
              {debtListItems.length === 0 ? (
                <div className="muted">Пока нет записей</div>
              ) : (
                debtListItems.map((item) => {
                  const debtCurrencyCode = item.currencyCode || settings.currencyCode || "RUB";
                  const totalAmount = Number(item.totalAmount || 0);
                  const remainingAmount = Number(item.remaining || 0);
                  const progress =
                    totalAmount > 0
                      ? Math.max(0, Math.min(1, (totalAmount - remainingAmount) / totalAmount))
                      : 0;
                  const toneClass =
                    item.kind === "owed_to_me" ? "positive" : "negative";
                  const remainingText = formatMoneyShort(remainingAmount, debtCurrencyCode);
                  const totalText = formatMoneyShort(totalAmount, debtCurrencyCode);
                  const dueDateText = item.dueDate
                    ? `до ${formatDisplayDate(item.dueDate)}`
                    : "дата возврата —";
                  return (
                    <button
                      key={item.id}
                      className={`debt-banner ${toneClass}`}
                      onClick={() =>
                        setDebtDetail({
                          ...item,
                          kind: item.kind,
                        })
                      }
                    >
                      <div className="debt-banner-header">
                        <span className="debt-banner-name">{item.name}</span>
                      </div>
                      <div className="debt-banner-sub">
                        <span className="debt-banner-label">Остаток по долгу</span>
                        <span className="debt-banner-value">
                          {remainingText} / {totalText}
                        </span>
                      </div>
                      <div className="debt-banner-bar" aria-hidden="true">
                        <div
                          className="debt-banner-progress"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                      <div className="debt-banner-foot">
                        <span className="debt-banner-foot-spacer" />
                        <span className="debt-banner-foot-date">{dueDateText}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <button
              className="btn"
              onClick={() => {
                const kind =
                  debtSection === "owed"
                    ? "owed_to_me"
                    : debtTab === "credits"
                      ? "credit"
                      : "i_owe";
                setDebtEditor({ mode: "create", kind });
                setDebtDetail(null);
              }}
            >
              Добавить
            </button>
          </section>
        );
      }

      if (goalTxEditor) {
        return (
          <section className="overview-shell">
            <div className="overview-manage-header">
              <div className="overview-manage-title">Операция цели</div>
              <button className="btn ghost" onClick={() => setGoalTxEditor(null)}>
                Закрыть
              </button>
            </div>
            <label className="label">Дата операции</label>
            <DateSlotPicker
              value={goalTxEditor.date || formatDateInput(new Date())}
              ariaLabel="Дата операции"
              onChange={(value) =>
                setGoalTxEditor((prev) => ({ ...prev, date: value }))
              }
            />
            <label className="label">Тип</label>
            <select
              className="select"
              value={goalTxEditor.type}
              onChange={(e) =>
                setGoalTxEditor((prev) => ({ ...prev, type: e.target.value }))
              }
            >
              <option value="income">Пополнение</option>
              <option value="expense">Изъятие</option>
            </select>
            {accounts.length > 0 && (
              <>
                <label className="label">
                  {goalTxEditor.type === "income" ? "Со счета" : "На счет"}
                </label>
                <select
                  className={`select ${goalTxError ? "invalid" : ""}`}
                  value={goalTxEditor.account || ""}
                  onChange={(e) =>
                    setGoalTxEditor((prev) => ({ ...prev, account: e.target.value }))
                  }
                >
                  <option value="">Выберите счет</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.name}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label className="label">Сумма</label>
            <input
              className={`input ${goalTxError ? "invalid" : ""}`}
              type="number"
              step="0.01"
              value={goalTxEditor.amount}
              onChange={(e) =>
                setGoalTxEditor((prev) => ({ ...prev, amount: e.target.value }))
              }
            />
            {goalTxError && <div className="error">{goalTxError}</div>}
            <div className="row">
              <button
                className="btn"
                onClick={() => updateGoalTransactionEntry(goalTxEditor)}
              >
                Сохранить
              </button>
              <button className="btn ghost" onClick={() => setGoalTxEditor(null)}>
                Отмена
              </button>
            </div>
            <button
              className="btn danger"
              onClick={() => deleteGoalTransactionEntry(goalTxEditor)}
            >
              Удалить операцию
            </button>
          </section>
        );
      }

      if (goalDetail) {
        const progress =
          goalDetail.targetAmount > 0
            ? Math.min(1, Math.max(0, (goalDetail.total || 0) / goalDetail.targetAmount))
            : 0;
        return (
          <section className="overview-shell">
            <div className="overview-manage-header">
              <div className="overview-manage-title">{goalDetail.name}</div>
              <button
                className="btn ghost"
                onClick={() => {
                  setGoalDetail(null);
                  setGoalTransfer(null);
                  setGoalTransferAmount("");
                  setGoalTransferAccount("");
                }}
              >
                Закрыть
              </button>
            </div>
            <div
              className="goal-detail-card"
              style={{ background: goalDetail.color || "#0f172a" }}
            >
              <div className="goal-detail-name">{goalDetail.name}</div>
              <div className="goal-detail-amount">
                {formatMoney(goalDetail.total || 0)} /{" "}
                {formatMoney(goalDetail.targetAmount || 0)}
              </div>
              {goalDetail.targetDate && (
                <div className="goal-detail-date">
                  до {formatDisplayDate(goalDetail.targetDate)}
                </div>
              )}
              <div className="goal-progress">
                <div
                  className="goal-progress-fill"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>

            <div className="row">
              <input
                className="input"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Поиск по названию или сумме"
              />
              <button
                className="btn ghost"
                onClick={() => {
                  setCustomRangeDraft(customRange);
                  setShowCustomRange(historyPeriod === "custom");
                  setShowPeriodSheet(true);
                }}
              >
                Период
              </button>
            </div>
            {periodRangeText && (
              <div className="history-range">{periodRangeText}</div>
            )}

            <div className="row">
              <button
                className={`btn ghost ${goalTransfer?.type === "income" ? "active" : ""}`}
                onClick={() => {
                  setGoalTransfer({ goalId: goalDetail.id, type: "income" });
                  setGoalTransferAmount("");
                  setGoalTransferAccount(accounts[0]?.name || "");
                  setGoalTransferMessage("");
                }}
              >
                Пополнить
              </button>
              <button
                className={`btn ghost ${goalTransfer?.type === "expense" ? "active" : ""}`}
                onClick={() => {
                  setGoalTransfer({ goalId: goalDetail.id, type: "expense" });
                  setGoalTransferAmount("");
                  setGoalTransferAccount(accounts[0]?.name || "");
                  setGoalTransferMessage("");
                }}
              >
                Изъять
              </button>
            </div>

            {goalTransfer && goalTransfer.goalId === goalDetail.id && (
              <div className="goal-transfer">
                <label className="label">
                  {goalTransfer.type === "income" ? "Сумма пополнения" : "Сумма изъятия"}
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={goalTransferAmount}
                  onChange={(e) => setGoalTransferAmount(e.target.value)}
                />
                {accounts.length > 0 && (
                  <>
                    <label className="label">
                      {goalTransfer.type === "income" ? "Со счета" : "На счет"}
                    </label>
                    <select
                      className="select"
                      value={goalTransferAccount}
                      onChange={(e) => setGoalTransferAccount(e.target.value)}
                    >
                      <option value="">Выберите счет</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.name}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <button
                  className="btn"
                  onClick={() => addGoalTransaction(goalDetail.id, goalTransfer.type)}
                >
                  Сохранить
                </button>
                {goalTransferMessage && (
                  <div
                    className={
                      /недостаточно|ошиб|выберите|введите/i.test(goalTransferMessage)
                        ? "error"
                        : "status success"
                    }
                  >
                    {goalTransferMessage}
                  </div>
                )}
              </div>
            )}

            <div className="history-list" ref={historyListRef} onScroll={handleHistoryScroll}>
              {groupedHistory.length === 0 ? (
                <div className="muted">Пока нет операций</div>
              ) : (
                groupedHistory.map((group) => (
                  <div key={group.key} className="history-group">
                    <div className="history-date-row">
                      <div className="history-date">{group.key}</div>
                    </div>
                    <div className="history-rows">
                      {group.items.map((op) => (
                        <button
                          key={op.id}
                          className="history-row"
                          onClick={() => {
                            setGoalTxError("");
                            setGoalTxEditor({
                              id: op.id,
                              goalId: goalDetail.id,
                              type: op.type,
                              amount: op.amount,
                              account: op.account || accounts[0]?.name || "",
                              date: formatDateInput(
                                op.createdAt || op.date || op.created_at || ""
                              ),
                            });
                          }}
                        >
                          <div className="history-row-main">
                            <span className="history-label">{op.label}</span>
                            <span className="history-meta">{getGoalFlowLine(op)}</span>
                          </div>
                          <span
                            className={`history-amount ${op.type === "income" ? "income" : "expense"}`}
                          >
                            {formatSignedMoney(op.amount, op.type, settings.currencySymbol)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              className="btn ghost"
              onClick={() =>
                setGoalEditor({
                  id: goalDetail.id,
                  name: goalDetail.name,
                  targetAmount: goalDetail.targetAmount || 0,
                  targetDate: goalDetail.targetDate || "",
                  color: goalDetail.color || "#0f172a",
                  notify: goalDetail.notify === true,
                  notifyFrequency: goalDetail.notifyFrequency || null,
                  notifyStartDate: goalDetail.notifyStartDate || null,
                  notifyTime: goalDetail.notifyTime || null,
                  mode: "edit",
                })
              }
            >
              Редактировать цель
            </button>
          </section>
        );
      }

      if (categoryDetail) {
        return (
          <section className="overview-shell">
            <div className="overview-manage-header">
              <div className="overview-manage-title">{categoryDetail.name}</div>
              <button className="btn ghost" onClick={() => setCategoryDetail(null)}>
                Закрыть
              </button>
            </div>
            <div className="row">
              <input
                className="input"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Поиск по названию или сумме"
              />
              <button
                className="btn ghost"
                onClick={() => {
                  setCustomRangeDraft(customRange);
                  setShowCustomRange(historyPeriod === "custom");
                  setShowPeriodSheet(true);
                }}
              >
                Период
              </button>
            </div>
            {periodRangeText && (
              <div className="history-range">{periodRangeText}</div>
            )}
            <button
              className="btn"
              onClick={() =>
                setOperationEditor({
                  mode: "create",
                  type: "expense",
                  label: "",
                  amount: "",
                  account: accounts[0]?.name || "",
                  category: categoryDetail.name,
                  date: formatDateInput(new Date()),
                })
              }
            >
              Добавить расход
            </button>
            <div className="history-list" ref={historyListRef} onScroll={handleHistoryScroll}>
              {groupedHistory.length === 0 ? (
                <div className="muted">Пока нет операций</div>
              ) : (
                groupedHistory.map((group) => (
                  <div key={group.key} className="history-group">
                    <div className="history-date-row">
                      <div className="history-date">{group.key}</div>
                      {group.expenseTotal > 0 && (
                        <div className="history-date-total">
                          {formatMoney(group.expenseTotal, settings.currencySymbol)}
                        </div>
                      )}
                    </div>
                    <div className="history-rows">
                      {group.items.map((op) => (
                        <button
                          key={op.id}
                          className="history-row"
                          onClick={() =>
                            setOperationEditor({
                              mode: "edit",
                              id: op.id,
                              label: op.label || op.text || "",
                              amount: op.amount,
                              account: op.account,
                              category: op.category || "Другое",
                              type: op.type,
                              date: formatDateInput(
                                op.createdAt || op.date || op.created_at || ""
                              ),
                            })
                          }
                        >
                          <div className="history-row-main">
                            <span className="history-label">{op.label || op.text}</span>
                            <span className="history-meta">
                              {getOperationFlowLine(op)}
                            </span>
                          </div>
                          <span
                            className={`history-amount ${op.type === "income" ? "income" : "expense"}`}
                          >
                            {formatSignedMoney(op.amount, op.type, settings.currencySymbol)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              className="btn ghost"
              onClick={() =>
                setCategoryEditor(() => {
                  const current = categories.find((c) => c.id === categoryDetail.id);
                  return {
                    id: categoryDetail.id,
                    name: categoryDetail.name,
                    originalName: categoryDetail.name,
                    budget: current?.budget ?? categoryDetail.budget ?? null,
                    mode: "edit",
                  };
                })
              }
            >
              Редактировать категорию
            </button>
          </section>
        );
      }

      if (incomeSourceDetail) {
        return (
          <section className="overview-shell">
            <div className="overview-manage-header">
              <div className="overview-manage-title">{incomeSourceDetail.name}</div>
              <button className="btn ghost" onClick={() => setIncomeSourceDetail(null)}>
                Закрыть
              </button>
            </div>
            <div className="row">
              <input
                className="input"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Поиск по названию или сумме"
              />
              <button
                className="btn ghost"
                onClick={() => {
                  setCustomRangeDraft(customRange);
                  setShowCustomRange(historyPeriod === "custom");
                  setShowPeriodSheet(true);
                }}
              >
                Период
              </button>
            </div>
            {periodRangeText && (
              <div className="history-range">{periodRangeText}</div>
            )}
            <button
              className="btn"
              onClick={() =>
                setOperationEditor({
                  mode: "create",
                  type: "income",
                  label: "",
                  amount: "",
                  account: accounts[0]?.name || "",
                  category: incomeSourceDetail.name,
                  incomeSource: incomeSourceDetail.name,
                  date: formatDateInput(new Date()),
                })
              }
            >
              Добавить доход
            </button>
            <div className="history-list" ref={historyListRef} onScroll={handleHistoryScroll}>
              {groupedHistory.length === 0 ? (
                <div className="muted">Пока нет операций</div>
              ) : (
                groupedHistory.map((group) => (
                  <div key={group.key} className="history-group">
                    <div className="history-date-row">
                      <div className="history-date">{group.key}</div>
                      {group.expenseTotal > 0 && (
                        <div className="history-date-total">
                          {formatMoney(group.expenseTotal, settings.currencySymbol)}
                        </div>
                      )}
                    </div>
                    <div className="history-rows">
                      {group.items.map((op) => (
                        <button
                          key={op.id}
                          className="history-row"
                          onClick={() =>
                            setOperationEditor({
                              mode: "edit",
                              id: op.id,
                              label: op.label || op.text || "",
                              amount: op.amount,
                              account: op.account,
                              category: op.category || "Прочее",
                              incomeSource: op.incomeSource || op.category || "",
                              type: op.type,
                              date: formatDateInput(
                                op.createdAt || op.date || op.created_at || ""
                              ),
                            })
                          }
                        >
                          <div className="history-row-main">
                            <span className="history-label">{op.label || op.text}</span>
                            <span className="history-meta">
                              {getOperationFlowLine(op)}
                            </span>
                          </div>
                          <span
                            className={`history-amount ${op.type === "income" ? "income" : "expense"}`}
                          >
                            {formatSignedMoney(op.amount, op.type, settings.currencySymbol)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            {!isDebtInterest && (
              <button
                className="btn ghost"
                onClick={() =>
                  setIncomeSourceEditor({
                    id: incomeSourceDetail.id,
                    name: incomeSourceDetail.name,
                    originalName: incomeSourceDetail.name,
                    mode: "edit",
                  })
                }
              >
                Редактировать источник
              </button>
            )}
          </section>
        );
      }

      if (accountDetail) {
        return (
          <section className="overview-shell">
            <div className="overview-manage-header">
              <div className="overview-manage-title">{accountDetail.name}</div>
              <button className="btn ghost" onClick={() => setAccountDetail(null)}>
                Закрыть
              </button>
            </div>
            <div className="row">
              <input
                className="input"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Поиск по названию или сумме"
              />
              <button
                className="btn ghost"
                onClick={() => {
                  setCustomRangeDraft(customRange);
                  setShowCustomRange(historyPeriod === "custom");
                  setShowPeriodSheet(true);
                }}
              >
                Период
              </button>
            </div>
            {periodRangeText && (
              <div className="history-range">{periodRangeText}</div>
            )}
            <div className="history-list" ref={historyListRef} onScroll={handleHistoryScroll}>
              {groupedHistory.length === 0 ? (
                <div className="muted">Пока нет операций</div>
              ) : (
                groupedHistory.map((group) => (
                  <div key={group.key} className="history-group">
                    <div className="history-date-row">
                      <div className="history-date">{group.key}</div>
                      {group.expenseTotal > 0 && (
                        <div className="history-date-total">
                          {formatMoney(
                            group.expenseTotal,
                            currencySymbolByCode(
                              accountDetail.currencyCode || settings.currencyCode
                            )
                          )}
                        </div>
                      )}
                    </div>
                    <div className="history-rows">
                      {group.items.map((op) => {
                        const isLocked = op.sourceType === "goal";
                        if (isLocked) {
                          return (
                            <div key={op.id} className="history-row readonly">
                              <div className="history-row-main">
                                <span className="history-label">
                                  {op.label || op.text}
                                </span>
                                <span className="history-meta">
                                  {getOperationFlowLine(op)}
                                </span>
                              </div>
                              <div
                                className={`history-amount ${op.type === "income" ? "income" : "expense"}`}
                              >
                                {formatSignedMoney(
                                  op.amount,
                                  op.type,
                                  currencySymbolByCode(
                                    accountDetail.currencyCode || settings.currencyCode
                                  )
                                )}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <button
                            key={op.id}
                            className="history-row"
                            onClick={() =>
                              setOperationEditor({
                                mode: "edit",
                                id: op.id,
                                label: op.label || op.text || "",
                                amount: op.amount,
                                account: op.account,
                                category: op.category || "Другое",
                                incomeSource: op.incomeSource || op.category || "",
                                type: op.type,
                                date: formatDateInput(
                                  op.createdAt || op.date || op.created_at || ""
                                ),
                              })
                            }
                          >
                            <div className="history-row-main">
                              <span className="history-label">
                                {op.label || op.text}
                              </span>
                              <span className="history-meta">
                                {getOperationFlowLine(op)}
                              </span>
                            </div>
                            <div
                              className={`history-amount ${op.type === "income" ? "income" : "expense"}`}
                            >
                              {formatSignedMoney(
                                op.amount,
                                op.type,
                                currencySymbolByCode(
                                  accountDetail.currencyCode || settings.currencyCode
                                )
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              {historyLoading && <div className="muted">Загрузка...</div>}
            </div>
            <button
              className="btn"
              onClick={() => {
                setAccountEditor({
                  mode: "edit",
                  id: accountDetail.id,
                  name: accountDetail.name,
                  originalName: accountDetail.name,
                  currencyCode: accountDetail.currencyCode || settings.currencyCode,
                  color: accountDetail.color || "#0f172a",
                  includeInBalance: accountDetail.includeInBalance !== false,
                  openingBalance: accountDetail.openingBalance || 0,
                });
                setEditingAccountId(accountDetail.id);
                setEditingAccountName(accountDetail.name);
              }}
            >
              Редактировать счет
            </button>
          </section>
        );
      }

      return (
        <section className="overview-shell">
          <div className="overview-header">
            <button className="overview-profile">
              default <span className="chevron">▾</span>
            </button>
          </div>

          <div className="overview-summary">
            <div className="summary-item">
              <div className="summary-label">Расходы</div>
              <div className="summary-value">{formatMoney(summary.expense)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Баланс</div>
              <div className="summary-value">{formatMoney(summary.balance)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Доходы</div>
              <div className="summary-value">{formatMoney(summary.income)}</div>
            </div>
          </div>

          <div className="overview-section">
            <div className="overview-section-header">
              <div className="overview-subtitle">Счета</div>
            </div>
            <div className="overview-carousel">
              {accountTiles.map((acc) => (
                <button
                  key={acc.key}
                  className="overview-tile"
                  onClick={() => {
                    if (accountDetail?.id === acc.key) {
                      setAccountDetail(null);
                      return;
                    }
                    setIncomeSourceDetail(null);
                    setCategoryDetail(null);
                    setGoalDetail(null);
                    setAccountDetail({
                      id: acc.key,
                      name: acc.label,
                      currencyCode: acc.currencyCode || settings.currencyCode,
                      color: acc.color || "#0f172a",
                      includeInBalance: acc.includeInBalance !== false,
                      openingBalance: acc.openingBalance || 0,
                    });
                  }}
                  style={{ background: acc.color || "#0f172a", color: "#fff" }}
                >
                  <div className="overview-icon inverse">
                    <IconWallet />
                  </div>
                  <div className="overview-name">{acc.label}</div>
                  <div className="overview-amount">
                    {formatMoney(
                      acc.balance,
                      currencySymbolByCode(acc.currencyCode || settings.currencyCode)
                    )}
                  </div>
                </button>
              ))}
              <button
                className="overview-tile add"
                  onClick={() => {
                    if (accountEditor?.mode === "create") {
                      setAccountEditor(null);
                      setEditingAccountId(null);
                      setEditingAccountName("");
                      setNewAccountName("");
                      return;
                    }
                    setIncomeSourceEditor(null);
                    setIncomeSourceDetail(null);
                    setCategoryDetail(null);
                    setGoalDetail(null);
                    setAccountEditor({
                      mode: "create",
                      name: "",
                      originalName: "",
                    currencyCode: settings.currencyCode,
                    color: "#0f172a",
                    includeInBalance: true,
                    openingBalance: 0,
                  });
                  setEditingAccountId(null);
                  setEditingAccountName("");
                  setNewAccountName("");
                }}
              >
                <div className="overview-icon">＋</div>
                <div className="overview-name">Добавить</div>
              </button>
            </div>
            <div className="overview-dots">
              {Array.from({ length: accountPages }).map((_, idx) => (
                <span key={idx} className="dot" />
              ))}
            </div>
          </div>

          {accountEditorView}

          {!accountEditor && !incomeSourceEditor && (
            <div className="overview-section">
              <div className="overview-section-header">
                <div className="overview-subtitle">Доходы</div>
              </div>
              <div className="overview-carousel">
                {incomeSourceTotals.map((src) => (
                  <button
                    key={src.id}
                    className="overview-tile income"
                  onClick={() => {
                    if (incomeSourceDetail?.id === src.id) {
                      setIncomeSourceDetail(null);
                      return;
                    }
                    setAccountDetail(null);
                    setCategoryDetail(null);
                    setGoalDetail(null);
                    setIncomeSourceDetail({
                      id: src.id,
                      name: src.name,
                    });
                  }}
                  >
                    <div className="overview-icon">
                      <IconIncome />
                    </div>
                    <div className="overview-name">{src.name}</div>
                    <div className="overview-amount">{formatMoney(src.total)}</div>
                  </button>
                ))}
                <button
                  className="overview-tile add"
                  onClick={() => {
                    if (incomeSourceEditor?.mode === "create") {
                      setIncomeSourceEditor(null);
                      setEditingIncomeSourceName("");
                      setNewIncomeSourceName("");
                      return;
                    }
                    setIncomeSourceEditor({
                      mode: "create",
                      name: "",
                      originalName: "",
                    });
                    setIncomeSourceDetail(null);
                    setCategoryDetail(null);
                    setGoalDetail(null);
                    setEditingIncomeSourceName("");
                    setNewIncomeSourceName("");
                  }}
                >
                  <div className="overview-icon">＋</div>
                  <div className="overview-name">Добавить</div>
                </button>
              </div>
              <div className="overview-dots">
                {Array.from({ length: incomePages }).map((_, idx) => (
                  <span key={idx} className="dot" />
                ))}
              </div>
            </div>
          )}

          {!accountEditor && !incomeSourceEditor && (
            <div className="overview-section">
              <div className="overview-section-header">
                <div className="overview-subtitle">Расходы</div>
              </div>
              <div className="overview-carousel">
                {categoryTotals.map((cat) => (
                  <button
                    key={cat.id}
                    className={`overview-tile category${
                      cat.budget !== null && cat.budget !== undefined
                        ? cat.total >= cat.budget
                          ? " budget-over"
                          : cat.total >= cat.budget * 0.8
                            ? " budget-near"
                            : ""
                        : ""
                    }`}
                    onClick={() => {
                      if (categoryDetail?.id === cat.id) {
                        setCategoryDetail(null);
                        return;
                      }
                      setAccountDetail(null);
                      setIncomeSourceDetail(null);
                      setGoalDetail(null);
                      setCategoryDetail({
                        id: cat.id,
                        name: cat.name,
                        budget: cat.budget ?? null,
                      });
                    }}
                  >
                    <div className="category-badge">
                      <CategoryIcon name={cat.name} />
                    </div>
                    <div className="overview-name">{cat.name}</div>
                    <div className="overview-amount">{formatMoney(cat.total)}</div>
                    {cat.budget !== null && cat.budget !== undefined && (
                      <div className="overview-budget">
                        {formatMoney(cat.budget)}
                      </div>
                    )}
                  </button>
                ))}
                <button
                  className="overview-tile add"
                  onClick={() => {
                    if (categoryEditor?.mode === "create") {
                      setCategoryEditor(null);
                      setEditingCategoryName("");
                      setNewCategoryName("");
                      return;
                    }
                    setAccountDetail(null);
                    setIncomeSourceDetail(null);
                    setCategoryEditor({
                      mode: "create",
                      name: "",
                      originalName: "",
                    });
                    setCategoryDetail(null);
                    setGoalDetail(null);
                    setEditingCategoryName("");
                    setNewCategoryName("");
                  }}
                >
                  <div className="overview-icon">＋</div>
                  <div className="overview-name">Добавить</div>
                </button>
              </div>
              <div className="overview-dots">
                {Array.from({ length: categoryPages }).map((_, idx) => (
                  <span key={idx} className="dot" />
                ))}
              </div>
            </div>
          )}

          {!accountEditor && !incomeSourceEditor && (
            <div className="overview-section">
              <div className="overview-section-header">
                <div className="overview-subtitle">Цели</div>
              </div>
              <div className="overview-carousel compact goal-carousel">
                {goalTiles.map((goal) => (
                  <div
                    key={goal.id}
                    className={`overview-tile compact goal-card ${goal.timeStatus}`}
                    onClick={() => {
                      setAccountDetail(null);
                      setIncomeSourceDetail(null);
                      setCategoryDetail(null);
                      setGoalDetail({
                        id: goal.id,
                        name: goal.name,
                        targetAmount: goal.targetAmount,
                        color: goal.color || "#0f172a",
                        targetDate: goal.targetDate || null,
                        notify: goal.notify === true,
                        notifyFrequency: goal.notifyFrequency || null,
                        notifyStartDate: goal.notifyStartDate || null,
                        notifyTime: goal.notifyTime || null,
                        total: goal.currentAmount,
                        createdAt: goal.createdAt || null,
                      });
                    }}
                  >
                    <div className="overview-icon">
                      <IconTarget />
                    </div>
                    <div className="overview-name">{goal.name}</div>
                    <div className="goal-progress">
                      <div
                        className="goal-progress-fill"
                        style={{
                          width: `${Math.round(goal.progress * 100)}%`,
                          background: goal.color || "#0f172a",
                        }}
                      />
                    </div>
                    <div className="goal-amount">
                      {formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)} (
                      {Math.round(goal.progress * 100)}%)
                    </div>
                    {goal.targetDate && (
                      <div className="goal-deadline">
                        до {formatDisplayDate(goal.targetDate)}
                      </div>
                    )}
                  </div>
                ))}
                <div
                  className="overview-tile compact add placeholder"
                  onClick={() => {
                    if (goalEditor?.mode === "create") {
                      setGoalEditor(null);
                      return;
                    }
                    setGoalEditor({ mode: "create" });
                    setGoalDetail(null);
                  }}
                >
                  <div className="overview-icon">＋</div>
                  <div className="overview-name">Добавить</div>
                </div>
              </div>
              <div className="overview-dots">
                {Array.from({ length: goalPages }).map((_, idx) => (
                  <span key={idx} className="dot" />
                ))}
              </div>
            </div>
          )}

          {!accountEditor && !incomeSourceEditor && (
            <div className="overview-section">
              <div className="overview-section-header">
                <div className="overview-subtitle">Долги / Кредиты</div>
              </div>
              <div className="overview-carousel compact">
                {debtTiles.map((item) => (
                  <div
                    key={item.id}
                    className={`overview-tile compact placeholder debt ${item.tone || ""}`}
                    onClick={() => {
                      setDebtSection(item.id);
                      setDebtTab("debts");
                      setDebtDetail(null);
                      setDebtEditor(null);
                      setAccountDetail(null);
                      setIncomeSourceDetail(null);
                      setCategoryDetail(null);
                      setGoalDetail(null);
                    }}
                  >
                    <div className="overview-icon">
                      <IconDebt />
                    </div>
                    <div className="overview-name">{item.name}</div>
                    <div className="overview-amount">{formatMoney(item.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="overview-dots">
                {Array.from({ length: debtPages }).map((_, idx) => (
                  <span key={idx} className="dot" />
                ))}
              </div>
            </div>
          )}
          {error && <div className="error">{error}</div>}
        </section>
      );
    }

    if (view === "history") {
      return (
        <section className="card">
          <h2>История</h2>
          {visibleOperations.length === 0 ? (
            <div className="muted">Пока нет операций</div>
          ) : (
            <ul className="list">
              {visibleOperations.map((op) => (
                <li key={op.id} className="list-item">
                  <div className="main">
                    <div className="line">
                      <span className="emoji">{op.labelEmoji || "🧾"}</span> {op.label}
                    </div>
                    <div className="line">💸 {op.amountText}</div>
                    <div className="line">{op.flowLine}</div>
                    <div className="line">🗂️ Категория: {op.category}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }

    if (view === "analytics") {
      return (
        <section className="card">
          <h2>Аналитика</h2>
          {totalsByCategory.length === 0 ? (
            <div className="muted">Пока нет данных</div>
          ) : (
            <ul className="list compact">
              {totalsByCategory.map(([name, value]) => (
                <li key={name} className="analytics-row">
                  <span>{name}</span>
                  <strong>
                    {value.toLocaleString("ru-RU")} {settings.currencySymbol}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }

    if (view === "accounts") {
      return (
        <section className="card">
          <h2>Счета</h2>
          <ul className="list compact">
            {accounts.map((acc) => (
              <li key={acc.id} className="analytics-row">
                <span>{acc.name}</span>
                <span className="muted">Баланс позже</span>
              </li>
            ))}
          </ul>
        </section>
      );
    }

    if (view === "settings") {
      return (
        <section className="card">
          <h2>Настройки</h2>
          <div className="settings-block">
            <label className="label">Валюта</label>
            <select
              className="select"
              value={settings.currencyCode}
              onChange={(e) => updateCurrency(e.target.value)}
            >
              {currencyOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.symbol}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="error">{error}</div>}
        </section>
      );
    }

    return (
      <>
        <div className="home-stack">
          <section className="topbar">
            <div className="profile">
              <div className="avatar">D</div>
              <div className="profile-meta">
                <span className="profile-label">default</span>
                <span className="profile-sub">Личные финансы</span>
              </div>
            </div>
            <button className="link accent" onClick={() => setView("analytics")}>
              Графики
            </button>
          </section>

          <section className="stat-scroll">
            <div className="stat-card">
              <div className="stat-icon">
                <IconTag />
              </div>
              <div className="stat-title">
                {summary.expenseCount === 0 ? "У вас пока нет расходов" : "Расходы за период"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <IconWallet />
              </div>
              <div className="stat-title">Сейчас на счетах</div>
              <div className="stat-value">{formatMoney(summary.balance)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <IconIncome />
              </div>
              <div className="stat-title">Доходы</div>
              <div className="stat-value">{formatMoney(summary.income)}</div>
            </div>
          </section>

          <section className="balance-slider">
            {showBalanceLeft && (
              <button
                className="balance-arrow left"
                aria-label="Прокрутить счета влево"
                onClick={() => scrollBalanceBy(-1)}
              >
                <IconChevron direction="left" />
              </button>
            )}
            {showBalanceRight && (
              <button
                className="balance-arrow right"
                aria-label="Прокрутить счета вправо"
                onClick={() => scrollBalanceBy(1)}
              >
                <IconChevron direction="right" />
              </button>
            )}
            <div
              className="balance-scroll"
              ref={balanceScrollRef}
              onScroll={updateBalanceArrows}
            >
              {accountSummaries.map((item) => (
                <div
                  className="balance-card"
                  key={item.key}
                  style={{
                    background: item.key === "all" ? "#0f172a" : item.color || "#0f172a",
                  }}
                >
                  {item.key !== "all" && (
                    <button
                      className="balance-edit"
                      onClick={() => {
                        setView("overview");
                        setEditingAccountId(item.key);
                        setEditingAccountName(item.label);
                      }}
                    >
                      ✎
                    </button>
                  )}
                  <div>
                    <div className="balance-title">{item.label}</div>
                    <div className="balance-value">
                      {formatMoney(
                        item.balance,
                        currencySymbolByCode(item.currencyCode || settings.currencyCode)
                      )}
                    </div>
                    <div className="balance-sub">
                      Всего:{" "}
                      {formatMoney(
                        item.balance,
                        currencySymbolByCode(item.currencyCode || settings.currencyCode)
                      )}
                    </div>
                  </div>
                  <div className="balance-row">
                    <div>
                      <div className="balance-label">Доход</div>
                      <div className="balance-positive">
                        {formatMoney(
                          item.income,
                          currencySymbolByCode(item.currencyCode || settings.currencyCode)
                        )}
                      </div>
                    </div>
                    <div className="balance-divider" />
                    <div>
                      <div className="balance-label">Расход</div>
                      <div className="balance-negative">
                        {formatMoney(
                          item.expense,
                          currencySymbolByCode(item.currencyCode || settings.currencyCode)
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </>
    );
  })();

  return (
    <div className="page">
      <main className="content">{content}</main>
      {showPeriodSheet && (
        <div
          className="sheet-backdrop"
          onClick={() => {
            setShowPeriodSheet(false);
            setShowCustomRange(false);
          }}
        >
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title-row">
              {showCustomRange ? (
                <button
                  className="sheet-back"
                  onClick={() => setShowCustomRange(false)}
                >
                  ← Назад
                </button>
              ) : (
                <span className="sheet-title">Период</span>
              )}
              {showCustomRange && <span className="sheet-title">Свой период</span>}
            </div>
            {!showCustomRange && (
              <>
                <button
                  className="sheet-button"
                  onClick={() => {
                    setHistoryPeriod("all");
                    setShowCustomRange(false);
                    setShowPeriodSheet(false);
                  }}
                >
                  Все время
                </button>
                <button
                  className="sheet-button"
                  onClick={() => {
                    setHistoryPeriod("today");
                    setShowCustomRange(false);
                    setShowPeriodSheet(false);
                  }}
                >
                  Сегодня
                </button>
                <button
                  className="sheet-button"
                  onClick={() => {
                    setHistoryPeriod("week");
                    setShowCustomRange(false);
                    setShowPeriodSheet(false);
                  }}
                >
                  Неделя
                </button>
                <button
                  className="sheet-button"
                  onClick={() => {
                    setHistoryPeriod("month");
                    setShowCustomRange(false);
                    setShowPeriodSheet(false);
                  }}
                >
                  Месяц
                </button>
                <button
                  className="sheet-button"
                  onClick={() => {
                    setHistoryPeriod("quarter");
                    setShowCustomRange(false);
                    setShowPeriodSheet(false);
                  }}
                >
                  Квартал
                </button>
                <button
                  className="sheet-button"
                  onClick={() => {
                    setHistoryPeriod("year");
                    setShowCustomRange(false);
                    setShowPeriodSheet(false);
                  }}
                >
                  Год
                </button>
                <button
                  className="sheet-button"
                  onClick={() => {
                    const today = formatDateInput(new Date());
                    setCustomRangeDraft((prev) => ({
                      from: prev.from || today,
                      to: prev.to || today,
                    }));
                    setShowCustomRange(true);
                  }}
                >
                  Свой период
                </button>
              </>
            )}
            {showCustomRange && (
              <div className="sheet-range">
                <div className="sheet-range-row">
                  <div className="sheet-field">
                    <div className="sheet-label">С</div>
                    <DateSlotPicker
                      value={customRangeDraft.from}
                      ariaLabel="Начало периода"
                      onChange={(value) =>
                        setCustomRangeDraft((prev) => ({ ...prev, from: value }))
                      }
                    />
                  </div>
                  <div className="sheet-field">
                    <div className="sheet-label">По</div>
                    <DateSlotPicker
                      value={customRangeDraft.to}
                      ariaLabel="Конец периода"
                      onChange={(value) =>
                        setCustomRangeDraft((prev) => ({ ...prev, to: value }))
                      }
                    />
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={() => {
                    setCustomRange(customRangeDraft);
                    setHistoryPeriod("custom");
                    setShowCustomRange(false);
                    setShowPeriodSheet(false);
                  }}
                  disabled={!customRangeDraft.from}
                >
                  Применить
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {!accountEditor && !operationEditor && !hideBottomNav && (
        <nav className="quick-actions">
          <button
            className={quickActive.home ? "quick-card active" : "quick-card"}
            onClick={() => {
              setHistoryFilter({ type: "all", category: null });
              setView("home");
            }}
          >
            <IconHome />
            <span>Главная</span>
          </button>
          <button
            className={quickActive.overview ? "quick-card active" : "quick-card"}
            onClick={() => {
              setAccountEditor(null);
              setEditingAccountId(null);
              setEditingAccountName("");
              setView("overview");
            }}
          >
            <IconGrid />
            <span>Обзор</span>
          </button>
          <button
            className={quickActive.add ? "quick-card add active" : "quick-card add"}
            onClick={() => {
              setView("categories");
            }}
          >
            <IconPlus />
            <span>Добавить</span>
          </button>
          <button
            className={quickActive.reports ? "quick-card active" : "quick-card"}
            onClick={() => {
              setView("analytics");
            }}
          >
            <IconChart />
            <span>Отчеты</span>
          </button>
          <button
            className={quickActive.settings ? "quick-card active" : "quick-card"}
            onClick={() => {
              setView("settings");
            }}
          >
            <IconSettings />
            <span>Настройки</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default App;
