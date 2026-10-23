package com.flowershop.order.event;

import com.flowershop.order.entity.OrderStatus;

/**
 * Sự kiện của module order. Listener chạy sau commit (AFTER_COMMIT) và @Async.
 */
public final class OrderEvents {

    private OrderEvents() {
    }

    public record OrderCreatedEvent(Long orderId) {
    }

    public record OrderStatusChangedEvent(Long orderId, OrderStatus from, OrderStatus to, String reason) {
    }

    /** Đơn chuyển sang PAID nhờ webhook SePay (hoặc nhân viên đánh dấu). */
    public record OrderPaidEvent(Long orderId, long amount, String source) {
    }
}
