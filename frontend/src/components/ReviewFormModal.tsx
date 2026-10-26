import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { accountApi } from '../api/account';
import { errorMessage } from '../api/client';
import type { Review, ReviewMedia } from '../api/types';
import { formatDateTime } from '../utils/format';
import {
  compressImage,
  REVIEW_MAX_IMAGES,
  REVIEW_MAX_VIDEO_MB,
  REVIEW_MAX_VIDEO_SECONDS,
  REVIEW_MAX_VIDEOS,
  videoDuration,
} from '../utils/media';
import { Modal } from './Modal';
import { ProductThumb } from './ProductThumb';
import { StarPicker } from './Stars';

const RATING_LABEL = ['', 'Rất tệ', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Tuyệt vời'];
const MAX_CONTENT = 2000;

/** Sản phẩm cần đánh giá */
export interface ReviewTarget {
  orderCode: string;
  productId: number;
  productName: string;
  thumbnailUrl?: string | null;
  variantName?: string | null;
}

interface NewFile {
  file: File;
  preview: string;
  type: ReviewMedia['type'];
}

/** Gửi mới (review = undefined) hoặc sửa đánh giá (1 lần). */
export function ReviewFormModal({
  target,
  review,
  onClose,
  onSaved,
}: {
  target: ReviewTarget;
  review?: Review;
  onClose: () => void;
  onSaved: (review: Review) => void;
}) {
  const editing = Boolean(review);
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [content, setContent] = useState(review?.content ?? '');
  const [kept, setKept] = useState<ReviewMedia[]>(review?.media ?? []);
  const [added, setAdded] = useState<NewFile[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  // Thu hồi URL xem trước khi đóng form
  const addedRef = useRef(added);
  useEffect(() => {
    addedRef.current = added;
  }, [added]);
  useEffect(() => () => addedRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  const imageCount = kept.filter((m) => m.type === 'IMAGE').length + added.filter((f) => f.type === 'IMAGE').length;
  const videoCount = kept.filter((m) => m.type === 'VIDEO').length + added.filter((f) => f.type === 'VIDEO').length;
  const busy = preparing || progress !== null;

  const pickImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    const room = REVIEW_MAX_IMAGES - imageCount;
    if (files.length > room) {
      setError(`Tối đa ${REVIEW_MAX_IMAGES} ảnh, bạn chỉ thêm được ${room} ảnh nữa`);
    }
    setPreparing(true);
    const next: NewFile[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      try {
        const compressed = await compressImage(file);
        next.push({ file: compressed, preview: URL.createObjectURL(compressed), type: 'IMAGE' });
      } catch (err) {
        setError(errorMessage(err));
      }
    }
    setAdded((prev) => [...prev, ...next]);
    setPreparing(false);
  };

  const pickVideo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (file.size > REVIEW_MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Video tối đa ${REVIEW_MAX_VIDEO_MB}MB. Hãy quay ngắn hơn hoặc chọn chất lượng 720p.`);
      return;
    }
    setPreparing(true);
    const duration = await videoDuration(file);
    setPreparing(false);
    if (duration === null) {
      setError('Trình duyệt không đọc được video này. Hãy chọn video MP4 (H.264) hoặc WebM.');
      return;
    }
    if (duration > REVIEW_MAX_VIDEO_SECONDS + 0.5) {
      setError(`Video tối đa ${REVIEW_MAX_VIDEO_SECONDS} giây (video này dài ${Math.round(duration)} giây).`);
      return;
    }
    setAdded((prev) => [...prev, { file, preview: URL.createObjectURL(file), type: 'VIDEO' }]);
  };

  const removeAdded = (item: NewFile) => {
    URL.revokeObjectURL(item.preview);
    setAdded((prev) => prev.filter((f) => f !== item));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setProgress(0);
    // Video trước để hiện đầu tiên giống khi xem
    const files = [...added].sort((a, b) => Number(a.type === 'IMAGE') - Number(b.type === 'IMAGE')).map((f) => f.file);
    try {
      const text = content.trim() || null;
      const saved = review
        ? await accountApi.updateReview(
            review.id,
            { rating, content: text, keepMediaIds: kept.map((m) => m.id) },
            files,
            setProgress,
          )
        : await accountApi.createReview(
            { orderCode: target.orderCode, productId: target.productId, rating, content: text },
            files,
            setProgress,
          );
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setProgress(null);
    }
  };

  const tiles = [
    ...kept.map((m) => ({ key: `m${m.id}`, type: m.type, src: m.url, remove: () => setKept((p) => p.filter((x) => x !== m)) })),
    ...added.map((f) => ({ key: f.preview, type: f.type, src: f.preview, remove: () => removeAdded(f) })),
  ].sort((a, b) => Number(a.type === 'IMAGE') - Number(b.type === 'IMAGE'));

  return (
    <Modal title={editing ? 'Sửa đánh giá' : 'Đánh giá sản phẩm'} onClose={busy ? () => undefined : onClose}>
      <form className="form review-modal" onSubmit={submit}>
        <div className="review-target">
          <ProductThumb url={target.thumbnailUrl} alt={target.productName} className="review-target-thumb" />
          <div>
            <strong>{target.productName}</strong>
            {target.variantName && <p className="muted small">Phân loại: {target.variantName}</p>}
            <p className="muted small">Đơn {target.orderCode}</p>
          </div>
        </div>

        <div className="review-rating-row">
          <StarPicker value={rating} onChange={setRating} />
          <span className="review-rating-label">{RATING_LABEL[rating]}</span>
        </div>

        <label className="field">
          <span className="field-label">Nhận xét</span>
          <textarea
            rows={4}
            maxLength={MAX_CONTENT}
            value={content}
            placeholder="Sản phẩm có đúng mô tả không? Chất lượng, đóng gói, giao hàng thế nào?"
            onChange={(e) => setContent(e.target.value)}
          />
          <span className="muted small review-counter">
            {content.length}/{MAX_CONTENT}
          </span>
        </label>

        <div className="field">
          <span className="field-label">
            Ảnh, video thực tế <span className="muted small">(không bắt buộc)</span>
          </span>
          <ul className="review-upload-grid">
            {tiles.map((t) => (
              <li key={t.key} className="review-upload-tile">
                {t.type === 'VIDEO' ? (
                  <>
                    <video src={t.src} preload="metadata" muted playsInline />
                    <span className="review-media-play" aria-hidden="true">
                      ▶
                    </span>
                  </>
                ) : (
                  <img src={t.src} alt="" />
                )}
                <button
                  type="button"
                  className="review-media-remove"
                  aria-label="Bỏ file này"
                  disabled={busy}
                  onClick={t.remove}
                >
                  ×
                </button>
              </li>
            ))}
            {imageCount < REVIEW_MAX_IMAGES && (
              <li>
                <button
                  type="button"
                  className="review-upload-add"
                  disabled={busy}
                  onClick={() => imageInput.current?.click()}
                >
                  <span aria-hidden="true">📷</span>
                  Thêm ảnh
                  <span className="small muted">
                    {imageCount}/{REVIEW_MAX_IMAGES}
                  </span>
                </button>
              </li>
            )}
            {videoCount < REVIEW_MAX_VIDEOS && (
              <li>
                <button
                  type="button"
                  className="review-upload-add"
                  disabled={busy}
                  onClick={() => videoInput.current?.click()}
                >
                  <span aria-hidden="true">🎬</span>
                  Thêm video
                  <span className="small muted">≤ {REVIEW_MAX_VIDEO_SECONDS}s</span>
                </button>
              </li>
            )}
          </ul>
          <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={pickImages} />
          <input ref={videoInput} type="file" accept="video/*" hidden onChange={pickVideo} />
          <p className="muted small">
            Tối đa {REVIEW_MAX_IMAGES} ảnh và {REVIEW_MAX_VIDEOS} video ({REVIEW_MAX_VIDEO_SECONDS} giây,{' '}
            {REVIEW_MAX_VIDEO_MB}MB).
            {preparing && ' Đang xử lý...'}
          </p>
        </div>

        <p className="muted small">
          {editing
            ? `Bạn chỉ sửa được 1 lần${
                review?.editableUntil ? ` (trước ${formatDateTime(review.editableUntil)})` : ''
              }. Sau khi sửa, đánh giá sẽ chờ shop duyệt lại.`
            : 'Đánh giá hiển thị công khai sau khi shop duyệt. Tên của bạn sẽ được che bớt.'}
        </p>

        {progress !== null && (
          <div className="upload-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        {error && <p className="field-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Đóng
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {progress !== null
              ? progress < 1
                ? `Đang tải lên ${Math.round(progress * 100)}%`
                : 'Đang lưu...'
              : editing
                ? 'Lưu thay đổi'
                : 'Gửi đánh giá'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
