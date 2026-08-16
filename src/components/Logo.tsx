/** Logo del negocio — recorte circular para que se vea limpio sobre fondos oscuros. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 0 0 2px var(--color-border)",
      }}
    >
      <img
        src="/logo.jpg"
        alt="Pollos Vivi"
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.35)" }}
      />
    </span>
  );
}
