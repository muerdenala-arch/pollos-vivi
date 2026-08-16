import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

const MAX_PIN = 6;

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const { loginWithPin, loading } = useAuth();
  const navigate = useNavigate();

  const pressKey = (digit: string) => {
    if (pin.length >= MAX_PIN) return;
    setError("");
    setPin((p) => p + digit);
  };
  const backspace = () => setPin((p) => p.slice(0, -1));

  const submit = async (value: string) => {
    if (value.length < 4) return;
    try {
      const user = await loginWithPin(value);
      // El admin entra directo al panel de administración (no vende por
      // defecto, así que no debe pasar por la apertura de caja); el cajero
      // entra al POS, donde sí se le exige abrir caja antes de vender.
      navigate(user.role === "admin" ? "/admin" : "/", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo iniciar sesión");
      setPin("");
    }
  };

  const onDigit = (d: string) => {
    const next = pin.length >= MAX_PIN ? pin : pin + d;
    setPin(next);
    setError("");
    if (next.length === 4) {
      // auto-submit a los 4 dígitos (PIN típico); si es incorrecto se puede seguir tecleando
      submit(next);
    }
  };

  return (
    <div className="pin-screen">
      <div className="pin-logo">🍗</div>
      <h1 className="pin-title">Pollos Vivi</h1>
      <p className="pin-subtitle">Ingresa tu PIN para comenzar</p>

      <div className="pin-dots">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
        ))}
      </div>

      <div className="pin-error">{loading ? "Verificando…" : error}</div>

      <div className="pin-keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} className="pin-key" onClick={() => onDigit(d)} disabled={loading}>
            {d}
          </button>
        ))}
        <div className="pin-key pin-key-ghost" />
        <button className="pin-key" onClick={() => onDigit("0")} disabled={loading}>0</button>
        <button className="pin-key" onClick={backspace} disabled={loading} aria-label="Borrar">⌫</button>
      </div>
    </div>
  );
}
