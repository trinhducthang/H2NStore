import type {
  CategoryType,
  CouponType,
  DeliverySlot,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  ReviewStatus,
  Role,
  TransactionStatus,
} from '../api/types';

const VN_TZ = 'Asia/Ho_Chi_Minh';
const moneyFormatter = new Intl.NumberFormat('vi-VN');

/** 1250000 -> "1.250.000đ" */
export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return `${moneyFormatter.format(Math.round(amount))}đ`;
}

/** "2026-10-23" -> "23/10/2026" (không đổi múi giờ) */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** ISO-8601 có múi giờ -> "09:30 23/10/2026" theo giờ Việt Nam */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
}

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Ngày hiện tại theo giờ Việt Nam, dạng yyyy-MM-dd */
export function todayVN(): string {
  return isoDateFormatter.format(new Date());
}

/** Cộng ngày cho chuỗi yyyy-MM-dd */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Ngày đầu tháng hiện tại (giờ VN) */
export function firstDayOfMonthVN(): string {
  return `${todayVN().slice(0, 8)}01`;
}

/** ISO có múi giờ -> giá trị cho <input type="datetime-local"> theo giờ VN */
export function toDateTimeLocalVN(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 16);
}

/** Giá trị <input type="datetime-local"> (hiểu là giờ VN) -> ISO có offset +07:00 */
export function fromDateTimeLocalVN(value: string): string | null {
  if (!value) return null;
  return `${value.length === 16 ? `${value}:00` : value}+07:00`;
}

export function pluralize(count: number, unit: string): string {
  return `${moneyFormatter.format(count)} ${unit}`;
}

// ------------------------------------------------------------------ nhãn tiếng Việt

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  ARRANGING: 'Đang chuẩn bị hàng',
  DELIVERING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  REFUNDED: 'Đã hoàn tiền',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  COD: 'Thanh toán khi nhận hàng (COD)',
  SEPAY: 'Chuyển khoản QR (SePay)',
};

export const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  MATCHED: 'Đã khớp đơn',
  PARTIAL: 'Thiếu tiền',
  UNMATCHED: 'Chưa khớp đơn',
  NEEDS_REFUND: 'Cần hoàn tiền',
  IGNORED: 'Bỏ qua / đã xử lý',
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  ACTIVE: 'Đang bán',
  HIDDEN: 'Đang ẩn',
  OUT_OF_STOCK: 'Hết hàng',
};

export const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = {
  DEPARTMENT: 'Ngành hàng',
  OCCASION: 'Theo dịp',
  FLOWER_TYPE: 'Loại hoa',
  STYLE: 'Kiểu dáng',
};

/** Thứ tự các nhóm danh mục ở menu, bộ lọc và trang quản trị */
export const CATEGORY_TYPES = Object.keys(CATEGORY_TYPE_LABEL) as CategoryType[];

export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên',
  ADMIN: 'Quản trị viên',
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  HIDDEN: 'Đã ẩn',
};

export const REVIEW_STATUS_TONE: Record<ReviewStatus, Tone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  HIDDEN: 'neutral',
};

export const COUPON_TYPE_LABEL: Record<CouponType, string> = {
  PERCENT: 'Giảm theo %',
  FIXED: 'Giảm số tiền',
};

export const SLOT_LABEL: Record<DeliverySlot, string> = {
  SLOT_08_10: '08:00 - 10:00',
  SLOT_10_12: '10:00 - 12:00',
  SLOT_14_16: '14:00 - 16:00',
  SLOT_16_18: '16:00 - 18:00',
  SLOT_18_20: '18:00 - 20:00',
  EXPRESS: 'Giao nhanh 2 - 3 giờ',
};

/** Tông màu badge theo trạng thái */
export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'primary';

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  ARRANGING: 'primary',
  DELIVERING: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  UNPAID: 'warning',
  PAID: 'success',
  REFUNDED: 'neutral',
};

export const TRANSACTION_STATUS_TONE: Record<TransactionStatus, Tone> = {
  MATCHED: 'success',
  PARTIAL: 'warning',
  UNMATCHED: 'danger',
  NEEDS_REFUND: 'danger',
  IGNORED: 'neutral',
};
