import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Order, OrderStatus } from "@shared/types";

const REFRESH_MS = 6000;
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Pagado: "Preparando",
  Preparando: "Entregado",
};
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  Pagado: "▶ Empezar a preparar",
  Preparando: "✅ Marcar listo / entregado",
};

/**
 * Pantalla de cocina — muestra los pedidos pagados y en preparación, con
 * botones grandes (táctiles) para avanzar el estado. Se actualiza sola cada
 * pocos segundos (no hay WebSockets en esta versión, así que es polling).
 */
export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const all = await api.get<Order[]>("/orders?limit=100");
      setOrders(all.filter((o) => o.status === "Pagado" || o.status === "Preparando"));
    } catch {
      // silencioso: el próximo tick vuelve a intentar
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const avanzar = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await api.patch(`/orders/${order.id}`, { status: next });
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "No se pudo actualizar el pedido");
    }
  };

  const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">🍳 Cocina</div>
        <div className="topbar-actions">
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{sorted.length} en curso</span>
          <ThemeToggle />
          {user?.role === "admin" ? (
            <button className="icon-btn" onClick={() => navigate("/admin")} title="Panel admin">⚙️</button>
          ) : (
            <button className="icon-btn" onClick={() => navigate("/")} title="Ir al POS">🍗</button>
          )}
          <button className="icon-btn" onClick={logout} title="Cerrar sesión">🚪</button>
        </div>
      </header>

      <div className="admin-panel">
        {loading ? (
          <p style={{ color: "var(--color-text-faint)" }}>Cargando…</p>
        ) : sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <p>No hay pedidos pendientes de preparar</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.85rem" }}>
            {sorted.map((o) => (
              <OrderCard key={o.id} order={o} onAdvance={() => avanzar(o)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onAdvance }: { order: Order; onAdvance: () => void }) {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000));
  const urgente = minutos >= 15;
  const nextLabel = NEXT_LABEL[order.status];

  return (
    <div
      className="admin-card"
      style={{
        marginBottom: 0,
        border: urgente ? "2px solid var(--color-danger)" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{order.ticket_number}</span>
        <span
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            color: urgente ? "var(--color-danger)" : "var(--color-text-muted)",
          }}
        >
          ⏱ {minutos} min
        </span>
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
        {order.order_type === "Mesa" ? "🍽️" : order.order_type === "Llevar" ? "🥡" : "🛵"} {order.order_type}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
        {order.items.map((item, i) => (
          <li key={i} style={{ padding: "0.15rem 0" }}>
            <strong>{item.cantidad}×</strong> {item.productoNombre}
            {item.presaNombre ? ` — ${item.presaNombre}` : ""}
          </li>
        ))}
      </ul>
      {nextLabel && (
        <button className="btn btn-primary" onClick={onAdvance}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}
