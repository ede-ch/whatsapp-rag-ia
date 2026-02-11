import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { message, model, systemPrompt, apiKey } = req.body;
    
    if (!message) return res.status(400).json({ error: "Mensagem ausente" });

    const openRouterKey = apiKey || process.env.OPEN_ROUTER_API_KEY;

    if (!openRouterKey) {
      return res.status(401).json({ error: "API Key não configurada (nem no Settings, nem no ENV)" });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const embeddingResp = await axios.post(
      "https://openrouter.ai/api/v1/embeddings",
      { model: "text-embedding-3-small", input: message },
      { headers: { Authorization: `Bearer ${openRouterKey}` } }
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
      { headers: { Authorization: `Bearer ${openRouterKey}` } }
    );

    const reply = chatResp.data.choices[0].message.content;
    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error(err);
    const apiError = err.response?.data || err.message;
    return res.status(500).json({ error: apiError });
  }
}