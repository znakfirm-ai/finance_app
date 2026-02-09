import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const apiUrl = (path) => `${API_BASE}${path}`;

function App() {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operations, setOperations] = useState([]);
  const [error, setError] = useState("");
  const [initData, setInitData] = useState(null);
  const [webUserId, setWebUserId] = useState(null);
  const [telegramReady, setTelegramReady] = useState(false);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      if (tg.initData) setInitData(tg.initData);
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

  useEffect(() => {
    if (!telegramReady) return;
    const url = webUserId
      ? apiUrl(`/api/operations?webUserId=${encodeURIComponent(webUserId)}`)
      : apiUrl("/api/operations");
    const headers = initData ? { "x-telegram-init-data": initData } : {};
    fetch(url, { headers })
      .then((r) => r.json())
      .then((data) => setOperations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [initData, webUserId, telegramReady]);

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Запись голоса недоступна в этом браузере");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      setRecording(false);
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await transcribe(blob);
    };

    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  }

  function stopRecording() {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
    }
  }

  async function transcribe(blob) {
    setTranscribing(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "audio.webm");
      const res = await fetch(apiUrl("/api/transcribe"), {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка распознавания");
      setText(data.text || "");
    } catch (e) {
      setError(e.message || "Ошибка распознавания");
    } finally {
      setTranscribing(false);
    }
  }

  async function saveOperation() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Введите текст операции");
      return;
    }
    if (!initData && !webUserId) {
      setError("Не удалось определить пользователя");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/operations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          webUserId ? { text: trimmed, webUserId } : { text: trimmed, initData }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка сохранения");
      setOperations((prev) => [data, ...prev]);
      setText("");
    } catch (e) {
      setError(e.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Личные финансы</h1>
        <p>Быстрый ввод расходов и доходов голосом или текстом</p>
      </header>

      <section className="card">
        <div className="row">
          <button
            className={recording ? "btn danger" : "btn"}
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
          >
            {recording ? "Остановить запись" : "Записать голос"}
          </button>
          <div className="status">
            {recording && "Идёт запись…"}
            {transcribing && "Распознавание…"}
          </div>
        </div>

        <label className="label">Текст операции</label>
        <textarea
          className="input"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Например: "потратил 350 на кофе с карты"'
        />

        <div className="row">
          <button className="btn primary" onClick={saveOperation} disabled={saving}>
            {saving ? "Сохраняю…" : "Сохранить операцию"}
          </button>
          {error && <div className="error">{error}</div>}
        </div>
      </section>

      <section className="card">
        <h2>История</h2>
        {operations.length === 0 ? (
          <div className="muted">Пока нет операций</div>
        ) : (
          <ul className="list">
            {operations.map((op) => (
              <li key={op.id} className="list-item">
                {op.label && op.amountText && op.flowLine ? (
                  <div className="main">
                    <div className="line">
                      <span className="emoji">{op.labelEmoji || "🧾"}</span> {op.label}
                    </div>
                    <div className="line">💸 {op.amountText}</div>
                    <div className="line">{op.flowLine}</div>
                    <div className="line">🗂️ Категория: {op.category}</div>
                  </div>
                ) : (
                  <>
                    <div className="main">
                      <div className="title">{op.text}</div>
                      <div className="meta">
                        {op.category} · {op.account}
                      </div>
                    </div>
                    <div className={op.type === "income" ? "amount income" : "amount expense"}>
                      {op.type === "income" ? "+" : "-"}
                      {op.amount}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Примеры</h2>
        <ul className="list compact">
          <li>потратил 350 на еду с карты</li>
          <li>купила кофе 180 наличными</li>
          <li>получил 20000 зарплата на карту</li>
        </ul>
      </section>
    </div>
  );
}

export default App;
