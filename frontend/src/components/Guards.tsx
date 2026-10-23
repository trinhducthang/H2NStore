import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Loading } from './Feedback';

function LoginRedirect() {
  const location = useLocation();
  const redirect = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/login?redirect=${redirect}`} replace />;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading text="Đang kiểm tra đăng nhập..." />;
  if (!user) return <LoginRedirect />;
  return <>{children}</>;
}

export function RequireStaff({ children }: { children: ReactNode }) {
  const { user, ready, isStaff } = useAuth();
  if (!ready) return <Loading text="Đang kiểm tra đăng nhập..." />;
  if (!user) return <LoginRedirect />;
  if (!isStaff) {
    return (
      <div className="container section">
        <EmptyState icon="🔒" title="Bạn không có quyền truy cập trang quản trị" action={{ to: '/', label: 'Về trang chủ' }} />
      </div>
    );
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <EmptyState icon="🔒" title="Chỉ quản trị viên (ADMIN) được dùng chức năng này" />;
  }
  return <>{children}</>;
}
