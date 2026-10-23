import type { Category } from '../api/types';
import { categoryLook, type CategoryLook } from './categoryStyle';

export const categoryUrl = (slug: string) => `/products?categorySlug=${slug}`;

export interface CategoryMenuLink {
  label: string;
  slug: string;
  to: string;
  icon: string;
  tint: string;
}

/** Một nhóm của menu danh mục: một ngành hàng, "Quà theo dịp" hoặc "Đang giảm giá" */
export interface CategoryMenuGroup extends CategoryLook {
  key: string;
  label: string;
  /** Trang của cả nhóm; "Quà theo dịp" không có trang riêng */
  to?: string;
  hot?: boolean;
  children: CategoryMenuLink[];
}

const OCCASION_LOOK: CategoryLook = { icon: '🎁', tint: '#fde4ec', accent: '#c2185b', tagline: 'Quà tặng ý nghĩa' };
const SALE_LOOK: CategoryLook = { icon: '🔥', tint: '#ffe8de', accent: '#e8590c', tagline: 'Giá tốt mỗi ngày' };

/** Menu danh mục dùng chung cho cột trái trang chủ (máy tính) và bảng danh mục (điện thoại) */
export function buildCategoryMenu(categories: Category[]): CategoryMenuGroup[] {
  const groups: CategoryMenuGroup[] = categories
    .filter((c) => c.type === 'DEPARTMENT')
    .map((c) => {
      const look = categoryLook(c.slug);
      return {
        ...look,
        key: c.slug,
        label: c.name,
        to: categoryUrl(c.slug),
        children: (c.children ?? []).map((ch) => ({
          label: ch.name,
          slug: ch.slug,
          to: categoryUrl(ch.slug),
          icon: categoryLook(ch.slug, look).icon,
          tint: look.tint,
        })),
      };
    });
  const occasions = categories.filter((c) => c.type === 'OCCASION');
  if (occasions.length) {
    groups.push({
      ...OCCASION_LOOK,
      key: 'occasions',
      label: 'Quà theo dịp',
      children: occasions.map((c) => ({
        label: c.name,
        slug: c.slug,
        to: categoryUrl(c.slug),
        icon: categoryLook(c.slug, OCCASION_LOOK).icon,
        tint: OCCASION_LOOK.tint,
      })),
    });
  }
  groups.push({ ...SALE_LOOK, key: 'sale', label: 'Đang giảm giá', to: '/products?onSale=true', hot: true, children: [] });
  return groups;
}
