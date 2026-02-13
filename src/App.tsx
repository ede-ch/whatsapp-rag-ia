import { useMemo, useState } from "react";
import ChatTester from "./components/ChatTester";
import DocumentManager from "./components/DocumentManager";
import Settings from "./components/Settings";
import styles from "./App.module.css";

type SelectedDoc = {
  id: string;
  file_name: string;
};

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<SelectedDoc | null>(null);

  const rightTitle = useMemo(() => {
    return selectedDoc?.file_name || "Nenhum documento selecionado";
  }, [selectedDoc]);

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandDot} />
          <div className={styles.brandTitle}>RAG.AI</div>
        </div>

        <button className={styles.primaryBtn} onClick={() => setSettingsOpen(true)} aria-label="Configurações">
          ⚙️
        </button>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>Documentos</div>

          <div className={styles.sidebarScroll}>
            <div className={styles.card}>
              <DocumentManager
                selectedDocumentId={selectedDoc?.id || null}
                onSelectDocument={(doc) => setSelectedDoc(doc)}
              />
            </div>
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.mainTitle}>{rightTitle}</div>
            <div className={styles.mainSub}>
              {selectedDoc ? "Use o chat para consultar o conteúdo indexado." : "Selecione um documento na lista para destacar no chat."}
            </div>
          </div>

          <div className={styles.mainBody}>
            <ChatTester selectedDocumentId={selectedDoc?.id || null} />
          </div>
        </main>
      </div>

      {settingsOpen && (
        <div className={styles.modalOverlay} onMouseDown={() => setSettingsOpen(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Configurações</span>
              <button className={styles.iconBtn} onClick={() => setSettingsOpen(false)} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <Settings />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}