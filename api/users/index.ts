import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { withErrorHandling } from "../_lib/http";
import { query, queryOne } from "../_lib/db";
import { requireAdmin } from "../_lib/auth";
import type { AppUser } from "../../shared/types";

const SELECT_USER = `id, name, role, branch_id, status, color, protected`;

const COLOR_PRESETS = ["primary", "secondary", "info", "gold", "success", "danger"];

async function handler(req: VercelRequest, res: VercelResponse) {
  requireAdmin(req); // gestión de usuarios: solo admin

  if (req.method === "GET") {
    const users = await query<AppUser>(`SELECT ${SELECT_USER} FROM users ORDER BY id`);
    res.status(200).json(users);
    return;
  }

  if (req.method === "POST") {
    const { name, role, pin, branch_id, color } = req.body ?? {};
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
    const chosenColor = COLOR_PRESETS.includes(color) ? color : COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
    const user = await queryOne<AppUser>(
      `INSERT INTO users (name, role, pin_hash, branch_id, color) VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT_USER}`,
      [name, role, pinHash, branch_id ?? null, chosenColor]
    );
    res.status(201).json(user);
    return;
  }

  if (req.method === "PATCH") {
    const { id, status, color } = req.body ?? {};
    if (!id) {
      res.status(400).json({ error: "id es obligatorio" });
      return;
    }
    const existing = await queryOne<AppUser>(`SELECT ${SELECT_USER} FROM users WHERE id = $1`, [id]);
    if (!existing) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    if (existing.protected && status === false) {
      res.status(400).json({ error: "Este usuario está protegido y no se puede bloquear" });
      return;
    }
    const user = await queryOne<AppUser>(
      `UPDATE users SET status = COALESCE($2, status), color = COALESCE($3, color) WHERE id = $1
       RETURNING ${SELECT_USER}`,
      [id, status ?? null, color ?? null]
    );
    res.status(200).json(user);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
