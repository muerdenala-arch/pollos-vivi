import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../_lib/http";
import { queryOne } from "../_lib/db";
import { requireAdmin } from "../_lib/auth";

interface CategoryRow {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}

async function handler(req: VercelRequest, res: VercelResponse) {
  requireAdmin(req); // el listado normal se sirve vía /api/catalog; esto es solo gestión

  if (req.method === "POST") {
    const { name, sort_order } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "El nombre es obligatorio" });
      return;
    }
    const row = await queryOne<CategoryRow>(
      `INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING id, name, sort_order, active`,
      [name, sort_order ?? 0]
    );
    res.status(201).json(row);
    return;
  }

  if (req.method === "PATCH") {
    const { id, name, sort_order, active } = req.body ?? {};
    if (!id) {
      res.status(400).json({ error: "id es obligatorio" });
      return;
    }
    const row = await queryOne<CategoryRow>(
      `UPDATE categories SET
         name = COALESCE($2, name),
         sort_order = COALESCE($3, sort_order),
         active = COALESCE($4, active)
       WHERE id = $1
       RETURNING id, name, sort_order, active`,
      [id, name ?? null, sort_order ?? null, active ?? null]
    );
    if (!row) {
      res.status(404).json({ error: "Categoría no encontrada" });
      return;
    }
    res.status(200).json(row);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
