/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Tên shop hiển thị trên header/footer */
  readonly VITE_SHOP_NAME?: string;
  /** Slogan nhỏ dưới logo */
  readonly VITE_SHOP_TAGLINE?: string;
  /** Hotline hiển thị ở dải hotline và footer */
  readonly VITE_SHOP_HOTLINE?: string;
  /** Địa chỉ cửa hàng hiển thị ở dải hotline và footer */
  readonly VITE_SHOP_ADDRESS?: string;
  /** Link mạng xã hội trên header; đặt "-" để ẩn biểu tượng */
  readonly VITE_FACEBOOK_URL?: string;
  readonly VITE_TWITTER_URL?: string;
  readonly VITE_INSTAGRAM_URL?: string;
  /** Nút chat Zalo: số điện thoại hoặc link zalo.me; trống = hotline, "-" = ẩn */
  readonly VITE_ZALO?: string;
  /** Nút chat Messenger: tên trang Facebook hoặc link m.me; trống = lấy từ VITE_FACEBOOK_URL, "-" = ẩn */
  readonly VITE_MESSENGER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
