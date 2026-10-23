import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { ProductSummary } from '../api/types';
import { useReveal } from '../hooks/useReveal';
import { formatVnd } from '../utils/format';
import { ProductThumb } from './ProductThumb';

/** revealIndex: vị trí trong lưới để thẻ trượt lên lần lượt khi cuộn tới (bỏ trống = không hiệu ứng) */
export function ProductCard({ product, revealIndex }: { product: ProductSummary; revealIndex?: number }) {
  const revealRef = useReveal<HTMLAnchorElement>();
  const reveal = revealIndex !== undefined;
  const onSale = product.compareAtPrice != null && product.price != null && product.compareAtPrice > product.price;
  const discountPercent =
    onSale && product.compareAtPrice ? Math.round((1 - (product.price ?? 0) / product.compareAtPrice) * 100) : 0;
  return (
    <Link
      to={`/products/${product.slug}`}
      ref={reveal ? revealRef : undefined}
      className={reveal ? 'product-card reveal' : 'product-card'}
      style={reveal ? ({ '--reveal-delay': `${(revealIndex % 4) * 80}ms` } as CSSProperties) : undefined}
    >
      <div className="product-card-media">
        <ProductThumb url={product.thumbnailUrl} alt={product.name} />
        {product.status === 'OUT_OF_STOCK' && <span className="ribbon ribbon-muted">Tạm hết</span>}
        {onSale && product.status !== 'OUT_OF_STOCK' && <span className="ribbon">-{discountPercent}%</span>}
      </div>
      <div className="product-card-body">
        <h3 className="product-card-title">{product.name}</h3>
        <div className="price-row">
          <span className="price">{product.price != null ? formatVnd(product.price) : 'Liên hệ'}</span>
          {onSale && <span className="price-old">{formatVnd(product.compareAtPrice)}</span>}
        </div>
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
