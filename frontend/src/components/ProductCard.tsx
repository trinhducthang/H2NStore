import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { ProductSummary } from '../api/types';
import { useReveal } from '../hooks/useReveal';
import { formatVnd } from '../utils/format';
import { ProductThumb } from './ProductThumb';

function isOnSale(product: ProductSummary) {
  return product.compareAtPrice != null && product.price != null && product.compareAtPrice > product.price;
}

/** Nhãn góc ảnh: "Tạm hết" hoặc % giảm giá */
function StatusRibbon({ product }: { product: ProductSummary }) {
  if (product.status === 'OUT_OF_STOCK') return <span className="ribbon ribbon-muted">Tạm hết</span>;
  if (!isOnSale(product) || !product.compareAtPrice) return null;
  const discountPercent = Math.round((1 - (product.price ?? 0) / product.compareAtPrice) * 100);
  return <span className="ribbon">-{discountPercent}%</span>;
}

function PriceRow({ product }: { product: ProductSummary }) {
  return (
    <div className="price-row">
      <span className="price">{product.price != null ? formatVnd(product.price) : 'Liên hệ'}</span>
      {isOnSale(product) && <span className="price-old">{formatVnd(product.compareAtPrice)}</span>}
    </div>
  );
}

/** Thẻ cùng hàng trượt lên lệch nhau một nhịp */
function revealDelay(revealIndex: number, perRow: number) {
  return { '--reveal-delay': `${(revealIndex % perRow) * 80}ms` } as CSSProperties;
}

/** revealIndex: vị trí trong lưới để thẻ trượt lên lần lượt khi cuộn tới (bỏ trống = không hiệu ứng) */
export function ProductCard({ product, revealIndex }: { product: ProductSummary; revealIndex?: number }) {
  const revealRef = useReveal<HTMLAnchorElement>();
  const reveal = revealIndex !== undefined;
  return (
    <Link
      to={`/products/${product.slug}`}
      ref={reveal ? revealRef : undefined}
      className={reveal ? 'product-card reveal' : 'product-card'}
      style={reveal ? revealDelay(revealIndex, 4) : undefined}
    >
      <div className="product-card-media">
        <ProductThumb url={product.thumbnailUrl} alt={product.name} />
        <StatusRibbon product={product} />
      </div>
      <div className="product-card-body">
        <h3 className="product-card-title">{product.name}</h3>
        <PriceRow product={product} />
        {product.soldCount > 0 && <p className="muted small">Đã bán {product.soldCount}</p>}
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <div className="product-grid">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} revealIndex={i} />
      ))}
    </div>
  );
}

/** Thẻ nằm ngang: ảnh nhỏ bên trái, tên + giá bên phải */
function ProductRowCard({ product, revealIndex }: { product: ProductSummary; revealIndex: number }) {
  const revealRef = useReveal<HTMLAnchorElement>();
  return (
    <Link
      to={`/products/${product.slug}`}
      ref={revealRef}
      className="product-row-card reveal"
      style={revealDelay(revealIndex, 3)}
    >
      <div className="product-row-media">
        <ProductThumb url={product.thumbnailUrl} alt={product.name} />
        <StatusRibbon product={product} />
      </div>
      <div className="product-row-body">
        <h3 className="product-card-title">{product.name}</h3>
        <PriceRow product={product} />
        {product.soldCount > 0 && <p className="muted small">Đã bán {product.soldCount}</p>}
      </div>
      <span className="product-row-go" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

/** Danh sách thẻ ngang: 1 cột trên điện thoại, 2-3 cột khi đủ rộng */
export function ProductRowList({ products }: { products: ProductSummary[] }) {
  return (
    <div className="product-rows">
      <div className="product-rows-grid">
        {products.map((p, i) => (
          <ProductRowCard key={p.id} product={p} revealIndex={i} />
        ))}
      </div>
    </div>
  );
}

export type ProductLayout = 'slider' | 'grid' | 'rows';

/** Khung giữ chỗ lúc đang tải, cùng bố cục với danh sách thật nên trang không bị giật khi có dữ liệu */
export function ProductSkeletons({ layout }: { layout: ProductLayout }) {
  const rows = layout === 'rows';
  const items = Array.from({ length: rows ? 3 : 4 }, (_, i) => (
    <div key={i} className={rows ? 'product-row-card skeleton-card' : 'product-card skeleton-card'} aria-hidden="true">
      <div className={rows ? 'product-row-media skeleton' : 'product-card-media skeleton'} />
      <div className={rows ? 'product-row-body' : 'product-card-body'}>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  ));
  return (
    <div role="status">
      <span className="sr-only">Đang tải sản phẩm...</span>
      {layout === 'slider' && (
        <div className="product-slider">
          <div className="product-slider-track">{items}</div>
        </div>
      )}
      {layout === 'grid' && <div className="product-grid">{items}</div>}
      {rows && (
        <div className="product-rows">
          <div className="product-rows-grid">{items}</div>
        </div>
      )}
    </div>
  );
}
