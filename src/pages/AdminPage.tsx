import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { Logo } from "../components/Logo";
import { StatusBadge, Badge } from "../components/Badge";
import { Switch } from "../components/Switch";
import { useToast } from "../components/Toast";
import { useCashRegister } from "../hooks/useCashRegister";
import { useCatalog } from "../hooks/useCatalog";
import type { Branch, AppUser, StockItem, Order, QrCode } from "@shared/types";
import type { Categoria, Presa, Producto } from "@shared/catalog";
import {
  BarChart3, Receipt, Wallet, Utensils, QrCode as QrCodeIcon,
  Store, Users, Package, LogOut, Menu, X, Lock, type LucideIcon,
} from "lucide-react";

type Tab = "reportes" | "pedidos" | "caja" | "catalogo" | "qr" | "sucursales" | "usuarios" | "stock";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "reportes", label: "Reportes", icon: BarChart3 },
  { id: "pedidos", label: "Pedidos", icon: Receipt },
  { id: "caja", label: "Caja", icon: Wallet },
  { id: "catalogo", label: "Catálogo", icon: Utensils },
  { id: "qr", label: "Códigos QR", icon: QrCodeIcon },
  { id: "sucursales", label: "Sucursales", icon: Store },
  { id: "usuarios", label: "Personal", icon: Users },
  { id: "stock", label: "Stock", icon: Package },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("reportes");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { logout } = useAuth();

  const selectTab = (id: Tab) => {
    setTab(id);
    setMobileNavOpen(false);
  };

  return (
    <div className="admin-shell">
      {/* Franja superior solo en móvil — el sidebar necesita un disparador para abrirse */}
      <div className="admin-mobile-topbar">
        <button className="icon-btn" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
        <div className="topbar-brand"><Logo size={26} /> Administración</div>
      </div>

      {mobileNavOpen && <div className="cart-backdrop" style={{ zIndex: 70 }} onClick={() => setMobileNavOpen(false)} />}

      <aside className={`admin-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div>
          <div className="admin-sidebar-header">
            <Logo size={38} />
            <div>
              <div className="admin-sidebar-title">Pollos Vivi</div>
              <div className="admin-sidebar-subtitle">Panel Admin</div>
            </div>
            <ThemeToggle />
            <button className="icon-btn admin-sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
          </div>

          <nav className="admin-nav">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`admin-nav-item ${tab === id ? "active" : ""}`}
                onClick={() => selectTab(id)}
              >
                {tab === id && (
                  <motion.span
                    layoutId="admin-nav-indicator"
                    className="admin-nav-indicator"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <button className="admin-nav-item" onClick={logout}><LogOut size={18} /> Cerrar sesión</button>
        </div>
      </aside>

      <main className="admin-main">
        {tab === "reportes" && <ReportesPanel />}
        {tab === "pedidos" && <PedidosPanel />}
        {tab === "caja" && <CajaPanel />}
        {tab === "catalogo" && <CatalogoPanel />}
        {tab === "qr" && <QrCodesPanel />}
        {tab === "sucursales" && <SucursalesPanel />}
        {tab === "usuarios" && <UsuariosPanel />}
        {tab === "stock" && <StockPanel />}
      </main>
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
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
        <Logo size={36} />
        <div>
          <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Pollos Vivi</div>
          <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Reporte de ventas</div>
        </div>
      </div>
      <motion.div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        <StatCard label="Ventas de hoy" value={bs(data.resumenHoy.total)} />
        <StatCard label="Efectivo" value={bs(data.resumenHoy.efectivo)} />
        <StatCard label="QR" value={bs(data.resumenHoy.qr)} />
        <StatCard label="Pedidos hoy" value={String(data.resumenHoy.pedidos)} />
      </motion.div>

      <div className="admin-card">
        <h3>Ventas — últimos 7 días</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem", height: 140, padding: "0.5rem 0" }}>
          {data.porDia.map((d) => (
            <div key={d.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
              <motion.div
                title={bs(d.total)}
                initial={{ height: 0 }}
                animate={{ height: Math.max(4, (d.total / maxDia) * 110) }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                style={{
                  width: "100%",
                  maxWidth: 36,
                  background: "var(--gradient-crispy)",
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
    <motion.div
      className="admin-card"
      style={{ marginBottom: 0, textAlign: "center" }}
      variants={{ hidden: { opacity: 0, y: 10, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
    >
      <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 800, color: "var(--color-accent)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </motion.div>
  );
}

function PedidosPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  useEffect(() => {
    api.get<Order[]>("/orders?limit=50").then(setOrders).catch(() => {});
  }, []);
  return (
    <div className="admin-card">
      <h3>Últimos pedidos</h3>
      <table className="admin-table">
        <thead>
          <tr><th>Ticket</th><th>Tipo</th><th>Total</th><th>Pago</th><th>Comprobante</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.ticket_number}</td>
              <td>{o.order_type}</td>
              <td>{bs(o.total)}</td>
              <td>{o.payment_method ?? "—"}</td>
              <td>
                {o.receipt_url ? (
                  <button onClick={() => setZoomUrl(o.receipt_url)} style={{ padding: 0, borderRadius: "var(--radius-sm)", overflow: "hidden" }} title="Ver comprobante">
                    <img src={o.receipt_url} alt={`Comprobante ${o.ticket_number}`} style={{ width: 36, height: 36, objectFit: "cover", display: "block" }} />
                  </button>
                ) : "—"}
              </td>
              <td><StatusBadge status={o.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p style={{ color: "var(--color-text-faint)" }}>Sin pedidos todavía.</p>}

      {zoomUrl && (
        <div
          onClick={() => setZoomUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            background: "rgba(0,0,0,0.85)",
            display: "grid", placeItems: "center",
            padding: "2rem",
          }}
        >
          <img src={zoomUrl} alt="Comprobante" style={{ maxWidth: "min(90vw, 420px)", maxHeight: "80vh", borderRadius: "var(--radius-md)" }} />
        </div>
      )}
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
                <td><Switch checked={p.activo} onChange={() => toggleProductoActivo(p)} label="Activo" /></td>
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
                <td><Switch checked={c.activo} onChange={() => toggleCategoriaActiva(c)} label="Activa" /></td>
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
                <td><Switch checked={p.activo} onChange={() => togglePresaActiva(p)} label="Activa" /></td>
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

function QrCodesPanel() {
  const [codes, setCodes] = useState<QrCode[]>([]);
  const [alias, setAlias] = useState("");
  const [bankOrHolder, setBankOrHolder] = useState("");
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { show } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => api.get<QrCode[]>("/qr-codes?all=1").then(setCodes).catch(() => {});
  useEffect(() => { load(); }, []);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setDataUri(reader.result as string);
    reader.readAsDataURL(file);
  };

  const create = async () => {
    if (!alias.trim() || !dataUri) {
      show("Alias e imagen del QR son obligatorios");
      return;
    }
    setUploading(true);
    try {
      const up = await api.post<{ url: string }>("/upload", { dataUri, folder: "qr" });
      await api.post("/qr-codes", { alias, bank_or_holder: bankOrHolder || null, image_url: up.url });
      setAlias(""); setBankOrHolder(""); setDataUri(null);
      load();
      show("Código QR agregado");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Error subiendo el QR");
    } finally {
      setUploading(false);
    }
  };

  const toggleActivo = async (qr: QrCode) => {
    await api.patch("/qr-codes", { id: qr.id, active: !qr.active });
    load();
  };

  const marcarDefault = async (qr: QrCode) => {
    await api.patch("/qr-codes", { id: qr.id, is_default: true, active: true });
    load();
  };

  return (
    <div className="admin-card">
      <h3>Códigos QR de pago</h3>
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
        El cajero elige entre los habilitados al cobrar por QR. El marcado con ⭐ es el que se muestra primero.
      </p>
      {codes.length === 0 && (
        <p style={{ color: "var(--color-text-faint)", fontSize: "0.85rem" }}>
          Todavía no hay ningún código QR configurado. Agrega el primero abajo.
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem", margin: "0.75rem 0" }}>
        {codes.map((qr) => (
          <div key={qr.id} className="admin-card" style={{ marginBottom: 0, opacity: qr.active ? 1 : 0.5, position: "relative" }}>
            {qr.is_default && (
              <span className="badge badge-gold" style={{ position: "absolute", top: 8, right: 8 }}>⭐ Por defecto</span>
            )}
            <img src={qr.image_url} alt={qr.alias} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, marginBottom: "0.4rem" }} />
            <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{qr.alias}</div>
            {qr.bank_or_holder && <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: "0.4rem" }}>{qr.bank_or_holder}</div>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
              <Switch checked={qr.active} onChange={() => toggleActivo(qr)} label={qr.active ? "Deshabilitar" : "Habilitar"} />
              {!qr.is_default && qr.active && (
                <button className="btn btn-secondary" style={{ width: "auto", padding: "0.3rem 0.6rem", fontSize: "0.78rem" }} onClick={() => marcarDefault(qr)}>
                  Usar por defecto
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="field-row"><label>Alias (ej. "Yape")</label><input value={alias} onChange={(e) => setAlias(e.target.value)} /></div>
      <div className="field-row"><label>Banco / titular (opcional)</label><input value={bankOrHolder} onChange={(e) => setBankOrHolder(e.target.value)} /></div>
      <input ref={fileInput} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <button className="upload-box" style={{ marginBottom: "0.7rem" }} onClick={() => fileInput.current?.click()}>
        {dataUri ? "Cambiar imagen" : "📷 Subir imagen del QR"}
      </button>
      {dataUri && <img className="upload-preview" src={dataUri} alt="Nuevo QR" style={{ maxWidth: 160 }} />}
      <button className="btn btn-primary" onClick={create} disabled={uploading}>
        {uploading ? "Subiendo…" : "Agregar código QR"}
      </button>
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

  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPin, setResetPin] = useState("");

  const guardarPin = async (u: AppUser) => {
    if (resetPin.length < 4 || resetPin.length > 6 || !/^\d+$/.test(resetPin)) {
      show("El PIN debe tener entre 4 y 6 dígitos");
      return;
    }
    try {
      await api.patch("/users", { id: u.id, pin: resetPin });
      setResetId(null); setResetPin("");
      show("PIN actualizado");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Error actualizando el PIN");
    }
  };

  return (
    <div className="admin-card">
      <h3>Personal</h3>
      <table className="admin-table">
        <thead><tr><th></th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><span className="avatar-dot" style={{ background: `var(--color-${u.color}, var(--color-accent))` }}>{u.name.charAt(0)}</span></td>
              <td>{u.name} {u.protected && <span title="Protegido">🔒</span>}</td>
              <td>{u.role}</td>
              <td><Badge tone={u.status ? "success" : "danger"}>{u.status ? "Activo" : "Bloqueado"}</Badge></td>
              <td>
                <Switch checked={u.status} onChange={() => toggleBloqueo(u)} label={u.status ? "Bloquear" : "Desbloquear"} disabled={u.protected} />
              </td>
              <td>
                {resetId === u.id ? (
                  <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <input inputMode="numeric" autoFocus placeholder="Nuevo PIN" value={resetPin}
                      onChange={(e) => setResetPin(e.target.value)} style={{ width: "5.5rem" }} />
                    <button className="btn btn-primary" style={{ width: "auto", padding: "0.5rem 0.9rem" }} onClick={() => guardarPin(u)}>Guardar</button>
                    <button className="btn btn-secondary" style={{ width: "auto", padding: "0.5rem 0.9rem" }} onClick={() => { setResetId(null); setResetPin(""); }}>Cancelar</button>
                  </span>
                ) : (
                  <motion.button
                    className="btn btn-secondary btn-pin-reset"
                    style={{ width: "auto" }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => { setResetId(u.id); setResetPin(""); }}
                  >
                    <Lock size={14} /> Cambiar PIN
                  </motion.button>
                )}
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
            <tr key={it.id}>
              <td>
                {it.item_name}{" "}
                {it.quantity <= it.min_stock && (
                  <motion.span
                    className="badge badge-lowstock"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  >
                    <span className="badge-lowstock-dot" /> Stock bajo
                  </motion.span>
                )}
              </td>
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
