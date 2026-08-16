import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../../_lib/http";
import { queryOne } from "../../_lib/db";
import { getAuthUser } from "../../_lib/auth";
import type { CashRegister } from "../../../shared/types";

interface RegisterRow extends CashRegister {}

/** Cierre de caja: calcula el esperado desde `orders` y guarda el monto contado + diferencia. */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  const user = getAuthUser(req);
  const id = Number(req.query.id);
  const { closing_amount } = req.body ?? {};
  const counted = Number(closing_amount);
  if (!Number.isFinite(counted) || counted < 0) {
    res.status(400).json({ error: "Monto de cierre inválido" });
    return;
  }

  const register = await queryOne<RegisterRow>(
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

  const updated = await queryOne<RegisterRow>(
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
}

export default withErrorHandling(handler);
