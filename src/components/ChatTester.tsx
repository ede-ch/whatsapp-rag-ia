import { useEffect, useMemo, useState } from "react";
import styles from "./ChatTester.module.css";

type MsgRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type Props = {
  selectedDocumentId?: string | null;
};

export default function ChatTester({ selectedDocumentId = null }: Props) {
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

      {
        const resp = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: id, role: "user", content: userText }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Falha ao salvar msg do usuário");
      }

      const ragResp = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, documentId: selectedDocumentId }),
      });
      const ragJson = await ragResp.json();
      if (!ragResp.ok) throw new Error(ragJson?.error || "Falha no chat RAG");

      const reply = String(ragJson.reply || "").trim();

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
    (async () => {
      try {
        const id = await createConversation();
        setConversationId(id);
      } catch (e: any) {
        setMsg(e?.message || "Erro ao iniciar");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Chat</h2>
        <button className={styles.secondaryBtn} onClick={newChat} disabled={loading}>
          Novo chat
        </button>
      </div>

      <div className={styles.meta}>
        conversationId: <b>{conversationId || "-"}</b>
      </div>

      <div className={styles.chatBox}>
        {messages.length === 0 ? (
          <div className={styles.empty}>Sem mensagens ainda.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={styles.msgCard}>
              <div className={styles.msgMeta}>
                <b className={styles.role}>{m.role}</b> • {new Date(m.created_at).toLocaleString()}
              </div>
              <div className={styles.msgContent}>{m.content}</div>
            </div>
          ))
        )}
      </div>

      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={styles.textarea}
        placeholder="Digite sua mensagem…"
      />

      <button className={styles.primaryBtn} onClick={send} disabled={!canSend}>
        {loading ? "Enviando…" : "Enviar"}
      </button>

      {msg ? <div className={styles.error}>{msg}</div> : null}
    </div>
  );
}