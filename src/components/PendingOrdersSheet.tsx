import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useToast } from "./Toast";
import { PaymentSheet } from "./PaymentSheet";
import type { Order } from "@shared/types";

const bs = (n: number) => `Bs. ${Number(n).toFixed(2)}`;

/** Pedidos guardados sin cobrar (status Pendiente) — se pueden reanudar (cobrar) o anular. */
export function PendingOrdersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const { show } = useToast();

  const load = () => {
    api.get<Order[]>("/orders?status=Pendiente&limit=50").then(setOrders).catch(() => setOrders([]));
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  const cancelar = async (order: Order) => {
    try {
      await api.patch(`/orders/${order.id}`, { status: "Cancelado" });
      show(`Pedido ${order.ticket_number} anulado`);
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "No se pudo anular el pedido");
    }
  };

  return (
    <>
      <div className="cart-backdrop" onClick={onClose} style={{ zIndex: 45 }} />
      <aside className="cart-sheet" style={{ zIndex: 46 }}>
        <div className="cart-sheet-handle" />
        <div className="cart-header">
          <span className="cart-title">📋 Pedidos pendientes</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="cart-body">
          {orders === null ? (
            <p style={{ color: "var(--color-text-faint)" }}>Cargando…</p>
          ) : orders.length === 0 ? (
            <div className="cart-empty">
              <div style={{ fontSize: "2.2rem" }}>📋</div>
              <p>No hay pedidos guardados sin cobrar.</p>
            </div>
          ) : (
            orders.map((o) => (
              <div className="cart-line" key={o.id}>
                <div className="cart-line-top">
                  <span className="cart-line-name">
                    {o.ticket_number} · {o.order_type}
                  </span>
                  <span className="cart-line-subtotal">{bs(o.total)}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0.3rem 0", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  {o.items.map((item, i) => (
                    <li key={i}>
                      {item.cantidad}× {item.productoNombre}
                      {item.presaNombre ? ` — ${item.presaNombre}` : ""}
                    </li>
                  ))}
                </ul>
                <div className="cart-line-row" style={{ gap: "0.5rem" }}>
                  <button className="btn btn-danger" style={{ width: "auto", padding: "0.4rem 0.8rem" }} onClick={() => cancelar(o)}>
                    Anular
                  </button>
                  <button className="btn btn-primary" style={{ width: "auto", padding: "0.4rem 0.8rem" }} onClick={() => setPayingOrder(o)}>
                    Cobrar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {payingOrder && (
        <PaymentSheet
          existingOrder={payingOrder}
          onClose={() => setPayingOrder(null)}
          onDone={() => {
            setPayingOrder(null);
            load();
          }}
        />
      )}
    </>
  );
}
