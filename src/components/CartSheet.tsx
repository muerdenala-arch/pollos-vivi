import { useState } from "react";
import { useCart } from "../context/CartContext";
import { DISPATCH_MODES, type DispatchMode } from "@shared/catalog";
import { PaymentSheet } from "./PaymentSheet";
import { api, ApiError } from "../lib/api";
import { useToast } from "./Toast";
import type { Order } from "@shared/types";

const bs = (n: number) => `Bs. ${n.toFixed(2)}`;

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, orderType, setOrderType, changeQty, removeLine, total, clear } = useCart();
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const { show } = useToast();

  const guardarPedido = async () => {
    setSaving(true);
    try {
      const order = await api.post<Order>("/orders", {
        order_type: orderType,
        items: lines.map((l) => ({ productoId: l.productoId, presaId: l.presaId, cantidad: l.cantidad })),
      });
      show(`📋 Pedido ${order.ticket_number} guardado — se puede cobrar después`);
      clear();
      onClose();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "No se pudo guardar el pedido");
    } finally {
      setSaving(false);
    }
  };

  const isMobile = () => window.innerWidth < 768;

  if (!open && isMobile()) return null;

  return (
    <>
      {open && isMobile() && <div className="cart-backdrop" onClick={onClose} />}
      <aside className="cart-sheet">
        <div className="cart-sheet-handle" />
        <div className="cart-header">
          <span className="cart-title">🛒 Pedido actual</span>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar carrito">✕</button>
        </div>

        <div className="dispatch-selector">
          {DISPATCH_MODES.map((mode) => (
            <DispatchButton key={mode} mode={mode} active={orderType === mode} onClick={() => setOrderType(mode)} />
          ))}
        </div>

        <div className="cart-body">
          {lines.length === 0 ? (
            <div className="cart-empty">
              <div style={{ fontSize: "2.2rem" }}>🍗</div>
              <p>El carrito está vacío.<br />Toca un producto para agregarlo.</p>
            </div>
          ) : (
            lines.map((l) => (
              <div className="cart-line" key={l.key}>
                <div className="cart-line-top">
                  <span className="cart-line-name">{l.nombre}</span>
                  <button className="cart-line-remove" onClick={() => removeLine(l.key)} aria-label="Quitar">✕</button>
                </div>
                <div className="cart-line-row">
                  <div className="qty-control">
                    <button className="qty-btn" onClick={() => changeQty(l.key, -1)}>−</button>
                    <span>{l.cantidad}</span>
                    <button className="qty-btn" onClick={() => changeQty(l.key, 1)}>+</button>
                  </div>
                  <span className="cart-line-subtotal">{bs(l.precioUnitario * l.cantidad)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-footer">
          <div className="cart-total-row">
            <span>Total</span>
            <span>{bs(total)}</span>
          </div>
          <button className="btn btn-primary" disabled={lines.length === 0} onClick={() => setPaying(true)}>
            Cobrar
          </button>
          <button className="btn btn-secondary" disabled={lines.length === 0 || saving} onClick={guardarPedido}>
            {saving ? "Guardando…" : "📋 Guardar sin cobrar"}
          </button>
        </div>
      </aside>

      {paying && <PaymentSheet onClose={() => setPaying(false)} onDone={() => { setPaying(false); onClose(); }} />}
    </>
  );
}

function DispatchButton({ mode, active, onClick }: { mode: DispatchMode; active: boolean; onClick: () => void }) {
  const icon = mode === "Mesa" ? "🍽️" : mode === "Llevar" ? "🥡" : "🛵";
  return (
    <button className={`dispatch-btn ${active ? "active" : ""}`} onClick={onClick}>
      {icon} {mode}
    </button>
  );
}
