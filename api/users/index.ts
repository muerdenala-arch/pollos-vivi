import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { withErrorHandling } from "../_lib/http";
import { query, queryOne } from "../_lib/db";
import { requireAdmin } from "../_lib/auth";
import type { AppUser } from "../../shared/types";

async function handler(req: VercelRequest, res: VercelResponse) {
  requireAdmin(req); // gestión de usuarios: solo admin

  if (req.method === "GET") {
    const users = await query<AppUser>(
      `SELECT id, name, role, branch_id, status FROM users ORDER BY id`
    );
    res.status(200).json(users);
    return;
  }

  if (req.method === "POST") {
    const { name, role, pin, branch_id } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "El nombre es obligatorio" });
      return;
    }
    if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      res.status(400).json({ error: "El PIN debe tener entre 4 y 6 dígitos" });
      return;
    }
    if (role !== "admin" && role !== "cajero") {
      res.status(400).json({ error: "Rol inválido" });
      return;
    }
    const pinHash = await bcrypt.hash(pin, 10);
    const user = await queryOne<AppUser>(
      `INSERT INTO users (name, role, pin_hash, branch_id) VALUES ($1, $2, $3, $4)
       RETURNING id, name, role, branch_id, status`,
      [name, role, pinHash, branch_id ?? null]
    );
    res.status(201).json(user);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
