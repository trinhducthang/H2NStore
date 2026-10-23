import { useMemo, useState, type CSSProperties } from 'react';

/**
 * Hiệu ứng cánh hoa rơi trang trí cho trang khách hàng.
 * - Chỉ dùng CSS animation trên transform (chạy trên GPU, không re-render React).
 * - Không chặn click (pointer-events: none), nằm dưới header/modal/toast.
 * - Mặc định bật cho mọi khách; ai thấy rối mắt thì tắt bằng nút góc dưới trái, lựa chọn được ghi nhớ.
 */

const STORAGE_KEY = 'h2n.petals';
const DESKTOP_COUNT = 24;
const MOBILE_COUNT = 12;

/** Cặp màu gradient cho cánh hoa (tông hồng của shop) */
const COLORS: [string, string][] = [
  ['#ffd1df', '#f48fb1'],
  ['#ffc2d4', '#e75480'],
  ['#ffe0ea', '#f7a8c0'],
  ['#fbc4d4', '#d14d78'],
  ['#fff0f4', '#f9b4c8'],
];

type PetalStyle = CSSProperties & Record<`--${string}`, string>;

interface Petal {
  id: number;
  style: PetalStyle;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

function makePetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, id) => {
    const fall = random(9, 18);
    const [c1, c2] = COLORS[Math.floor(Math.random() * COLORS.length)];
    const spin = random(180, 540) * (Math.random() < 0.5 ? -1 : 1);
    return {
      id,
      style: {
        '--x': `${random(0, 100).toFixed(2)}%`,
        '--size': `${random(13, 26).toFixed(1)}px`,
        '--fall-dur': `${fall.toFixed(2)}s`,
        // Delay âm để lúc mở trang hoa đã rải khắp màn hình, không rơi cùng lúc từ trên xuống
        '--delay': `${(-random(0, fall)).toFixed(2)}s`,
        '--drift': `${random(-60, 120).toFixed(0)}px`,
        '--sway': `${random(20, 60).toFixed(0)}px`,
        '--sway-dur': `${random(3, 6).toFixed(2)}s`,
        '--spin': `${spin.toFixed(0)}deg`,
        '--alpha': random(0.75, 1).toFixed(2),
        '--c1': c1,
        '--c2': c2,
      },
    };
  });
}

/** @return lựa chọn khách đã lưu, null nếu chưa chọn lần nào */
function readStored(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? null : value === 'on';
  } catch {
    return null;
  }
}

function saveEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Trình duyệt chặn lưu trữ (VD chế độ riêng tư): chỉ không nhớ được lựa chọn
  }
}

export function FallingPetals() {
  const [stored, setStored] = useState(readStored);
  const enabled = stored ?? true;

  const petals = useMemo(() => makePetals(window.innerWidth < 640 ? MOBILE_COUNT : DESKTOP_COUNT), []);

  const toggle = () => {
    const next = !enabled;
    setStored(next);
    saveEnabled(next);
  };
  const label = enabled ? 'Tắt hiệu ứng hoa rơi' : 'Bật hiệu ứng hoa rơi';

  return (
    <>
      {enabled && (
        <div className="petals" aria-hidden="true">
          {petals.map((p) => (
            <span key={p.id} className="petal-fall" style={p.style}>
              <span className="petal" />
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        className="petals-toggle"
        aria-pressed={enabled}
        aria-label={label}
        title={label}
        onClick={toggle}
      >
        <span aria-hidden="true">🌸</span>
      </button>
    </>
  );
}
