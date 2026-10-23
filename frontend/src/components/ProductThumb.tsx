import { useState } from 'react';

/** Ảnh sản phẩm; không có ảnh (hoặc ảnh lỗi) thì hiện placeholder gradient + 🌸 */
export function ProductThumb({
  url,
  alt,
  className = '',
  eager = false,
}: {
  url?: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  // Nhớ URL bị lỗi (không dùng boolean) để khi đổi sang ảnh khác thì thử tải lại
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) {
    return (
      <div className={`thumb thumb-placeholder ${className}`} role="img" aria-label={alt}>
        <span aria-hidden="true">🌸</span>
      </div>
    );
  }
  return (
    <img
      className={`thumb ${className}`}
      src={url}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailedUrl(url)}
    />
  );
}
