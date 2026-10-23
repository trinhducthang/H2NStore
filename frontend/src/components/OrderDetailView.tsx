import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Order } from '../api/types';
import {
  formatDate,
  formatDateTime,
  formatVnd,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from '../utils/format';
import { OrderStatusBadge, PaymentStatusBadge } from './Badge';

const FLOW: Order['status'][] = ['PENDING', 'CONFIRMED', 'ARRANGING', 'DELIVERING', 'DELIVERED'];

/** Thanh tiến trình trạng thái đơn */
export function OrderProgress({ status }: { status: Order['status'] }) {
  if (status === 'CANCELLED') {
    return <div className="alert alert-error">Đơn hàng đã bị hủy</div>;
  }
  const current = FLOW.indexOf(status);
  return (
    <ol className="order-progress">
      {FLOW.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'current' : ''}>
          <span className="dot" aria-hidden="true" />
          <span>{ORDER_STATUS_LABEL[s]}</span>
        </li>
      ))}
    </ol>
  );
}

export function OrderTimeline({ history }: { history: NonNullable<Order['history']> }) {
  if (!history.length) return null;
  return (
    <ul className="timeline">
      {[...history].reverse().map((h, idx) => (
        <li key={idx}>
          <div className="timeline-time muted small">{formatDateTime(h.createdAt)}</div>
          <div>
            {h.fromStatus && h.fromStatus !== h.toStatus ? (
              <strong>
                {ORDER_STATUS_LABEL[h.fromStatus]} → {ORDER_STATUS_LABEL[h.toStatus]}
              </strong>
            ) : h.fromStatus === h.toStatus ? (
              <strong>Cập nhật</strong>
            ) : (
              <strong>Đặt hàng ({ORDER_STATUS_LABEL[h.toStatus]})</strong>
            )}
            <span className="muted small"> · {h.changedBy}</span>
            {h.reason && <p className="timeline-reason">{h.reason}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OrderDetailView({
  order,
  actions,
  showTimeline = true,
  productLinks = false,
}: {
  order: Order;
  actions?: ReactNode;
  showTimeline?: boolean;
  productLinks?: boolean;
}) {
  return (
    <div className="order-detail">
      <div className="order-head card">
        <div>
          <p className="muted small">Mã đơn</p>
          <h2 className="order-code">{order.code}</h2>
          <p className="muted small">Đặt lúc {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="order-head-badges">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      <OrderProgress status={order.status} />

      {actions && <div className="order-actions">{actions}</div>}

      <div className="detail-grid">
        <section className="card">
          <h3 className="card-title">Giao hàng</h3>
          <dl className="info-list">
            <dt>Người nhận</dt>
            <dd>
              {order.receiver.name}
              {order.receiver.phone && ` · ${order.receiver.phone}`}
            </dd>
            <dt>Địa chỉ</dt>
            <dd>{order.deliveryAddress}</dd>
            <dt>Khu vực</dt>
            <dd>{order.deliveryZone?.name}</dd>
            <dt>Thời gian</dt>
            <dd>
              {formatDate(order.deliveryDate)} · {order.deliverySlotLabel ?? order.deliverySlot}
            </dd>
            {order.cardMessage && (
              <>
                <dt>Lời nhắn thiệp</dt>
                <dd className="card-message">“{order.cardMessage}”</dd>
              </>
            )}
            {order.note && (
              <>
                <dt>Ghi chú</dt>
                <dd>{order.note}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="card">
          <h3 className="card-title">Người gửi & thanh toán</h3>
          <dl className="info-list">
            <dt>Người gửi</dt>
            <dd>
              {order.sender.name}
              {order.sender.phone && ` · ${order.sender.phone}`}
              {order.hideSender && <span className="badge badge-neutral ml">Giấu tên với người nhận</span>}
            </dd>
            {order.sender.email && (
              <>
                <dt>Email</dt>
                <dd>{order.sender.email}</dd>
              </>
            )}
            <dt>Thanh toán</dt>
            <dd>{PAYMENT_METHOD_LABEL[order.paymentMethod]}</dd>
            {order.paidAmount > 0 && (
              <>
                <dt>Đã nhận</dt>
                <dd>
                  {formatVnd(order.paidAmount)}
                  {order.paidAt && <span className="muted small"> lúc {formatDateTime(order.paidAt)}</span>}
                </dd>
              </>
            )}
          </dl>
        </section>
      </div>

      <section className="card">
        <h3 className="card-title">Sản phẩm</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th className="num">Đơn giá</th>
                <th className="num">SL</th>
                <th className="num">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.variantId}>
                  <td>
                    {productLinks ? (
                      <Link to={`/admin/products/${item.productId}`}>{item.productName}</Link>
                    ) : (
                      item.productName
                    )}
                    <div className="muted small">{item.variantName}</div>
                  </td>
                  <td className="num">{formatVnd(item.unitPrice)}</td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{formatVnd(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="totals">
          <dt>Tạm tính</dt>
          <dd>{formatVnd(order.subtotal)}</dd>
          <dt>Phí giao hàng</dt>
          <dd>{formatVnd(order.shippingFee)}</dd>
          {order.discount > 0 && (
            <>
              <dt>Giảm giá{order.couponCode && ` (${order.couponCode})`}</dt>
              <dd>-{formatVnd(order.discount)}</dd>
            </>
          )}
          <dt className="total-label">Tổng cộng</dt>
          <dd className="total-value">{formatVnd(order.total)}</dd>
        </dl>
      </section>

      {order.deliveryPhotoUrl && (
        <section className="card">
          <h3 className="card-title">Ảnh thực tế</h3>
          <a href={order.deliveryPhotoUrl} target="_blank" rel="noreferrer">
            <img className="delivery-photo" src={order.deliveryPhotoUrl} alt="Ảnh đơn hàng trước khi giao" />
          </a>
        </section>
      )}

      {showTimeline && order.history && order.history.length > 0 && (
        <section className="card">
          <h3 className="card-title">Lịch sử đơn hàng</h3>
          <OrderTimeline history={order.history} />
        </section>
      )}
    </div>
  );
}
