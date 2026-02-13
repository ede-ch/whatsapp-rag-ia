import React, { useEffect, useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";
import styles from "./DocumentManager.module.css";

type DocRow = {
  id: string;
  file_name: string;
  created_at: string;
  chunk_count: number;
};

type SelectedDoc = {
  id: string;
  file_name: string;
};

type Props = {
  selectedDocumentId?: string | null;
  onSelectDocument?: (doc: SelectedDoc | null) => void;
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
      const arr = Array.isArray(json) ? (json as DocRow[]) : [];
      setDocs(arr);

      if (arr.length === 0) {
        onSelectDocument?.(null);
      } else if (selectedDocumentId && !arr.some((d) => d.id === selectedDocumentId)) {
        onSelectDocument?.(null);
      }
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
        body: JSON.stringify({ fileName: file.name, content }),
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

      const latest = [...docs]
        .sort((a, b) => (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0))[0];
      const byName = (prev: DocRow[]) => prev.find((d) => d.file_name === file.name);
      const match = byName(docs);
      if (match) onSelectDocument?.({ id: match.id, file_name: match.file_name });
      else if (latest) onSelectDocument?.({ id: latest.id, file_name: latest.file_name });
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

      if (selectedDocumentId === id) {
        onSelectDocument?.(null);
      }

      await loadDocs();
    } catch (e: any) {
      setMsg(e?.message || "Erro ao deletar");
    } finally {
      setBusy(false);
    }
  }

  function selectDoc(d: DocRow) {
    onSelectDocument?.({ id: d.id, file_name: d.file_name });
  }

  useEffect(() => {
    loadDocs();
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
                onClick={() => selectDoc(d)}
                disabled={busy}
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
                    className={styles.dangerBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(d.id);
                    }}
                    role="button"
                    aria-disabled={busy}
                    tabIndex={0}
                  >
                    Deletar
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