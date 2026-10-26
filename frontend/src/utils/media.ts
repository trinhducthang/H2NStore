/** Giới hạn đính kèm đánh giá, khớp với backend (ReviewService, ImageValidator, VideoValidator) */
export const REVIEW_MAX_IMAGES = 5;
export const REVIEW_MAX_VIDEOS = 1;
export const REVIEW_MAX_VIDEO_MB = 30;
export const REVIEW_MAX_VIDEO_SECONDS = 60;

const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.85;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Không đọc được ảnh “${file.name}” (chỉ nhận JPG, PNG, WebP)`));
    };
    img.src = url;
  });
}

/**
 * Thu nhỏ ảnh chụp điện thoại (thường 3-10MB) về cạnh dài 1600px, JPEG 85% trước khi gửi.
 * Vẽ lại qua canvas nên bỏ luôn EXIF (vị trí GPS...), trình duyệt đã xoay ảnh theo EXIF khi vẽ.
 * Ảnh không đọc được thì báo lỗi; canvas lỗi thì gửi ảnh gốc.
 */
export async function compressImage(file: File): Promise<File> {
  const img = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // Ảnh PNG trong suốt: nền trắng thay vì đen khi chuyển sang JPEG
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'anh'}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Thời lượng video (giây); null nếu trình duyệt không đọc được (thường là định dạng không phát được). */
export function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}
