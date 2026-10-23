import { useEffect, useRef, useState } from 'react';
import { formatDate, formatVnd } from '../utils/format';

export interface DailyPoint {
  date: string;
  orders: number;
  revenue: number;
}

const HEIGHT = 260;
const MARGIN = { top: 16, right: 12, bottom: 30, left: 56 };
const MAX_BAR = 24;
const GAP = 2;

/** Bước chia trục "đẹp": 1, 2, 2.5, 5 × 10^n, để vạch chia là số tròn (500k, 1tr, 1,5tr...) */
function niceStep(raw: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * exp >= raw) return m * exp;
  }
  return 10 * exp;
}

function axisTicks(maxValue: number): number[] {
  const step = maxValue > 0 ? niceStep(maxValue / 4) : 250_000;
  const top = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}

/** 1500000 -> "1,5tr", 500000 -> "500k" */
function compactVnd(v: number): string {
  const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  if (v >= 1e9) return `${fmt(v / 1e9)} tỷ`;
  if (v >= 1e6) return `${fmt(v / 1e6)}tr`;
  if (v >= 1e3) return `${fmt(v / 1e3)}k`;
  return String(v);
}

/** Cột bo 4px ở đầu dữ liệu, vuông ở đường đáy */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * Biểu đồ cột doanh thu theo ngày (một chuỗi số liệu nên không cần chú giải; tiêu đề nằm ở card).
 * Rê chuột / focus bàn phím vào từng ngày để xem giá trị; bảng số liệu nằm ở chế độ "Xem dạng bảng".
 */
export function RevenueChart({ data }: { data: DailyPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.floor(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const n = Math.max(1, data.length);
  const band = plotW / n;
  const barW = Math.max(1, Math.min(MAX_BAR, band - GAP));
  const ticks = axisTicks(Math.max(0, ...data.map((d) => d.revenue)));
  const max = ticks[ticks.length - 1];
  const y = (v: number) => MARGIN.top + plotH - (v / max) * plotH;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 46))));

  const activePoint = active !== null ? data[active] : null;
  const tooltipLeft =
    active !== null ? Math.min(Math.max(MARGIN.left + band * active + band / 2, 70), width - 70) : 0;

  return (
    <div className="chart-wrap" ref={wrapRef} onPointerLeave={() => setActive(null)}>
      <svg width={width} height={HEIGHT} role="img" aria-label="Biểu đồ cột doanh thu theo ngày" className="chart-svg">
        {ticks.map((t) => (
          <g key={t}>
            <line
              className="chart-grid"
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={Math.round(y(t)) + 0.5}
              y2={Math.round(y(t)) + 0.5}
            />
            <text className="chart-tick" x={MARGIN.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {compactVnd(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = MARGIN.left + band * i + (band - barW) / 2;
          const h = Math.max(0, MARGIN.top + plotH - y(d.revenue));
          return (
            <g key={d.date}>
              {h > 0 && (
                <path
                  className={`chart-bar ${active === i ? 'active' : ''}`}
                  d={columnPath(x, MARGIN.top + plotH - h, barW, h)}
                />
              )}
              {i % labelEvery === 0 && (
                <text className="chart-tick" x={MARGIN.left + band * i + band / 2} y={HEIGHT - 10} textAnchor="middle">
                  {formatDate(d.date).slice(0, 5)}
                </text>
              )}
              {/* Vùng bắt chuột phủ cả cột (lớn hơn phần tô màu) */}
              <rect
                className="chart-hit"
                x={MARGIN.left + band * i}
                y={MARGIN.top}
                width={band}
                height={plotH}
                tabIndex={0}
                aria-label={`${formatDate(d.date)}: ${formatVnd(d.revenue)}, ${d.orders} đơn`}
                onPointerEnter={() => setActive(i)}
                onPointerMove={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}

        <line
          className="chart-axis"
          x1={MARGIN.left}
          x2={width - MARGIN.right}
          y1={MARGIN.top + plotH + 0.5}
          y2={MARGIN.top + plotH + 0.5}
        />
      </svg>

      {activePoint && (
        <div className="chart-tooltip" style={{ left: tooltipLeft }}>
          <strong>{formatVnd(activePoint.revenue)}</strong>
          <span>
            {formatDate(activePoint.date)} · {activePoint.orders} đơn
          </span>
        </div>
      )}
    </div>
  );
}
