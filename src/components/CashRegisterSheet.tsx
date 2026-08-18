import { useState } from "react";
import { useCashRegister } from "../hooks/useCashRegister";
import { ApiError } from "../lib/api";
import { useToast } from "./Toast";

const bs = (n: number) => `Bs. ${Number(n).toFixed(2)}`;

/**
 * Cierre de caja / arqueo accesible para el cajero (no solo desde el panel
 * admin). Antes solo existía dentro de /admin, así que un cajero nunca
 * podía cerrar su propia caja ni declarar el efectivo contado.
 */
export function CashRegisterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { register, close } = useCashRegister();
  const { show } = useToast();
  const [amount, setAmount] = useState("");
  const [resumen, setResumen] = useState<Record<string, number> | null>(null);

  if (!open) return null;

  const doClose = async () => {
    if (!register) return;
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      show("Ingresa un monto contado válido");
      return;
    }
    try {
      const res = await close(register.id, value);
      setResumen(res.resumen);
      show("Caja cerrada correctamente");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "No se pudo cerrar la caja");
    }
  };

  const cerrarTodo = () => {
    setAmount("");
    setResumen(null);
    onClose();
  };

  return (
    <>
      <div className="cart-backdrop" onClick={cerrarTodo} style={{ zIndex: 45 }} />
      <aside className="cart-sheet" style={{ zIndex: 46 }}>
        <div className="cart-sheet-handle" />
        <div className="cart-header">
          <span className="cart-title">💰 Cerrar caja</span>
          <button className="icon-btn" onClick={cerrarTodo}>✕</button>
        </div>

        <div className="cart-body">
          {register === undefined ? (
            <p style={{ color: "var(--color-text-faint)" }}>Cargando…</p>
          ) : !register ? (
            <div className="cart-empty">
              <div style={{ fontSize: "2.2rem" }}>💰</div>
              <p>No tienes una caja abierta en este momento.</p>
            </div>
          ) : resumen ? (
            <div style={{ fontSize: "0.9rem" }}>
              <p>Efectivo esperado: {bs(resumen.efectivo_esperado)}</p>
              <p>Vendido efectivo: {bs(resumen.efectivo_vendido)}</p>
              <p>Vendido QR: {bs(resumen.qr_vendido)}</p>
              <p>Pedidos: {resumen.pedidos}</p>
              <p>Monto contado: {bs(resumen.monto_contado)}</p>
              <p style={{ fontWeight: 700 }}>
                Diferencia: {bs(resumen.diferencia)}
              </p>
              {/* Recarga para que la pantalla de "Apertura de caja" (que consulta su propio
                  estado) se entere de que esta caja ya se cerró y pida abrir el próximo turno. */}
              <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => window.location.reload()}>
                Listo
              </button>
            </div>
          ) : (
            <>
              <p>Apertura: {bs(register.opening_amount)} · desde {new Date(register.opened_at).toLocaleString("es-BO")}</p>
              <div className="field-row">
                <label>Monto contado al cierre (Bs.)</label>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {register && !resumen && (
          <div className="cart-footer">
            <button className="btn btn-primary" onClick={doClose}>
              Cerrar caja / declarar efectivo
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
