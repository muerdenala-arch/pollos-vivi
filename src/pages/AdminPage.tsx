import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toast";
import { useCashRegister } from "../hooks/useCashRegister";
import { useCatalog } from "../hooks/useCatalog";
import type { Branch, AppUser, StockItem, Order } from "@shared/types";
import type { Categoria, Presa, Producto } from "@shared/catalog";

type Tab = "reportes" | "pedidos" | "caja" | "catalogo" | "sucursales" | "usuarios" | "stock";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("reportes");
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
            ["reportes", "📊 Reportes"],
            ["pedidos", "🧾 Pedidos"],
            ["caja", "💰 Caja"],
            ["catalogo", "🍗 Catálogo"],
            ["sucursales", "🏬 Sucursales"],
            ["usuarios", "👤 Personal"],
            ["stock", "📦 Stock"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={`cat-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="admin-panel">
        {tab === "reportes" && <ReportesPanel />}
        {tab === "pedidos" && <PedidosPanel />}
        {tab === "caja" && <CajaPanel />}
        {tab === "catalogo" && <CatalogoPanel />}
        {tab === "sucursales" && <SucursalesPanel />}
        {tab === "usuarios" && <UsuariosPanel />}
        {tab === "stock" && <StockPanel />}
      </div>
    </div>
  );
}

const bs = (n: number) => `Bs. ${Number(n).toFixed(2)}`;

interface ReportData {
  resumenHoy: { total: number; efectivo: number; qr: number; pedidos: number };
  porDia: { dia: string; total: number; pedidos: number }[];
  topProductos: { nombre: string; cantidad: number; total: number }[];
}

function ReportesPanel() {
  const [data, setData] = useState<ReportData | null>(null);
  useEffect(() => {
    api.get<ReportData>("/reports?days=7").then(setData).catch(() => {});
  }, []);

  if (!data) return <p style={{ color: "var(--color-text-faint)" }}>Cargando reportes…</p>;

  const maxDia = Math.max(1, ...data.porDia.map((d) => d.total));

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <StatCard label="Ventas de hoy" value={bs(data.resumenHoy.total)} />
        <StatCard label="Efectivo" value={bs(data.resumenHoy.efectivo)} />
        <StatCard label="QR" value={bs(data.resumenHoy.qr)} />
        <StatCard label="Pedidos hoy" value={String(data.resumenHoy.pedidos)} />
      </div>

      <div className="admin-card">
        <h3>Ventas — últimos 7 días</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem", height: 140, padding: "0.5rem 0" }}>
          {data.porDia.map((d) => (
            <div key={d.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
              <div
                title={bs(d.total)}
                style={{
                  width: "100%",
                  maxWidth: 36,
                  height: Math.max(4, (d.total / maxDia) * 110),
                  background: "var(--color-accent)",
                  borderRadius: "6px 6px 0 0",
                }}
              />
              <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                {new Date(d.dia).toLocaleDateString("es-BO", { weekday: "short" })}
              </span>
            </div>
          ))}
          {data.porDia.length === 0 && <p style={{ color: "var(--color-text-faint)" }}>Sin ventas en este período.</p>}
        </div>
      </div>

      <div className="admin-card">
        <h3>Productos más vendidos (7 días)</h3>
        <table className="admin-table">
          <thead><tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr></thead>
          <tbody>
            {data.topProductos.map((p) => (
              <tr key={p.nombre}><td>{p.nombre}</td><td>{p.cantidad}</td><td>{bs(p.total)}</td></tr>
            ))}
          </tbody>
        </table>
        {data.topProductos.length === 0 && <p style={{ color: "var(--color-text-faint)" }}>Sin ventas en este período.</p>}
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-card" style={{ marginBottom: 0, textAlign: "center" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--color-accent)" }}>{value}</div>
    </div>
  );
}

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

function CatalogoPanel() {
  const { categorias, productos, presas, refresh } = useCatalog();
  const { show } = useToast();

  const [catName, setCatName] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodCat, setProdCat] = useState<number | "">("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodPresa, setProdPresa] = useState(false);
  const [prodPresaIds, setProdPresaIds] = useState<number[]>([]);
  const [presaName, setPresaName] = useState("");
  const [presaRecargo, setPresaRecargo] = useState("0");

  const nombreCategoria = (id: number) => categorias.find((c) => c.id === id)?.nombre ?? "—";

  const addCategoria = async () => {
    if (!catName.trim()) return;
    try {
      await api.post("/catalog", { resource: "category", name: catName });
      setCatName("");
      refresh();
      show("Categoría creada");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Error creando categoría");
    }
  };

  const toggleCategoriaActiva = async (c: Categoria) => {
    await api.patch("/catalog", { resource: "category", id: c.id, active: !c.activo });
    refresh();
  };

  const addPresa = async () => {
    if (!presaName.trim()) return;
    try {
      await api.post("/catalog", { resource: "presa", name: presaName, recargo: Number(presaRecargo) || 0 });
      setPresaName("");
      setPresaRecargo("0");
      refresh();
      show("Presa creada");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Error creando presa");
    }
  };

  const togglePresaActiva = async (p: Presa) => {
    await api.patch("/catalog", { resource: "presa", id: p.id, active: !p.activo });
    refresh();
  };

  const addProducto = async () => {
    if (!prodName.trim() || !prodCat || !prodPrice) {
      show("Nombre, categoría y precio son obligatorios");
      return;
    }
    try {
      await api.post("/catalog", {
        resource: "product",
        category_id: prodCat,
        name: prodName,
        base_price: Number(prodPrice),
        requiere_presa: prodPresa,
        presa_ids: prodPresa ? prodPresaIds : [],
      });
      setProdName(""); setProdPrice(""); setProdPresa(false); setProdPresaIds([]);
      refresh();
      show("Producto creado");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Error creando producto");
    }
  };

  const toggleProductoActivo = async (p: Producto) => {
    await api.patch("/catalog", { resource: "product", id: p.id, active: !p.activo });
    refresh();
  };

  return (
    <>
      <div className="admin-card">
        <h3>Productos</h3>
        <table className="admin-table">
          <thead><tr><th>Nombre</th><th>Categoría</th><th>Precio base</th><th>Presa</th><th>Activo</th></tr></thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} style={!p.activo ? { opacity: 0.5 } : undefined}>
                <td>{p.nombre}</td>
                <td>{nombreCategoria(p.categoriaId)}</td>
                <td>{bs(p.precioBase)}</td>
                <td>{p.requierePresa ? "Sí" : "—"}</td>
                <td><button className="btn btn-secondary" style={{ padding: "0.3rem 0.7rem" }} onClick={() => toggleProductoActivo(p)}>{p.activo ? "Desactivar" : "Activar"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="field-row"><label>Nombre</label><input value={prodName} onChange={(e) => setProdName(e.target.value)} /></div>
        <div className="field-row">
          <label>Categoría</label>
          <select value={prodCat} onChange={(e) => setProdCat(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— Selecciona —</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="field-row"><label>Precio base (Bs.)</label><input inputMode="decimal" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} /></div>
        <div className="field-row">
          <label><input type="checkbox" checked={prodPresa} onChange={(e) => setProdPresa(e.target.checked)} /> Requiere elegir presa</label>
        </div>
        {prodPresa && (
          <div className="field-row">
            <label>Presas admitidas</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {presas.map((p) => (
                <label key={p.id} style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={prodPresaIds.includes(p.id)}
                    onChange={(e) =>
                      setProdPresaIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                    }
                  />
                  {p.nombre}
                </label>
              ))}
            </div>
          </div>
        )}
        <button className="btn btn-primary" onClick={addProducto}>Crear producto</button>
      </div>

      <div className="admin-card">
        <h3>Categorías</h3>
        <table className="admin-table">
          <thead><tr><th>Nombre</th><th>Activa</th></tr></thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                <td><button className="btn btn-secondary" style={{ padding: "0.3rem 0.7rem" }} onClick={() => toggleCategoriaActiva(c)}>{c.activo ? "Desactivar" : "Activar"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="field-row"><label>Nueva categoría</label><input value={catName} onChange={(e) => setCatName(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={addCategoria}>Crear categoría</button>
      </div>

      <div className="admin-card">
        <h3>Presas</h3>
        <table className="admin-table">
          <thead><tr><th>Nombre</th><th>Recargo</th><th>Activa</th></tr></thead>
          <tbody>
            {presas.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{bs(p.recargo)}</td>
                <td><button className="btn btn-secondary" style={{ padding: "0.3rem 0.7rem" }} onClick={() => togglePresaActiva(p)}>{p.activo ? "Desactivar" : "Activar"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="field-row"><label>Nombre</label><input value={presaName} onChange={(e) => setPresaName(e.target.value)} /></div>
        <div className="field-row"><label>Recargo (Bs.)</label><input inputMode="decimal" value={presaRecargo} onChange={(e) => setPresaRecargo(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={addPresa}>Crear presa</button>
      </div>
    </>
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

  const toggleBloqueo = async (u: AppUser) => {
    if (u.protected) {
      show("Este usuario está protegido y no se puede bloquear");
      return;
    }
    try {
      await api.patch("/users", { id: u.id, status: !u.status });
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Error actualizando usuario");
    }
  };

  return (
    <div className="admin-card">
      <h3>Personal</h3>
      <table className="admin-table">
        <thead><tr><th></th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><span className="avatar-dot" style={{ background: `var(--color-${u.color}, var(--color-accent))` }}>{u.name.charAt(0)}</span></td>
              <td>{u.name} {u.protected && <span title="Protegido">🔒</span>}</td>
              <td>{u.role}</td>
              <td>{u.status ? "Activo" : "Bloqueado"}</td>
              <td>
                <button className="btn btn-secondary" style={{ padding: "0.3rem 0.7rem" }} onClick={() => toggleBloqueo(u)} disabled={u.protected}>
                  {u.status ? "Bloquear" : "Desbloquear"}
                </button>
              </td>
            </tr>
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
