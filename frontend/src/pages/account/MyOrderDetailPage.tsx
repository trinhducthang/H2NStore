import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { accountApi } from '../../api/account';
import { ordersApi } from '../../api/orders';
import type { Order, PendingReview, Review } from '../../api/types';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { PromptModal } from '../../components/Modal';
import { MyReviewRow, PendingReviewRow } from '../../components/MyReviewRows';
import { OrderDetailView } from '../../components/OrderDetailView';
import { ReviewFormModal } from '../../components/ReviewFormModal';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';

/** Mỗi sản phẩm trong đơn đã giao: chờ đánh giá / đã đánh giá (sửa được 1 lần) / hết hạn. */
function OrderReviews({ order }: { order: Order }) {
  const toast = useToast();
  const pending = useAsync(() => accountApi.pendingReviews(order.code), [order.code]);
  const mine = useAsync(() => accountApi.myReviews({ orderCode: order.code, size: 50 }), [order.code]);
  const [writing, setWriting] = useState<PendingReview | null>(null);
  const [editing, setEditing] = useState<Review | null>(null);

  if ((pending.loading && !pending.data) || (mine.loading && !mine.data)) return <Loading />;
  const error = pending.error ?? mine.error;
  if (error) {
    return (
      <ErrorBox
        message={error}
        onRetry={() => {
          pending.reload();
          mine.reload();
        }}
      />
    );
  }
  const products = order.items.filter((item, idx, arr) => arr.findIndex((x) => x.productId === item.productId) === idx);

  return (
    <>
      <div className="my-review-list">
        {products.map((item) => {
          const review = mine.data?.content.find((r) => r.productId === item.productId);
          const todo = pending.data?.find((p) => p.productId === item.productId);
          if (review) {
            return <MyReviewRow key={item.productId} review={review} showOrder={false} onEdit={() => setEditing(review)} />;
          }
          if (todo) {
            return (
              <PendingReviewRow key={item.productId} item={todo} showOrder={false} onReview={() => setWriting(todo)} />
            );
          }
          return (
            <div key={item.productId} className="my-review-row">
              <div className="my-review-main">
                <strong className="my-review-name">{item.productName}</strong>
                <p className="muted small">Đã hết hạn đánh giá</p>
              </div>
            </div>
          );
        })}
      </div>

      {writing && (
        <ReviewFormModal
          target={writing}
          onClose={() => setWriting(null)}
          onSaved={() => {
            setWriting(null);
            pending.reload();
            mine.reload();
            toast.success('Cảm ơn bạn! Đánh giá sẽ hiển thị sau khi shop duyệt.');
          }}
        />
      )}
      {editing && (
        <ReviewFormModal
          target={{
            orderCode: order.code,
            productId: editing.productId,
            productName: editing.productName ?? '',
            thumbnailUrl: editing.productThumbnail,
            variantName: editing.variantName,
          }}
          review={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            if (mine.data) {
              mine.setData({ ...mine.data, content: mine.data.content.map((r) => (r.id === saved.id ? saved : r)) });
            }
            setEditing(null);
            toast.success('Đã lưu. Đánh giá sẽ hiển thị lại sau khi shop duyệt.');
          }}
        />
      )}
    </>
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

      {o.status === 'DELIVERED' && (
        <section className="card">
          <h3 className="card-title">Đánh giá sản phẩm</h3>
          <OrderReviews order={o} />
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
