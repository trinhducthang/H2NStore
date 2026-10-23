export function Stars({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const rounded = Math.round(value);
  return (
    <span className={`stars stars-${size}`} aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rounded ? 'star on' : 'star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="stars stars-md star-picker" role="radiogroup" aria-label="Chọn số sao">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} sao`}
          className={i <= value ? 'star on' : 'star'}
          onClick={() => onChange(i)}
        >
          ★
        </button>
      ))}
    </span>
  );
}
