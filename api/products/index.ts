import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "../_lib/http";
import { withTransaction } from "../_lib/db";
import { requireAdmin } from "../_lib/auth";

interface ProductRow {
  id: number;
  category_id: number;
  name: string;
  base_price: string;
  requiere_presa: boolean;
  active: boolean;
}

/** Crea/edita un producto y sincroniza sus presas admitidas (product_presas). */
async function handler(req: VercelRequest, res: VercelResponse) {
  requireAdmin(req);

  if (req.method === "POST") {
    const { category_id, name, base_price, requiere_presa, presa_ids } = req.body ?? {};
    if (!category_id || !name || base_price == null) {
      res.status(400).json({ error: "category_id, name y base_price son obligatorios" });
      return;
    }
    const product = await withTransaction(async (client) => {
      const inserted = await client.query<ProductRow>(
        `INSERT INTO products (category_id, name, base_price, requiere_presa)
         VALUES ($1, $2, $3, $4)
         RETURNING id, category_id, name, base_price, requiere_presa, active`,
        [category_id, name, base_price, !!requiere_presa]
      );
      const row = inserted.rows[0];
      const ids: number[] = Array.isArray(presa_ids) ? presa_ids : [];
      for (const presaId of ids) {
        await client.query(`INSERT INTO product_presas (product_id, presa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
          row.id,
          presaId,
        ]);
      }
      return row;
    });
    res.status(201).json(product);
    return;
  }

  if (req.method === "PATCH") {
    const { id, category_id, name, base_price, requiere_presa, active, presa_ids } = req.body ?? {};
    if (!id) {
      res.status(400).json({ error: "id es obligatorio" });
      return;
    }
    const product = await withTransaction(async (client) => {
      const updated = await client.query<ProductRow>(
        `UPDATE products SET
           category_id = COALESCE($2, category_id),
           name = COALESCE($3, name),
           base_price = COALESCE($4, base_price),
           requiere_presa = COALESCE($5, requiere_presa),
           active = COALESCE($6, active)
         WHERE id = $1
         RETURNING id, category_id, name, base_price, requiere_presa, active`,
        [id, category_id ?? null, name ?? null, base_price ?? null, requiere_presa ?? null, active ?? null]
      );
      const row = updated.rows[0];
      if (row && Array.isArray(presa_ids)) {
        await client.query(`DELETE FROM product_presas WHERE product_id = $1`, [id]);
        for (const presaId of presa_ids) {
          await client.query(`INSERT INTO product_presas (product_id, presa_id) VALUES ($1, $2)`, [id, presaId]);
        }
      }
      return row;
    });
    if (!product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
    res.status(200).json(product);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
