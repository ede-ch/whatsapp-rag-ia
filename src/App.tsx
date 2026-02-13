import React, { useState } from "react";
import ChatTester from "./components/ChatTester";
import DocumentManager from "./components/DocumentManager";
import Settings from "./components/Settings";

function Modal(props: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!props.open) return null;

  return (
    <div style={styles.modalOverlay} onMouseDown={props.onClose}>
      <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ fontWeight: 800 }}>{props.title}</div>
          <button onClick={props.onClose} style={styles.iconBtn} aria-label="Fechar">✕</button>
        </div>
        <div style={styles.modalBody}>{props.children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={styles.brand}>
          <div style={styles.brandDot} />
          <div>
            <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>WhatsApp RAG</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Console</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setSettingsOpen(true)} style={styles.primaryBtn}>
            ⚙️ Configurações
          </button>
        </div>
      </div>

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>Documentos</div>
          <div style={styles.sidebarBody}>
            <DocumentManager />
          </div>
        </aside>

        <main style={styles.main}>
          <ChatTester />
        </main>
      </div>

      <Modal open={settingsOpen} title="Configurações" onClose={() => setSettingsOpen(false)}>
        <Settings />
      </Modal>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0B0F19",
    color: "white",
  },
  topbar: {
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    backdropFilter: "blur(10px)",
  },
  brand: { display: "flex", gap: 10, alignItems: "center" },
  brandDot: { width: 12, height: 12, borderRadius: 999, background: "#4F8CFF" },

  body: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 12,
    padding: 12,
    minHeight: 0,
  },
  sidebar: {
    minHeight: 0,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  sidebarHeader: {
    padding: "12px 14px",
    fontWeight: 800,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  sidebarBody: { padding: 12, overflow: "auto" },

  main: {
    minHeight: 0,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    overflow: "hidden",
    display: "flex",
  },

  primaryBtn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(79,140,255,0.7)",
    background: "rgba(79,140,255,0.15)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    zIndex: 999,
  },
  modal: {
    width: "min(820px, 96vw)",
    maxHeight: "86vh",
    overflow: "hidden",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#0B0F19",
    boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  modalBody: { padding: 12, overflow: "auto" },
  iconBtn: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "white",
    borderRadius: 12,
    width: 36,
    height: 36,
    cursor: "pointer",
    fontWeight: 900,
  },
};