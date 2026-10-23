import { useEffect, useRef, useState } from 'react';
import type { ProductSummary } from '../api/types';
import { ProductCard } from './ProductCard';

const AUTOPLAY_MS = 3500;
/** Khách vừa vuốt, cuộn hoặc tab vào dải sản phẩm thì tạm dừng tự trượt một lúc */
const IDLE_MS = 6000;

/** Trượt một thẻ; đang ở cuối thì quay về đầu, đang ở đầu mà lùi thì sang cuối */
function slide(track: HTMLElement | null, dir: 1 | -1) {
  const card = track?.firstElementChild as HTMLElement | null;
  if (!track || !card) return;
  const step = card.offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0);
  const max = track.scrollWidth - track.clientWidth;
  if (dir > 0 && track.scrollLeft >= max - 4) track.scrollTo({ left: 0, behavior: 'smooth' });
  else if (dir < 0 && track.scrollLeft <= 4) track.scrollTo({ left: max, behavior: 'smooth' });
  else track.scrollBy({ left: dir * step, behavior: 'smooth' });
}

/** Dải sản phẩm trượt ngang: vuốt trên điện thoại, nút ‹ › trên máy tính, tùy chọn tự trượt */
export function ProductSlider({
  products,
  label,
  autoplay = false,
}: {
  products: ProductSummary[];
  label: string;
  autoplay?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const lastInteraction = useRef(0);
  const [overflowing, setOverflowing] = useState(false);

  // Chỉ hiện nút ‹ › khi còn thẻ bị khuất
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => setOverflowing(track.scrollWidth > track.clientWidth + 4);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(track);
    return () => ro.disconnect();
  }, [products]);

  // Tự trượt khi dải đang nằm trong màn hình và khách không thao tác
  useEffect(() => {
    const track = trackRef.current;
    if (!autoplay || !track) return;
    let visible = false;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(track);
    const timer = window.setInterval(() => {
      const idle = Date.now() - lastInteraction.current > IDLE_MS;
      if (visible && idle && !hovering.current && !document.hidden) slide(track, 1);
    }, AUTOPLAY_MS);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [autoplay]);

  const interact = () => {
    lastInteraction.current = Date.now();
  };

  return (
    <div
      className="product-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') hovering.current = true;
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') hovering.current = false;
      }}
      onPointerDown={interact}
      onWheel={interact}
      onFocus={interact}
    >
      <div className="product-slider-track" ref={trackRef}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {overflowing && (
        <>
          <button
            type="button"
            className="slider-nav prev"
            aria-label="Sản phẩm trước"
            onClick={() => slide(trackRef.current, -1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="slider-nav next"
            aria-label="Sản phẩm tiếp theo"
            onClick={() => slide(trackRef.current, 1)}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
