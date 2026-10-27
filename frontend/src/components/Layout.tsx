import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import type { Category, CategoryType } from '../api/types';
import { SHOP_ADDRESS, SHOP_HOTLINE, SHOP_NAME, SHOP_TAGLINE, SOCIAL_LINKS } from '../config';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useAsync } from '../hooks/useAsync';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { buildCategoryMenu } from '../utils/categoryMenu';
import { CATEGORY_TYPE_LABEL, CATEGORY_TYPES } from '../utils/format';
import { ChatButtons } from './ChatButtons';
import { FallingPetals } from './FallingPetals';
import { Loading } from './Feedback';
import { MobileCategoryPanel } from './MobileCategoryPanel';

/** Từ độ rộng này header có đủ 3 hàng và menu ngang (khớp media query 900px trong CSS) */
const DESKTOP_QUERY = '(min-width: 900px)';

/** Không rắc hoa ở trang quản trị và trang đặt hàng/thanh toán (tránh che mã QR khi khách quét). */
const NO_PETALS_PATH = /^\/(admin|checkout|payment)(\/|$)/;

interface MenuLink {
  label: string;
  to: string;
}

interface MenuItem extends MenuLink {
  children?: MenuLink[];
}

const categoryLink = (c: Category): MenuLink => ({ label: c.name, to: `/products?categorySlug=${c.slug}` });

/**
 * Danh mục -> menu: mỗi ngành hàng (DEPARTMENT) một mục, có danh mục con thì xổ xuống;
 * các loại còn lại (dịp tặng quà, loại hoa, kiểu dáng) mỗi loại gom thành một dropdown.
 */
function buildMenu(categories: Category[]): MenuItem[] {
  const ofType = (type: CategoryType) => categories.filter((c) => c.type === type);
  const flatten = (list: Category[]) => list.flatMap((c) => [categoryLink(c), ...(c.children ?? []).map(categoryLink)]);
  const items: MenuItem[] = ofType('DEPARTMENT').map((c) => {
    const self = categoryLink(c);
    // Mục đầu của dropdown dẫn tới cả ngành hàng
    const children = c.children?.length ? [{ label: 'Xem tất cả', to: self.to }, ...c.children.map(categoryLink)] : undefined;
    return { ...self, children };
  });
  for (const type of CATEGORY_TYPES.filter((t) => t !== 'DEPARTMENT')) {
    const group = ofType(type);
    if (group.length) items.push({ label: CATEGORY_TYPE_LABEL[type], to: '/products', children: flatten(group) });
  }
  items.push({ label: 'Đang giảm giá', to: '/products?onSale=true' });
  items.push({ label: 'Tra cứu đơn', to: '/track' });
  return items;
}

// ------------------------------------------------------------------ icon

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" fill="currentColor" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Logo: bông hoa nét mảnh trong vòng tròn */
function BrandEmblem() {
  return (
    <svg className="brand-emblem" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <g fill="none" stroke="currentColor" strokeWidth="1.8">
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse key={angle} cx="24" cy="16" rx="5" ry="8" transform={`rotate(${angle} 24 24)`} />
        ))}
      </g>
      <circle cx="24" cy="24" r="3.2" fill="currentColor" />
    </svg>
  );
}

function SocialIcons() {
  const { facebook, twitter, instagram } = SOCIAL_LINKS;
  return (
    <div className="social-icons">
      {facebook && (
        <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="social facebook">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#1877f2" />
            <path d="M13.2 20.5v-9.1c0-2.1 1-3.3 3.3-3.3h1.3" fill="none" stroke="#fff" strokeWidth="2.6" />
            <path d="M9.6 12.4h6.8" stroke="#fff" strokeWidth="2.3" />
          </svg>
        </a>
      )}
      {twitter && (
        <a href={twitter} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="social x">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect width="24" height="24" rx="6" fill="#111" />
            <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </a>
      )}
      {instagram && (
        <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="social instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="#e1306c" strokeWidth="2.2" />
            <circle cx="12" cy="12" r="4.3" fill="none" stroke="#e1306c" strokeWidth="2.2" />
            <circle cx="17.4" cy="6.6" r="1.4" fill="#e1306c" />
          </svg>
        </a>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ các phần của header

function SearchBox({ placeholder = 'Tìm kiếm' }: { placeholder?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : '/products');
  };
  return (
    <form className="search-box" onSubmit={submit} role="search">
      <input
        type="search"
        placeholder={placeholder}
        value={q}
        aria-label="Tìm sản phẩm"
        onChange={(e) => setQ(e.target.value)}
      />
      <button type="submit" aria-label="Tìm">
        <SearchIcon />
      </button>
    </form>
  );
}

/** Đóng khi bấm ra ngoài, nhấn Escape hoặc đổi trang. */
function useDropdown<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

/**
 * Mục menu đang được chọn: cùng pathname và khớp mọi query của link (categorySlug, onSale...).
 * NavLink chỉ so pathname nên mọi link /products?... sẽ cùng sáng.
 */
function useIsActive() {
  const location = useLocation();
  return (to: string) => {
    const url = new URL(to, window.location.origin);
    if (url.pathname !== location.pathname) return false;
    const current = new URLSearchParams(location.search);
    for (const [key, value] of url.searchParams) {
      if (current.get(key) !== value) return false;
    }
    return true;
  };
}

function NavItem({ item }: { item: MenuItem }) {
  const { open, setOpen, ref } = useDropdown<HTMLLIElement>();
  const isActive = useIsActive();
  if (!item.children?.length) {
    return (
      <li className="nav-item">
        <Link to={item.to} className={`nav-link ${isActive(item.to) ? 'active' : ''}`}>
          {item.label}
        </Link>
      </li>
    );
  }
  const childActive = item.children.some((c) => isActive(c.to));
  return (
    <li
      ref={ref}
      className={`nav-item has-dropdown ${open ? 'open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`nav-link ${childActive ? 'active' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        {item.label}
        <span className="caret" aria-hidden="true" />
      </button>
      {open && (
        <ul className="nav-dropdown">
          {item.children.map((c) => (
            <li key={c.to + c.label}>
              <Link to={c.to} className={isActive(c.to) ? 'active' : ''}>
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function AccountMenu() {
  const { user, isStaff, logout } = useAuth();
  const navigate = useNavigate();
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();

  if (!user) {
    return (
      <Link to="/login" className="header-icon-btn" aria-label="Đăng nhập" title="Đăng nhập">
        <UserIcon />
      </Link>
    );
  }
  return (
    <div ref={ref} className={`account-menu ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="header-icon-btn"
        aria-label={`Tài khoản: ${user.fullName}`}
        title={user.fullName}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <UserIcon />
      </button>
      {open && (
        <div className="account-dropdown">
          <p className="account-name">{user.fullName}</p>
          <Link to="/account/orders">Đơn hàng của tôi</Link>
          <Link to="/account/profile">Tài khoản</Link>
          {isStaff && <Link to="/admin">Quản trị</Link>}
          <button
            type="button"
            className="link-btn"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/');
            }}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function CartButton() {
  const { count } = useCart();
  return (
    <Link to="/cart" className="cart-btn" aria-label={`Giỏ hàng (${count})`}>
      <BagIcon />
      <span className="cart-count">{count > 99 ? '99+' : count}</span>
    </Link>
  );
}

function Brand() {
  return (
    <Link to="/" className="brand" aria-label={`${SHOP_NAME} - trang chủ`}>
      <BrandEmblem />
      <span className="brand-text">
        <span className="brand-name">{SHOP_NAME}</span>
        {SHOP_TAGLINE && <span className="brand-tagline">{SHOP_TAGLINE}</span>}
      </span>
    </Link>
  );
}

/** Menu trượt trên mobile (ô tìm kiếm đã nằm sẵn ở hàng "Danh mục" của header) */
function MobileDrawer({ menu, onClose }: { menu: MenuItem[]; onClose: () => void }) {
  const { user, isStaff, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="mobile-drawer">
      <ul className="drawer-nav">
        {menu.map((item) =>
          item.children?.length ? (
            <li key={item.label}>
              <details>
                <summary>{item.label}</summary>
                <ul>
                  {item.children.map((c) => (
                    <li key={c.to + c.label}>
                      <Link to={c.to}>{c.label}</Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ) : (
            <li key={item.label}>
              <Link to={item.to}>{item.label}</Link>
            </li>
          ),
        )}
      </ul>
      <div className="drawer-account">
        {user ? (
          <>
            <Link to="/account/orders">Đơn hàng của tôi</Link>
            <Link to="/account/profile">Tài khoản</Link>
            {isStaff && <Link to="/admin">Quản trị</Link>}
            <button
              type="button"
              className="link-btn"
              onClick={async () => {
                onClose();
                await logout();
                navigate('/');
              }}
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Đăng nhập</Link>
            <Link to="/register">Đăng ký</Link>
          </>
        )}
      </div>
      <SocialIcons />
    </div>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const categories = useAsync(() => catalogApi.categories(), []);
  const menu = buildMenu(categories.data ?? []);

  useEffect(() => {
    setMenuOpen(false);
    setCategoriesOpen(false);
  }, [location.pathname, location.search]);

  // Kéo rộng cửa sổ / xoay ngang lên giao diện máy tính thì đóng menu của điện thoại
  useEffect(() => {
    if (!desktop) return;
    setMenuOpen(false);
    setCategoriesOpen(false);
  }, [desktop]);

  // Bảng danh mục phủ phần màn hình dưới header: khóa cuộn trang phía sau, Esc để đóng
  useEffect(() => {
    if (!categoriesOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCategoriesOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [categoriesOpen]);

  const toggleCategories = () => {
    setMenuOpen(false);
    setPanelTop(headerRef.current?.getBoundingClientRect().bottom ?? 0);
    setCategoriesOpen((o) => !o);
  };

  return (
    <>
      <header ref={headerRef} className={`site-header ${menuOpen ? 'menu-open' : ''}`}>
        <div className="container header-top">
          <button
            type="button"
            className="header-icon-btn menu-toggle"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            onClick={() => {
              setCategoriesOpen(false);
              setMenuOpen((o) => !o);
            }}
          >
            <span className="burger" aria-hidden="true" />
          </button>
          <div className="header-social">
            <SocialIcons />
          </div>
          <Brand />
          <div className="header-actions">
            <div className="header-search">
              <SearchBox />
            </div>
            <div className="header-account">
              <AccountMenu />
            </div>
            <CartButton />
          </div>
        </div>

        {/* Điện thoại: nút "Danh mục" mở bảng danh mục + ô tìm kiếm luôn hiện */}
        <div className="mobile-tools">
          <button
            type="button"
            className={`mcat-toggle ${categoriesOpen ? 'open' : ''}`}
            aria-expanded={categoriesOpen}
            aria-controls="mobile-categories"
            onClick={toggleCategories}
          >
            Danh mục
            <span className="caret" aria-hidden="true" />
          </button>
          <div className="mobile-search">
            <SearchBox placeholder="Tìm kiếm ..." />
          </div>
        </div>

        <nav className="header-nav" aria-label="Danh mục sản phẩm">
          <ul className="container nav-list">
            {menu.map((item) => (
              <NavItem key={item.label} item={item} />
            ))}
          </ul>
        </nav>

        {menuOpen && <MobileDrawer menu={menu} onClose={() => setMenuOpen(false)} />}
        {categoriesOpen && (
          <MobileCategoryPanel
            groups={buildCategoryMenu(categories.data ?? [])}
            top={panelTop}
            onClose={() => setCategoriesOpen(false)}
          />
        )}
      </header>

      {/* Nằm ngoài header: trên điện thoại cuộn đi theo trang để phần dính đầu trang không quá cao */}
      <div className="hotline-bar">
        <a href={`tel:${SHOP_HOTLINE.replace(/[^\d+]/g, '')}`}>
          Hotline đặt hàng nhanh - {SHOP_ADDRESS}: {SHOP_HOTLINE}
        </a>
      </div>
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <p className="brand-name">{SHOP_NAME}</p>
          <p className="muted">Hoa tươi, đồ gia dụng, đồ chơi và quà tặng, giao tận nơi đúng khung giờ.</p>
        </div>
        <div>
          <p className="footer-title">Liên hệ</p>
          <p>Hotline: {SHOP_HOTLINE}</p>
          <p>{SHOP_ADDRESS}</p>
        </div>
        <div>
          <p className="footer-title">Hỗ trợ</p>
          <p>
            <Link to="/track">Tra cứu đơn hàng</Link>
          </p>
          <p>Thanh toán: COD hoặc chuyển khoản QR (tự xác nhận qua SePay)</p>
        </div>
      </div>
      <div className="container footer-bottom muted small">
        © {new Date().getFullYear()} {SHOP_NAME}
      </div>
    </footer>
  );
}

export function Layout() {
  const location = useLocation();
  // Trang mở đầu tiên giữ title server dựng sẵn theo URL (SSI); đã chuyển trang thì trang nào không tự đặt title
  // sẽ về tên shop. <title> của trang con mount sau nên được React chèn lên trước và được ưu tiên.
  const [firstKey] = useState(location.key);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className="app-shell">
      {location.key !== firstKey && <title>{SHOP_NAME}</title>}
      <Header />
      <main className="site-main">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      {!NO_PETALS_PATH.test(location.pathname) && <FallingPetals />}
      {!location.pathname.startsWith('/admin') && <ChatButtons />}
    </div>
  );
}
