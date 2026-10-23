import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import type { Category, ProductSummary } from '../api/types';
import { MEMBER_OFFER, SERVICE_PERKS, SHOP_HOTLINE, SUPPORT_HOURS } from '../config';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { buildCategoryMenu, categoryUrl, type CategoryMenuGroup } from '../utils/categoryMenu';
import { categoryLook } from '../utils/categoryStyle';
import { formatVnd } from '../utils/format';
import { getRecentlyViewed, type RecentProduct } from '../utils/recentlyViewed';
import { ProductThumb } from './ProductThumb';

const PROMO_MS = 4500;

/** Một dòng danh mục; có danh mục con thì rê chuột (hoặc Tab tới) để xổ sang phải */
function SideMenuRow({ item }: { item: CategoryMenuGroup }) {
  const content = (
    <>
      <span className="side-cat-icon" style={{ background: item.tint }} aria-hidden="true">
        {item.icon}
      </span>
      <span className="side-cat-name">{item.label}</span>
      <span className="side-cat-arrow" aria-hidden="true">
        ›
      </span>
    </>
  );
  return (
    <li className={`side-cat-item ${item.hot ? 'hot' : ''}`}>
      {item.to ? (
        <Link to={item.to} className="side-cat-link">
          {content}
        </Link>
      ) : (
        // Không có trang riêng: focus (Tab) hoặc rê chuột để mở danh sách con
        <span className="side-cat-link" tabIndex={0}>
          {content}
        </span>
      )}
      {item.children.length > 0 && (
        <div className="side-flyout">
          <p className="side-flyout-title">{item.label}</p>
          {item.to && <Link to={item.to}>Xem tất cả</Link>}
          {item.children.map((c) => (
            <Link key={c.to} to={c.to}>
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

/** Cột trái trang chủ (màn hình rộng): danh mục sản phẩm + cam kết dịch vụ */
export function HomeLeftSidebar({ categories }: { categories: Category[] }) {
  return (
    <aside className="home-side home-side-left" aria-label="Danh mục sản phẩm">
      <div className="side-card">
        <p className="side-cat-head">
          <span aria-hidden="true">☰</span> Danh mục sản phẩm
        </p>
        <ul className="side-cat-list">
          {buildCategoryMenu(categories).map((item) => (
            <SideMenuRow key={item.key} item={item} />
          ))}
        </ul>
        <ul className="side-perks">
          {SERVICE_PERKS.map((p) => (
            <li key={p.title}>
              <span className="side-perk-icon" aria-hidden="true">
                {p.icon}
              </span>
              <span>
                <strong>{p.title}</strong>
                <span className="muted">{p.note}</span>
              </span>
            </li>
          ))}
          <li>
            <span className="side-perk-icon" aria-hidden="true">
              ☎
            </span>
            <span>
              <a href={`tel:${SHOP_HOTLINE.replace(/[^\d+]/g, '')}`}>
                <strong>{SHOP_HOTLINE}</strong>
              </a>
              <span className="muted">{SUPPORT_HOURS}</span>
            </span>
          </li>
        </ul>
      </div>
    </aside>
  );
}

/** % giảm lớn nhất trong các sản phẩm đang giảm giá */
function maxDiscount(products: ProductSummary[]): number {
  return products.reduce((max, p) => {
    if (p.price == null || !p.compareAtPrice || p.compareAtPrice <= p.price) return max;
    return Math.max(max, Math.round((1 - p.price / p.compareAtPrice) * 100));
  }, 0);
}

/** Thẻ khuyến mãi theo ngành hàng, tự chuyển; % giảm lấy từ sản phẩm đang giảm giá thật */
function PromoCards({ departments }: { departments: Category[] }) {
  const slugs = departments.map((d) => d.slug).join();
  const deals = useAsync(
    () => Promise.all(departments.map((d) => catalogApi.products({ categorySlug: d.slug, onSale: true, size: 50 }))),
    [slugs],
  );
  const [index, setIndex] = useState(0);
  // Thẻ vừa rời đi: trượt sang trái trong khi thẻ mới vào từ bên phải
  const [leaving, setLeaving] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const count = departments.length;
  const current = index < count ? index : 0;

  const show = (next: number) => {
    if (next === current) return;
    setLeaving(current);
    setIndex(next);
  };

  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = window.setTimeout(() => {
      setLeaving(current);
      setIndex((current + 1) % count);
    }, PROMO_MS);
    return () => window.clearTimeout(timer);
  }, [current, count, paused]);

  if (!count) return null;
  return (
    <div
      className="promo-cards"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="promo-stage">
        {departments.map((d, i) => {
          const look = categoryLook(d.slug);
          const discount = maxDiscount(deals.data?.[i]?.content ?? []);
          const note = d.children?.map((c) => c.name).join(', ');
          return (
            <Link
              key={d.id}
              to={categoryUrl(d.slug)}
              className={`promo-card ${i === current ? 'active' : i === leaving ? 'leaving' : ''}`}
              style={{ background: `linear-gradient(135deg, ${look.accent}b3, ${look.accent})` }}
              inert={i !== current}
            >
              <span className="promo-kicker">{d.name}</span>
              <strong className="promo-title">{look.tagline}</strong>
              <strong className="promo-deal">{discount > 0 ? `Giảm đến ${discount}%` : 'Mua sắm ngay →'}</strong>
              {note && <span className="promo-note">{note}</span>}
            </Link>
          );
        })}
      </div>
      {count > 1 && (
        <div className="promo-dots">
          {departments.map((d, i) => (
            <button
              key={d.id}
              type="button"
              className={i === current ? 'active' : ''}
              aria-label={`Ưu đãi ${d.name}`}
              aria-current={i === current}
              onClick={() => show(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Sản phẩm vừa xem (lưu ở trình duyệt); khách chưa xem gì thì gợi ý sản phẩm bán chạy */
function RecentlyViewed() {
  const [recent] = useState(getRecentlyViewed);
  const bestsellers = useAsync(
    () => (recent.length ? Promise.resolve(null) : catalogApi.products({ sort: 'bestseller', size: 3 })),
    [],
  );
  const items: RecentProduct[] = recent.length ? recent.slice(0, 3) : (bestsellers.data?.content ?? []);
  if (!items.length) return null;
  return (
    <section className="side-recent">
      <h2 className="side-head">{recent.length ? 'Vừa xem gần đây' : 'Gợi ý cho bạn'}</h2>
      <ul>
        {items.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.slug}`} className="side-recent-item">
              <ProductThumb url={p.thumbnailUrl} alt="" className="side-recent-thumb" />
              <span className="side-recent-text">
                <span className="side-recent-name">{p.name}</span>
                <strong className="side-recent-price">{p.price != null ? formatVnd(p.price) : 'Liên hệ'}</strong>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MemberCard() {
  const { user } = useAuth();
  return (
    <div className="member-card">
      {user ? (
        <>
          <p className="member-kicker">Xin chào</p>
          <p className="member-title">{user.fullName}</p>
          <Link to="/account/orders" className="member-btn">
            Đơn hàng của tôi
          </Link>
        </>
      ) : (
        <>
          <p className="member-kicker">Ưu đãi thành viên</p>
          <p className="member-title">
            {MEMBER_OFFER.title}
            <br />
            {MEMBER_OFFER.note}
          </p>
          <Link to="/register" className="member-btn">
            Đăng ký ngay
          </Link>
        </>
      )}
    </div>
  );
}

/** Cột phải trang chủ (màn hình rộng): khuyến mãi theo ngành, sản phẩm vừa xem, ưu đãi thành viên */
export function HomeRightSidebar({ categories }: { categories: Category[] }) {
  const departments = categories.filter((c) => c.type === 'DEPARTMENT');
  return (
    <aside className="home-side home-side-right" aria-label="Ưu đãi và sản phẩm vừa xem">
      <div className="side-card">
        <PromoCards departments={departments} />
        <RecentlyViewed />
        <MemberCard />
      </div>
    </aside>
  );
}
