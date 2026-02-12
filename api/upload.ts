import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ausente: ${name}`);
  return v;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { content, fileName, apiKey } = req.body || {};
    if (!content || !fileName) {
      return res.status(400).json({ error: "Conteúdo ou nome ausente" });
    }

    const openRouterKey = apiKey || process.env.OPEN_ROUTER_API_KEY;
    if (!openRouterKey) {
      return res.status(401).json({ error: "OPEN_ROUTER_API_KEY ausente" });
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const embeddingResp = await axios.post(
      "https://openrouter.ai/api/v1/embeddings",
      { model: "text-embedding-3-small", input: content },
      { headers: { Authorization: `Bearer ${openRouterKey}` } }
    );

    const embedding = embeddingResp.data?.data?.[0]?.embedding;
    if (!embedding) {
      return res.status(500).json({ error: "Embedding inválido" });
    }

    const { error } = await supabase.from("documents").insert({
      file_name: fileName,
      content,
      embedding
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    const apiError = err?.response?.data || err?.message || "Erro interno";
    return res.status(500).json({ error: apiError });
  }
}