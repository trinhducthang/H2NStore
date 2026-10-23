import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { accountApi } from '../../api/account';
import { ApiError, errorMessage } from '../../api/client';
import { ordersApi } from '../../api/orders';
import type { Order, OrderLine } from '../../api/types';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { PromptModal } from '../../components/Modal';
import { OrderDetailView } from '../../components/OrderDetailView';
import { StarPicker } from '../../components/Stars';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';

function ReviewForm({ orderCode, item }: { orderCode: string; item: OrderLine }) {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await accountApi.createReview({ orderCode, productId: item.productId, rating, content: content.trim() || null });
      setResult({ ok: true, message: 'Cảm ơn bạn! Đánh giá sẽ hiển thị sau khi shop duyệt.' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setResult({ ok: true, message: 'Bạn đã đánh giá sản phẩm này trong đơn hàng.' });
      } else {
        setResult({ ok: false, message: errorMessage(err) });
      }
    } finally {
      setBusy(false);
    }
  };

  if (result?.ok) {
    return (
      <div className="review-form done">
        <strong>{item.productName}</strong>
        <p className="muted small">{result.message}</p>
      </div>
    );
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <strong>{item.productName}</strong>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        rows={2}
        maxLength={2000}
        value={content}
        placeholder="Sản phẩm có đúng mô tả không? Giao có đúng giờ không?"
        onChange={(e) => setContent(e.target.value)}
      />
      {result && !result.ok && <p className="field-error">{result.message}</p>}
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        {busy ? 'Đang gửi...' : 'Gửi đánh giá'}
      </button>
    </form>
  );
}

export function MyOrderDetailPage() {
  const { code = '' } = useParams();
  const toast = useToast();
  const order = useAsync(() => ordersApi.myOrder(code), [code]);
  const [cancelling, setCancelling] = useState(false);

  if (order.loading && !order.data) return <Loading />;
  if (order.errorStatus === 404) {
    return <EmptyState icon="🔎" title="Không tìm thấy đơn hàng" action={{ to: '/account/orders', label: 'Về danh sách đơn' }} />;
  }
  if (order.error || !order.data) return <ErrorBox message={order.error ?? 'Không tải được đơn'} onRetry={order.reload} />;

  const o: Order = order.data;
  const canPay = o.paymentMethod === 'SEPAY' && o.paymentStatus === 'UNPAID' && o.status === 'PENDING';
  const reviewItems = o.status === 'DELIVERED'
    ? o.items.filter((item, idx, arr) => arr.findIndex((x) => x.productId === item.productId) === idx)
    : [];

  return (
    <>
      <p>
        <Link to="/account/orders" className="link-more">
          ← Danh sách đơn
        </Link>
      </p>
      <OrderDetailView
        order={o}
        actions={
          canPay || o.cancellable ? (
            <>
              {canPay && (
                <Link
                  to={`/payment/${o.code}?phone=${encodeURIComponent(o.sender.phone ?? '')}`}
                  className="btn btn-primary"
                >
                  Thanh toán chuyển khoản
                </Link>
              )}
              {o.cancellable && (
                <button type="button" className="btn btn-danger-outline" onClick={() => setCancelling(true)}>
                  Hủy đơn
                </button>
              )}
            </>
          ) : undefined
        }
      />

      {reviewItems.length > 0 && (
        <section className="card">
          <h3 className="card-title">Đánh giá sản phẩm</h3>
          <div className="review-forms">
            {reviewItems.map((item) => (
              <ReviewForm key={item.productId} orderCode={o.code} item={item} />
            ))}
          </div>
        </section>
      )}

      {cancelling && (
        <PromptModal
          title={`Hủy đơn ${o.code}`}
          label="Lý do hủy (không bắt buộc)"
          multiline
          danger
          confirmText="Hủy đơn"
          description="Đơn chỉ hủy được khi shop chưa xác nhận. Mã giảm giá đã dùng sẽ được hoàn lại."
          onCancel={() => setCancelling(false)}
          onSubmit={async (reason) => {
            const updated = await ordersApi.cancelMyOrder(o.code, reason);
            order.setData(updated);
            setCancelling(false);
            toast.success('Đã hủy đơn hàng');
          }}
        />
      )}
    </>
  );
}
