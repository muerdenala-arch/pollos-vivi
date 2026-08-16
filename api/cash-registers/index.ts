import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../_lib/http";
import { query, queryOne } from "../_lib/db";
import { getAuthUser } from "../_lib/auth";
import type { CashRegister } from "../../shared/types";

/**
 * Apertura y consulta de caja — reemplaza el localStorage de frontend/js/caja.js
 * (hallazgo de la auditoría) por persistencia real en Neon, con auditoría e
 * imposibilidad de tener dos cajas abiertas simultáneas para el mismo cajero
 * (constraint idx_one_open_register_per_cashier).
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  const user = getAuthUser(req);

  if (req.method === "GET") {
    const register = await queryOne<CashRegister>(
      `SELECT id, cashier_id, branch_id, opening_amount, closing_amount, opened_at, closed_at, status
       FROM cash_registers WHERE cashier_id = $1 AND status = 'open'`,
      [user.sub]
    );
    res.status(200).json(register);
    return;
  }

  if (req.method === "POST") {
    if (!user.branchId) {
      res.status(400).json({ error: "El usuario no tiene sucursal asignada" });
      return;
    }
    const { opening_amount } = req.body ?? {};
    const amount = Number(opening_amount);
    if (!Number.isFinite(amount) || amount < 0) {
      res.status(400).json({ error: "Monto inicial inválido" });
      return;
    }

    const existing = await queryOne<CashRegister>(
      `SELECT id FROM cash_registers WHERE cashier_id = $1 AND status = 'open'`,
      [user.sub]
    );
    if (existing) {
      res.status(409).json({ error: "Ya tienes una caja abierta", register: existing });
      return;
    }

    const register = await queryOne<CashRegister>(
      `INSERT INTO cash_registers (cashier_id, branch_id, opening_amount)
       VALUES ($1, $2, $3)
       RETURNING id, cashier_id, branch_id, opening_amount, closing_amount, opened_at, closed_at, status`,
      [user.sub, user.branchId, amount]
    );
    res.status(201).json(register);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
