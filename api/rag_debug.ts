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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

    const { query, message, matchCount } = req.body || {};
    const q = String(query || message || "").trim();
    if (!q) return res.status(400).json({ error: "query ausente" });

    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: settings } = await supabase
      .from("settings")
      .select("openrouter_api_key")
      .eq("id", 1)
      .single();

    const openRouterKey = process.env.OPEN_ROUTER_API_KEY || settings?.openrouter_api_key;
    if (!openRouterKey) return res.status(401).json({ error: "OPEN_ROUTER_API_KEY ausente (settings/ENV)" });

    const emb = await createEmbedding(openRouterKey, q);

    const { data: chunks, error: rpcError } = await supabase.rpc("match_chunks", {
      query_embedding: emb,
      match_count: typeof matchCount === "number" ? matchCount : 8,
    });

    if (rpcError) return res.status(500).json({ error: `RPC match_chunks falhou: ${rpcError.message}` });

    return res.status(200).json({ ok: true, count: (chunks || []).length, chunks: chunks || [] });
  } catch (err: any) {
    const status = err?.response?.status || 500;
    const apiError = err?.response?.data || err?.message || "Erro interno";
    return res.status(status).json({ error: safeString(apiError) });
  }
}