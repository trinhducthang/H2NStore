import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import { useAsync } from '../hooks/useAsync';
import type { CategoryMenuGroup } from '../utils/categoryMenu';
import { formatVnd } from '../utils/format';
import { ProductThumb } from './ProductThumb';

/** Sản phẩm bán chạy của ngành đang chọn, lấp phần trống dưới danh mục con */
function Bestsellers({ slug, onClose }: { slug: string; onClose: () => void }) {
  const products = useAsync(() => catalogApi.products({ categorySlug: slug, sort: 'bestseller', size: 4 }), [slug]);
  if (!products.data?.content.length) return null;
  return (
    <section className="mcat-featured">
      <h3 className="mcat-featured-title">Bán chạy</h3>
      <div className="mcat-featured-grid">
        {products.data.content.map((p) => (
          <Link key={p.id} to={`/products/${p.slug}`} className="mcat-product" onClick={onClose}>
            <ProductThumb url={p.thumbnailUrl} alt="" className="mcat-product-thumb" />
            <span className="mcat-product-name">{p.name}</span>
            <strong className="mcat-product-price">{p.price != null ? formatVnd(p.price) : 'Liên hệ'}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Nhóm chứa danh mục khách đang xem (mở bảng là thấy ngay chỗ đang đứng), không có thì nhóm đầu */
function currentGroupIndex(groups: CategoryMenuGroup[], search: string): number {
  const slug = new URLSearchParams(search).get('categorySlug');
  if (!slug) return 0;
  return Math.max(0, groups.findIndex((g) => g.key === slug || g.children.some((c) => c.slug === slug)));
}

/**
 * Bảng danh mục trên điện thoại, phủ phần màn hình dưới header:
 * cột trái là các ngành hàng, bên phải là danh mục con dạng ô lớn dễ bấm.
 */
export function MobileCategoryPanel({
  groups,
  top,
  onClose,
}: {
  groups: CategoryMenuGroup[];
  /** Mép dưới của header (px) */
  top: number;
  onClose: () => void;
}) {
  const location = useLocation();
  const [active, setActive] = useState(() => currentGroupIndex(groups, location.search));
  const group = groups[active] ?? groups[0];
  if (!group) return null;

  return (
    <nav id="mobile-categories" className="mcat-panel" style={{ top }} aria-label="Danh mục sản phẩm">
      <div className="mcat-rail" role="tablist" aria-orientation="vertical">
        {groups.map((g, i) => {
          const content = (
            <>
              <span className="mcat-rail-icon" style={{ background: g.tint }} aria-hidden="true">
                {g.icon}
              </span>
              <span className="mcat-rail-label">{g.label}</span>
            </>
          );
          // Nhóm không có danh mục con (VD "Đang giảm giá"): bấm là sang trang luôn
          return g.children.length === 0 && g.to ? (
            <Link key={g.key} to={g.to} className={`mcat-rail-item ${g.hot ? 'hot' : ''}`} onClick={onClose}>
              {content}
            </Link>
          ) : (
            <button
              key={g.key}
              type="button"
              role="tab"
              id={`mcat-tab-${g.key}`}
              aria-selected={i === active}
              aria-controls="mcat-content"
              className={`mcat-rail-item ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="mcat-content" id="mcat-content" role="tabpanel" aria-labelledby={`mcat-tab-${group.key}`}>
        <div className="mcat-hero" style={{ background: `linear-gradient(135deg, ${group.accent}b3, ${group.accent})` }}>
          <span className="mcat-hero-kicker">{group.label}</span>
          <strong className="mcat-hero-title">{group.tagline}</strong>
          {group.to && (
            <Link to={group.to} className="mcat-hero-link" onClick={onClose}>
              Xem tất cả →
            </Link>
          )}
        </div>
        <div className="mcat-grid">
          {group.children.map((c) => (
            <Link key={c.to} to={c.to} className="mcat-tile" onClick={onClose}>
              <span className="mcat-tile-icon" style={{ background: c.tint }} aria-hidden="true">
                {c.icon}
              </span>
              <span className="mcat-tile-label">{c.label}</span>
            </Link>
          ))}
        </div>
        {/* key: đổi ngành thì tải lại từ đầu, không hiện tạm sản phẩm của ngành trước */}
        {group.to && !group.hot && <Bestsellers key={group.key} slug={group.key} onClose={onClose} />}
      </div>
    </nav>
  );
}
