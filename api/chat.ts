import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ausente: ${name}`);
  return v;
}

function normalizeModel(input?: string) {
  const raw = (input || "").trim();
  if (!raw) return "openai/gpt-4o-mini";

  if (raw.includes("/")) return raw;

  const key = raw.toLowerCase();

  const map: Record<string, string> = {
    "gpt-4": "openai/gpt-4o-mini",
    "gpt4": "openai/gpt-4o-mini",
    "gpt-4o": "openai/gpt-4o",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-4.1-mini": "openai/gpt-4.1-mini",
    "claude": "anthropic/claude-3.5-sonnet",
    "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
    "llama": "meta-llama/llama-3.1-70b-instruct",
  };

  return map[key] || "openai/gpt-4o-mini";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { message, model, systemPrompt, apiKey, documentId } = req.body || {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Mensagem ausente" });
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("openrouter_api_key, selected_model, system_prompt")
      .eq("id", 1)
      .single();

    if (settingsError) {
      return res.status(500).json({ error: settingsError.message });
    }

    const apiKeyTrimmed = typeof apiKey === "string" ? apiKey.trim() : "";
    const openRouterKey =
      apiKeyTrimmed ||
      process.env.OPEN_ROUTER_API_KEY ||
      settings?.openrouter_api_key;

    if (!openRouterKey) {
      return res.status(401).json({
        error: "API Key não configurada no painel nem no ENV",
      });
    }

    const modelFinal = normalizeModel(model || settings?.selected_model);

    const systemPromptFinal =
      (typeof systemPrompt === "string" && systemPrompt.trim().length > 0
        ? systemPrompt.trim()
        : settings?.system_prompt) ||
      "Responda usando exclusivamente o contexto fornecido. Se não houver informação suficiente, diga claramente que não encontrou no documento.";

    let docsForContext: Array<{ file_name: string; content: string }> = [];

    if (documentId) {
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("file_name, content")
        .eq("id", documentId)
        .single();

      if (docError || !doc) {
        return res.status(400).json({ error: "Documento selecionado não encontrado" });
      }

      docsForContext = [doc];
    } else {
      const embeddingResp = await axios.post(
        "https://openrouter.ai/api/v1/embeddings",
        { model: "text-embedding-3-small", input: message },
        { headers: { Authorization: `Bearer ${openRouterKey}` } }
      );

      const queryEmbedding = embeddingResp.data?.data?.[0]?.embedding;
      if (!queryEmbedding) {
        return res.status(500).json({ error: "Embedding inválido retornado pelo OpenRouter" });
      }

      const { data: documents, error: rpcError } = await supabase.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_count: 5,
      });

      if (rpcError) {
        return res.status(500).json({ error: `RPC match_documents falhou: ${rpcError.message}` });
      }

      docsForContext =
        (documents || []).map((d: any) => ({
          file_name: d.file_name || "documento",
          content: d.content || "",
        })) || [];
    }

    const context =
      docsForContext.length > 0
        ? docsForContext
            .map((d) => `### Documento: ${d.file_name}\nConteúdo:\n${d.content}`)
            .join("\n\n---\n\n")
        : "Sem contexto disponível.";

    const forcedContext = `
Você está respondendo com base no banco de conhecimento interno.

CONTEXTO:
${context}

INSTRUÇÕES:
- Use apenas informações presentes no contexto.
- Se não houver informação suficiente, diga: "Não encontrei essa informação nos documentos carregados."
- Não invente dados.
`;

    const chatResp = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: modelFinal,
        messages: [
          { role: "system", content: systemPromptFinal },
          { role: "system", content: forcedContext },
          { role: "user", content: message },
        ],
      },
      { headers: { Authorization: `Bearer ${openRouterKey}` } }
    );

    const reply = chatResp.data?.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: "Resposta inválida do OpenRouter" });

    return res.status(200).json({ reply });
  } catch (err: any) {
    const status = err?.response?.status || 500;
    const apiError = err?.response?.data || err?.message || "Erro interno";
    return res.status(status).json({ error: apiError });
  }
}