import React, { useEffect, useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

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

export default function DocumentManager() {
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
        setMsg(
          "PDF sem texto extraível. Provavelmente é PDF escaneado (imagem). Sem OCR, não dá pra indexar."
        );
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Documentos (RAG)</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            id="doc-file-input"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button onClick={handleUpload} disabled={!canUpload} style={styles.btn}>
            {busy ? "Processando..." : "Enviar"}
          </button>
        </div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.35 }}>
          PDF é extraído no navegador e enviado como texto para a API.
          <br />
          PDF escaneado (imagem) não funciona sem OCR.
        </div>

        {msg ? (
          <pre style={styles.log}>
            {msg}
          </pre>
        ) : null}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Lista</div>
          <button onClick={loadDocs} disabled={busy} style={styles.btn}>
            Atualizar
          </button>
        </div>

        {docs.length === 0 ? (
          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.75)" }}>Nenhum documento.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {docs.map((d) => (
              <div key={d.id} style={styles.card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d.file_name}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                      {formatDate(d.created_at)} • chunks: {d.chunk_count}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{d.id}</div>
                  </div>

                  <button onClick={() => handleDelete(d.id)} disabled={busy} style={styles.dangerBtn}>
                    Deletar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(79,140,255,0.7)",
    background: "rgba(79,140,255,0.15)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,90,90,0.6)",
    background: "rgba(255,90,90,0.12)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    height: 38,
    alignSelf: "flex-start",
  },
  card: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
  },
  log: {
    margin: 0,
    marginTop: 6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: "rgba(0,0,0,0.25)",
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    fontSize: 12,
  },
};