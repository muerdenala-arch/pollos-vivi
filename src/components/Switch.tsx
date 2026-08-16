export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className="switch" title={label} aria-label={label} style={disabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="switch-track" />
    </label>
  );
}
