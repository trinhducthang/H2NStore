const env = import.meta.env;

/** Để trống thì dùng giá trị mặc định; đặt "-" để ẩn hẳn mục đó */
function setting(value: string | undefined, fallback: string): string {
  if (value?.trim() === '-') return '';
  return value || fallback;
}

export const SHOP_NAME = env.VITE_SHOP_NAME || 'H2N Store';
export const SHOP_TAGLINE = setting(env.VITE_SHOP_TAGLINE, 'Say it with flowers');
export const SHOP_HOTLINE = env.VITE_SHOP_HOTLINE || '0912 345 678';
export const SHOP_ADDRESS = env.VITE_SHOP_ADDRESS || 'Hà Nội';

/** Mạng xã hội trên header; giá trị rỗng thì biểu tượng đó không hiện */
export const SOCIAL_LINKS = {
  facebook: setting(env.VITE_FACEBOOK_URL, 'https://www.facebook.com/'),
  twitter: setting(env.VITE_TWITTER_URL, 'https://x.com/'),
  instagram: setting(env.VITE_INSTAGRAM_URL, 'https://www.instagram.com/'),
};

const isUrl = (value: string) => /^https?:\/\//.test(value);

/** Nút chat Zalo: số điện thoại ("0912 345 678" -> zalo.me/0912345678) hoặc link; trống = hotline, "-" = ẩn */
export const ZALO_URL = (() => {
  const value = setting(env.VITE_ZALO, SHOP_HOTLINE).trim();
  if (!value) return '';
  return isUrl(value) ? value : `https://zalo.me/${value.replace(/\D/g, '')}`;
})();

/**
 * Nút chat Messenger: tên trang Facebook (-> m.me/<tên>) hoặc link đầy đủ; "-" = ẩn nút.
 * Để trống thì lấy trang từ VITE_FACEBOOK_URL, không có thì mở messenger.com.
 */
export const MESSENGER_URL = (() => {
  const value = env.VITE_MESSENGER?.trim();
  if (value === '-') return '';
  const page =
    value ||
    SOCIAL_LINKS.facebook.match(/facebook\.com\/profile\.php\?id=(\d+)/)?.[1] ||
    SOCIAL_LINKS.facebook.match(/facebook\.com\/([\w.-]+)\/?$/)?.[1];
  if (!page) return 'https://www.messenger.com/';
  return isUrl(page) ? page : `https://m.me/${page.replace(/^@/, '')}`;
})();

/**
 * Cam kết dịch vụ ở cột trái trang chủ (màn hình rộng).
 * Hệ thống CHƯA tự áp dụng freeship hay đổi trả: sửa cho đúng chính sách thật của shop.
 */
export const SERVICE_PERKS: { icon: string; title: string; note: string }[] = [
  { icon: '🚚', title: 'Freeship nội thành', note: 'Đơn từ 300K' },
  { icon: '↻', title: 'Đổi trả 7 ngày', note: 'Với đồ gia dụng' },
];
export const SUPPORT_HOURS = 'Hỗ trợ 8h – 22h';

/** Ô ưu đãi cho khách chưa đăng nhập ở cột phải trang chủ; nhớ tạo mã giảm giá tương ứng trong trang quản trị */
export const MEMBER_OFFER = { title: 'Giảm 50K', note: 'cho đơn đầu tiên' };

/** Số lượng tối đa mỗi sản phẩm trong giỏ / đơn (khớp backend) */
export const MAX_QUANTITY = 20;
/** Số dòng tối đa trong giỏ / đơn */
export const MAX_CART_LINES = 20;
