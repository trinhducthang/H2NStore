package com.flowershop.payment.event;

/**
 * Có tiền vào nhưng không tự xử lý được (không khớp đơn, đơn đã hủy...). Báo shop qua Telegram.
 */
public record PaymentNeedsAttentionEvent(Long transactionId, String status, long amount, String content,
                                         String orderCode, String note) {
}
