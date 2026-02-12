import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ausente: ${name}`);
  return v;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("settings")
        .select("id, selected_model, system_prompt, openrouter_api_key, updated_at")
        .eq("id", 1)
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        selectedModel: data?.selected_model || "openai/gpt-4o-mini",
        systemPrompt: data?.system_prompt || "Você é um assistente útil.",
        hasApiKey: Boolean(data?.openrouter_api_key && data.openrouter_api_key.length > 0),
        updatedAt: data?.updated_at,
      });
    }

    if (req.method === "PUT") {
      const { apiKey, selectedModel, systemPrompt } = req.body || {};

      if (typeof selectedModel !== "string" || typeof systemPrompt !== "string") {
        return res.status(400).json({ error: "selectedModel e systemPrompt são obrigatórios" });
      }

      const payload: any = {
        selected_model: selectedModel,
        system_prompt: systemPrompt,
        updated_at: new Date().toISOString(),
      };

      if (typeof apiKey === "string" && apiKey.trim().length > 0) {
        payload.openrouter_api_key = apiKey.trim();
      }

      const { error } = await supabase
        .from("settings")
        .upsert({ id: 1, ...payload }, { onConflict: "id" });

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}