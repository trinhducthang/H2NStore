import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { errorMessage } from '../../api/client';
import type { Review, ReviewStatus } from '../../api/types';
import { Badge } from '../../components/Badge';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { Pagination } from '../../components/Pagination';
import { Stars } from '../../components/Stars';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { formatDateTime, REVIEW_STATUS_LABEL } from '../../utils/format';

const STATUSES = Object.keys(REVIEW_STATUS_LABEL) as ReviewStatus[];
const TONE: Record<ReviewStatus, 'warning' | 'success' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  HIDDEN: 'neutral',
};

export function AdminReviewsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<ReviewStatus | ''>('PENDING');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const reviews = useAsync(() => adminApi.reviews({ status, page, size: 20 }), [status, page]);

  const change = async (r: Review, next: ReviewStatus) => {
    setBusyId(r.id);
    try {
      const updated = await adminApi.setReviewStatus(r.id, next);
      if (reviews.data) {
        reviews.setData({
          ...reviews.data,
          content: reviews.data.content.map((x) => (x.id === r.id ? updated : x)),
        });
      }
      toast.success(`Đã chuyển đánh giá sang “${REVIEW_STATUS_LABEL[next]}”`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
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
      </div>

      {reviews.loading && !reviews.data && <Loading />}
      {reviews.error && <ErrorBox message={reviews.error} onRetry={reviews.reload} />}
      {reviews.data && reviews.data.content.length === 0 && <EmptyState icon="⭐" title="Không có đánh giá" />}
      {reviews.data && reviews.data.content.length > 0 && (
        <div className={reviews.loading ? 'is-refreshing' : ''}>
          <div className="review-admin-list">
            {reviews.data.content.map((r) => (
              <div key={r.id} className="card review-admin">
                <div className="review-head">
                  <strong>{r.authorName}</strong>
                  <Stars value={r.rating} size="sm" />
                  <Badge tone={TONE[r.status]}>{REVIEW_STATUS_LABEL[r.status]}</Badge>
                  <span className="muted small">{formatDateTime(r.createdAt)}</span>
                </div>
                <p className="pre-line">{r.content || <span className="muted">(không có nội dung)</span>}</p>
                <div className="row-actions">
                  <Link to={`/admin/products/${r.productId}`} className="link-more small">
                    Sản phẩm #{r.productId}
                  </Link>
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
                </div>
              </div>
            ))}
          </div>
          <Pagination page={reviews.data.page} totalPages={reviews.data.totalPages} onChange={setPage} />
        </div>
      )}
    </>
  );
}
