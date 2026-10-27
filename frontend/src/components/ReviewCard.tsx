import type { ReactNode } from 'react';
import type { Review, ReviewMedia } from '../api/types';
import { formatDate } from '../utils/format';
import { ReviewMediaList } from './ReviewMedia';
import { Stars } from './Stars';

/** Nội dung 1 đánh giá: người viết, sao, phân loại, nội dung, ảnh/video, phản hồi của shop. */
export function ReviewCard({
  review: r,
  extra,
  onDeleteMedia,
  busyMediaId,
}: {
  review: Review;
  /** Chèn thêm vào dòng tiêu đề (VD: badge trạng thái) */
  extra?: ReactNode;
  onDeleteMedia?: (m: ReviewMedia) => void;
  busyMediaId?: number | null;
}) {
  return (
    <div className="review-card">
      <div className="review-head">
        <strong>{r.authorName}</strong>
        <Stars value={r.rating} size="sm" />
        <span className="muted small">
          {formatDate(r.createdAt)}
          {r.edited && ' · đã chỉnh sửa'}
        </span>
        {extra}
      </div>
      {r.variantName && <p className="muted small review-variant">Phân loại: {r.variantName}</p>}
      {r.content && <p className="pre-line">{r.content}</p>}
      <ReviewMediaList media={r.media ?? []} onDelete={onDeleteMedia} busyId={busyMediaId} />
      {r.reply && (
        <div className="review-reply">
          <strong className="small">Phản hồi của shop</strong>
          <p className="pre-line">{r.reply}</p>
        </div>
      )}
    </div>
  );
}
