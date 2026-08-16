/**
 * Catálogo de venta — Pollos Vivi.
 *
 * El catálogo (categorías, productos, presas) vive en la base de datos
 * (tablas categories/products/presas), administrable desde el panel admin.
 * Este módulo solo define los tipos y las funciones PURAS de cálculo/
 * validación, compartidas entre frontend y las funciones /api — reciben los
 * datos como parámetro, no los "conocen" de antemano.
 *
 * Los precios SIEMPRE se recalculan en el servidor a partir de lo que hay
 * en la base en ese momento; nunca se confía en lo que envíe el cliente.
 */

export type DispatchMode = "Mesa" | "Llevar" | "Delivery";
export const DISPATCH_MODES: DispatchMode[] = ["Mesa", "Llevar", "Delivery"];

export interface Presa {
  id: number;
  nombre: string;
  recargo: number;
  activo: boolean;
}

export interface Producto {
  id: number;
  categoriaId: number;
  nombre: string;
  precioBase: number;
  requierePresa: boolean;
  activo: boolean;
  /** IDs de presas admitidas (solo relevante si requierePresa = true) */
  presaIds: number[];
}

export interface Categoria {
  id: number;
  nombre: string;
  activo: boolean;
}

export function getProducto(productos: Producto[], id: number): Producto | undefined {
  return productos.find((p) => p.id === id);
}

export function getPresa(presas: Presa[], id: number): Presa | undefined {
  return presas.find((p) => p.id === id);
}

/**
 * Una "variante" es lo que se muestra como tarjeta en el POS:
 * - Productos sin presa → 1 variante.
 * - Productos con presa → 1 variante por cada presa admitida.
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

export function buildVariantes(productos: Producto[], presas: Presa[]): Variante[] {
  const variantes: Variante[] = [];
  for (const producto of productos) {
    if (!producto.activo) continue;
    if (producto.requierePresa && producto.presaIds.length > 0) {
      for (const presaId of producto.presaIds) {
        const presa = getPresa(presas, presaId);
        if (!presa || !presa.activo) continue;
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
 * Recalcula precios en servidor a partir de lo que manda el cliente y del
 * catálogo vigente en la base de datos (productos/presas). Lanza
 * CatalogoError si algo es inválido — nunca confía en precios del front.
 */
export function validarYCalcularItems(
  items: ItemCarritoInput[],
  productos: Producto[],
  presas: Presa[]
): { items: ItemPedido[]; total: number } {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CatalogoError("El pedido debe tener al menos un ítem");
  }

  const resultado: ItemPedido[] = [];
  let total = 0;

  for (const raw of items) {
    const producto = getProducto(productos, raw.productoId);
    if (!producto || !producto.activo) throw new CatalogoError(`Producto ${raw.productoId} no existe`);

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
      const presa = getPresa(presas, raw.presaId);
      if (!presa || !presa.activo || !producto.presaIds.includes(presa.id)) {
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
