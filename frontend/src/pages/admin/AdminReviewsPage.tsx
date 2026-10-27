import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { errorMessage } from '../../api/client';
import type { Review, ReviewMedia, ReviewStatus } from '../../api/types';
import { ReviewStatusBadge } from '../../components/Badge';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { PromptModal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { ProductThumb } from '../../components/ProductThumb';
import { ReviewCard } from '../../components/ReviewCard';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { REVIEW_STATUS_LABEL } from '../../utils/format';

const STATUSES = Object.keys(REVIEW_STATUS_LABEL) as ReviewStatus[];

export function AdminReviewsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<ReviewStatus | ''>('PENDING');
  const [rating, setRating] = useState<number | ''>('');
  const [withMedia, setWithMedia] = useState(false);
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyMediaId, setBusyMediaId] = useState<number | null>(null);
  const [replying, setReplying] = useState<Review | null>(null);
  const reviews = useAsync(
    () => adminApi.reviews({ status, rating, withMedia, page, size: 20 }),
    [status, rating, withMedia, page],
  );

  const replace = (updated: Review) => {
    if (reviews.data) {
      reviews.setData({
        ...reviews.data,
        content: reviews.data.content.map((x) => (x.id === updated.id ? updated : x)),
      });
    }
  };

  const change = async (r: Review, next: ReviewStatus) => {
    setBusyId(r.id);
    try {
      replace(await adminApi.setReviewStatus(r.id, next));
      toast.success(`Đã chuyển đánh giá sang “${REVIEW_STATUS_LABEL[next]}”`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const deleteMedia = async (r: Review, m: ReviewMedia) => {
    if (!window.confirm(`Gỡ ${m.type === 'VIDEO' ? 'video' : 'ảnh'} này khỏi đánh giá? Không thể hoàn tác.`)) return;
    setBusyMediaId(m.id);
    try {
      replace(await adminApi.deleteReviewMedia(r.id, m.id));
      toast.success('Đã gỡ file');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyMediaId(null);
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1>Đánh giá</h1>
      </div>
      <div className="filter-bar">
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${status === '' ? 'chip-active' : ''}`}
            onClick={() => {
              setStatus('');
              setPage(0);
            }}
          >
            Tất cả
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${status === s ? 'chip-active' : ''}`}
              onClick={() => {
                setStatus(s);
                setPage(0);
              }}
            >
              {REVIEW_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="filter-inline">
          <select
            aria-label="Lọc theo số sao"
            value={rating}
            onChange={(e) => {
              setRating(e.target.value ? Number(e.target.value) : '');
              setPage(0);
            }}
          >
            <option value="">Mọi số sao</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} sao
              </option>
            ))}
          </select>
          <label className="check">
            <input
              type="checkbox"
              checked={withMedia}
              onChange={(e) => {
                setWithMedia(e.target.checked);
                setPage(0);
              }}
            />
            Có ảnh/video
          </label>
        </div>
      </div>

      {reviews.loading && !reviews.data && <Loading />}
      {reviews.error && <ErrorBox message={reviews.error} onRetry={reviews.reload} />}
      {reviews.data && reviews.data.content.length === 0 && <EmptyState icon="⭐" title="Không có đánh giá" />}
      {reviews.data && reviews.data.content.length > 0 && (
        <div className={reviews.loading ? 'is-refreshing' : ''}>
          <div className="review-admin-list">
            {reviews.data.content.map((r) => (
              <div key={r.id} className="card review-admin">
                <div className="review-admin-product">
                  <ProductThumb url={r.productThumbnail} alt={r.productName ?? ''} className="my-review-thumb" />
                  <div>
                    <Link to={`/admin/products/${r.productId}`} className="link-more">
                      {r.productName ?? `Sản phẩm #${r.productId}`}
                    </Link>
                    {r.orderCode && (
                      <p className="muted small">
                        Đơn <Link to={`/admin/orders/${r.orderCode}`}>{r.orderCode}</Link>
                      </p>
                    )}
                  </div>
                </div>
                <ReviewCard
                  review={r}
                  extra={<ReviewStatusBadge status={r.status} />}
                  onDeleteMedia={(m) => deleteMedia(r, m)}
                  busyMediaId={busyMediaId}
                />
                <div className="row-actions">
                  {r.status !== 'APPROVED' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={busyId === r.id}
                      onClick={() => change(r, 'APPROVED')}
                    >
                      Duyệt
                    </button>
                  )}
                  {r.status !== 'HIDDEN' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      disabled={busyId === r.id}
                      onClick={() => change(r, 'HIDDEN')}
                    >
                      Ẩn
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setReplying(r)}>
                    {r.reply ? 'Sửa phản hồi' : 'Phản hồi'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={reviews.data.page} totalPages={reviews.data.totalPages} onChange={setPage} />
        </div>
      )}

      {replying && (
        <PromptModal
          title="Phản hồi đánh giá"
          label="Phản hồi của shop"
          multiline
          initialValue={replying.reply ?? ''}
          placeholder="Cảm ơn bạn đã tin tưởng shop..."
          description="Phản hồi hiển thị công khai dưới đánh giá. Để trống để gỡ phản hồi."
          confirmText="Lưu phản hồi"
          onCancel={() => setReplying(null)}
          onSubmit={async (text) => {
            replace(await adminApi.replyReview(replying.id, text));
            setReplying(null);
            toast.success(text ? 'Đã lưu phản hồi' : 'Đã gỡ phản hồi');
          }}
        />
      )}
    </>
  );
}
