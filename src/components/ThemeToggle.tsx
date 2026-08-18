import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

/**
 * Selector claro/oscuro tipo píldora (segmented control) con indicador
 * animado — a propósito más grande y notorio que un ícono suelto, para que
 * se identifique de un vistazo como un control (no como un ícono más).
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Cambiar tema" title="Claro / oscuro">
      <span className={`theme-toggle-opt ${theme === "light" ? "active" : ""}`}>
        {theme === "light" && (
          <motion.span
            layoutId="theme-toggle-indicator"
            className="pill-indicator"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
        <Sun size={14} />
      </span>
      <span className={`theme-toggle-opt ${theme === "dark" ? "active" : ""}`}>
        {theme === "dark" && (
          <motion.span
            layoutId="theme-toggle-indicator"
            className="pill-indicator"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
        <Moon size={14} />
      </span>
    </button>
  );
}
