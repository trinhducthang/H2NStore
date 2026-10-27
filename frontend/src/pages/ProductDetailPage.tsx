import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import { errorMessage } from '../api/client';
import type { ProductDetail, Variant } from '../api/types';
import { EmptyState, ErrorBox, Loading } from '../components/Feedback';
import { Pagination } from '../components/Pagination';
import { ProductGrid } from '../components/ProductCard';
import { ProductThumb } from '../components/ProductThumb';
import { QuantityInput } from '../components/QuantityInput';
import { ReviewCard } from '../components/ReviewCard';
import { Stars } from '../components/Stars';
import { MAX_QUANTITY, SHOP_NAME } from '../config';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { formatVnd } from '../utils/format';
import { addRecentlyViewed } from '../utils/recentlyViewed';

function defaultVariant(product: ProductDetail): Variant | undefined {
  return product.variants.find((v) => v.stock > 0) ?? product.variants[0];
}

const REVIEW_PAGE_SIZE = 5;
const STAR_LEVELS = [5, 4, 3, 2, 1];

interface ReviewFilter {
  rating: number | null;
  withMedia: boolean;
}

function Reviews({ slug }: { slug: string }) {
  const [filter, setFilter] = useState<ReviewFilter>({ rating: null, withMedia: false });
  const [page, setPage] = useState(0);
  const summary = useAsync(() => catalogApi.reviewSummary(slug), [slug]);
  const reviews = useAsync(
    () => catalogApi.reviews(slug, { ...filter, page, size: REVIEW_PAGE_SIZE }),
    [slug, page, filter.rating, filter.withMedia],
  );

  const choose = (next: ReviewFilter) => {
    setFilter(next);
    setPage(0);
  };
  const isActive = (f: ReviewFilter) => filter.rating === f.rating && filter.withMedia === f.withMedia;

  if (summary.loading && !summary.data) return <Loading />;
  if (summary.error) return <ErrorBox message={summary.error} onRetry={summary.reload} />;
  const s = summary.data;
  if (!s || s.count === 0) {
    return (
      <p className="muted">
        Chưa có đánh giá nào cho sản phẩm này. Khách đã mua và nhận hàng có thể đánh giá trong mục Tài khoản › Đánh giá.
      </p>
    );
  }

  return (
    <>
      <div className="rating-overview">
        <div className="rating-score">
          <p>
            <strong>{s.average?.toFixed(1)}</strong>
            <span className="muted">/5</span>
          </p>
          <Stars value={s.average ?? 0} />
          <span className="muted small">{s.count} đánh giá từ khách đã mua</span>
        </div>
        <ul className="rating-bars">
          {STAR_LEVELS.map((star) => {
            const n = s.distribution[star] ?? 0;
            return (
              <li key={star}>
                <button
                  type="button"
                  disabled={n === 0}
                  aria-label={`Xem ${n} đánh giá ${star} sao`}
                  onClick={() => choose({ rating: star, withMedia: false })}
                >
                  <span className="rating-bar-label">{star} ★</span>
                  <span className="rating-bar">
                    <span style={{ width: `${(n / s.count) * 100}%` }} />
                  </span>
                  <span className="muted small rating-bar-count">{n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="chip-row review-filters">
        <button
          type="button"
          className={`chip chip-sm ${isActive({ rating: null, withMedia: false }) ? 'chip-active' : ''}`}
          onClick={() => choose({ rating: null, withMedia: false })}
        >
          Tất cả ({s.count})
        </button>
        {s.withMedia > 0 && (
          <button
            type="button"
            className={`chip chip-sm ${isActive({ rating: null, withMedia: true }) ? 'chip-active' : ''}`}
            onClick={() => choose({ rating: null, withMedia: true })}
          >
            Có ảnh/video ({s.withMedia})
          </button>
        )}
        {STAR_LEVELS.filter((star) => (s.distribution[star] ?? 0) > 0).map((star) => (
          <button
            key={star}
            type="button"
            className={`chip chip-sm ${isActive({ rating: star, withMedia: false }) ? 'chip-active' : ''}`}
            onClick={() => choose({ rating: star, withMedia: false })}
          >
            {star} sao ({s.distribution[star]})
          </button>
        ))}
      </div>

      {reviews.loading && !reviews.data && <Loading />}
      {reviews.error && <ErrorBox message={reviews.error} onRetry={reviews.reload} />}
      {reviews.data && reviews.data.content.length === 0 && (
        <p className="muted">Không có đánh giá phù hợp bộ lọc.</p>
      )}
      {reviews.data && reviews.data.content.length > 0 && (
        <>
          <ul className={`review-list ${reviews.loading ? 'is-refreshing' : ''}`}>
            {reviews.data.content.map((r) => (
              <li key={r.id} className="review">
                <ReviewCard review={r} />
              </li>
            ))}
          </ul>
          <Pagination page={reviews.data.page} totalPages={reviews.data.totalPages} onChange={setPage} />
        </>
      )}
    </>
  );
}

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const toast = useToast();
  const product = useAsync(() => catalogApi.product(slug), [slug]);
  const related = useAsync(() => catalogApi.related(slug), [slug]);

  const [variantId, setVariantId] = useState<number | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  // Hướng ảnh mới trượt vào khi đổi ảnh (null = lần đầu, không hiệu ứng)
  const [slideFrom, setSlideFrom] = useState<'left' | 'right' | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!product.data) return;
    const p = product.data;
    setVariantId(defaultVariant(p)?.id ?? null);
    const thumbIdx = p.images.findIndex((i) => i.thumbnail);
    setImageIndex(thumbIdx >= 0 ? thumbIdx : 0);
    setSlideFrom(null);
    setQuantity(1);
    // Lưu vào "Vừa xem gần đây" (cột phải trang chủ) với giá thấp nhất đang bán
    const cheapest = p.variants
      .filter((v) => v.active)
      .reduce<Variant | undefined>((min, v) => (!min || v.effectivePrice < min.effectivePrice ? v : min), undefined);
    addRecentlyViewed({
      id: p.id,
      slug: p.slug,
      name: p.name,
      thumbnailUrl: p.images[thumbIdx >= 0 ? thumbIdx : 0]?.url ?? null,
      price: cheapest?.effectivePrice ?? null,
      compareAtPrice: cheapest?.salePrice != null ? cheapest.price : null,
    });
  }, [product.data]);

  const variant = useMemo(
    () => product.data?.variants.find((v) => v.id === variantId) ?? (product.data ? defaultVariant(product.data) : undefined),
    [product.data, variantId],
  );

  if (product.loading && !product.data) return <Loading />;
  if (product.errorStatus === 404) {
    return (
      <div className="container section">
        <EmptyState icon="🥀" title="Sản phẩm không tồn tại hoặc đã ngừng bán" action={{ to: '/products', label: 'Xem sản phẩm khác' }} />
      </div>
    );
  }
  if (product.error || !product.data) {
    return (
      <div className="container section">
        <ErrorBox message={product.error ?? 'Không tải được sản phẩm'} onRetry={product.reload} />
      </div>
    );
  }

  const p = product.data;
  const images = p.images;
  const mainImage = images[imageIndex] ?? images[0];
  const showImage = (idx: number, from: 'left' | 'right') => {
    setSlideFrom(from);
    setImageIndex((idx + images.length) % images.length);
  };
  const purchasable = p.status === 'ACTIVE' && !!variant && variant.active && variant.stock > 0;
  const maxQty = variant ? Math.max(1, Math.min(MAX_QUANTITY, variant.stock)) : 1;

  const addToCart = async (buyNow: boolean) => {
    if (!variant) return;
    setAdding(true);
    try {
      await cart.add(
        {
          variantId: variant.id,
          productId: p.id,
          productName: p.name,
          productSlug: p.slug,
          variantName: variant.name,
          thumbnailUrl: mainImage?.url ?? images[0]?.url ?? null,
          unitPrice: variant.effectivePrice,
          originalPrice: variant.salePrice != null ? variant.price : null,
          stock: variant.stock,
        },
        quantity,
      );
      if (buyNow) navigate('/checkout');
      else toast.success(`Đã thêm “${p.name}” vào giỏ`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="container section">
      <title>{`${p.name} | ${SHOP_NAME}`}</title>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/products">Sản phẩm</Link>
        {p.categories[0] && (
          <>
            <span>/</span>
            <Link to={`/products?categorySlug=${p.categories[0].slug}`}>{p.categories[0].name}</Link>
          </>
        )}
      </nav>

      <div className="product-detail">
        <div className="gallery">
          <div className="gallery-main">
            <div key={mainImage?.id ?? 'none'} className={`gallery-slide ${slideFrom ? `from-${slideFrom}` : ''}`}>
              <ProductThumb url={mainImage?.url} alt={p.name} eager />
            </div>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="slider-nav prev"
                  aria-label="Ảnh trước"
                  onClick={() => showImage(imageIndex - 1, 'left')}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="slider-nav next"
                  aria-label="Ảnh sau"
                  onClick={() => showImage(imageIndex + 1, 'right')}
                >
                  ›
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  className={idx === imageIndex ? 'active' : ''}
                  onClick={() => idx !== imageIndex && showImage(idx, idx > imageIndex ? 'right' : 'left')}
                  aria-label={`Ảnh ${idx + 1}`}
                >
                  <img src={img.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <h1>{p.name}</h1>
          <div className="product-meta">
            {p.ratingCount ? (
              <a href="#reviews" className="rating-link">
                <Stars value={p.ratingAvg ?? 0} size="sm" /> {p.ratingAvg?.toFixed(1)} ({p.ratingCount} đánh giá)
              </a>
            ) : (
              <span className="muted small">Chưa có đánh giá</span>
            )}
            {p.soldCount > 0 && <span className="muted small">· Đã bán {p.soldCount}</span>}
          </div>

          {variant && (
            <div className="price-row price-lg">
              <span className="price">{formatVnd(variant.effectivePrice)}</span>
              {variant.salePrice != null && variant.salePrice < variant.price && (
                <span className="price-old">{formatVnd(variant.price)}</span>
              )}
            </div>
          )}

          {p.variants.length > 1 && (
            <div className="variant-picker">
              <p className="field-label">Chọn mẫu</p>
              <div className="chip-row">
                {p.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`chip ${variant?.id === v.id ? 'chip-active' : ''}`}
                    disabled={v.stock <= 0}
                    onClick={() => {
                      setVariantId(v.id);
                      setQuantity(1);
                    }}
                  >
                    {v.name} · {formatVnd(v.effectivePrice)}
                    {v.stock <= 0 && ' (hết)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {variant && (
            <p className={`stock-note ${variant.stock > 0 ? '' : 'out'}`}>
              {p.status === 'OUT_OF_STOCK' || variant.stock <= 0
                ? 'Tạm hết hàng'
                : variant.stock <= 5
                  ? `Chỉ còn ${variant.stock} sản phẩm`
                  : 'Còn hàng'}
            </p>
          )}

          <div className="buy-row">
            <QuantityInput value={quantity} max={maxQty} disabled={!purchasable} onChange={setQuantity} />
            <button
              type="button"
              className="btn btn-outline btn-lg"
              disabled={!purchasable || adding}
              onClick={() => addToCart(false)}
            >
              Thêm vào giỏ
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!purchasable || adding}
              onClick={() => addToCart(true)}
            >
              Mua ngay
            </button>
          </div>

          <ul className="perks">
            <li>🚚 Chọn ngày và khung giờ giao, đặt trước tối thiểu 2 giờ</li>
            <li>💌 Tặng thiệp ghi lời nhắn miễn phí</li>
            <li>📷 Gửi ảnh thực tế trước khi giao</li>
          </ul>

          {p.categories.length > 0 && (
            <div className="chip-row">
              {p.categories.map((c) => (
                <Link key={c.id} to={`/products?categorySlug=${c.slug}`} className="chip chip-sm">
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {p.description && (
        <section className="card section-card">
          <h2 className="card-title">Mô tả</h2>
          <p className="pre-line">{p.description}</p>
        </section>
      )}

      <section className="card section-card" id="reviews">
        <h2 className="card-title">
          Đánh giá{' '}
          {p.ratingCount ? (
            <span className="muted small">
              ({p.ratingAvg?.toFixed(1)}/5 từ {p.ratingCount} đánh giá)
            </span>
          ) : null}
        </h2>
        <Reviews slug={slug} />
      </section>

      {related.data && related.data.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Có thể bạn cũng thích</h2>
          </div>
          <ProductGrid products={related.data} />
        </section>
      )}
    </div>
  );
}
