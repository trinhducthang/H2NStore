import { lazy, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { RequireAdmin, RequireAuth, RequireStaff } from './components/Guards';
import { EmptyState } from './components/Feedback';
import { Layout } from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { AccountLayout } from './pages/account/AccountLayout';
import { AddressesPage } from './pages/account/AddressesPage';
import { MyOrderDetailPage } from './pages/account/MyOrderDetailPage';
import { MyOrdersPage } from './pages/account/MyOrdersPage';
import { MyReviewsPage } from './pages/account/MyReviewsPage';
import { ProfilePage } from './pages/account/ProfilePage';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { HomePage } from './pages/HomePage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { PaymentPage } from './pages/PaymentPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductListPage } from './pages/ProductListPage';
import { TrackOrderPage } from './pages/TrackOrderPage';

/** Trang quản trị tải riêng (code-split) để khách mua hàng không phải tải phần admin */
function lazyPage<M>(loader: () => Promise<M>, pick: (m: M) => ComponentType<object>) {
  return lazy(() => loader().then((m) => ({ default: pick(m) })));
}

const AdminLayout = lazyPage(() => import('./pages/admin/AdminLayout'), (m) => m.AdminLayout);
const AdminOrdersPage = lazyPage(() => import('./pages/admin/AdminOrdersPage'), (m) => m.AdminOrdersPage);
const AdminOrderDetailPage = lazyPage(() => import('./pages/admin/AdminOrderDetailPage'), (m) => m.AdminOrderDetailPage);
const AdminTransactionsPage = lazyPage(() => import('./pages/admin/AdminTransactionsPage'), (m) => m.AdminTransactionsPage);
const AdminProductsPage = lazyPage(() => import('./pages/admin/AdminProductsPage'), (m) => m.AdminProductsPage);
const AdminProductEditPage = lazyPage(() => import('./pages/admin/AdminProductEditPage'), (m) => m.AdminProductEditPage);
const AdminReviewsPage = lazyPage(() => import('./pages/admin/AdminReviewsPage'), (m) => m.AdminReviewsPage);
const AdminReportsPage = lazyPage(() => import('./pages/admin/AdminReportsPage'), (m) => m.AdminReportsPage);
const AdminCategoriesPage = lazyPage(() => import('./pages/admin/AdminCategoriesPage'), (m) => m.AdminCategoriesPage);
const AdminCouponsPage = lazyPage(() => import('./pages/admin/AdminCouponsPage'), (m) => m.AdminCouponsPage);
const AdminZonesPage = lazyPage(() => import('./pages/admin/AdminZonesPage'), (m) => m.AdminZonesPage);
const AdminUsersPage = lazyPage(() => import('./pages/admin/AdminUsersPage'), (m) => m.AdminUsersPage);
const AdminBannersPage = lazyPage(() => import('./pages/admin/AdminBannersPage'), (m) => m.AdminBannersPage);

/** Remount form sản phẩm khi đổi id (VD: từ sửa sản phẩm A sang thêm mới) để không giữ dữ liệu cũ */
function ProductEditRoute() {
  const { id } = useParams();
  return <AdminProductEditPage key={id ?? 'new'} />;
}

function NotFound() {
  return (
    <div className="container section">
      <EmptyState icon="🥀" title="Không tìm thấy trang" action={{ to: '/', label: 'Về trang chủ' }}>
        Đường dẫn không tồn tại hoặc đã bị thay đổi.
      </EmptyState>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="products" element={<ProductListPage />} />
                <Route path="products/:slug" element={<ProductDetailPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
                <Route path="payment/:code" element={<PaymentPage />} />
                <Route path="order-success/:code" element={<OrderSuccessPage />} />
                <Route path="track" element={<TrackOrderPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
                <Route path="reset-password" element={<ResetPasswordPage />} />

                <Route
                  path="account"
                  element={
                    <RequireAuth>
                      <AccountLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<Navigate to="orders" replace />} />
                  <Route path="orders" element={<MyOrdersPage />} />
                  <Route path="orders/:code" element={<MyOrderDetailPage />} />
                  <Route path="reviews" element={<MyReviewsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="addresses" element={<AddressesPage />} />
                </Route>

                <Route
                  path="admin"
                  element={
                    <RequireStaff>
                      <AdminLayout />
                    </RequireStaff>
                  }
                >
                  <Route index element={<Navigate to="orders" replace />} />
                  <Route path="orders" element={<AdminOrdersPage />} />
                  <Route path="orders/:code" element={<AdminOrderDetailPage />} />
                  <Route path="payments" element={<AdminTransactionsPage />} />
                  <Route path="products" element={<AdminProductsPage />} />
                  <Route path="products/new" element={<ProductEditRoute />} />
                  <Route path="products/:id" element={<ProductEditRoute />} />
                  <Route path="reviews" element={<AdminReviewsPage />} />
                  <Route
                    path="reports"
                    element={
                      <RequireAdmin>
                        <AdminReportsPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="categories"
                    element={
                      <RequireAdmin>
                        <AdminCategoriesPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="coupons"
                    element={
                      <RequireAdmin>
                        <AdminCouponsPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="zones"
                    element={
                      <RequireAdmin>
                        <AdminZonesPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="users"
                    element={
                      <RequireAdmin>
                        <AdminUsersPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="banners"
                    element={
                      <RequireAdmin>
                        <AdminBannersPage />
                      </RequireAdmin>
                    }
                  />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
