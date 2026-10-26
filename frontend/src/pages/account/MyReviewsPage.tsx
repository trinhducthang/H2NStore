import { useState } from 'react';
import { accountApi } from '../../api/account';
import type { PendingReview, Review } from '../../api/types';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { MyReviewRow, PendingReviewRow } from '../../components/MyReviewRows';
import { Pagination } from '../../components/Pagination';
import { ReviewFormModal, type ReviewTarget } from '../../components/ReviewFormModal';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';

type Tab = 'pending' | 'done';

export function MyReviewsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(0);
  const pending = useAsync(() => accountApi.pendingReviews(), []);
  const mine = useAsync(() => accountApi.myReviews({ page, size: 10 }), [page]);
  const [writing, setWriting] = useState<PendingReview | null>(null);
  const [editing, setEditing] = useState<Review | null>(null);

  const pendingCount = pending.data?.length ?? 0;
  const doneCount = mine.data?.totalElements ?? 0;

  const targetOf = (r: Review): ReviewTarget => ({
    orderCode: r.orderCode ?? '',
    productId: r.productId,
    productName: r.productName ?? `Sản phẩm #${r.productId}`,
    thumbnailUrl: r.productThumbnail,
    variantName: r.variantName,
  });

  return (
    <>
      <div className="chip-row review-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'pending'}
          className={`chip ${tab === 'pending' ? 'chip-active' : ''}`}
          onClick={() => setTab('pending')}
        >
          Chờ đánh giá{pendingCount > 0 && ` (${pendingCount})`}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'done'}
          className={`chip ${tab === 'done' ? 'chip-active' : ''}`}
          onClick={() => setTab('done')}
        >
          Đã đánh giá{doneCount > 0 && ` (${doneCount})`}
        </button>
      </div>

      {tab === 'pending' && (
        <>
          {pending.loading && !pending.data && <Loading />}
          {pending.error && <ErrorBox message={pending.error} onRetry={pending.reload} />}
          {pending.data && pending.data.length === 0 && (
            <EmptyState icon="⭐" title="Không có sản phẩm nào chờ đánh giá">
              Sản phẩm sẽ xuất hiện ở đây sau khi đơn hàng giao thành công.
            </EmptyState>
          )}
          {pending.data && pending.data.length > 0 && (
            <div className="card my-review-list">
              {pending.data.map((item) => (
                <PendingReviewRow
                  key={`${item.orderCode}-${item.productId}`}
                  item={item}
                  onReview={() => setWriting(item)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'done' && (
        <>
          {mine.loading && !mine.data && <Loading />}
          {mine.error && <ErrorBox message={mine.error} onRetry={mine.reload} />}
          {mine.data && mine.data.content.length === 0 && <EmptyState icon="📝" title="Bạn chưa viết đánh giá nào" />}
          {mine.data && mine.data.content.length > 0 && (
            <>
              <div className={`card my-review-list ${mine.loading ? 'is-refreshing' : ''}`}>
                {mine.data.content.map((r) => (
                  <MyReviewRow key={r.id} review={r} onEdit={() => setEditing(r)} />
                ))}
              </div>
              <Pagination page={mine.data.page} totalPages={mine.data.totalPages} onChange={setPage} />
            </>
          )}
        </>
      )}

      {writing && (
        <ReviewFormModal
          target={writing}
          onClose={() => setWriting(null)}
          onSaved={() => {
            if (pending.data) {
              pending.setData(pending.data.filter((p) => p !== writing));
            }
            setWriting(null);
            mine.reload();
            toast.success('Cảm ơn bạn! Đánh giá sẽ hiển thị sau khi shop duyệt.');
          }}
        />
      )}
      {editing && (
        <ReviewFormModal
          target={targetOf(editing)}
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
