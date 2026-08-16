import { query } from "./db";
import type { Producto, Presa, Categoria } from "../../shared/catalog";

interface CategoryRow {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}
interface PresaRow {
  id: number;
  name: string;
  recargo: string;
  active: boolean;
}
interface ProductRow {
  id: number;
  category_id: number;
  name: string;
  base_price: string;
  requiere_presa: boolean;
  active: boolean;
  sort_order: number;
}
interface ProductPresaRow {
  product_id: number;
  presa_id: number;
}

/** Trae categorías/productos/presas de la BD y arma la forma que usa shared/catalog.ts. */
export async function loadCatalog(): Promise<{ categorias: Categoria[]; productos: Producto[]; presas: Presa[] }> {
  const [categoryRows, presaRows, productRows, linkRows] = await Promise.all([
    query<CategoryRow>(`SELECT id, name, sort_order, active FROM categories ORDER BY sort_order, id`),
    query<PresaRow>(`SELECT id, name, recargo, active FROM presas ORDER BY id`),
    query<ProductRow>(`SELECT id, category_id, name, base_price, requiere_presa, active, sort_order FROM products ORDER BY sort_order, id`),
    query<ProductPresaRow>(`SELECT product_id, presa_id FROM product_presas`),
  ]);

  const presaIdsByProduct = new Map<number, number[]>();
  for (const link of linkRows) {
    const list = presaIdsByProduct.get(link.product_id) ?? [];
    list.push(link.presa_id);
    presaIdsByProduct.set(link.product_id, list);
  }

  const categorias: Categoria[] = categoryRows.map((c) => ({ id: c.id, nombre: c.name, activo: c.active }));
  const presas: Presa[] = presaRows.map((p) => ({ id: p.id, nombre: p.name, recargo: Number(p.recargo), activo: p.active }));
  const productos: Producto[] = productRows.map((p) => ({
    id: p.id,
    categoriaId: p.category_id,
    nombre: p.name,
    precioBase: Number(p.base_price),
    requierePresa: p.requiere_presa,
    activo: p.active,
    presaIds: presaIdsByProduct.get(p.id) ?? [],
  }));

  return { categorias, productos, presas };
}
