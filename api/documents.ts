import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ausente: ${name}`);
  return v;
}

function extractChunkCount(row: any): number {
  const dc = row?.document_chunks;
  if (!dc) return 0;

  if (Array.isArray(dc)) {
    const n = dc?.[0]?.count;
    return typeof n === "number" ? n : 0;
  }

  const n = dc?.count;
  return typeof n === "number" ? n : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("documents")
        .select("id,file_name,created_at,document_chunks(count)")
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ error: error.message });

      const rows = (data ?? []).map((r: any) => ({
        id: r.id,
        file_name: r.file_name,
        created_at: r.created_at,
        chunk_count: extractChunkCount(r),
      }));

      return res.status(200).json(rows);
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "ID ausente" });

      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}