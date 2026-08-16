import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Variante, DispatchMode } from "@shared/catalog";

export interface CartLine {
  key: string;
  productoId: number;
  presaId: number | null;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
}

interface CartState {
  lines: CartLine[];
  orderType: DispatchMode;
  setOrderType: (m: DispatchMode) => void;
  addVariante: (v: Variante) => void;
  changeQty: (key: string, delta: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<DispatchMode>("Llevar");

  const addVariante = (v: Variante) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.key === v.key);
      if (existing) {
        return prev.map((l) => (l.key === v.key ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [
        ...prev,
        {
          key: v.key,
          productoId: v.productoId,
          presaId: v.presaId,
          nombre: v.nombreCompleto,
          precioUnitario: v.precio,
          cantidad: 1,
        },
      ];
    });
  };

  const changeQty = (key: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0)
    );
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));
  const clear = () => setLines([]);

  const total = useMemo(
    () => Math.round(lines.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0) * 100) / 100,
    [lines]
  );
  const itemCount = useMemo(() => lines.reduce((s, l) => s + l.cantidad, 0), [lines]);

  return (
    <CartContext.Provider
      value={{ lines, orderType, setOrderType, addVariante, changeQty, removeLine, clear, total, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
