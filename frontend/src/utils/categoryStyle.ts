/** Cách hiển thị một danh mục: biểu tượng, màu nền nhạt, màu đậm (thẻ khuyến mãi), câu khẩu hiệu */
export interface CategoryLook {
  icon: string;
  tint: string;
  accent: string;
  tagline: string;
}

const DEFAULT_LOOK: CategoryLook = { icon: '🛍️', tint: '#fdeef3', accent: '#b0305a', tagline: 'Ưu đãi mỗi ngày' };

/**
 * Chọn theo cụm từ trong slug (khớp nguyên cụm giữa các dấu "-"), cụm đứng trước được ưu tiên.
 * Danh mục admin tự thêm không khớp thì dùng giá trị mặc định.
 */
const LOOKS: [string, Partial<CategoryLook>][] = [
  // Dịp tặng quà
  ['sinh-nhat', { icon: '🎂' }],
  ['tan-gia', { icon: '🏡' }],
  ['khai-truong', { icon: '🎉' }],
  ['chia-buon', { icon: '🕊️' }],
  ['tinh-yeu', { icon: '💝' }],
  ['nang', { icon: '💝' }],
  ['cho-be', { icon: '🎈' }],
  // Danh mục con: đứng trước ngành hàng vì slug con hay chứa tên ngành (VD dien-gia-dung)
  ['nha-bep', { icon: '🍳' }],
  ['dien-gia-dung', { icon: '🔌' }],
  ['phong-tam', { icon: '🛁' }],
  ['don-dep', { icon: '🧹' }],
  ['giao-duc', { icon: '🧮' }],
  ['lap-rap', { icon: '🧩' }],
  ['thu-bong', { icon: '🧸' }],
  ['xe', { icon: '🚗' }],
  ['an-dam', { icon: '🥣' }],
  ['cham-soc', { icon: '🧴' }],
  ['quan-ao', { icon: '👕' }],
  ['but', { icon: '🖊️' }],
  ['so-giay', { icon: '📒' }],
  ['hoc-tap', { icon: '🎒' }],
  // Ngành hàng
  ['hoa', { icon: '💐', tint: '#fde4ec', accent: '#c2185b', tagline: 'Hoa tươi mỗi ngày' }],
  ['gia-dung', { icon: '🏠', tint: '#e2effd', accent: '#1d5fb8', tagline: 'Bếp đẹp mỗi ngày' }],
  ['do-choi', { icon: '🧸', tint: '#fff0d4', accent: '#e8590c', tagline: 'Vui chơi thỏa thích' }],
  ['me-va-be', { icon: '🍼', tint: '#dcf3ef', accent: '#0f766e', tagline: 'Chăm bé từng ngày' }],
  ['van-phong', { icon: '✏️', tint: '#ede6fb', accent: '#6d28d9', tagline: 'Học tập hứng khởi' }],
];

/** base: giá trị khi slug không khớp (danh mục con lấy màu, icon của ngành cha) */
export function categoryLook(slug: string, base: CategoryLook = DEFAULT_LOOK): CategoryLook {
  const padded = `-${slug}-`;
  return { ...base, ...LOOKS.find(([key]) => padded.includes(`-${key}-`))?.[1] };
}
