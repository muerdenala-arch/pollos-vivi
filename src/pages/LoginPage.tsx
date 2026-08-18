import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";

const MAX_PIN = 6;
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const { loginWithPin, loading } = useAuth();
  const navigate = useNavigate();

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
      setShakeKey((k) => k + 1); // fuerza a Framer Motion a re-disparar el shake
    }
  };

  const onDigit = (d: string) => {
    if (loading) return;
    const next = pin.length >= MAX_PIN ? pin : pin + d;
    setPin(next);
    setError("");
    if (next.length === 4) {
      // auto-submit a los 4 dígitos (PIN típico); si es incorrecto se puede seguir tecleando
      submit(next);
    }
  };

  return (
    <div className="login-atmosphere">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      {/* Blobs de luz ambiental — respiran en bucle infinito */}
      <motion.div
        className="login-glow login-glow-a"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="login-glow login-glow-b"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <div className="login-logo-wrap">
          <motion.div
            className="login-logo-halo"
            animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.9, 0.55] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
          >
            <Logo size={92} />
          </motion.div>
        </div>

        <h1 className="pin-title">Pollos Vivi</h1>
        <p className="pin-subtitle">Ingresa tu PIN para comenzar</p>

        <motion.div
          key={shakeKey}
          className="pin-dots-wrap"
          animate={
            shakeKey > 0
              ? { x: [-10, 10, -8, 8, -4, 4, 0], backgroundColor: ["rgba(248,113,113,0.28)", "rgba(248,113,113,0)"] }
              : undefined
          }
          transition={{ duration: 0.45, ease: "easeInOut" }}
        >
          <div className="pin-dots">
            {Array.from({ length: 4 }).map((_, i) => {
              const filled = i < pin.length;
              return (
                <div key={i} className="pin-dot-slot">
                  <AnimatePresence>
                    {filled && (
                      <motion.div
                        className="pin-dot filled"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [0.8, 1.25, 1], opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.32, ease: "easeOut" }}
                      />
                    )}
                  </AnimatePresence>
                  {!filled && <div className="pin-dot" />}
                </div>
              );
            })}
          </div>
        </motion.div>

        <div className="pin-status">
          {loading ? (
            <motion.span
              className="pin-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Loader2 size={15} className="spin" /> Verificando…
            </motion.span>
          ) : (
            <AnimatePresence mode="wait">
              {error && (
                <motion.span
                  key={error}
                  className="pin-error-flash"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {error}
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </div>

        <div className="pin-keypad">
          {DIGITS.map((d) => (
            <KeypadButton key={d} label={d} onClick={() => onDigit(d)} disabled={loading} />
          ))}
          <div className="pin-key pin-key-ghost" />
          <KeypadButton label="0" onClick={() => onDigit("0")} disabled={loading} />
          <motion.button
            className="pin-key pin-key-backspace"
            whileHover={{ scale: 1.06, backgroundColor: "rgba(255,255,255,0.08)" }}
            whileTap={{ scale: 0.92, backgroundColor: "rgba(249,115,22,0.25)" }}
            onClick={backspace}
            disabled={loading}
            aria-label="Borrar"
          >
            <Delete size={20} />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function KeypadButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <motion.button
      className="pin-key"
      whileHover={{ scale: 1.06, backgroundColor: "rgba(255,255,255,0.08)" }}
      whileTap={{ scale: 0.92, backgroundColor: "rgba(249,115,22,0.25)" }}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </motion.button>
  );
}
