import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toast";
import { useCashRegister } from "../hooks/useCashRegister";
import type { Branch, AppUser, StockItem, Order } from "@shared/types";

type Tab = "pedidos" | "caja" | "sucursales" | "usuarios" | "stock";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("pedidos");
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">⚙️ Administración</div>
        <div className="topbar-actions">
          <ThemeToggle />
          <button className="icon-btn" onClick={() => navigate("/")} title="Volver al POS">🍗</button>
          <button className="icon-btn" onClick={logout} title="Cerrar sesión">🚪</button>
        </div>
      </header>

      <div className="admin-tabs">
        {(
          [
            ["pedidos", "🧾 Pedidos"],
            ["caja", "💰 Caja"],
            ["sucursales", "🏬 Sucursales"],
            ["usuarios", "👤 Usuarios"],
            ["stock", "📦 Stock"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={`cat-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="admin-panel">
        {tab === "pedidos" && <PedidosPanel />}
        {tab === "caja" && <CajaPanel />}
        {tab === "sucursales" && <SucursalesPanel />}
        {tab === "usuarios" && <UsuariosPanel />}
        {tab === "stock" && <StockPanel />}
      </div>
    </div>
  );
}

const bs = (n: number) => `Bs. ${Number(n).toFixed(2)}`;

function PedidosPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    api.get<Order[]>("/orders?limit=50").then(setOrders).catch(() => {});
  }, []);
  return (
    <div className="admin-card">
      <h3>Últimos pedidos</h3>
      <table className="admin-table">
        <thead>
          <tr><th>Ticket</th><th>Tipo</th><th>Total</th><th>Pago</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.ticket_number}</td>
              <td>{o.order_type}</td>
              <td>{bs(o.total)}</td>
              <td>{o.payment_method ?? "—"}</td>
              <td>{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p style={{ color: "var(--color-text-faint)" }}>Sin pedidos todavía.</p>}
    </div>
  );
}

function CajaPanel() {
  const { register, close } = useCashRegister();
  const { show } = useToast();
  const [amount, setAmount] = useState("");
  const [resumen, setResumen] = useState<Record<string, number> | null>(null);

  const doClose = async () => {
    if (!register) return;
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return;
    try {
      const res = await close(register.id, value);
      setResumen(res.resumen);
      show("Caja cerrada correctamente");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "No se pudo cerrar la caja");
    }
  };

  if (register === undefined) return <p>Cargando…</p>;
  if (!register) return <div className="admin-card">No hay una caja abierta en este momento.</div>;

  return (
    <div className="admin-card">
      <h3>Caja abierta</h3>
      <p>Apertura: {bs(register.opening_amount)} · desde {new Date(register.opened_at).toLocaleString("es-BO")}</p>
      <div className="field-row">
        <label>Monto contado al cierre (Bs.)</label>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={doClose}>Cerrar caja / arqueo</button>

      {resumen && (
        <div style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
          <p>Efectivo esperado: {bs(resumen.efectivo_esperado)}</p>
          <p>Vendido efectivo: {bs(resumen.efectivo_vendido)}</p>
          <p>Vendido QR: {bs(resumen.qr_vendido)}</p>
          <p>Pedidos: {resumen.pedidos}</p>
          <p>Diferencia: {bs(resumen.diferencia)}</p>
        </div>
      )}
    </div>
  );
}

function SucursalesPanel() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const { show } = useToast();

  const load = () => api.get<Branch[]>("/branches").then(setBranches).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.post("/branches", { name, address });
      setName(""); setAddress("");
      load();
      show("Sucursal creada");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Error creando sucursal");
    }
  };

  return (
    <div className="admin-card">
      <h3>Sucursales</h3>
      <table className="admin-table">
        <thead><tr><th>Nombre</th><th>Dirección</th><th>Activa</th></tr></thead>
        <tbody>
          {branches.map((b) => (
            <tr key={b.id}><td>{b.name}</td><td>{b.address}</td><td>{b.is_active ? "Sí" : "No"}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="field-row"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field-row"><label>Dirección</label><input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={create}>Agregar sucursal</button>
    </div>
  );
}

function UsuariosPanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "cajero">("cajero");
  const [pin, setPin] = useState("");
  const [branchId, setBranchId] = useState<number | "">("");
  const { show } = useToast();

  const load = () => api.get<AppUser[]>("/users").then(setUsers).catch(() => {});
  useEffect(() => {
    load();
    api.get<Branch[]>("/branches").then(setBranches).catch(() => {});
  }, []);

  const create = async () => {
    if (!name.trim() || pin.length < 4) {
      show("Nombre y PIN (4-6 dígitos) son obligatorios");
      return;
    }
    try {
      await api.post("/users", { name, role, pin, branch_id: branchId || null });
      setName(""); setPin("");
      load();
      show("Usuario creado");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Error creando usuario");
    }
  };

  return (
    <div className="admin-card">
      <h3>Usuarios</h3>
      <table className="admin-table">
        <thead><tr><th>Nombre</th><th>Rol</th><th>Activo</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}><td>{u.name}</td><td>{u.role}</td><td>{u.status ? "Sí" : "No"}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="field-row"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field-row">
        <label>Rol</label>
        <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "cajero")}>
          <option value="cajero">Cajero</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="field-row"><label>PIN (4-6 dígitos)</label><input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} /></div>
      <div className="field-row">
        <label>Sucursal</label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">— Sin asignar —</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" onClick={create}>Crear usuario</button>
    </div>
  );
}

function StockPanel() {
  const [items, setItems] = useState<StockItem[]>([]);
  const { show } = useToast();
  const load = () => api.get<StockItem[]>("/stock").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const updateQty = async (id: number, quantity: number) => {
    try {
      await api.patch("/stock", { id, quantity });
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Error actualizando stock");
    }
  };

  return (
    <div className="admin-card">
      <h3>Inventario</h3>
      <table className="admin-table">
        <thead><tr><th>Ítem</th><th>Cantidad</th><th>Mínimo</th><th>Unidad</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} style={it.quantity <= it.min_stock ? { color: "var(--color-danger)" } : undefined}>
              <td>{it.item_name}</td>
              <td>
                <div className="qty-control">
                  <button className="qty-btn" onClick={() => updateQty(it.id, Math.max(0, it.quantity - 1))}>−</button>
                  <span>{it.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQty(it.id, it.quantity + 1)}>+</button>
                </div>
              </td>
              <td>{it.min_stock}</td>
              <td>{it.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
