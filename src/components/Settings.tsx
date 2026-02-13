import React, { useEffect, useMemo, useState } from "react";

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
  const canSave = useMemo(() => selectedModel.trim().length > 0 && systemPrompt.trim().length > 0, [selectedModel, systemPrompt]);

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

  useEffect(() => { load(); }, []);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Configurações</h2>

      {loading ? <p>Carregando…</p> : null}

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>OpenRouter API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasApiKey ? "Já existe uma key salva (digite para substituir ou limpar)" : "Cole sua key aqui"}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
            Status: {hasApiKey ? "configurada" : "não configurada"} {updatedAt ? `• atualizado em ${updatedAt}` : ""}
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Modelo</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", resize: "vertical" }}
          />
        </div>

        <button
          onClick={save}
          disabled={!canSave || saving}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #007AFF",
            background: saving ? "#eee" : "white",
            color: "#007AFF",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>

        {msg ? <div style={{ fontSize: 13, color: msg === "Salvo." ? "green" : "#b00020" }}>{msg}</div> : null}
      </div>
    </div>
  );
}