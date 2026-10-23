import { request } from './client';
import type { CartItemInput, CartResponse } from './types';

/** Giỏ hàng lưu trên server (chỉ khi đã đăng nhập). */
export const cartApi = {
  get: () => request<CartResponse>('/api/cart'),

  add: (item: CartItemInput) => request<CartResponse>('/api/cart/items', { method: 'POST', body: item }),

  update: (itemId: number, quantity: number) =>
    request<CartResponse>(`/api/cart/items/${itemId}`, { method: 'PATCH', body: { quantity } }),

  remove: (itemId: number) => request<CartResponse>(`/api/cart/items/${itemId}`, { method: 'DELETE' }),

  merge: (items: CartItemInput[]) => request<CartResponse>('/api/cart/merge', { method: 'POST', body: { items } }),
};
