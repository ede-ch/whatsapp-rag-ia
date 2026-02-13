import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ausente: ${name}`);
  return v;
}

function safeString(v: any) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    if (req.method === "GET") {
      const conversationId = String(req.query.conversationId || "").trim();
      if (!conversationId) return res.status(400).json({ error: "conversationId ausente" });

      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data ?? []);
    }

    if (req.method === "POST") {
      const { conversationId, role, content } = req.body || {};
      if (!conversationId) return res.status(400).json({ error: "conversationId ausente" });
      if (!role || !["user", "assistant", "system"].includes(String(role))) {
        return res.status(400).json({ error: "role inválido" });
      }
      if (!content || String(content).trim().length === 0) return res.status(400).json({ error: "content ausente" });

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role: String(role),
          content: String(content),
        })
        .select("id")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ id: data?.id });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (err: any) {
    return res.status(500).json({ error: safeString(err?.message || err) });
  }
}