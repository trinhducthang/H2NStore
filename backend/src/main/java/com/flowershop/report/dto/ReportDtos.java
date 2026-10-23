package com.flowershop.report.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class ReportDtos {

    private ReportDtos() {
    }

    public record DailyRevenue(LocalDate date, long orders, long revenue) {
    }

    public record TopProduct(Long productId, String productName, long quantity, long revenue) {
    }

    /** revenue: tổng tiền đơn chưa hủy; paidRevenue: phần đã thu (PAID). */
    public record ReportSummary(LocalDate from, LocalDate to, long orderCount, long deliveredCount,
                                long cancelledCount, long revenue, long paidRevenue, long averageOrderValue,
                                Map<String, Long> byStatus, List<DailyRevenue> byDay, List<TopProduct> topProducts) {
    }

    public record OrderRow(String code, OffsetDateTime createdAt, String status, String paymentMethod,
                           String paymentStatus, String senderName, String senderPhone, String receiverName,
                           LocalDate deliveryDate, String deliverySlot, long subtotal, long shippingFee,
                           long discount, long total) {
    }
}
