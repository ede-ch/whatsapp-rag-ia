import { useEffect, useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";
import styles from "./DocumentManager.module.css";

type DocRow = {
  id: string;
  file_name: string;
  created_at: string;
  chunk_count: number;
};

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = (textContent.items as any[])
      .map((it) => (typeof it?.str === "string" ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) fullText += (fullText ? "\n\n" : "") + pageText;
  }

  return fullText.trim();
}

function formatDate(v: string) {
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

type Props = {
  selectedDocumentId?: string | null;
  onSelectDocument?: (doc: DocRow) => void;
};

export default function DocumentManager({ selectedDocumentId = null, onSelectDocument }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const canUpload = useMemo(() => !!file && !busy, [file, busy]);

  async function loadDocs() {
    setBusy(true);
    setMsg("");
    try {
      const resp = await fetch("/api/documents", { method: "GET" });
      const text = await resp.text();

      if (!resp.ok) {
        setDocs([]);
        setMsg(text || "Falha ao listar documentos");
        return;
      }

      const json = JSON.parse(text);
      setDocs(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setDocs([]);
      setMsg(e?.message || "Erro ao listar documentos");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload() {
    if (!file) return;

    setBusy(true);
    setMsg("");

    try {
      const content = await extractPdfText(file);

      if (!content) {
        setMsg("PDF sem texto extraível. Provavelmente é PDF escaneado (imagem). Sem OCR, não dá pra indexar.");
        return;
      }

      const resp = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          content,
        }),
      });

      const text = await resp.text();
      if (!resp.ok) {
        setMsg(text || "Falha no upload");
        return;
      }

      setMsg(text);
      setFile(null);

      const input = document.getElementById("doc-file-input") as HTMLInputElement | null;
      if (input) input.value = "";

      await loadDocs();
    } catch (e: any) {
      setMsg(e?.message || "Erro no upload");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setMsg("");
    try {
      const resp = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const text = await resp.text();
      if (!resp.ok) {
        setMsg(text || "Falha ao deletar");
        return;
      }

      setMsg(text);
      await loadDocs();
    } catch (e: any) {
      setMsg(e?.message || "Erro ao deletar");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.uploadArea}>
        <div className={styles.sectionTitle}>Documentos (RAG)</div>

        <div className={styles.row}>
          <input
            id="doc-file-input"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className={styles.fileInput}
          />

          <button className={styles.btn} onClick={handleUpload} disabled={!canUpload}>
            {busy ? "Processando..." : "Enviar"}
          </button>
        </div>

        <div className={styles.hint}>
          PDF é extraído no navegador e enviado como texto para a API.
          <br />
          PDF escaneado (imagem) não funciona sem OCR.
        </div>

        {msg ? <pre className={styles.log}>{msg}</pre> : null}
      </div>

      <div className={styles.divider} />

      <div className={styles.listHeader}>
        <div className={styles.sectionTitle}>Lista</div>
        <button onClick={loadDocs} disabled={busy} className={styles.btn}>
          Atualizar
        </button>
      </div>

      {docs.length === 0 ? (
        <div className={styles.empty}>Nenhum documento.</div>
      ) : (
        <div className={styles.list}>
          {docs.map((d) => {
            const isSelected = selectedDocumentId === d.id;

            return (
              <button
                key={d.id}
                type="button"
                className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
                onClick={() => onSelectDocument?.(d)}
                title="Selecionar documento"
              >
                <div className={styles.cardTop}>
                  <div className={styles.cardInfo}>
                    <div className={styles.fileName} title={d.file_name}>
                      {d.file_name}
                    </div>
                    <div className={styles.meta}>
                      {formatDate(d.created_at)} • chunks: {d.chunk_count}
                    </div>
                    <div className={styles.idText}>{d.id}</div>
                  </div>

                  <span
                    className={styles.deleteWrap}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(d.id);
                    }}
                  >
                    <button type="button" disabled={busy} className={styles.dangerBtn}>
                      Deletar
                    </button>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}