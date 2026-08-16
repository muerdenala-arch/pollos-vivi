import { useState, type ReactNode } from "react";
import { useCashRegister } from "../hooks/useCashRegister";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

/**
 * Bloquea el acceso al POS hasta que el cajero registre la apertura de caja
 * (persistida en Neon vía /api/cash-registers, ya no en localStorage).
 */
export function CashRegisterGate({ children }: { children: ReactNode }) {
  const { register, open, refresh } = useCashRegister();
  const { user, logout } = useAuth();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (register === undefined) {
    return <div className="caja-screen">Cargando…</div>;
  }

  if (register) {
    return <>{children}</>;
  }

  const handleOpen = async () => {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      setError("Ingresa un monto válido");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await open(value);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo abrir caja");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="caja-screen">
      <div className="pin-logo">💰</div>
      <h1 className="pin-title">Apertura de caja</h1>
      <p className="pin-subtitle">
        Hola {user?.name}, registra el monto inicial en efectivo para empezar tu turno.
      </p>
      <input
        className="caja-amount-input"
        inputMode="decimal"
        placeholder="Bs. 0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {error && <div className="pin-error">{error}</div>}
      <button className="btn btn-primary" style={{ maxWidth: 240 }} onClick={handleOpen} disabled={submitting}>
        {submitting ? "Abriendo…" : "Abrir caja"}
      </button>
      <button className="btn btn-danger" style={{ maxWidth: 240 }} onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  );
}
