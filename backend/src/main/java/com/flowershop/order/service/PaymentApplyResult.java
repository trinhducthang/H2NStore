package com.flowershop.order.service;

/**
 * Kết quả ghi nhận một khoản tiền vào đơn (từ webhook SePay hoặc gán thủ công).
 */
public record PaymentApplyResult(Outcome outcome, Long orderId, String orderCode, long paidAmount, long total,
                                 String message) {

    public enum Outcome {
        /** Đơn đã đủ tiền -> PAID */
        PAID,
        /** Đã cộng tiền nhưng chưa đủ tổng đơn */
        PARTIAL,
        /** Không có đơn với mã này */
        ORDER_NOT_FOUND,
        /** Đơn đã hủy / đã thanh toán / đã hoàn tiền: cần hoàn tiền thủ công cho khách */
        NOT_PAYABLE
    }

    public static PaymentApplyResult notFound(String code) {
        return new PaymentApplyResult(Outcome.ORDER_NOT_FOUND, null, code, 0, 0, "Không tìm thấy đơn " + code);
    }
}
