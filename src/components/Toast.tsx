import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ToastState {
  show: (message: string) => void;
}
const ToastContext = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message && <div className="toast">{message}</div>}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
