import { useState, useEffect } from "react";

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    setApiKey(localStorage.getItem("OPEN_ROUTER_API_KEY") || "");
    setModel(localStorage.getItem("MODEL") || "gpt-4");
    setSystemPrompt(localStorage.getItem("SYSTEM_PROMPT") || "");
  }, []);

  const handleSave = () => {
    localStorage.setItem("OPEN_ROUTER_API_KEY", apiKey);
    localStorage.setItem("MODEL", model);
    localStorage.setItem("SYSTEM_PROMPT", systemPrompt);
    alert("Configurações salvas!");
  };

  return (
    <div>
      <h2>Painel de Configurações</h2>
      <input placeholder="Open Router API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} />
      <select value={model} onChange={e => setModel(e.target.value)}>
        <option value="gpt-4">GPT-4</option>
        <option value="claude">Claude</option>
        <option value="llama">Llama</option>
      </select>
      <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={4} placeholder="System Prompt" />
      <button onClick={handleSave}>Salvar</button>
    </div>
  );
}
