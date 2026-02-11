import { useState, useEffect } from "react";
import axios from "axios";

export default function DocumentManager() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocuments = async () => {
    try {
      const { data } = await axios.get("/api/documents");
      setDocuments(data);
    } catch (error) {
      console.error("Erro ao buscar documentos:", error);
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  // Função simplificada para ler APENAS .txt
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação simples de extensão
    if (!file.name.endsWith(".txt")) {
      alert("Por favor, carregue apenas arquivos .txt");
      e.target.value = ""; // Limpa o input
      return;
    }

    setFileName(file.name);
    
    try {
      const text = await file.text();
      setContent(text);
    } catch (err) {
      alert("Erro ao ler o ficheiro.");
      console.error(err);
    }
  };

  const upload = async () => {
    if (!content || !fileName) {
      alert("Selecione um ficheiro ou escreva o conteúdo.");
      return;
    }

    setIsUploading(true);
    try {
      await axios.post("/api/upload", { fileName, content });
      
      // Limpa os campos após sucesso
      setFileName(""); 
      setContent(""); 
      
      // Atualiza a lista
      fetchDocuments();
      alert("Documento salvo com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar no banco de dados.");
    } finally {
      setIsUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Tem a certeza que deseja excluir este documento?")) return;
    try {
      await axios.delete("/api/documents", { data: { id } });
      fetchDocuments();
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  return (
    <div>
      <h2>Gestor de Documentos (TXT)</h2>
      
      <div style={{ 
        background: "#f5f5f5", 
        padding: "15px", 
        borderRadius: "8px", 
        marginBottom: "20px",
        border: "1px solid #ddd" 
      }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          1. Escolha o arquivo .txt:
        </label>
        <input 
          type="file" 
          accept=".txt" 
          onChange={handleFileUpload} 
          style={{ marginBottom: "15px", display: "block" }}
        />

        <label style={{ display: "block", marginBottom: "5px" }}>Nome do Arquivo:</label>
        <input 
          placeholder="Ex: manual_empresa.txt" 
          value={fileName} 
          onChange={e=>setFileName(e.target.value)} 
          style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box" }}
        />
        
        <label style={{ display: "block", marginBottom: "5px" }}>Conteúdo (Pré-visualização):</label>
        <textarea 
          placeholder="O conteúdo do arquivo aparecerá aqui..." 
          value={content} 
          onChange={e=>setContent(e.target.value)} 
          rows={6}
          style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", fontFamily: "monospace" }} 
        />
        
        <button 
          onClick={upload} 
          disabled={isUploading}
          style={{ 
            backgroundColor: isUploading ? "#ccc" : "#1a73e8",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "5px",
            cursor: isUploading ? "not-allowed" : "pointer"
          }}
        >
          {isUploading ? "Enviando..." : "Salvar no Banco de Conhecimento"}
        </button>
      </div>

      <h3>Documentos Disponíveis na Base:</h3>
      {documents.length === 0 ? <p style={{ color: "#777" }}>Nenhum documento cadastrado.</p> : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {documents.map(d => (
            <li key={d.id} style={{ 
              padding: "10px", 
              borderBottom: "1px solid #eee", 
              display: "flex", 
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span>📄 {d.file_name}</span> 
              <button 
                onClick={()=>remove(d.id)} 
                style={{ 
                  background: "#ff4d4d", 
                  color: "white", 
                  border: "none", 
                  borderRadius: "4px", 
                  padding: "5px 10px",
                  cursor: "pointer"
                }}
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}