import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "./_lib/http";
import { query, queryOne } from "./_lib/db";
import { requireAdmin } from "./_lib/auth";

interface ResumenRow {
  total: string;
  efectivo: string;
  qr: string;
  pedidos: string;
}
interface PorDiaRow {
  dia: string;
  total: string;
  pedidos: string;
}
interface TopProductoRow {
  nombre: string;
  cantidad: string;
  total: string;
}

async function handler(req: VercelRequest, res: VercelResponse) {
  requireAdmin(req);
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
  const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
  // "Hoy" y los últimos N días se calculan en horario de Bolivia, no UTC —
  // si no, un pedido de después de las 8pm aparecía contado "al día siguiente".
  const TZ = "America/La_Paz";

  const [resumenHoy, porDia, topProductos] = await Promise.all([
    queryOne<ResumenRow>(
      `SELECT
         COALESCE(SUM(total), 0) AS total,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'Efectivo'), 0) AS efectivo,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'QR'), 0) AS qr,
         COUNT(*) AS pedidos
       FROM orders
       WHERE status <> 'Cancelado'
         AND (created_at AT TIME ZONE '${TZ}') >= date_trunc('day', now() AT TIME ZONE '${TZ}')
         AND ($1::int IS NULL OR branch_id = $1)`,
      [branchId]
    ),
    query<PorDiaRow>(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE '${TZ}'), 'YYYY-MM-DD') AS dia,
              COALESCE(SUM(total), 0) AS total, COUNT(*) AS pedidos
       FROM orders
       WHERE status <> 'Cancelado'
         AND (created_at AT TIME ZONE '${TZ}') >= (now() AT TIME ZONE '${TZ}') - ($1 || ' days')::interval
         AND ($2::int IS NULL OR branch_id = $2)
       GROUP BY dia ORDER BY dia`,
      [days, branchId]
    ),
    query<TopProductoRow>(
      `SELECT item->>'productoNombre' AS nombre,
              SUM((item->>'cantidad')::int) AS cantidad,
              SUM((item->>'subtotal')::numeric) AS total
       FROM orders, jsonb_array_elements(items) AS item
       WHERE status <> 'Cancelado'
         AND (created_at AT TIME ZONE '${TZ}') >= (now() AT TIME ZONE '${TZ}') - ($1 || ' days')::interval
         AND ($2::int IS NULL OR branch_id = $2)
       GROUP BY nombre ORDER BY cantidad DESC LIMIT 10`,
      [days, branchId]
    ),
  ]);

  res.status(200).json({
    resumenHoy: {
      total: Number(resumenHoy?.total ?? 0),
      efectivo: Number(resumenHoy?.efectivo ?? 0),
      qr: Number(resumenHoy?.qr ?? 0),
      pedidos: Number(resumenHoy?.pedidos ?? 0),
    },
    porDia: porDia.map((r) => ({ dia: r.dia, total: Number(r.total), pedidos: Number(r.pedidos) })),
    topProductos: topProductos.map((r) => ({ nombre: r.nombre, cantidad: Number(r.cantidad), total: Number(r.total) })),
  });
}

export default withErrorHandling(handler);
