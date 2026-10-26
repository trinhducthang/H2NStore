package com.flowershop.review.event;

/**
 * Khách gửi mới hoặc sửa đánh giá, cần shop duyệt. Báo shop qua Telegram (AFTER_COMMIT, @Async).
 */
public record ReviewSubmittedEvent(Long reviewId, boolean edited) {
}
