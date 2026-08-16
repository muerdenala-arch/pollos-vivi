import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../_lib/http";
import { query, queryOne } from "../_lib/db";
import { getAuthUser, requireAdmin } from "../_lib/auth";
import type { Branch } from "../../shared/types";

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    getAuthUser(req); // requiere sesión, cualquier rol
    const branches = await query<Branch>(
      `SELECT id, name, address, phone, is_active FROM branches ORDER BY id`
    );
    res.status(200).json(branches);
    return;
  }

  if (req.method === "POST") {
    requireAdmin(req);
    const { name, address, phone } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "El nombre de la sucursal es obligatorio" });
      return;
    }
    const branch = await queryOne<Branch>(
      `INSERT INTO branches (name, address, phone) VALUES ($1, $2, $3)
       RETURNING id, name, address, phone, is_active`,
      [name, address ?? null, phone ?? null]
    );
    res.status(201).json(branch);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
