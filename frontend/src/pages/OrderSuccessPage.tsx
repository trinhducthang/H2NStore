import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ordersApi } from '../api/orders';
import { ErrorBox, Loading } from '../components/Feedback';
import { OrderDetailView } from '../components/OrderDetailView';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatVnd } from '../utils/format';

export function OrderSuccessPage() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const phone = params.get('phone') ?? '';
  const order = useAsync(() => (phone ? ordersApi.track(code, phone) : Promise.resolve(null)), [code, phone]);
  const trackLink = `/track?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`;

  return (
    <div className="container section">
      <div className="card result-card success">
        <div className="result-icon" aria-hidden="true">
          🌸
        </div>
        <h1>Đặt hàng thành công!</h1>
        <p>
          Mã đơn của bạn là <strong className="order-code-inline">{code}</strong>. Hãy lưu lại mã này để tra cứu đơn.
        </p>
        {order.data && (
          <p className="muted">
            {order.data.paymentMethod === 'COD'
              ? `Bạn sẽ thanh toán ${formatVnd(order.data.total)} khi nhận hàng.`
              : order.data.paymentStatus === 'PAID'
                ? 'Đơn đã được thanh toán.'
                : 'Đơn đang chờ thanh toán chuyển khoản.'}{' '}
            Đơn sẽ được giao ngày {formatDate(order.data.deliveryDate)}, {order.data.deliverySlotLabel}.
          </p>
        )}
        <div className="result-actions">
          {order.data?.paymentMethod === 'SEPAY' && order.data.paymentStatus === 'UNPAID' && order.data.status === 'PENDING' && (
            <Link to={`/payment/${code}?phone=${encodeURIComponent(phone)}`} className="btn btn-primary">
              Thanh toán ngay
            </Link>
          )}
          <Link to={trackLink} className="btn btn-outline">
            Theo dõi đơn hàng
          </Link>
          <Link to="/products" className="btn btn-ghost">
            Tiếp tục mua sắm
          </Link>
        </div>
      </div>

      {order.loading && <Loading />}
      {order.error && <ErrorBox message={order.error} onRetry={order.reload} />}
      {order.data && <OrderDetailView order={order.data} showTimeline={false} />}
    </div>
  );
}
