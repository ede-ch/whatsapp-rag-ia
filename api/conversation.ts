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

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { platform, phoneNumber } = req.body || {};
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        platform: typeof platform === "string" ? platform : "web",
        phone_number: typeof phoneNumber === "string" ? phoneNumber : null,
      })
      .select("id")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data?.id });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}