import { useMemo, useState } from "react";
import type { Variante } from "@shared/catalog";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../hooks/useCatalog";
import { useToast } from "../components/Toast";
import { ThemeToggle } from "../components/ThemeToggle";
import { CartSheet } from "../components/CartSheet";
import { PendingOrdersSheet } from "../components/PendingOrdersSheet";
import { Logo } from "../components/Logo";
import { ClipboardList, ChefHat, Settings, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const bs = (n: number) => `Bs. ${n.toFixed(2)}`;

export default function PosPage() {
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const { addVariante, itemCount, total } = useCart();
  const { user, branch, logout } = useAuth();
  const { categorias, variantes: allVariantes, loading } = useCatalog();
  const { show } = useToast();
  const navigate = useNavigate();

  const variantes = useMemo(() => {
    let list = allVariantes;
    if (selectedCat != null) list = list.filter((v) => v.categoriaId === selectedCat);
    const term = search.trim().toLowerCase();
    if (term) list = list.filter((v) => v.nombreCompleto.toLowerCase().includes(term));
    return list;
  }, [allVariantes, selectedCat, search]);

  const onAdd = (v: Variante) => {
    addVariante(v);
    show(`+ ${v.nombreCorto}`);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <Logo />
          Pollos Vivi
        </div>
        <div className="topbar-actions">
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            {user?.name} · {branch?.name}
          </span>
          <ThemeToggle />
          <button className="icon-btn" onClick={() => setPendingOpen(true)} title="Pedidos pendientes"><ClipboardList size={18} /></button>
          <button className="icon-btn" onClick={() => navigate("/cocina")} title="Pantalla de cocina"><ChefHat size={18} /></button>
          {user?.role === "admin" && (
            <button className="icon-btn" onClick={() => navigate("/admin")} title="Panel admin"><Settings size={18} /></button>
          )}
          <button className="icon-btn" onClick={logout} title="Cerrar sesión"><LogOut size={18} /></button>
        </div>
      </header>

      <div className="pos-layout">
        <div className="pos-main">
          <div className="search-bar">
            <input
              placeholder="Buscar producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="cat-tabs">
            <button className={`cat-tab ${selectedCat === null ? "active" : ""}`} onClick={() => setSelectedCat(null)}>
              Todos
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                className={`cat-tab ${selectedCat === c.id ? "active" : ""}`}
                onClick={() => setSelectedCat(c.id)}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <p>Cargando catálogo…</p>
            </div>
          ) : variantes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <p>Sin resultados</p>
            </div>
          ) : (
            <div className="product-grid">
              {variantes.map((v) => (
                <button key={v.key} className="product-card" onClick={() => onAdd(v)}>
                  <span className="product-name">{v.nombreCorto}</span>
                  <span className="product-price">{bs(v.precio)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
      </div>

      <PendingOrdersSheet open={pendingOpen} onClose={() => setPendingOpen(false)} />

      {itemCount > 0 && (
        <button className="cart-fab-bar" onClick={() => setCartOpen(true)}>
          <span>
            <span className="cart-fab-badge">{itemCount}</span>
            Ver pedido
          </span>
          <span className="cart-fab-total">{bs(total)}</span>
        </button>
      )}
    </div>
  );
}
