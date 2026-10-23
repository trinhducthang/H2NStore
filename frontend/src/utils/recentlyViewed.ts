import type { ProductSummary } from '../api/types';

const KEY = 'h2n.recent';
const MAX = 10;

export type RecentProduct = Pick<ProductSummary, 'id' | 'slug' | 'name' | 'thumbnailUrl' | 'price' | 'compareAtPrice'>;

/** Sản phẩm khách vừa xem, mới nhất trước (chỉ lưu trong trình duyệt của khách) */
export function getRecentlyViewed(): RecentProduct[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.filter(
      (p): p is RecentProduct => typeof p?.id === 'number' && typeof p.slug === 'string' && typeof p.name === 'string',
    );
  } catch {
    return [];
  }
}

export function addRecentlyViewed(product: RecentProduct) {
  try {
    const list = [product, ...getRecentlyViewed().filter((p) => p.id !== product.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư...): bỏ qua
  }
}
