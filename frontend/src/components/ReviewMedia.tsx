import { useState } from 'react';
import type { ReviewMedia } from '../api/types';
import { Modal } from './Modal';

/** Khung hình đầu làm ảnh xem trước (iOS Safari không tự vẽ khung đầu khi preload="metadata") */
function videoPreviewSrc(url: string): string {
  return url.includes('#') ? url : `${url}#t=0.1`;
}

/** Hàng ảnh/video thu nhỏ; bấm để xem lớn. onDelete: nút gỡ từng file (trang quản trị). */
export function ReviewMediaList({
  media,
  onDelete,
  busyId,
}: {
  media: ReviewMedia[];
  onDelete?: (m: ReviewMedia) => void;
  busyId?: number | null;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (media.length === 0) return null;

  return (
    <>
      <ul className="review-media">
        {media.map((m, i) => (
          <li key={m.id} className="review-media-item">
            <button
              type="button"
              className="review-media-thumb"
              aria-label={m.type === 'VIDEO' ? 'Xem video' : `Xem ảnh ${i + 1}`}
              onClick={() => setOpenIndex(i)}
            >
              {m.type === 'VIDEO' ? (
                <>
                  <video src={videoPreviewSrc(m.url)} preload="metadata" muted playsInline tabIndex={-1} />
                  <span className="review-media-play" aria-hidden="true">
                    ▶
                  </span>
                </>
              ) : (
                <img src={m.url} alt="" loading="lazy" />
              )}
            </button>
            {onDelete && (
              <button
                type="button"
                className="review-media-remove"
                aria-label="Gỡ file này"
                title="Gỡ file này"
                disabled={busyId === m.id}
                onClick={() => onDelete(m)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <MediaViewer media={media} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}

function MediaViewer({
  media,
  index,
  onIndex,
  onClose,
}: {
  media: ReviewMedia[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const current = media[Math.min(index, media.length - 1)];
  const go = (delta: number) => onIndex((index + delta + media.length) % media.length);
  return (
    <Modal title={`Ảnh/video đánh giá (${index + 1}/${media.length})`} onClose={onClose} wide>
      <div
        className="media-viewer"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1);
          if (e.key === 'ArrowRight') go(1);
        }}
      >
        {current.type === 'VIDEO' ? (
          <video key={current.id} src={current.url} controls autoPlay playsInline />
        ) : (
          <img key={current.id} src={current.url} alt={`Ảnh đánh giá ${index + 1}`} />
        )}
        {media.length > 1 && (
          <>
            <button type="button" className="media-viewer-nav prev" aria-label="Trước" onClick={() => go(-1)}>
              ‹
            </button>
            <button type="button" className="media-viewer-nav next" aria-label="Sau" onClick={() => go(1)}>
              ›
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
