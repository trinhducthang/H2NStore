import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import { OrderStatusBadge, PaymentStatusBadge } from '../../components/Badge';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { Pagination } from '../../components/Pagination';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, formatDateTime, formatVnd, SLOT_LABEL } from '../../utils/format';

export function MyOrdersPage() {
  const [page, setPage] = useState(0);
  const orders = useAsync(() => ordersApi.myOrders(page, 10), [page]);

  if (orders.loading && !orders.data) return <Loading />;
  if (orders.error) return <ErrorBox message={orders.error} onRetry={orders.reload} />;
  if (!orders.data || orders.data.content.length === 0) {
    return <EmptyState icon="📦" title="Bạn chưa có đơn hàng nào" action={{ to: '/products', label: 'Mua sắm ngay' }} />;
  }

  return (
    <>
      <div className="order-cards">
        {orders.data.content.map((o) => (
          <Link key={o.code} to={`/account/orders/${o.code}`} className="card order-card">
            <div className="order-card-head">
              <strong>{o.code}</strong>
              <span className="muted small">{formatDateTime(o.createdAt)}</span>
            </div>
            <p>
              {o.firstItemName ?? 'Đơn hàng'}
              {o.itemCount > 1 && <span className="muted"> và {o.itemCount - 1} sản phẩm khác</span>}
            </p>
            <p className="muted small">
              Giao {formatDate(o.deliveryDate)} · {SLOT_LABEL[o.deliverySlot]} · cho {o.receiverName}
            </p>
            <div className="order-card-foot">
              <div className="badge-row">
                <OrderStatusBadge status={o.status} />
                <PaymentStatusBadge status={o.paymentStatus} />
              </div>
              <strong className="price">{formatVnd(o.total)}</strong>
            </div>
          </Link>
        ))}
      </div>
      <Pagination page={orders.data.page} totalPages={orders.data.totalPages} onChange={setPage} />
    </>
  );
}
