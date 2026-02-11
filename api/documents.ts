import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (req.method === "GET") {
    const { data } = await supabase.from("documents").select("*");
    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID ausente" });
    await supabase.from("documents").delete().eq("id", id);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Método não permitido" });
}
