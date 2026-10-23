import { request } from './client';
import type {
  CreateOrderRequest,
  Order,
  OrderCreatedResponse,
  OrderSummary,
  PageResponse,
  PaymentStatusResponse,
  PreviewOrderRequest,
  PreviewOrderResponse,
} from './types';

export const ordersApi = {
  preview: (req: PreviewOrderRequest, signal?: AbortSignal) =>
    request<PreviewOrderResponse>('/api/orders/preview', { method: 'POST', body: req, signal }),

  /** idempotencyKey: giữ nguyên khi gửi lại để không tạo đơn trùng. */
  create: (req: CreateOrderRequest, idempotencyKey: string) =>
    request<OrderCreatedResponse>('/api/orders', {
      method: 'POST',
      body: req,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  track: (code: string, phone: string) => request<Order>('/api/orders/track', { query: { code, phone } }),

  paymentStatus: (code: string, phone: string) =>
    request<PaymentStatusResponse>(`/api/orders/${encodeURIComponent(code)}/payment`, { query: { phone } }),

  myOrders: (page = 0, size = 10) => request<PageResponse<OrderSummary>>('/api/me/orders', { query: { page, size } }),

  myOrder: (code: string) => request<Order>(`/api/me/orders/${encodeURIComponent(code)}`),

  cancelMyOrder: (code: string, reason?: string) =>
    request<Order>(`/api/me/orders/${encodeURIComponent(code)}/cancel`, {
      method: 'POST',
      body: { reason: reason || null },
    }),
};
