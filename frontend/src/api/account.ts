import { request } from './client';
import type { Address, AddressRequest, CreateReviewRequest, Review, UpdateProfileRequest, User } from './types';

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

  createReview: (req: CreateReviewRequest) => request<Review>('/api/me/reviews', { method: 'POST', body: req }),
};

/** Backend trả record field "isDefault"; đọc phòng cả trường hợp Jackson đổi tên thành "default". */
export function isDefaultAddress(a: Address): boolean {
  const raw = a as Address & { default?: boolean };
  return Boolean(raw.isDefault ?? raw.default);
}

export function formatAddress(a: Pick<Address, 'addressLine' | 'ward' | 'district' | 'city'>): string {
  return [a.addressLine, a.ward, a.district, a.city].filter(Boolean).join(', ');
}
