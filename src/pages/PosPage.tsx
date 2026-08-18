import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Variante } from "@shared/catalog";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../hooks/useCatalog";
import { useToast } from "../components/Toast";
import { ThemeToggle } from "../components/ThemeToggle";
import { CartSheet } from "../components/CartSheet";
import { PendingOrdersSheet } from "../components/PendingOrdersSheet";
import { CashRegisterSheet } from "../components/CashRegisterSheet";
import { Logo } from "../components/Logo";
import { ClipboardList, ChefHat, LogOut, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const bs = (n: number) => `Bs. ${n.toFixed(2)}`;

export default function PosPage() {
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
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
          {/* Dentro del POS la caja siempre está abierta (CashRegisterGate lo garantiza). */}
          <span className="caja-chip">
            <span className="caja-chip-dot" />
            Caja abierta
          </span>
          <span className="topbar-user-label" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="header-avatar">{user?.name?.charAt(0) ?? "?"}</span>
            {branch?.name}
          </span>
          <ThemeToggle />
          <button className="icon-btn" onClick={() => setPendingOpen(true)} title="Pedidos pendientes"><ClipboardList size={18} /></button>
          <button className="icon-btn icon-btn-critical" onClick={() => setCashOpen(true)} title="Cerrar caja"><Lock size={18} /></button>
          <button className="icon-btn" onClick={() => navigate("/cocina")} title="Pantalla de cocina"><ChefHat size={18} /></button>
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
            <CatTab label="Todos" active={selectedCat === null} onClick={() => setSelectedCat(null)} />
            {categorias.map((c) => (
              <CatTab key={c.id} label={c.nombre} active={selectedCat === c.id} onClick={() => setSelectedCat(c.id)} />
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
            <motion.div
              className="product-grid"
              key={`${selectedCat ?? "all"}-${search}`}
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.02 } } }}
            >
              {variantes.map((v) => (
                <ProductCard key={v.key} variante={v} onAdd={onAdd} />
              ))}
            </motion.div>
          )}
        </div>

        <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
      </div>

      <PendingOrdersSheet open={pendingOpen} onClose={() => setPendingOpen(false)} />
      <CashRegisterSheet open={cashOpen} onClose={() => setCashOpen(false)} />

      <AnimatePresence>
        {itemCount > 0 && (
          <motion.button
            className="cart-fab-bar"
            onClick={() => setCartOpen(true)}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            whileTap={{ scale: 0.97 }}
          >
            <span>
              <span className="cart-fab-badge">{itemCount}</span>
              Ver pedido
            </span>
            <span className="cart-fab-total">{bs(total)}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function CatTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`cat-tab ${active ? "active" : ""}`} onClick={onClick}>
      {active && (
        <motion.span
          layoutId="cat-tab-indicator"
          className="cat-tab-indicator"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      {label}
    </button>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1 },
};

function ProductCard({ variante, onAdd }: { variante: Variante; onAdd: (v: Variante) => void }) {
  const [pulse, setPulse] = useState(0);

  const handleClick = () => {
    onAdd(variante);
    setPulse((p) => p + 1);
  };

  return (
    <motion.button
      className="product-card"
      onClick={handleClick}
      variants={cardVariants}
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -2 }}
    >
      <span className="product-name">{variante.nombreCorto}</span>
      <span className="product-price">{bs(variante.precio)}</span>
      <AnimatePresence>
        {pulse > 0 && (
          <motion.span
            key={pulse}
            className="product-add-fly"
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -18, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            +1
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
