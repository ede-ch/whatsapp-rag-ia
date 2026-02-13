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

function normalizeModel(input?: string) {
  const raw = (input || "").trim();
  if (!raw) return "openai/gpt-4o-mini";
  if (raw.includes("/")) return raw;

  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    "gpt-4": "openai/gpt-4o-mini",
    gpt4: "openai/gpt-4o-mini",
    "gpt-4o": "openai/gpt-4o",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-4.1-mini": "openai/gpt-4.1-mini",
    claude: "anthropic/claude-3.5-sonnet",
    "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
    "claude-3-haiku": "anthropic/claude-3-haiku",
    llama: "meta-llama/llama-3.1-8b-instruct",
  };

  return map[key] || "openai/gpt-4o-mini";
}

function extractOpenRouterStatus(err: any) {
  return err?.response?.status as number | undefined;
}

function extractOpenRouterDetail(err: any) {
  return (
    err?.response?.data?.error ??
    err?.response?.data?.message ??
    err?.response?.data ??
    err?.message ??
    "Erro no OpenRouter"
  );
}

async function openRouterChat(params: {
  openRouterKey: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}) {
  const { openRouterKey, model, messages } = params;

  const resp = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    { model, messages },
    { headers: { Authorization: `Bearer ${openRouterKey}` }, timeout: 60000 }
  );

  const reply = resp.data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error("Resposta inválida do OpenRouter");
  return reply as string;
}

async function chatWith402Fallback(params: {
  openRouterKey: string;
  model: string;
  fallbackModel: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}) {
  const { openRouterKey, model, fallbackModel, messages } = params;

  try {
    const reply = await openRouterChat({ openRouterKey, model, messages });
    return { reply, usedModel: model, fallbackUsed: false };
  } catch (err: any) {
    const status = extractOpenRouterStatus(err);

    if (status === 402) {
      const reply2 = await openRouterChat({ openRouterKey, model: fallbackModel, messages });
      return { reply: reply2, usedModel: fallbackModel, fallbackUsed: true };
    }

    const detail = extractOpenRouterDetail(err);
    const e = new Error(`OpenRouter falhou (${status || 500}): ${safeString(detail)}`);
    (e as any).status = status || 500;
    (e as any).detail = detail;
    throw e;
  }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

    const { message, model, systemPrompt, apiKey } = req.body || {};
    const userMessage = String(message || "").trim();
    if (!userMessage) return res.status(400).json({ error: "message ausente" });

    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: settings } = await supabase
      .from("settings")
      .select("openrouter_api_key, selected_model, system_prompt")
      .eq("id", 1)
      .single();

    const openRouterKey =
      (typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : "") ||
      process.env.OPEN_ROUTER_API_KEY ||
      settings?.openrouter_api_key;

    if (!openRouterKey) {
      return res.status(401).json({ error: "OPEN_ROUTER_API_KEY ausente (settings/ENV)" });
    }

    const modelFinal = normalizeModel(model || settings?.selected_model);
    const fallbackModel = "openai/gpt-4o-mini";

    const systemPromptFinal =
      (typeof systemPrompt === "string" && systemPrompt.trim() ? systemPrompt : settings?.system_prompt) ||
      "Você é um assistente útil.";

    const queryEmbedding = await createEmbedding(openRouterKey, userMessage);

    const { data: chunks, error: rpcError } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_count: 8,
    });

    if (rpcError) return res.status(500).json({ error: `RPC match_chunks falhou: ${rpcError.message}` });

    const SIMILARITY_MIN = 0.2;

    type ChunkResult = {
  file_name: string | null;
  content: string | null;
  similarity: number | null;
};

const rawChunks = (chunks || []) as ChunkResult[];

const docsForContext = rawChunks
  .map((c) => ({
    file_name: c.file_name ?? "documento",
    content: c.content ?? "",
    similarity: typeof c.similarity === "number" ? c.similarity : 0,
  }))
  .filter((c) => c.content.trim().length > 0)
  .filter((c) => c.similarity >= SIMILARITY_MIN);

    const uniqueSourceNames = Array.from(new Set(docsForContext.map((d) => d.file_name).filter(Boolean)));
    const limitedSources = uniqueSourceNames.slice(0, 2);
    const sourcesLine = limitedSources.length ? `\n\nFontes: ${limitedSources.join(", ")}` : "";

    const context =
      docsForContext.length > 0
        ? docsForContext
            .map(
              (d, idx) =>
                `### Trecho ${idx + 1} — Documento: ${d.file_name} (similaridade: ${d.similarity.toFixed(3)})\n${
                  d.content
                }`
            )
            .join("\n\n---\n\n")
        : "Sem contexto disponível.";

    const forcedContext = `
Você TEM acesso ao banco interno de documentos (trechos relevantes já fornecidos abaixo).
Responda usando APENAS o conteúdo dos trechos fornecidos.
Se os trechos não tiverem a resposta, diga: "Não encontrei essa informação nos documentos carregados."

TRECHOS:
${context}
`.trim();

    const { reply, usedModel, fallbackUsed } = await chatWith402Fallback({
      openRouterKey,
      model: modelFinal,
      fallbackModel,
      messages: [
        { role: "system", content: systemPromptFinal },
        { role: "system", content: forcedContext },
        { role: "user", content: userMessage },
      ],
    });

    return res.status(200).json({ reply: reply + sourcesLine, usedModel, fallbackUsed });
  } catch (err: any) {
    const status = err?.status || err?.response?.status || 500;
    const apiError = err?.detail || err?.response?.data || err?.message || "Erro interno";
    return res.status(status).json({ error: safeString(apiError) });
  }
}