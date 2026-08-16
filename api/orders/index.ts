import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../_lib/http";
import { query, queryOne, withTransaction } from "../_lib/db";
import { getAuthUser } from "../_lib/auth";
import { validarYCalcularItems, CatalogoError, DISPATCH_MODES } from "../../shared/catalog";
import { loadCatalog } from "../_lib/catalog";
import type { Order } from "../../shared/types";

async function handler(req: VercelRequest, res: VercelResponse) {
  const user = getAuthUser(req);

  if (req.method === "GET") {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : user.branchId;

    const rows = await query<Order>(
      `SELECT id, ticket_number, branch_id, cashier_id, cash_register_id, order_type,
              items, total, payment_method, receipt_url, status, created_at
       FROM orders
       WHERE ($1::int IS NULL OR branch_id = $1)
         AND ($2::text IS NULL OR status = $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [branchId ?? null, status, limit]
    );
    res.status(200).json(rows);
    return;
  }

  if (req.method === "POST") {
    if (!user.branchId) {
      res.status(400).json({ error: "El usuario no tiene sucursal asignada" });
      return;
    }
    const { items, order_type } = req.body ?? {};
    const orderType = DISPATCH_MODES.includes(order_type) ? order_type : "Llevar";

    let calculo;
    try {
      const { productos, presas } = await loadCatalog();
      calculo = validarYCalcularItems(items ?? [], productos, presas);
    } catch (e) {
      if (e instanceof CatalogoError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }

    // Requiere caja abierta para poder cobrar (fix del hallazgo de auditoría:
    // ya no se puede vender "a ciegas" sin una apertura de caja registrada).
    const openRegister = await queryOne<{ id: number }>(
      `SELECT id FROM cash_registers WHERE cashier_id = $1 AND status = 'open'`,
      [user.sub]
    );
    if (!openRegister) {
      res.status(409).json({ error: "Debes abrir caja antes de registrar pedidos" });
      return;
    }

    const order = await withTransaction(async (client) => {
      const insert = await client.query<Order>(
        `INSERT INTO orders (ticket_number, branch_id, cashier_id, cash_register_id, order_type, items, total, status)
         VALUES ('TEMP', $1, $2, $3, $4, $5::jsonb, $6, 'Pendiente')
         RETURNING id`,
        [user.branchId, user.sub, openRegister.id, orderType, JSON.stringify(calculo.items), calculo.total]
      );
      const id = insert.rows[0].id;
      const ticket = `PV-${String(id).padStart(6, "0")}`;
      const updated = await client.query<Order>(
        `UPDATE orders SET ticket_number = $2 WHERE id = $1
         RETURNING id, ticket_number, branch_id, cashier_id, cash_register_id, order_type,
                   items, total, payment_method, receipt_url, status, created_at`,
        [id, ticket]
      );
      return updated.rows[0];
    });

    res.status(201).json(order);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
