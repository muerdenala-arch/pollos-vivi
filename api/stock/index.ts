import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../_lib/http";
import { query, queryOne } from "../_lib/db";
import { getAuthUser, requireAdmin } from "../_lib/auth";
import type { StockItem } from "../../shared/types";

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const user = getAuthUser(req);
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : user.branchId;
    const rows = branchId
      ? await query<StockItem>(
          `SELECT id, branch_id, item_name, quantity, min_stock, unit FROM stock_inventory
           WHERE branch_id = $1 ORDER BY item_name`,
          [branchId]
        )
      : await query<StockItem>(
          `SELECT id, branch_id, item_name, quantity, min_stock, unit FROM stock_inventory ORDER BY item_name`
        );
    res.status(200).json(rows);
    return;
  }

  if (req.method === "POST") {
    requireAdmin(req);
    const { branch_id, item_name, quantity, min_stock, unit } = req.body ?? {};
    if (!branch_id || !item_name) {
      res.status(400).json({ error: "branch_id e item_name son obligatorios" });
      return;
    }
    const row = await queryOne<StockItem>(
      `INSERT INTO stock_inventory (branch_id, item_name, quantity, min_stock, unit)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, branch_id, item_name, quantity, min_stock, unit`,
      [branch_id, item_name, quantity ?? 0, min_stock ?? 0, unit ?? "unidad"]
    );
    res.status(201).json(row);
    return;
  }

  if (req.method === "PATCH") {
    requireAdmin(req);
    const { id, quantity } = req.body ?? {};
    if (!id || quantity == null) {
      res.status(400).json({ error: "id y quantity son obligatorios" });
      return;
    }
    const row = await queryOne<StockItem>(
      `UPDATE stock_inventory SET quantity = $2, updated_at = now() WHERE id = $1
       RETURNING id, branch_id, item_name, quantity, min_stock, unit`,
      [id, quantity]
    );
    if (!row) {
      res.status(404).json({ error: "No encontrado" });
      return;
    }
    res.status(200).json(row);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
