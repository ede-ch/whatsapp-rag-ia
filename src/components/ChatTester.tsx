import React, { useEffect, useMemo, useState } from "react";

type MsgRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export default function ChatTester() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canSend = useMemo(() => text.trim().length > 0 && !loading, [text, loading]);

  async function createConversation() {
    setMsg(null);
    const resp = await fetch("/api/conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "web" }),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error || "Falha ao criar conversa");
    return String(json.id);
  }

  async function loadMessages(id: string) {
    const resp = await fetch(`/api/messages?conversationId=${encodeURIComponent(id)}`);
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error || "Falha ao carregar histórico");
    setMessages(json || []);
  }

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const id = await createConversation();
    setConversationId(id);
    await loadMessages(id);
    return id;
  }

  async function send() {
    if (!canSend) return;
    setLoading(true);
    setMsg(null);

    try {
      const id = await ensureConversation();
      const userText = text.trim();

      // salva msg do usuário
      {
        const resp = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: id, role: "user", content: userText }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Falha ao salvar msg do usuário");
      }

      // chama RAG
      const ragResp = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });
      const ragJson = await ragResp.json();
      if (!ragResp.ok) throw new Error(ragJson?.error || "Falha no chat RAG");

      const reply = String(ragJson.reply || "").trim();

      // salva resposta do assistente
      {
        const resp = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: id, role: "assistant", content: reply }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Falha ao salvar msg do assistente");
      }

      setText("");
      await loadMessages(id);
    } catch (e: any) {
      setMsg(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function newChat() {
    setLoading(true);
    setMsg(null);
    try {
      const id = await createConversation();
      setConversationId(id);
      setMessages([]);
    } catch (e: any) {
      setMsg(e?.message || "Erro ao criar conversa");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // cria uma conversa ao abrir, pra já ter histórico
    (async () => {
      try {
        const id = await createConversation();
        setConversationId(id);
      } catch (e: any) {
        setMsg(e?.message || "Erro ao iniciar");
      }
    })();
  }, []);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ marginTop: 0 }}>Chat de teste (RAG) + Histórico</h2>
        <button
          onClick={newChat}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #007AFF",
            background: loading ? "#eee" : "white",
            color: "#007AFF",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Novo chat
        </button>
      </div>

      <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
        conversationId: <b>{conversationId || "-"}</b>
      </div>

      <div
        style={{
          background: "#fafafa",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          height: 260,
          overflow: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: "#777" }}>Sem mensagens ainda.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#555" }}>
                <b>{m.role}</b> • {new Date(m.created_at).toLocaleString()}
              </div>
              <div>{m.content}</div>
            </div>
          ))
        )}
      </div>

      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginTop: 10 }}
        placeholder="Digite sua mensagem…"
      />

      <button
        onClick={send}
        disabled={!canSend}
        style={{
          marginTop: 10,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #007AFF",
          background: !canSend ? "#eee" : "white",
          color: "#007AFF",
          fontWeight: 700,
          cursor: !canSend ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Enviando…" : "Enviar"}
      </button>

      {msg ? (
        <div style={{ fontSize: 13, marginTop: 10, color: "#b00020" }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}