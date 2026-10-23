import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Loading } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABEL } from '../../utils/format';

const STAFF_LINKS = [
  { to: '/admin/orders', label: 'Đơn hàng', icon: '📦' },
  { to: '/admin/payments', label: 'Đối soát SePay', icon: '💳' },
  { to: '/admin/products', label: 'Sản phẩm', icon: '💐' },
  { to: '/admin/reviews', label: 'Đánh giá', icon: '⭐' },
];

const ADMIN_LINKS = [
  { to: '/admin/reports', label: 'Báo cáo', icon: '📊' },
  { to: '/admin/banners', label: 'Banner trang chủ', icon: '🖼️' },
  { to: '/admin/categories', label: 'Danh mục', icon: '🗂️' },
  { to: '/admin/coupons', label: 'Mã giảm giá', icon: '🏷️' },
  { to: '/admin/zones', label: 'Khu vực giao', icon: '🗺️' },
  { to: '/admin/users', label: 'Người dùng', icon: '👥' },
];

export function AdminLayout() {
  const { user, isAdmin } = useAuth();
  const links = isAdmin ? [...STAFF_LINKS, ...ADMIN_LINKS] : STAFF_LINKS;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-user">
          <strong>{user?.fullName}</strong>
          <span className="muted small">{user && ROLE_LABEL[user.role]}</span>
        </div>
        <nav className="admin-nav" aria-label="Quản trị">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to}>
              <span aria-hidden="true">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-content">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
