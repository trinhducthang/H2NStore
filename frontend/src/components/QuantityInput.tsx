export function QuantityInput({
  value,
  min = 1,
  max = 20,
  disabled = false,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? Math.trunc(n) : min));
  return (
    <div className="qty-input">
      <button
        type="button"
        aria-label="Giảm số lượng"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label="Số lượng"
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <button
        type="button"
        aria-label="Tăng số lượng"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </div>
  );
}
