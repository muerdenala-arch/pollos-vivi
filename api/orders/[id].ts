import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../_lib/http";
import { queryOne } from "../_lib/db";
import { getAuthUser } from "../_lib/auth";
import type { Order } from "../../shared/types";

const SELECT_ORDER = `SELECT id, ticket_number, branch_id, cashier_id, cash_register_id, order_type,
       items, total, payment_method, receipt_url, status, created_at FROM orders WHERE id = $1`;

async function handler(req: VercelRequest, res: VercelResponse) {
  getAuthUser(req);
  const id = Number(req.query.id);

  if (req.method === "GET") {
    const order = await queryOne<Order>(SELECT_ORDER, [id]);
    if (!order) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }
    res.status(200).json(order);
    return;
  }

  if (req.method === "PATCH") {
    const { status, payment_method, receipt_url } = req.body ?? {};

    const current = await queryOne<Order>(`SELECT status FROM orders WHERE id = $1`, [id]);
    if (!current) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }
    // Entregado/Cancelado son estados finales: no se pueden reabrir ni
    // recobrar (evita descuadrar caja o duplicar una venta ya cerrada).
    if (status && (current.status === "Entregado" || current.status === "Cancelado")) {
      res.status(400).json({ error: `Este pedido ya está ${current.status.toLowerCase()} y no se puede modificar` });
      return;
    }

    const order = await queryOne<Order>(
      `UPDATE orders SET
         status = COALESCE($2, status),
         payment_method = COALESCE($3, payment_method),
         receipt_url = COALESCE($4, receipt_url),
         updated_at = now()
       WHERE id = $1
       RETURNING id, ticket_number, branch_id, cashier_id, cash_register_id, order_type,
                 items, total, payment_method, receipt_url, status, created_at`,
      [id, status ?? null, payment_method ?? null, receipt_url ?? null]
    );
    res.status(200).json(order);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
