import { request, requestBlob } from './client';
import type {
  AdminCreateUserRequest,
  AdminProductSummary,
  Banner,
  BannerRequest,
  Category,
  CategoryRequest,
  Coupon,
  CouponRequest,
  DeliveryZone,
  Order,
  OrderStatus,
  OrderSummary,
  PageResponse,
  PaymentStatus,
  PaymentTransaction,
  ProductDetail,
  ProductImage,
  ProductStatus,
  ProductUpsertRequest,
  ReportSummary,
  Review,
  ReviewStatus,
  Role,
  TransactionStatus,
  User,
  ZoneRequest,
} from './types';

export interface AdminOrderQuery {
  status?: OrderStatus | '';
  paymentStatus?: PaymentStatus | '';
  deliveryDate?: string;
  q?: string;
  page?: number;
  size?: number;
}

export const adminApi = {
  // ---------------------------------------------------------------- đơn hàng
  orders: (query: AdminOrderQuery) =>
    request<PageResponse<OrderSummary>>('/api/admin/orders', { query: { ...query } }),

  order: (code: string) => request<Order>(`/api/admin/orders/${encodeURIComponent(code)}`),

  changeStatus: (code: string, toStatus: OrderStatus, reason: string | null, version: number) =>
    request<Order>(`/api/admin/orders/${encodeURIComponent(code)}/status`, {
      method: 'PATCH',
      body: { toStatus, reason, version },
    }),

  updatePayment: (code: string, paymentStatus: PaymentStatus, note: string | null, version: number) =>
    request<Order>(`/api/admin/orders/${encodeURIComponent(code)}/payment`, {
      method: 'PATCH',
      body: { paymentStatus, note, version },
    }),

  uploadOrderPhoto: (code: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<Order>(`/api/admin/orders/${encodeURIComponent(code)}/photo`, { method: 'POST', body: form });
  },

  // ---------------------------------------------------------------- đối soát SePay
  transactions: (query: { status?: TransactionStatus | ''; q?: string; page?: number; size?: number }) =>
    request<PageResponse<PaymentTransaction>>('/api/admin/payments/transactions', { query: { ...query } }),

  assignTransaction: (id: number, orderCode: string) =>
    request<PaymentTransaction>(`/api/admin/payments/transactions/${id}/assign`, {
      method: 'POST',
      body: { orderCode },
    }),

  resolveTransaction: (id: number, note: string) =>
    request<PaymentTransaction>(`/api/admin/payments/transactions/${id}/resolve`, {
      method: 'POST',
      body: { note },
    }),

  // ---------------------------------------------------------------- sản phẩm
  products: (query: { q?: string; status?: ProductStatus | ''; page?: number; size?: number }) =>
    request<PageResponse<AdminProductSummary>>('/api/admin/products', { query: { ...query } }),

  product: (id: number) => request<ProductDetail>(`/api/admin/products/${id}`),

  createProduct: (req: ProductUpsertRequest) =>
    request<ProductDetail>('/api/admin/products', { method: 'POST', body: req }),

  updateProduct: (id: number, req: ProductUpsertRequest) =>
    request<ProductDetail>(`/api/admin/products/${id}`, { method: 'PUT', body: req }),

  updateProductStatus: (id: number, status: ProductStatus) =>
    request<ProductDetail>(`/api/admin/products/${id}/status`, { method: 'PATCH', body: { status } }),

  deleteProduct: (id: number) => request<void>(`/api/admin/products/${id}`, { method: 'DELETE' }),

  uploadImages: (productId: number, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return request<ProductImage[]>(`/api/admin/products/${productId}/images`, { method: 'POST', body: form });
  },

  updateImage: (id: number, patch: { sortOrder?: number; thumbnail?: boolean }) =>
    request<ProductImage>(`/api/admin/images/${id}`, { method: 'PATCH', body: patch }),

  deleteImage: (id: number) => request<void>(`/api/admin/images/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------- danh mục (ADMIN)
  categories: () => request<Category[]>('/api/admin/categories'),

  createCategory: (req: CategoryRequest) =>
    request<Category>('/api/admin/categories', { method: 'POST', body: req }),

  updateCategory: (id: number, req: CategoryRequest) =>
    request<Category>(`/api/admin/categories/${id}`, { method: 'PUT', body: req }),

  deleteCategory: (id: number) => request<void>(`/api/admin/categories/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------- mã giảm giá (ADMIN)
  coupons: (query: { q?: string; page?: number; size?: number }) =>
    request<PageResponse<Coupon>>('/api/admin/coupons', { query: { ...query } }),

  createCoupon: (req: CouponRequest) => request<Coupon>('/api/admin/coupons', { method: 'POST', body: req }),

  updateCoupon: (id: number, req: CouponRequest) =>
    request<Coupon>(`/api/admin/coupons/${id}`, { method: 'PUT', body: req }),

  deleteCoupon: (id: number) => request<void>(`/api/admin/coupons/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------- khu vực giao (ADMIN)
  zones: () => request<DeliveryZone[]>('/api/admin/delivery-zones'),

  createZone: (req: ZoneRequest) => request<DeliveryZone>('/api/admin/delivery-zones', { method: 'POST', body: req }),

  updateZone: (id: number, req: ZoneRequest) =>
    request<DeliveryZone>(`/api/admin/delivery-zones/${id}`, { method: 'PUT', body: req }),

  deactivateZone: (id: number) => request<void>(`/api/admin/delivery-zones/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------- người dùng (ADMIN)
  users: (query: { q?: string; role?: Role | ''; page?: number; size?: number }) =>
    request<PageResponse<User>>('/api/admin/users', { query: { ...query } }),

  createUser: (req: AdminCreateUserRequest) => request<User>('/api/admin/users', { method: 'POST', body: req }),

  setUserEnabled: (id: number, enabled: boolean) =>
    request<User>(`/api/admin/users/${id}/enabled`, { method: 'PATCH', body: { enabled } }),

  setUserRole: (id: number, role: Role) =>
    request<User>(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),

  // ---------------------------------------------------------------- đánh giá (STAFF, ADMIN)
  reviews: (query: {
    status?: ReviewStatus | '';
    rating?: number | '';
    withMedia?: boolean;
    page?: number;
    size?: number;
  }) =>
    request<PageResponse<Review>>('/api/admin/reviews', {
      query: { ...query, withMedia: query.withMedia || undefined },
    }),

  setReviewStatus: (id: number, status: ReviewStatus) =>
    request<Review>(`/api/admin/reviews/${id}`, { method: 'PATCH', body: { status } }),

  /** Để trống = gỡ phản hồi */
  replyReview: (id: number, reply: string) =>
    request<Review>(`/api/admin/reviews/${id}/reply`, { method: 'PUT', body: { reply } }),

  deleteReviewMedia: (id: number, mediaId: number) =>
    request<Review>(`/api/admin/reviews/${id}/media/${mediaId}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------- báo cáo (ADMIN)
  reportSummary: (from: string, to: string) =>
    request<ReportSummary>('/api/admin/reports/summary', { query: { from, to } }),

  exportReport: (from: string, to: string) => requestBlob('/api/admin/reports/export', { from, to }),

  // ---------------------------------------------------------------- banner trang chủ (ADMIN)
  banners: () => request<Banner[]>('/api/admin/banners'),

  createBanner: (req: BannerRequest) => request<Banner>('/api/admin/banners', { method: 'POST', body: req }),

  updateBanner: (id: number, req: BannerRequest) =>
    request<Banner>(`/api/admin/banners/${id}`, { method: 'PUT', body: req }),

  uploadBannerImage: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<Banner>(`/api/admin/banners/${id}/image`, { method: 'POST', body: form });
  },

  deleteBanner: (id: number) => request<void>(`/api/admin/banners/${id}`, { method: 'DELETE' }),
};
