import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { EmptyState, Loading } from '../components/Feedback';
import { ProductThumb } from '../components/ProductThumb';
import { QuantityInput } from '../components/QuantityInput';
import { MAX_QUANTITY } from '../config';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatVnd } from '../utils/format';

export function CartPage() {
  const cart = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [busyVariant, setBusyVariant] = useState<number | null>(null);

  const run = async (variantId: number, action: () => Promise<void>) => {
    setBusyVariant(variantId);
    try {
      await action();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyVariant(null);
    }
  };

  if (cart.loading && cart.lines.length === 0) return <Loading text="Đang tải giỏ hàng..." />;

  if (cart.lines.length === 0) {
    return (
      <div className="container section">
        <EmptyState icon="🛒" title="Giỏ hàng đang trống" action={{ to: '/products', label: 'Mua sắm ngay' }}>
          Hãy chọn vài món ưng ý cho gia đình hoặc làm quà tặng người thương.
        </EmptyState>
      </div>
    );
  }

  const unavailable = cart.lines.filter((l) => !l.available);

  return (
    <div className="container section">
      <div className="page-head">
        <h1>Giỏ hàng</h1>
        <p className="muted">{cart.count} sản phẩm</p>
      </div>

      {unavailable.length > 0 && (
        <div className="alert alert-warning">
          Có {unavailable.length} sản phẩm đã ngừng bán hoặc không đủ hàng. Vui lòng xóa hoặc giảm số lượng trước khi
          đặt hàng.
        </div>
      )}

      <div className="cart-layout">
        <div className="cart-lines">
          {cart.lines.map((line) => (
            <div key={line.variantId} className={`cart-line card ${line.available ? '' : 'unavailable'}`}>
              <Link to={`/products/${line.productSlug}`} className="cart-line-thumb">
                <ProductThumb url={line.thumbnailUrl} alt={line.productName} />
              </Link>
              <div className="cart-line-info">
                <Link to={`/products/${line.productSlug}`} className="cart-line-name">
                  {line.productName}
                </Link>
                <p className="muted small">{line.variantName}</p>
                <div className="price-row">
                  <span className="price">{formatVnd(line.unitPrice)}</span>
                  {line.originalPrice != null && line.originalPrice > line.unitPrice && (
                    <span className="price-old">{formatVnd(line.originalPrice)}</span>
                  )}
                </div>
                {!line.available && (
                  <p className="field-error">
                    {line.stock !== undefined && line.stock > 0
                      ? `Chỉ còn ${line.stock} sản phẩm`
                      : 'Sản phẩm tạm hết hàng / ngừng bán'}
                  </p>
                )}
              </div>
              <div className="cart-line-actions">
                <QuantityInput
                  value={line.quantity}
                  max={Math.max(1, Math.min(MAX_QUANTITY, line.stock ?? MAX_QUANTITY))}
                  disabled={busyVariant === line.variantId}
                  onChange={(q) => run(line.variantId, () => cart.setQuantity(line.variantId, q))}
                />
                <strong className="cart-line-total">{formatVnd(line.lineTotal)}</strong>
                <button
                  type="button"
                  className="link-btn danger"
                  disabled={busyVariant === line.variantId}
                  onClick={() => run(line.variantId, () => cart.remove(line.variantId))}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="card summary-card">
          <h3 className="card-title">Tóm tắt</h3>
          <dl className="totals">
            <dt>Tạm tính</dt>
            <dd>{formatVnd(cart.subtotal)}</dd>
            <dt>Phí giao hàng</dt>
            <dd className="muted">Tính ở bước sau</dd>
          </dl>
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            disabled={unavailable.length > 0}
            onClick={() => navigate('/checkout')}
          >
            Tiến hành đặt hàng
          </button>
          {!user && (
            <p className="muted small center">
              <Link to="/login?redirect=%2Fcheckout">Đăng nhập</Link> để lưu giỏ hàng và sổ địa chỉ, hoặc đặt ngay
              không cần tài khoản.
            </p>
          )}
          <Link to="/products" className="link-more center-block">
            ← Tiếp tục mua sắm
          </Link>
        </aside>
      </div>
    </div>
  );
}
