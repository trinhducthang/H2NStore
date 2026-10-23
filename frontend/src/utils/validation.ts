/** Số điện thoại di động VN, cùng regex với backend */
export const PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
export const PHONE_MESSAGE = 'Số điện thoại không hợp lệ';
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.replace(/[\s.-]/g, ''));
}

/** Bỏ dấu cách/dấu chấm người dùng gõ trong số điện thoại */
export function cleanPhone(phone: string): string {
  return phone.replace(/[\s.-]/g, '');
}

/** UUID cho Idempotency-Key; crypto.randomUUID chỉ có trong secure context nên có phương án dự phòng. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // rơi xuống phương án dưới
    }
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
