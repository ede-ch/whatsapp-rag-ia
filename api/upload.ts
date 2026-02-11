import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { content, fileName } = req.body;
  if (!content || !fileName) return res.status(400).json({ error: "Conteúdo ou nome ausente" });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const embeddingResp = await axios.post(
    "https://openrouter.ai/api/v1/embeddings",
    { model: "text-embedding-3-small", input: content },
    { headers: { Authorization: `Bearer ${process.env.OPEN_ROUTER_API_KEY}` } }
  );

  const embedding = embeddingResp.data.data[0].embedding;

  const { error } = await supabase.from("documents").insert({
    file_name: fileName,
    content,
    embedding
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
