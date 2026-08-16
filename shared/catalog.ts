/**
 * Catálogo de venta — Pollos Vivi.
 *
 * Fuente única de verdad, compartida entre frontend (src/) y las funciones
 * serverless (api/). NO se alteraron categorías, productos, precios ni presas
 * respecto del sistema anterior — se migraron tal cual desde database/seed.sql.
 *
 * Los precios SIEMPRE se calculan aquí, nunca se confía en lo que envíe el
 * cliente (misma regla anti-manipulación que tenía el backend FastAPI).
 */

export type DispatchMode = "Mesa" | "Llevar" | "Delivery";
export const DISPATCH_MODES: DispatchMode[] = ["Mesa", "Llevar", "Delivery"];

export interface Presa {
  id: number;
  nombre: string;
  recargo: number;
}

export interface Producto {
  id: number;
  categoriaId: number;
  nombre: string;
  precioBase: number;
  requierePresa: boolean;
  /** IDs de presas admitidas (solo si requierePresa = true) */
  presaIds: number[];
}

export interface Categoria {
  id: number;
  nombre: string;
}

export const CATEGORIAS: Categoria[] = [
  { id: 1, nombre: "Pollos" },
  { id: 2, nombre: "Salchipapas" },
  { id: 3, nombre: "Bebidas" },
  { id: 4, nombre: "Extras" },
];

export const PRESAS: Presa[] = [
  { id: 1, nombre: "Pierna", recargo: 0 },
  { id: 2, nombre: "Pecho", recargo: 0 },
  { id: 3, nombre: "Ala", recargo: 0 },
  { id: 4, nombre: "Mixto", recargo: 0 },
];

const TODAS_LAS_PRESAS = PRESAS.map((p) => p.id);

export const PRODUCTOS: Producto[] = [
  // Pollos
  { id: 1, categoriaId: 1, nombre: "Cuarto de Pollo", precioBase: 20.0, requierePresa: true, presaIds: TODAS_LAS_PRESAS },
  { id: 2, categoriaId: 1, nombre: "Medio Pollo", precioBase: 38.0, requierePresa: true, presaIds: TODAS_LAS_PRESAS },
  { id: 3, categoriaId: 1, nombre: "Pollo Entero", precioBase: 72.0, requierePresa: false, presaIds: [] },
  // Salchipapas
  { id: 4, categoriaId: 2, nombre: "Salchipapa Simple", precioBase: 15.0, requierePresa: false, presaIds: [] },
  { id: 5, categoriaId: 2, nombre: "Salchipapa Especial", precioBase: 20.0, requierePresa: false, presaIds: [] },
  { id: 6, categoriaId: 2, nombre: "Salchipapa Familiar", precioBase: 35.0, requierePresa: false, presaIds: [] },
  // Bebidas
  { id: 7, categoriaId: 3, nombre: "Gaseosa Personal", precioBase: 5.0, requierePresa: false, presaIds: [] },
  { id: 8, categoriaId: 3, nombre: "Gaseosa 1.5L", precioBase: 10.0, requierePresa: false, presaIds: [] },
  { id: 9, categoriaId: 3, nombre: "Jugo Natural", precioBase: 8.0, requierePresa: false, presaIds: [] },
  // Extras
  { id: 10, categoriaId: 4, nombre: "Ensalada", precioBase: 5.0, requierePresa: false, presaIds: [] },
  { id: 11, categoriaId: 4, nombre: "Porción Papa", precioBase: 8.0, requierePresa: false, presaIds: [] },
];

export function getProducto(id: number): Producto | undefined {
  return PRODUCTOS.find((p) => p.id === id);
}

export function getPresa(id: number): Presa | undefined {
  return PRESAS.find((p) => p.id === id);
}

/**
 * Una "variante" es lo que se muestra como tarjeta en el POS:
 * - Productos sin presa → 1 variante.
 * - Productos con presa → 1 variante por cada presa admitida.
 * Mismo comportamiento que frontend/js/pos.js (buildVariantes) del sistema anterior.
 */
export interface Variante {
  key: string; // `${productoId}-${presaId|'null'}`
  productoId: number;
  presaId: number | null;
  nombreCorto: string;
  nombreCompleto: string;
  precio: number;
  categoriaId: number;
}

export function buildVariantes(productos: Producto[] = PRODUCTOS): Variante[] {
  const variantes: Variante[] = [];
  for (const producto of productos) {
    if (producto.requierePresa && producto.presaIds.length > 0) {
      for (const presaId of producto.presaIds) {
        const presa = getPresa(presaId);
        if (!presa) continue;
        const primeraPalabra = producto.nombre.split(" ")[0];
        variantes.push({
          key: `${producto.id}-${presa.id}`,
          productoId: producto.id,
          presaId: presa.id,
          nombreCorto: `${primeraPalabra} ${presa.nombre}`,
          nombreCompleto: `${producto.nombre} — ${presa.nombre}`,
          precio: round2(producto.precioBase + presa.recargo),
          categoriaId: producto.categoriaId,
        });
      }
    } else {
      variantes.push({
        key: `${producto.id}-null`,
        productoId: producto.id,
        presaId: null,
        nombreCorto: producto.nombre,
        nombreCompleto: producto.nombre,
        precio: round2(producto.precioBase),
        categoriaId: producto.categoriaId,
      });
    }
  }
  return variantes;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Ítem tal como lo envía el cliente al crear un pedido (sin precios de confianza). */
export interface ItemCarritoInput {
  productoId: number;
  presaId?: number | null;
  cantidad: number;
}

/** Ítem ya validado y con precio recalculado en servidor — esto es lo que se guarda en orders.items (JSONB). */
export interface ItemPedido {
  productoId: number;
  productoNombre: string;
  presaId: number | null;
  presaNombre: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export class CatalogoError extends Error {}

/**
 * Recalcula precios en servidor a partir de lo que manda el cliente.
 * Lanza CatalogoError si algo es inválido — nunca confía en precios del front.
 */
export function validarYCalcularItems(items: ItemCarritoInput[]): { items: ItemPedido[]; total: number } {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CatalogoError("El pedido debe tener al menos un ítem");
  }

  const resultado: ItemPedido[] = [];
  let total = 0;

  for (const raw of items) {
    const producto = getProducto(raw.productoId);
    if (!producto) throw new CatalogoError(`Producto ${raw.productoId} no existe`);

    const cantidad = Number(raw.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
      throw new CatalogoError(`Cantidad inválida para "${producto.nombre}"`);
    }

    let precioUnitario = producto.precioBase;
    let presaNombre: string | null = null;
    let presaId: number | null = null;

    if (raw.presaId != null) {
      if (!producto.requierePresa) {
        throw new CatalogoError(`"${producto.nombre}" no admite selección de presa`);
      }
      const presa = getPresa(raw.presaId);
      if (!presa || !producto.presaIds.includes(presa.id)) {
        throw new CatalogoError(`Presa inválida para "${producto.nombre}"`);
      }
      precioUnitario = round2(producto.precioBase + presa.recargo);
      presaNombre = presa.nombre;
      presaId = presa.id;
    } else if (producto.requierePresa) {
      throw new CatalogoError(`"${producto.nombre}" requiere seleccionar una presa`);
    }

    const subtotal = round2(precioUnitario * cantidad);
    total = round2(total + subtotal);

    resultado.push({
      productoId: producto.id,
      productoNombre: producto.nombre,
      presaId,
      presaNombre,
      cantidad,
      precioUnitario,
      subtotal,
    });
  }

  return { items: resultado, total };
}
