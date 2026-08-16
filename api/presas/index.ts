import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../_lib/http";
import { queryOne } from "../_lib/db";
import { requireAdmin } from "../_lib/auth";

interface PresaRow {
  id: number;
  name: string;
  recargo: string;
  active: boolean;
}

async function handler(req: VercelRequest, res: VercelResponse) {
  requireAdmin(req);

  if (req.method === "POST") {
    const { name, recargo } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "El nombre es obligatorio" });
      return;
    }
    const row = await queryOne<PresaRow>(
      `INSERT INTO presas (name, recargo) VALUES ($1, $2) RETURNING id, name, recargo, active`,
      [name, recargo ?? 0]
    );
    res.status(201).json(row);
    return;
  }

  if (req.method === "PATCH") {
    const { id, name, recargo, active } = req.body ?? {};
    if (!id) {
      res.status(400).json({ error: "id es obligatorio" });
      return;
    }
    const row = await queryOne<PresaRow>(
      `UPDATE presas SET
         name = COALESCE($2, name),
         recargo = COALESCE($3, recargo),
         active = COALESCE($4, active)
       WHERE id = $1
       RETURNING id, name, recargo, active`,
      [id, name ?? null, recargo ?? null, active ?? null]
    );
    if (!row) {
      res.status(404).json({ error: "Presa no encontrada" });
      return;
    }
    res.status(200).json(row);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
