import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../_lib/http";
import { query, queryOne } from "../_lib/db";
import { getAuthUser, requireAdmin } from "../_lib/auth";
import type { CashRegister } from "../../shared/types";

/**
 * Apertura, consulta y cierre de caja — reemplaza el localStorage de
 * frontend/js/caja.js (hallazgo de la auditoría) por persistencia real en
 * Neon. El cierre vive aquí mismo (PATCH con `id` en el body) en vez de una
 * ruta [id]/close.ts aparte, para no sumar otra función serverless al
 * límite del plan de Vercel.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  const user = getAuthUser(req);

  if (req.method === "GET") {
    // Modo admin: listado de cajas de UNA sucursal en UNA fecha (para auditar
    // turnos — cuántas cajas se abrieron, quién, y poder ver sus movimientos).
    // Se distingue del modo normal (mi propia caja abierta) por query params.
    if (req.query.branch_id) {
      requireAdmin(req);
      const branchId = Number(req.query.branch_id);
      const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().slice(0, 10);
      // Fecha comparada en horario de Bolivia, no UTC — si no, una caja
      // abierta después de las 8pm local aparecía fechada al día siguiente.
      const registers = await query<CashRegister & { cashier_name: string }>(
        `SELECT cr.id, cr.cashier_id, cr.branch_id, cr.opening_amount, cr.closing_amount,
                cr.opened_at, cr.closed_at, cr.status, u.name AS cashier_name
         FROM cash_registers cr
         JOIN users u ON u.id = cr.cashier_id
         WHERE cr.branch_id = $1 AND (cr.opened_at AT TIME ZONE 'America/La_Paz')::date = $2::date
         ORDER BY cr.opened_at DESC`,
        [branchId, date]
      );
      res.status(200).json(registers);
      return;
    }

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

  if (req.method === "PATCH") {
    const { id, closing_amount } = req.body ?? {};
    const counted = Number(closing_amount);
    if (!id || !Number.isFinite(counted) || counted < 0) {
      res.status(400).json({ error: "id y closing_amount (válido) son obligatorios" });
      return;
    }

    const register = await queryOne<CashRegister>(
      `SELECT id, cashier_id, branch_id, opening_amount, closing_amount, opened_at, closed_at, status
       FROM cash_registers WHERE id = $1`,
      [id]
    );
    if (!register) {
      res.status(404).json({ error: "Caja no encontrada" });
      return;
    }
    if (register.status !== "open") {
      res.status(400).json({ error: "Esta caja ya está cerrada" });
      return;
    }
    if (register.cashier_id !== user.sub && user.role !== "admin") {
      res.status(403).json({ error: "No puedes cerrar la caja de otro cajero" });
      return;
    }

    const totals = await queryOne<{ efectivo: string; qr: string; cantidad: string }>(
      `SELECT
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'Efectivo'), 0) AS efectivo,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'QR'), 0) AS qr,
         COUNT(*) AS cantidad
       FROM orders WHERE cash_register_id = $1 AND status <> 'Cancelado'`,
      [id]
    );

    const efectivoVendido = Number(totals?.efectivo ?? 0);
    const esperado = Number(register.opening_amount) + efectivoVendido;
    const diferencia = counted - esperado;

    const updated = await queryOne<CashRegister>(
      `UPDATE cash_registers SET closing_amount = $2, closed_at = now(), status = 'closed'
       WHERE id = $1
       RETURNING id, cashier_id, branch_id, opening_amount, closing_amount, opened_at, closed_at, status`,
      [id, counted]
    );

    res.status(200).json({
      register: updated,
      resumen: {
        efectivo_esperado: esperado,
        efectivo_vendido: efectivoVendido,
        qr_vendido: Number(totals?.qr ?? 0),
        pedidos: Number(totals?.cantidad ?? 0),
        monto_contado: counted,
        diferencia,
      },
    });
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
