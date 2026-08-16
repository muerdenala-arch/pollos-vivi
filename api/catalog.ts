import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "./_lib/http";
import { getAuthUser, requireAdmin } from "./_lib/auth";
import { loadCatalog } from "./_lib/catalog";
import { queryOne, withTransaction } from "./_lib/db";

/**
 * Catálogo (categorías, productos, presas) consolidado en un solo endpoint
 * para no pasarnos del límite de funciones serverless del plan de Vercel:
 *   GET              -> catálogo completo, para pintar el POS.
 *   POST/PATCH body: { resource: "category" | "product" | "presa", ... }
 *                    -> gestión desde el panel admin.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    getAuthUser(req);
    const catalog = await loadCatalog();
    res.status(200).json(catalog);
    return;
  }

  if (req.method === "POST" || req.method === "PATCH") {
    requireAdmin(req);
    const { resource } = req.body ?? {};
    if (resource === "category") return handleCategory(req, res);
    if (resource === "presa") return handlePresa(req, res);
    if (resource === "product") return handleProduct(req, res);
    res.status(400).json({ error: 'resource debe ser "category", "presa" o "product"' });
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

async function handleCategory(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const { name, sort_order } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: "El nombre es obligatorio" });
      return;
    }
    const row = await queryOne(
      `INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING id, name, sort_order, active`,
      [name, sort_order ?? 0]
    );
    res.status(201).json(row);
    return;
  }
  const { id, name, sort_order, active } = req.body ?? {};
  if (!id) { res.status(400).json({ error: "id es obligatorio" }); return; }
  const row = await queryOne(
    `UPDATE categories SET name = COALESCE($2, name), sort_order = COALESCE($3, sort_order), active = COALESCE($4, active)
     WHERE id = $1 RETURNING id, name, sort_order, active`,
    [id, name ?? null, sort_order ?? null, active ?? null]
  );
  if (!row) { res.status(404).json({ error: "Categoría no encontrada" }); return; }
  res.status(200).json(row);
}

async function handlePresa(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const { name, recargo } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: "El nombre es obligatorio" });
      return;
    }
    const row = await queryOne(
      `INSERT INTO presas (name, recargo) VALUES ($1, $2) RETURNING id, name, recargo, active`,
      [name, recargo ?? 0]
    );
    res.status(201).json(row);
    return;
  }
  const { id, name, recargo, active } = req.body ?? {};
  if (!id) { res.status(400).json({ error: "id es obligatorio" }); return; }
  const row = await queryOne(
    `UPDATE presas SET name = COALESCE($2, name), recargo = COALESCE($3, recargo), active = COALESCE($4, active)
     WHERE id = $1 RETURNING id, name, recargo, active`,
    [id, name ?? null, recargo ?? null, active ?? null]
  );
  if (!row) { res.status(404).json({ error: "Presa no encontrada" }); return; }
  res.status(200).json(row);
}

async function handleProduct(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const { category_id, name, base_price, requiere_presa, presa_ids } = req.body ?? {};
    if (!category_id || !name || base_price == null) {
      res.status(400).json({ error: "category_id, name y base_price son obligatorios" });
      return;
    }
    const product = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO products (category_id, name, base_price, requiere_presa)
         VALUES ($1, $2, $3, $4) RETURNING id, category_id, name, base_price, requiere_presa, active`,
        [category_id, name, base_price, !!requiere_presa]
      );
      const row = inserted.rows[0];
      const ids: number[] = Array.isArray(presa_ids) ? presa_ids : [];
      for (const presaId of ids) {
        await client.query(`INSERT INTO product_presas (product_id, presa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [row.id, presaId]);
      }
      return row;
    });
    res.status(201).json(product);
    return;
  }

  const { id, category_id, name, base_price, requiere_presa, active, presa_ids } = req.body ?? {};
  if (!id) { res.status(400).json({ error: "id es obligatorio" }); return; }
  const product = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE products SET
         category_id = COALESCE($2, category_id), name = COALESCE($3, name),
         base_price = COALESCE($4, base_price), requiere_presa = COALESCE($5, requiere_presa),
         active = COALESCE($6, active)
       WHERE id = $1 RETURNING id, category_id, name, base_price, requiere_presa, active`,
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
  if (!product) { res.status(404).json({ error: "Producto no encontrado" }); return; }
  res.status(200).json(product);
}

export default withErrorHandling(handler);
