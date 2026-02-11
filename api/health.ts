import type { VercelRequest, VercelResponse } from '@vercel/node';
// Todo arquivo dentro de /api no Vercel deve exportar uma função default
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ status: "ok" }); //Testando o Back
}
