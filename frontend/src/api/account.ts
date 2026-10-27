import { request, upload, type UploadOptions } from './client';
import type {
  Address,
  AddressRequest,
  CreateReviewRequest,
  PageResponse,
  PendingReview,
  Review,
  UpdateProfileRequest,
  UpdateReviewRequest,
  User,
} from './types';

/** Multipart: phần "review" là JSON, phần "files" là ảnh/video */
function reviewForm(review: CreateReviewRequest | UpdateReviewRequest, files: File[]): FormData {
  const form = new FormData();
  form.append('review', new Blob([JSON.stringify(review)], { type: 'application/json' }));
  files.forEach((f) => form.append('files', f));
  return form;
}

export const accountApi = {
  profile: () => request<User>('/api/me/profile'),

  updateProfile: (req: UpdateProfileRequest) => request<User>('/api/me/profile', { method: 'PUT', body: req }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/api/me/password', { method: 'PUT', body: { currentPassword, newPassword } }),

  addresses: () => request<Address[]>('/api/me/addresses'),

  createAddress: (req: AddressRequest) => request<Address>('/api/me/addresses', { method: 'POST', body: req }),

  updateAddress: (id: number, req: AddressRequest) =>
    request<Address>(`/api/me/addresses/${id}`, { method: 'PUT', body: req }),

  deleteAddress: (id: number) => request<void>(`/api/me/addresses/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------- đánh giá
  pendingReviews: (orderCode?: string) =>
    request<PendingReview[]>('/api/me/reviews/pending', { query: { orderCode } }),

  myReviews: (query: { orderCode?: string; page?: number; size?: number }) =>
    request<PageResponse<Review>>('/api/me/reviews', { query: { ...query } }),

  createReview: (req: CreateReviewRequest, files: File[], onProgress?: UploadOptions['onProgress']) =>
    upload<Review>('/api/me/reviews', reviewForm(req, files), { onProgress }),

  updateReview: (id: number, req: UpdateReviewRequest, files: File[], onProgress?: UploadOptions['onProgress']) =>
    upload<Review>(`/api/me/reviews/${id}`, reviewForm(req, files), { method: 'PUT', onProgress }),
};

/** Backend trả record field "isDefault"; đọc phòng cả trường hợp Jackson đổi tên thành "default". */
export function isDefaultAddress(a: Address): boolean {
  const raw = a as Address & { default?: boolean };
  return Boolean(raw.isDefault ?? raw.default);
}

export function formatAddress(a: Partial<Pick<Address, 'addressLine' | 'ward' | 'district' | 'city'>>): string {
  return [a.addressLine, a.ward, a.district, a.city].filter(Boolean).join(', ');
}
