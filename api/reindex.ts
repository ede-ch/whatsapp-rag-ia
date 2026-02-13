import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ausente: ${name}`);
  return v;
}

function safeString(v: any) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function chunkText(text: string, opts?: { chunkSize?: number; overlap?: number }) {
  const chunkSize = opts?.chunkSize ?? 1200;
  const overlap = opts?.overlap ?? 200;
  const clean = (text || "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    const slice = clean.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

async function createEmbedding(openRouterKey: string, input: string) {
  const resp = await axios.post(
    "https://openrouter.ai/api/v1/embeddings",
    { model: "text-embedding-3-small", input },
    { headers: { Authorization: `Bearer ${openRouterKey}` }, timeout: 60000 }
  );

  const emb = resp.data?.data?.[0]?.embedding;
  if (!emb) throw new Error("Embedding inválido retornado pelo OpenRouter");
  return emb as number[];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function runner() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = new Array(Math.min(limit, items.length)).fill(null).map(() => runner());
  await Promise.all(runners);
  return results;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let step = "init";

  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "ID ausente" });

    step = "supabase_client";
    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    step = "read_settings";
    const { data: settings, error: setErr } = await supabase
      .from("settings")
      .select("openrouter_api_key")
      .eq("id", 1)
      .single();

    if (setErr) return res.status(500).json({ error: setErr.message });

    const openRouterKey = (process.env.OPEN_ROUTER_API_KEY || settings?.openrouter_api_key || "").trim();
    if (!openRouterKey) return res.status(401).json({ error: "OPEN_ROUTER_API_KEY ausente" });

    step = "fetch_document";
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id,file_name,content")
      .eq("id", id)
      .single();

    if (docErr || !doc) return res.status(404).json({ error: docErr?.message || "Documento não encontrado" });

    const content = String(doc.content || "").trim();
    if (content.length < 10) {
      return res.status(400).json({ error: "Documento sem conteúdo suficiente para reindexar" });
    }

    step = "delete_old_chunks";
    const { error: delErr } = await supabase.from("document_chunks").delete().eq("document_id", id);
    if (delErr) return res.status(500).json({ error: delErr.message });

    step = "chunking";
    const chunks = chunkText(content);

    const MAX_CHUNKS = 20;
    const CHUNK_CONCURRENCY = 5;
    const limitedChunks = chunks.slice(0, MAX_CHUNKS);

    step = "embed_chunks";
    const rows = await mapWithConcurrency(limitedChunks, CHUNK_CONCURRENCY, async (txt, i) => {
      const emb = await createEmbedding(openRouterKey, txt);
      return { document_id: id, chunk_index: i, content: txt, embedding: emb };
    });

    step = "insert_chunks";
    const { error: insErr } = await supabase.from("document_chunks").insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });

    return res.status(200).json({
      success: true,
      documentId: id,
      fileName: doc.file_name,
      totalChunks: chunks.length,
      embeddedChunks: rows.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `[${step}] ${safeString(err?.message || err)}` });
  }
}