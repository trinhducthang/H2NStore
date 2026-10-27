import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AccountLayout() {
  const { user } = useAuth();
  return (
    <div className="container section">
      <div className="page-head">
        <h1>Tài khoản</h1>
        {user && <p className="muted">Xin chào, {user.fullName}</p>}
      </div>
      <nav className="tabs" aria-label="Tài khoản">
        <NavLink to="/account/orders">Đơn hàng của tôi</NavLink>
        <NavLink to="/account/reviews">Đánh giá</NavLink>
        <NavLink to="/account/profile">Hồ sơ & mật khẩu</NavLink>
        <NavLink to="/account/addresses">Sổ địa chỉ</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
