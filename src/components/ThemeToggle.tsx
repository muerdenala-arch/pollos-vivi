import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="icon-btn" onClick={toggle} aria-label="Cambiar tema" title="Claro / oscuro">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
