import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { from, message, model, systemPrompt } = req.body;
  if (!from || !message) return res.status(400).json({ error: "'from' ou 'message' ausente" });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const embeddingResp = await axios.post(
    "https://openrouter.ai/api/v1/embeddings",
    { model: "text-embedding-3-small", input: message },
    { headers: { Authorization: `Bearer ${process.env.OPEN_ROUTER_API_KEY}` } }
  );

  const queryEmbedding = embeddingResp.data.data[0].embedding;

  const { data: documents } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: 3,
  });

  const context = documents?.map((d: any) => d.content).join("\n") || "Sem contexto disponível.";

  const chatResp = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: model || "gpt-4",
      messages: [
        { role: "system", content: systemPrompt || "Responda apenas usando o contexto fornecido." },
        { role: "user", content: `Contexto:\n${context}\n\nPergunta:\n${message}` }
      ]
    },
    { headers: { Authorization: `Bearer ${process.env.OPEN_ROUTER_API_KEY}` } }
  );

  const reply = chatResp.data.choices[0].message.content;

  await axios.post(
    `${process.env.EVOLUTION_URL}/messages`,
    { to: from, message: reply },
    { headers: { Authorization: `Bearer ${process.env.EVOLUTION_KEY}`, "Content-Type": "application/json" } }
  );

  return res.status(200).json({ success: true });
}
