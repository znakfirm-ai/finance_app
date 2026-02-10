import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const apiUrl = (path) => `${API_BASE}${path}`;

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

  async function loadOperations() {
    try {
      const res = await fetch(apiUrl(withWebQuery("/api/operations")), {
        headers: authHeaders,
      });
      const data = await res.json();
      setOperations(Array.isArray(data) ? data : []);
    } catch (_) {}
  }

  async function loadHistory(reset = true) {
    const target = accountDetail || incomeSourceDetail || categoryDetail;
    if (!target) return;
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      const searchQuery = historyQueryDebounced.trim();
      const params = new URLSearchParams();
      params.set("limit", searchQuery ? "500" : "50");
      if (accountDetail) {
        params.set("account", accountDetail.name);
      } else if (incomeSourceDetail) {
        params.set("type", "income");
        params.set("incomeSource", incomeSourceDetail.name);
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
      const res = await fetch(apiUrl(withWebQuery(`/api/operations?${params}`)), {
        headers: authHeaders,
      });
      const data = await res.json();
      const items = Array.isArray(data) ? data : [];
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
    }
  }, [view]);

  useEffect(() => {
    const target = accountDetail || incomeSourceDetail || categoryDetail;
    if (!target) return;
    setHistoryBefore(null);
    setHistoryHasMore(true);
    setHistoryQuery("");
    setHistoryQueryDebounced("");
    setHistoryPeriod("month");
    setCustomRange({ from: "", to: "" });
    setCustomRangeDraft({ from: "", to: "" });
    setShowCustomRange(false);
  }, [accountDetail?.id, incomeSourceDetail?.id, categoryDetail?.id, initData, webUserId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHistoryQueryDebounced(historyQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [historyQuery]);

  useEffect(() => {
    const target = accountDetail || incomeSourceDetail || categoryDetail;
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

  const currencySymbolByCode = (code) => {
    const entry = currencyOptions.find((c) => c.code === code);
    return entry?.symbol || settings.currencySymbol || "₽";
  };

  const startOfDay = (date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

  const endOfDay = (date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

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
    operations.forEach((op) => {
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
      const key = op.incomeSource || op.category || "Прочее";
      totals[key] = (totals[key] || 0) + Number(op.amount || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [operations]);

  const incomeSourceTotals = useMemo(() => {
    const totals = new Map();
    incomeSources.forEach((src) => totals.set(src.name, 0));
    operations.forEach((op) => {
      if (op.type !== "income") return;
      const key = op.incomeSource || op.category || "Прочее";
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
      expenseCount: operations.filter((op) => op.type === "expense").length,
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
  const goalPlaceholders = [
    { id: "goal-1", name: "Подушка", amount: 0 },
    { id: "goal-2", name: "Отпуск", amount: 0 },
  ];
  const debtPlaceholders = [
    { id: "debt-1", name: "Должны мне", amount: 0, tone: "positive" },
    { id: "debt-2", name: "Должен я", amount: 0, tone: "negative" },
    { id: "debt-3", name: "Кредиты", amount: 0, tone: "neutral" },
  ];
  const goalPages = Math.max(1, Math.ceil((goalPlaceholders.length + 1) / 4));
  const debtPages = Math.max(1, Math.ceil((debtPlaceholders.length + 1) / 4));

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

  const formatSignedMoney = (value, type, symbolOverride) => {
    const sign = type === "income" ? "+" : "-";
    return `${sign}${formatMoney(Math.abs(value || 0), symbolOverride)}`;
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
                            <span className="history-emoji">
                              {op.labelEmoji || "🧾"}
                            </span>
                            <span className="history-label">{op.label || op.text}</span>
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
                            <span className="history-emoji">
                              {op.labelEmoji || "🧾"}
                            </span>
                            <span className="history-label">{op.label || op.text}</span>
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
                              incomeSource: op.incomeSource || op.category || "",
                              type: op.type,
                              date: formatDateInput(
                                op.createdAt || op.date || op.created_at || ""
                              ),
                            })
                          }
                        >
                          <div className="history-row-main">
                            <span className="history-emoji">
                              {op.labelEmoji || "🧾"}
                            </span>
                            <span className="history-label">{op.label || op.text}</span>
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
                      ))}
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
                    setIncomeSourceDetail({ id: src.id, name: src.name });
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
              <div className="overview-carousel compact">
                {goalPlaceholders.map((goal) => (
                  <div key={goal.id} className="overview-tile compact placeholder goal">
                    <div className="overview-icon">
                      <IconTarget />
                    </div>
                    <div className="overview-name">{goal.name}</div>
                    <div className="overview-amount">{formatMoney(goal.amount)}</div>
                  </div>
                ))}
                <div className="overview-tile compact add placeholder">
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
                {debtPlaceholders.map((item) => (
                  <div
                    key={item.id}
                    className={`overview-tile compact placeholder debt ${item.tone || ""}`}
                  >
                    <div className="overview-icon">
                      <IconDebt />
                    </div>
                    <div className="overview-name">{item.name}</div>
                    <div className="overview-amount">{formatMoney(item.amount)}</div>
                  </div>
                ))}
                <div className="overview-tile compact add placeholder">
                  <div className="overview-icon">＋</div>
                  <div className="overview-name">Добавить</div>
                </div>
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
