import Settings from "./components/Settings";
import DocumentManager from "./components/DocumentManager";
import ChatTester from "./components/ChatTester";
import "./App.css";

export default function App() {
  return (
    <div className="app-container">
      <header>
        <h1>RAG + WhatsApp Bot</h1>
        <p style={{ textAlign: "center", color: "#8e8ea0" }}>
          Painel de Controle e Testes
        </p>
      </header>

      <section className="card">
        <Settings />
      </section>

      <section className="card">
        <DocumentManager />
      </section>

      <section className="card">
        <ChatTester />
      </section>
    </div>
  );
}