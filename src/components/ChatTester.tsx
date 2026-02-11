import { useState } from "react";
import axios from "axios";

export default function ChatTester() {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<{user:string, bot:string}[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    const apiKey = localStorage.getItem("OPEN_ROUTER_API_KEY");
    const model = localStorage.getItem("MODEL");
    const systemPrompt = localStorage.getItem("SYSTEM_PROMPT");

    try {
      const { data } = await axios.post("/api/chat", { 
        message, 
        model, 
        systemPrompt, 
        apiKey 
      });
      
      setHistory([...history, { user: message, bot: data.reply }]);
      setMessage("");
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.error || "Erro ao comunicar com a API";
      setHistory([...history, { user: message, bot: `Erro: ${errorMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Chat de Teste</h2>
      <div style={{ maxHeight: 300, overflowY: "scroll", border: "1px solid #ccc", padding: "10px", marginBottom: "10px", background: "#f9f9f9" }}>
        {history.length === 0 && <p style={{color: "#888"}}>Nenhuma mensagem ainda.</p>}
        {history.map((h,i)=>(
          <div key={i} style={{ marginBottom: "10px" }}>
            <div style={{ fontWeight: "bold", color: "#333" }}>Você:</div>
            <div style={{ marginBottom: "5px" }}>{h.user}</div>
            <div style={{ fontWeight: "bold", color: "#1a73e8" }}>Bot:</div>
            <div>{h.bot}</div>
          </div>
        ))}
        {loading && <p>Thinking...</p>}
      </div>
      
      <div style={{ display: "flex", gap: "10px" }}>
        <input 
          value={message} 
          onChange={e=>setMessage(e.target.value)} 
          placeholder="Digite sua pergunta..."
          style={{ flex: 1, padding: "8px" }}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? "..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}