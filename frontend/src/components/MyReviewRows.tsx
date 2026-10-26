import { Link } from 'react-router-dom';
import type { PendingReview, Review } from '../api/types';
import { formatDate } from '../utils/format';
import { ReviewStatusBadge } from './Badge';
import { ProductThumb } from './ProductThumb';
import { ReviewCard } from './ReviewCard';

function ProductName({ name, slug }: { name: string; slug?: string | null }) {
  return slug ? (
    <Link to={`/products/${slug}`} className="my-review-name">
      {name}
    </Link>
  ) : (
    <strong className="my-review-name">{name}</strong>
  );
}

/** Sản phẩm đã nhận, chưa đánh giá. showOrder: hiện mã đơn (ẩn khi đang ở trang chi tiết đơn đó). */
export function PendingReviewRow({
  item,
  showOrder = true,
  onReview,
}: {
  item: PendingReview;
  showOrder?: boolean;
  onReview: () => void;
}) {
  return (
    <div className="my-review-row">
      <ProductThumb url={item.thumbnailUrl} alt={item.productName} className="my-review-thumb" />
      <div className="my-review-main">
        <ProductName name={item.productName} slug={item.productSlug} />
        {item.variantName && <p className="muted small">Phân loại: {item.variantName}</p>}
        <p className="muted small">
          {showOrder && (
            <>
              Đơn <Link to={`/account/orders/${item.orderCode}`}>{item.orderCode}</Link> ·{' '}
            </>
          )}
          Nhận hàng {formatDate(item.deliveredAt)} · <span className="accent">Hạn đánh giá {formatDate(item.deadline)}</span>
        </p>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={onReview}>
        Đánh giá
      </button>
    </div>
  );
}

/** Đánh giá khách đã gửi, kèm trạng thái duyệt và nút sửa (nếu còn được sửa). */
export function MyReviewRow({
  review,
  showOrder = true,
  onEdit,
}: {
  review: Review;
  showOrder?: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="my-review-row">
      <ProductThumb
        url={review.productThumbnail}
        alt={review.productName ?? 'Sản phẩm'}
        className="my-review-thumb"
      />
      <div className="my-review-main">
        <ProductName name={review.productName ?? `Sản phẩm #${review.productId}`} slug={review.productSlug} />
        {showOrder && review.orderCode && (
          <p className="muted small">
            Đơn <Link to={`/account/orders/${review.orderCode}`}>{review.orderCode}</Link>
          </p>
        )}
        <ReviewCard review={review} extra={<ReviewStatusBadge status={review.status} />} />
        {review.status === 'PENDING' && <p className="muted small">Đánh giá sẽ hiển thị sau khi shop duyệt.</p>}
        {review.status === 'HIDDEN' && (
          <p className="muted small">Đánh giá đang bị ẩn do chưa phù hợp tiêu chuẩn cộng đồng.</p>
        )}
      </div>
      {review.editable && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          title={review.editableUntil ? `Sửa được 1 lần, trước ${formatDate(review.editableUntil)}` : undefined}
          onClick={onEdit}
        >
          Sửa
        </button>
      )}
    </div>
  );
}
