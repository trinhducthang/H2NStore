import { request } from './client';
import type {
  Category,
  CategoryType,
  DeliveryZone,
  PageResponse,
  ProductDetail,
  ProductSummary,
  PublicBanner,
  RatingBreakdown,
  Review,
  SlotAvailability,
  ValidateCouponResponse,
} from './types';

export type ProductSort = 'newest' | 'bestseller' | 'price,asc' | 'price,desc';

export interface ProductQuery {
  q?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Chỉ sản phẩm đang giảm giá */
  onSale?: boolean;
  sort?: ProductSort;
  page?: number;
  size?: number;
}

export const catalogApi = {
  banners: () => request<PublicBanner[]>('/api/public/banners'),

  categories: (type?: CategoryType) => request<Category[]>('/api/public/categories', { query: { type } }),

  products: (query: ProductQuery) =>
    request<PageResponse<ProductSummary>>('/api/public/products', { query: { ...query } }),

  product: (slug: string) => request<ProductDetail>(`/api/public/products/${encodeURIComponent(slug)}`),

  related: (slug: string) => request<ProductSummary[]>(`/api/public/products/${encodeURIComponent(slug)}/related`),

  /** rating: lọc theo số sao; withMedia: chỉ đánh giá có ảnh/video */
  reviews: (slug: string, query: { rating?: number | null; withMedia?: boolean; page?: number; size?: number }) =>
    request<PageResponse<Review>>(`/api/public/products/${encodeURIComponent(slug)}/reviews`, {
      query: { ...query, withMedia: query.withMedia || undefined },
    }),

  reviewSummary: (slug: string) =>
    request<RatingBreakdown>(`/api/public/products/${encodeURIComponent(slug)}/reviews/summary`),

  zones: () => request<DeliveryZone[]>('/api/public/delivery/zones'),

  slots: (date: string, zoneId?: number | null) =>
    request<SlotAvailability[]>('/api/public/delivery/slots', { query: { date, zoneId } }),

  validateCoupon: (code: string, subtotal: number) =>
    request<ValidateCouponResponse>('/api/public/coupons/validate', { method: 'POST', body: { code, subtotal } }),
};
