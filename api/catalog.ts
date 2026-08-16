import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "./_lib/http";
import { getAuthUser } from "./_lib/auth";
import { loadCatalog } from "./_lib/catalog";

/** Catálogo completo (categorías + productos + presas) para pintar el POS. */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  getAuthUser(req);
  const catalog = await loadCatalog();
  res.status(200).json(catalog);
}

export default withErrorHandling(handler);
