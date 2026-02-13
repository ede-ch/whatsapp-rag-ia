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

function normalizeSpaces(s: string) {
  return String(s || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text: string, targetChars = 1200, overlap = 120): string[] {
  const t = normalizeSpaces(text);
  if (!t) return [];

  const parts = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const out = buf.trim();
    if (out) chunks.push(out);
    buf = "";
  };

  for (const p of parts) {
    if (!buf) {
      buf = p;
      continue;
    }

    if ((buf + "\n\n" + p).length <= targetChars) {
      buf = buf + "\n\n" + p;
    } else {
      flush();
      buf = p;
    }
  }
  flush();

  if (overlap > 0 && chunks.length > 1) {
    const withOverlap: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const prev = i > 0 ? chunks[i - 1] : "";
      const cur = chunks[i];
      const tail = prev ? prev.slice(Math.max(0, prev.length - overlap)) : "";
      const merged = tail ? `${tail}\n${cur}` : cur;
      withOverlap.push(merged);
    }
    return withOverlap;
  }

  return chunks;
}

async function createEmbedding(openRouterKey: string, text: string) {
  const resp = await axios.post(
    "https://openrouter.ai/api/v1/embeddings",
    { model: "text-embedding-3-small", input: text },
    { headers: { Authorization: `Bearer ${openRouterKey}` }, timeout: 60000 }
  );

  const emb = resp.data?.data?.[0]?.embedding;
  if (!emb) throw new Error("Embedding inválido retornado pelo OpenRouter");
  return emb as number[];
}

async function clearAllDocuments(supabase: any) {
  const { error: e1 } = await supabase.from("document_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e1) throw new Error(`Falha ao limpar document_chunks: ${e1.message}`);

  const { error: e2 } = await supabase.from("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e2) throw new Error(`Falha ao limpar documents: ${e2.message}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: settings } = await supabase
      .from("settings")
      .select("openrouter_api_key")
      .eq("id", 1)
      .single();

    const openRouterKey =
      (typeof req.body?.apiKey === "string" && req.body.apiKey.trim() ? req.body.apiKey.trim() : "") ||
      process.env.OPEN_ROUTER_API_KEY ||
      settings?.openrouter_api_key;

    if (!openRouterKey) {
      return res.status(401).json({ error: "OPEN_ROUTER_API_KEY ausente (settings/ENV)" });
    }

    const fileName = String(req.body?.fileName || req.body?.file_name || "").trim();
    if (!fileName) return res.status(400).json({ error: "fileName ausente" });

    let chunksInput: string[] = [];
    const rawChunks = req.body?.chunks;

    if (Array.isArray(rawChunks) && rawChunks.length) {
      chunksInput = rawChunks.map((c: any) => normalizeSpaces(String(c || ""))).filter(Boolean);
    } else {
      const content = normalizeSpaces(String(req.body?.content || ""));
      if (!content) return res.status(400).json({ error: "Envie chunks[] ou content" });
      chunksInput = chunkText(content);
    }

    if (!chunksInput.length) return res.status(400).json({ error: "Nenhum chunk gerado" });

    await clearAllDocuments(supabase);

    const fullText = chunksInput.join("\n\n");
    const docEmbedding = await createEmbedding(openRouterKey, fullText.slice(0, 8000));

    const { data: docRow, error: docErr } = await supabase
      .from("documents")
      .insert({ file_name: fileName, content: fullText, embedding: docEmbedding as any })
      .select("id")
      .single();

    if (docErr || !docRow?.id) {
      return res.status(500).json({ error: `Falha ao inserir documents: ${docErr?.message || "sem id"}` });
    }

    const documentId = docRow.id as string;

    const rows: Array<any> = [];
    for (let i = 0; i < chunksInput.length; i++) {
      const ch = chunksInput[i];
      const emb = await createEmbedding(openRouterKey, ch);
      rows.push({
        document_id: documentId,
        chunk_index: i,
        content: ch,
        embedding: emb as any,
      });
    }

    const { error: chErr } = await supabase.from("document_chunks").insert(rows);
    if (chErr) return res.status(500).json({ error: `Falha ao inserir document_chunks: ${chErr.message}` });

    return res.status(200).json({
      ok: true,
      document_id: documentId,
      file_name: fileName,
      chunk_count: chunksInput.length,
    });
  } catch (err: any) {
    const status = err?.status || err?.response?.status || 500;
    return res.status(status).json({ error: safeString(err?.message || err) });
  }
}