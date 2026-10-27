import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi, type ProductQuery } from '../api/catalog';
import type { Category } from '../api/types';
import { BannerCarousel } from '../components/BannerCarousel';
import { ErrorBox, Loading } from '../components/Feedback';
import { HomeLeftSidebar, HomeRightSidebar } from '../components/HomeSidebars';
import { ProductGrid, ProductRowList, ProductSkeletons, type ProductLayout } from '../components/ProductCard';
import { ProductSlider } from '../components/ProductSlider';
import { SHOP_NAME } from '../config';
import { useAsync } from '../hooks/useAsync';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useReveal } from '../hooks/useReveal';
import { categoryLook } from '../utils/categoryStyle';
import { CATEGORY_TYPE_LABEL, CATEGORY_TYPES } from '../utils/format';

/** Số sản phẩm tải lần đầu: dải trượt ngang, danh sách thẻ ngang, lưới dọc */
const FIRST_SIZE: Record<ProductLayout, number> = { slider: 12, rows: 6, grid: 8 };
/** Lưới dọc: mỗi lần bấm "Xem thêm" tải thêm bấy nhiêu, quá GRID_MAX thì chuyển sang trang danh sách */
const GRID_STEP = 8;
const GRID_MAX = 48;
/** Màn hình đủ rộng thì thêm cột danh mục bên trái và cột ưu đãi bên phải (khớp CSS .home-layout.has-sides) */
const SIDEBARS_QUERY = '(min-width: 1400px)';

function ProductSection({
  title,
  query,
  link,
  layout = 'slider',
  centered = false,
  hideWhenEmpty = false,
  autoplay = false,
}: {
  title: string;
  query: ProductQuery;
  link: string;
  layout?: ProductLayout;
  centered?: boolean;
  hideWhenEmpty?: boolean;
  autoplay?: boolean;
}) {
  const [size, setSize] = useState(FIRST_SIZE[layout]);
  const queryKey = JSON.stringify(query);
  // "Xem thêm" tải lại từ đầu với size lớn hơn: thẻ cũ giữ nguyên trên màn hình, thẻ mới nối vào cuối
  const { data, error, loading, reload } = useAsync(
    () => catalogApi.products({ ...query, size }),
    [queryKey, size],
  );
  const revealRef = useReveal<HTMLElement>();
  if (hideWhenEmpty && data && data.content.length === 0) return null;
  const remaining = data ? data.totalElements - data.content.length : 0;
  return (
    <section className="section reveal" ref={revealRef}>
      <div className={`section-head ${centered ? 'section-head-center' : ''}`}>
        <h2>{title}</h2>
        <Link to={link} className="link-more">
          Xem tất cả{' '}
          <span className="link-more-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
      {loading && !data && <ProductSkeletons layout={layout} />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.content.length === 0 && <p className="muted">Chưa có sản phẩm.</p>}
      {data && data.content.length > 0 && layout === 'slider' && (
        <ProductSlider products={data.content} label={title} autoplay={autoplay} />
      )}
      {data && data.content.length > 0 && layout === 'rows' && <ProductRowList products={data.content} />}
      {data && data.content.length > 0 && layout === 'grid' && <ProductGrid products={data.content} />}
      {layout === 'grid' && remaining > 0 && (
        <div className="load-more">
          {size < GRID_MAX ? (
            <button
              type="button"
              className="btn btn-outline btn-lg"
              disabled={loading}
              onClick={() => setSize((s) => s + GRID_STEP)}
            >
              {loading ? 'Đang tải...' : `Xem thêm ${Math.min(remaining, GRID_STEP)} sản phẩm`}
            </button>
          ) : (
            <Link to={link} className="btn btn-outline btn-lg">
              Xem tất cả sản phẩm
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function CategoryChips({ categories }: { categories: Category[] }) {
  const groups = CATEGORY_TYPES.map((type) => ({ type, items: categories.filter((c) => c.type === type) })).filter(
    (g) => g.items.length > 0,
  );
  return (
    <>
      {groups.map((g) => (
        <div key={g.type} className="category-group">
          <h3 className="category-group-title">{CATEGORY_TYPE_LABEL[g.type]}</h3>
          <div className="chip-row">
            {g.items.map((c, i) => (
              <Link
                key={c.id}
                to={`/products?categorySlug=${c.slug}`}
                className="chip chip-lg"
                style={{ '--i': i } as CSSProperties}
              >
                <span aria-hidden="true">{categoryLook(c.slug).icon}</span>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/** Hero mặc định khi admin chưa đặt banner nào */
function DefaultHero() {
  return (
    <section className="hero">
      <div className="container hero-inner">
        <div className="hero-text">
          <p className="hero-kicker">Hoa tươi · Gia dụng · Đồ chơi</p>
          <h1>Mua sắm cho cả nhà, quà tặng cho người thương</h1>
          <p>
            Chọn ngày và khung giờ giao. Thanh toán khi nhận hoặc quét mã QR — hệ thống tự xác nhận ngay khi tiền về.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary btn-lg">
              Mua sắm ngay
            </Link>
            <Link to="/track" className="btn btn-outline btn-lg">
              Tra cứu đơn
            </Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span>🛍️</span>
        </div>
      </div>
    </section>
  );
}

function HomeBanner() {
  const banners = useAsync(() => catalogApi.banners(), []);
  if (banners.data && banners.data.length > 0) {
    return (
      <section className="container home-banner">
        <h1 className="sr-only">{SHOP_NAME} - hoa tươi, gia dụng, đồ chơi đặt online, giao tận nơi</h1>
        <BannerCarousel banners={banners.data} />
      </section>
    );
  }
  if (banners.loading && !banners.data) {
    // Giữ chỗ đúng tỉ lệ banner để trang không bị giật khi ảnh tải xong
    return (
      <div className="container home-banner" aria-hidden="true">
        <div className="banner-frame skeleton" />
      </div>
    );
  }
  return <DefaultHero />;
}

export function HomePage() {
  const categories = useAsync(() => catalogApi.categories(), []);
  const withSidebars = useMediaQuery(SIDEBARS_QUERY);
  const categoriesRef = useReveal<HTMLElement>();

  return (
    <div className={withSidebars ? 'home-layout has-sides' : 'home-layout'}>
      {withSidebars && <HomeLeftSidebar categories={categories.data ?? []} />}

      <div className="home-main">
        <HomeBanner />

        <div className="container">
          <ProductSection
            title="Đang giảm giá"
            query={{ onSale: true, sort: 'bestseller' }}
            link="/products?onSale=true"
            centered
            hideWhenEmpty
            autoplay
          />

          <ProductSection title="Bán chạy nhất" query={{ sort: 'bestseller' }} link="/products?sort=bestseller" />

          <section className="section reveal" ref={categoriesRef}>
            <div className="section-head">
              <h2>Danh mục</h2>
            </div>
            {categories.loading && !categories.data && <Loading />}
            {categories.error && <ErrorBox message={categories.error} onRetry={categories.reload} />}
            {categories.data && <CategoryChips categories={categories.data} />}
          </section>

          <ProductSection
            title="Giá tốt"
            query={{ sort: 'price,asc' }}
            link="/products?sort=price,asc"
            layout="rows"
            hideWhenEmpty
          />
          <ProductSection title="Mẫu mới" query={{ sort: 'newest' }} link="/products?sort=newest" layout="grid" />
        </div>
      </div>

      {withSidebars && <HomeRightSidebar categories={categories.data ?? []} />}
    </div>
  );
}
