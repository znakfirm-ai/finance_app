import { useEffect, useMemo, useState } from "react";
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

function App() {
  const [view, setView] = useState("home");
  const [operations, setOperations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
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
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      if (tg.initData) setInitData(tg.initData);
    }
    if (!tg || !tg.initData) {
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
      const res = await fetch(apiUrl("/api/meta"));
      const data = await res.json();
      setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
      setCurrencyOptions(Array.isArray(data?.currencyOptions) ? data.currencyOptions : []);
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
    loadOperations();
  }, [telegramReady, initData, webUserId]);

  useEffect(() => {
    if (!selectedAccount && accounts.length) {
      setSelectedAccount(accounts[0]);
    }
  }, [accounts, selectedAccount]);

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
      const payload = { name };
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
    } catch (e) {
      setError(e.message || "Ошибка создания категории");
    }
  }

  async function updateCategory(id) {
    const name = editingName.trim();
    if (!name) return;
    try {
      const payload = { name };
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
      setEditingId(null);
      setEditingName("");
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

  const totalsByCategory = useMemo(() => {
    const totals = {};
    operations.forEach((op) => {
      if (op.type !== "expense") return;
      const key = op.category || "Другое";
      totals[key] = (totals[key] || 0) + Number(op.amount || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [operations]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    operations.forEach((op) => {
      const value = Number(op.amount || 0);
      if (op.type === "income") income += value;
      else expense += value;
    });
    return {
      income,
      expense,
      balance: income - expense,
      expenseCount: operations.filter((op) => op.type === "expense").length,
    };
  }, [operations]);

  const visibleOperations = useMemo(() => {
    return operations.filter((op) => {
      if (historyFilter.type !== "all" && op.type !== historyFilter.type) return false;
      if (historyFilter.category && op.category !== historyFilter.category) return false;
      return true;
    });
  }, [operations, historyFilter]);

  const categoryIcons = {
    Еда: "🍽️",
    Транспорт: "🚌",
    "Жильё": "🏠",
    Развлечения: "🎬",
    Другое: "🧾",
  };

  const formatMoney = (value) => {
    const amount = Number(value || 0);
    const hasCents = Math.abs(amount % 1) > 0.001;
    const formatted = amount.toLocaleString("ru-RU", {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    });
    return `${formatted} ${settings.currencySymbol || "₽"}`;
  };

  const quickActive = {
    home: view === "home",
    overview: view === "history",
    add: view === "categories",
    reports: view === "analytics",
    settings: view === "settings",
  };

  const content = (() => {
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
                key={acc}
                className={acc === selectedAccount ? "chip active" : "chip"}
                onClick={() => setSelectedAccount(acc)}
              >
                {acc}
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
                  {categoryIcons[cat.name] || "🧾"}
                </span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
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
              <li key={acc} className="analytics-row">
                <span>{acc}</span>
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

          <div className="settings-block">
            <label className="label">Категории</label>
            <div className="row">
              <input
                className="input"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Новая категория"
              />
              <button className="btn" onClick={createCategory}>
                Добавить
              </button>
            </div>
            <ul className="list compact">
              {categories.map((cat) => (
                <li key={cat.id} className="category-row">
                  {editingId === cat.id ? (
                    <>
                      <input
                        className="input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                      />
                      <button className="btn" onClick={() => updateCategory(cat.id)}>
                        Сохранить
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName("");
                        }}
                      >
                        Отмена
                      </button>
                    </>
                  ) : (
                    <>
                      <span>{cat.name}</span>
                      <div className="row">
                        <button
                          className="btn ghost"
                          onClick={() => {
                            setEditingId(cat.id);
                            setEditingName(cat.name);
                          }}
                        >
                          Редактировать
                        </button>
                        <button className="btn danger" onClick={() => deleteCategory(cat.id)}>
                          Удалить
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
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
              <div className="stat-icon">🧾</div>
              <div className="stat-title">
                {summary.expenseCount === 0 ? "У вас пока нет расходов" : "Расходы за период"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💳</div>
              <div className="stat-title">Сейчас на счетах</div>
              <div className="stat-value">{formatMoney(summary.balance)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-title">Доходы</div>
              <div className="stat-value">{formatMoney(summary.income)}</div>
            </div>
          </section>

          <section className="balance-card">
            <div>
              <div className="balance-title">Баланс</div>
              <div className="balance-value">{formatMoney(summary.balance)}</div>
              <div className="balance-sub">Всего: {formatMoney(summary.balance)}</div>
            </div>
            <div className="balance-row">
              <div>
                <div className="balance-label">Доход</div>
                <div className="balance-positive">{formatMoney(summary.income)}</div>
              </div>
              <div className="balance-divider" />
              <div>
                <div className="balance-label">Расход</div>
                <div className="balance-negative">{formatMoney(summary.expense)}</div>
              </div>
            </div>
          </section>
        </div>
      </>
    );
  })();

  return (
    <div className="page">
      {view !== "home" && (
        <header className="header">
          <h1>Личные финансы</h1>
          <p>Выберите категорию и добавьте операцию</p>
        </header>
      )}

      <main className="content">{content}</main>
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
            setHistoryFilter({ type: "all", category: null });
            setView("history");
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
    </div>
  );
}

export default App;
