import { useEffect, useMemo, useState } from "react";
import styles from "./Settings.module.css";

type SettingsResponse = {
  selectedModel: string;
  systemPrompt: string;
  hasApiKey: boolean;
  updatedAt: string | null;
};

const MODEL_OPTIONS = [
  { label: "GPT-4o mini (OpenAI)", value: "openai/gpt-4o-mini" },
  { label: "GPT-4o (OpenAI)", value: "openai/gpt-4o" },
  { label: "Claude 3.5 Sonnet (Anthropic)", value: "anthropic/claude-3.5-sonnet" },
  { label: "Claude 3 Haiku (Anthropic)", value: "anthropic/claude-3-haiku" },
  { label: "Llama 3.1 8B Instruct (Meta)", value: "meta-llama/llama-3.1-8b-instruct" },
];

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("openai/gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("Você é um assistente útil.");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const canSave = useMemo(
    () => selectedModel.trim().length > 0 && systemPrompt.trim().length > 0,
    [selectedModel, systemPrompt]
  );

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const resp = await fetch("/api/settings");
      const json = (await resp.json()) as SettingsResponse | { error: string };
      if (!resp.ok) throw new Error((json as any)?.error || "Falha ao carregar settings");

      const s = json as SettingsResponse;
      setSelectedModel(s.selectedModel);
      setSystemPrompt(s.systemPrompt);
      setHasApiKey(Boolean(s.hasApiKey));
      setUpdatedAt(s.updatedAt);
      setApiKey("");
    } catch (e: any) {
      setMsg(e?.message || "Erro ao carregar settings");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setMsg(null);
    try {
      const resp = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          selectedModel,
          systemPrompt,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Falha ao salvar");
      setMsg("Salvo.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Configurações</h2>

      {loading ? <p className={styles.info}>Carregando…</p> : null}

      <div className={styles.grid}>
        <div>
          <label className={styles.label}>OpenRouter API Key</label>
          <input
            className={styles.input}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasApiKey ? "Já existe uma key salva (digite para substituir ou limpar)" : "Cole sua key aqui"}
          />
          <div className={styles.small}>
            Status: {hasApiKey ? "configurada" : "não configurada"} {updatedAt ? `• atualizado em ${updatedAt}` : ""}
          </div>
        </div>

        <div>
          <label className={styles.label}>Modelo</label>
          <select className={styles.input} value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={styles.label}>System Prompt</label>
          <textarea
            className={styles.textarea}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
          />
        </div>

        <button className={styles.primaryBtn} onClick={save} disabled={!canSave || saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>

        {msg ? <div className={msg === "Salvo." ? styles.ok : styles.error}>{msg}</div> : null}
      </div>
    </div>
  );
}