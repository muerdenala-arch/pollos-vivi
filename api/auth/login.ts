import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { withErrorHandling } from "../_lib/http";
import { query, queryOne } from "../_lib/db";
import { signToken } from "../_lib/auth";
import type { AppUser, Branch, AuthResponse } from "../../shared/types";

interface UserRow {
  id: number;
  name: string;
  role: "admin" | "cajero";
  pin_hash: string;
  branch_id: number | null;
  status: boolean;
}

/**
 * Login por PIN (pensado para pantallas táctiles de caja).
 * El PIN no es único a nivel de índice (está hasheado), así que se compara
 * contra los usuarios activos — el equipo de cajeros es pequeño, así que
 * el costo de iterar es despreciable frente a la seguridad de no guardar
 * el PIN en texto plano ni permitir búsquedas directas por él.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  const { pin } = req.body ?? {};
  if (!pin || typeof pin !== "string" || pin.length < 4) {
    res.status(400).json({ error: "PIN inválido" });
    return;
  }

  const users = await query<UserRow>(
    `SELECT id, name, role, pin_hash, branch_id, status FROM users WHERE status = TRUE`
  );

  let matched: UserRow | null = null;
  for (const u of users) {
    if (await bcrypt.compare(pin, u.pin_hash)) {
      matched = u;
      break;
    }
  }

  if (!matched) {
    res.status(401).json({ error: "PIN incorrecto" });
    return;
  }

  const token = signToken({
    sub: matched.id,
    role: matched.role,
    branchId: matched.branch_id,
    name: matched.name,
  });

  const branch = matched.branch_id
    ? await queryOne<Branch>(`SELECT id, name, address, phone, is_active FROM branches WHERE id = $1`, [
        matched.branch_id,
      ])
    : null;

  const user: AppUser = {
    id: matched.id,
    name: matched.name,
    role: matched.role,
    branch_id: matched.branch_id,
    status: matched.status,
  };

  const body: AuthResponse = { token, user, branch };
  res.status(200).json(body);
}

export default withErrorHandling(handler);
