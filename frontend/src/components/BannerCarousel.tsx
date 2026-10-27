import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PublicBanner } from '../api/types';

const AUTOPLAY_MS = 5000;
/** Lâu hơn transition của .banner-track (0.65s) một chút: trượt xong mới nhảy từ slide nhân bản về slide thật */
const SLIDE_MS = 700;
const SWIPE_PX = 50;
/** Kéo quá chừng này mới tính là kéo (bấm thường vẫn là click) */
const DRAG_START_PX = 6;

/** Link nội bộ "/..." dùng router; link ngoài mở tab mới. Backend chỉ nhận "/..." hoặc http(s). */
function BannerLink({ url, className, label, children }: { url: string; className?: string; label?: string; children: ReactNode }) {
  if (url.startsWith('/')) {
    return (
      <Link to={url} className={className} aria-label={label} draggable={false}>
        {children}
      </Link>
    );
  }
  return (
    <a href={url} className={className} aria-label={label} target="_blank" rel="noopener noreferrer" draggable={false}>
      {children}
    </a>
  );
}

function Slide({ banner, index, current, hidden }: { banner: PublicBanner; index: number; current: boolean; hidden: boolean }) {
  const { title, subtitle, buttonText, linkUrl } = banner;
  const image = (
    <img
      className="banner-image"
      src={banner.imageUrl}
      alt={title || `Banner ${index + 1}`}
      loading={index === 0 ? 'eager' : 'lazy'}
      draggable={false}
      style={{ objectPosition: `${banner.imagePositionX}% ${banner.imagePositionY}%` }}
    />
  );
  // Có nút CTA thì chỉ nút là link (tránh link lồng link); không có nút thì cả banner là link
  const ctaLink = buttonText && linkUrl ? linkUrl : null;
  const slideLink = !ctaLink && linkUrl ? linkUrl : null;
  return (
    <div className={`banner-slide ${current ? 'is-current' : ''}`} inert={hidden} aria-hidden={hidden}>
      {slideLink ? (
        <BannerLink url={slideLink} className="banner-link" label={title || `Banner ${index + 1}`}>
          {image}
        </BannerLink>
      ) : (
        image
      )}
      {(title || subtitle || ctaLink) && (
        <div className="banner-overlay">
          {title && <p className="banner-title">{title}</p>}
          {subtitle && <p className="banner-subtitle">{subtitle}</p>}
          {ctaLink && (
            <BannerLink url={ctaLink} className="banner-cta">
              {buttonText}
              <span aria-hidden="true">→</span>
            </BannerLink>
          )}
        </div>
      )}
    </div>
  );
}

export function BannerCarousel({ banners }: { banners: PublicBanner[] }) {
  const count = banners.length;
  const loop = count > 1;
  // Dải trượt [bản sao slide cuối, ...banner, bản sao slide đầu] để trượt vòng tròn liền mạch theo cả hai chiều
  const slides = loop ? [banners[count - 1], ...banners, banners[0]] : banners;
  const [pos, setPos] = useState(loop ? 1 : 0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const dragStart = useRef<number | null>(null);
  const dragged = useRef(false);

  const current = loop ? (pos - 1 + count) % count : 0;
  const dragging = dragX !== null;

  const move = (delta: number) => {
    setAnimate(true);
    setPos((p) => Math.min(count + 1, Math.max(0, p + delta)));
  };

  // Tự trượt; đặt lại hẹn giờ mỗi khi đổi slide (kể cả khi khách tự bấm hoặc kéo)
  useEffect(() => {
    if (!loop || paused || dragging) return;
    const timer = window.setTimeout(() => {
      setAnimate(true);
      setPos((p) => Math.min(count + 1, p + 1));
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [current, count, loop, paused, dragging]);

  // Tới slide nhân bản ở hai đầu: trượt xong thì nhảy (không hiệu ứng) về slide thật giống hệt nó
  useEffect(() => {
    if (!loop || (pos !== 0 && pos !== count + 1)) return;
    const timer = window.setTimeout(() => {
      setAnimate(false);
      setPos(pos === 0 ? count : 1);
    }, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [pos, count, loop]);

  // Bật lại hiệu ứng sau khi trình duyệt đã vẽ vị trí mới
  useEffect(() => {
    if (animate) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setAnimate(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [animate]);

  // Danh sách banner thay đổi (admin vừa xóa bớt) thì không để vị trí vượt quá dải trượt
  useEffect(() => {
    if (pos > slides.length - 1) setPos(loop ? 1 : 0);
  }, [pos, slides.length, loop]);

  const endDrag = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    const dx = dragX ?? 0;
    setDragX(null);
    if (Math.abs(dx) > SWIPE_PX) move(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="banner-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Banner khuyến mãi"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="banner-frame"
        onPointerDown={(e) => {
          if (!loop || !e.isPrimary) return;
          dragStart.current = e.clientX;
          dragged.current = false;
        }}
        onPointerMove={(e) => {
          if (dragStart.current === null) return;
          const dx = e.clientX - dragStart.current;
          if (!dragged.current && Math.abs(dx) < DRAG_START_PX) return;
          dragged.current = true;
          setDragX(dx);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(e) => {
          // Vừa kéo xong thì không coi là bấm vào link (click bằng bàn phím có detail = 0, không chặn)
          if (dragged.current && e.detail > 0) {
            e.preventDefault();
            e.stopPropagation();
          }
          dragged.current = false;
        }}
      >
        <div
          className={`banner-track ${animate && !dragging ? '' : 'no-anim'}`}
          style={{ transform: `translateX(calc(${-pos * 100}% + ${dragX ?? 0}px))` }}
        >
          {slides.map((b, i) => {
            const real = loop ? (i - 1 + count) % count : i;
            const clone = loop && (i === 0 || i === slides.length - 1);
            return (
              <Slide
                key={`${b.id}-${i}`}
                banner={b}
                index={real}
                current={real === current}
                hidden={clone || real !== current}
              />
            );
          })}
        </div>

        {loop && (
          <>
            <button type="button" className="banner-nav prev" aria-label="Banner trước" onClick={() => move(-1)}>
              ‹
            </button>
            <button type="button" className="banner-nav next" aria-label="Banner sau" onClick={() => move(1)}>
              ›
            </button>
            <div className="banner-dots">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  className={i === current ? 'active' : ''}
                  aria-label={`Xem banner ${i + 1}`}
                  aria-current={i === current}
                  onClick={() => {
                    setAnimate(true);
                    setPos(i + 1);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
