package com.flowershop.order.dto;

import com.flowershop.common.util.PhoneUtils;
import com.flowershop.delivery.entity.DeliverySlot;
import com.flowershop.order.entity.OrderStatus;
import com.flowershop.order.entity.PaymentMethod;
import com.flowershop.order.entity.PaymentStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class OrderDtos {

    private OrderDtos() {
    }

    // ------------------------------------------------------------ request

    public record OrderItemRequest(@NotNull Long variantId,
                                   @NotNull @Min(1) @Max(20) Integer quantity) {
    }

    public record SenderRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Pattern(regexp = PhoneUtils.VN_PHONE_REGEX, message = PhoneUtils.VN_PHONE_MESSAGE) String phone,
            @Email @Size(max = 255) String email) {
    }

    public record ReceiverRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Pattern(regexp = PhoneUtils.VN_PHONE_REGEX, message = PhoneUtils.VN_PHONE_MESSAGE) String phone) {
    }

    public record CreateOrderRequest(
            @NotEmpty @Size(max = 20) List<@Valid @NotNull OrderItemRequest> items,
            @NotNull @Valid SenderRequest sender,
            @NotNull @Valid ReceiverRequest receiver,
            @NotBlank @Size(max = 500) String deliveryAddress,
            @NotNull Long deliveryZoneId,
            @NotNull LocalDate deliveryDate,
            @NotNull DeliverySlot deliverySlot,
            @Size(max = 300) String cardMessage,
            boolean hideSender,
            @Size(max = 50) String couponCode,
            @NotNull PaymentMethod paymentMethod,
            @Size(max = 500) String note) {
    }

    public record PreviewOrderRequest(
            @NotEmpty @Size(max = 20) List<@Valid @NotNull OrderItemRequest> items,
            Long deliveryZoneId,
            LocalDate deliveryDate,
            DeliverySlot deliverySlot,
            @Size(max = 50) String couponCode) {
    }

    public record UpdateStatusRequest(@NotNull OrderStatus toStatus,
                                      @Size(max = 500) String reason,
                                      /* version đơn client đang xem; lệch thì trả 409 CONFLICT */
                                      Long version) {
    }

    public record UpdatePaymentRequest(@NotNull PaymentStatus paymentStatus,
                                       @Size(max = 500) String note,
                                       Long version) {
    }

    public record CancelOrderRequest(@Size(max = 500) String reason) {
    }

    // ------------------------------------------------------------ response

    public record LineResponse(Long variantId, Long productId, String productName, String variantName,
                               long unitPrice, int quantity, long lineTotal) {
    }

    public record PreviewOrderResponse(List<LineResponse> items, long subtotal, long shippingFee, long discount,
                                       long total, String couponCode, String couponError) {
    }

    /**
     * Thông tin chuyển khoản qua SePay: quét VietQR, nội dung CK chứa mã đơn.
     * SePay gọi webhook khi tiền về, hệ thống tự chuyển payment_status = PAID.
     */
    public record BankTransferInfo(String bankCode, String accountNumber, String accountName, long amount,
                                   String content, String qrUrl, OffsetDateTime expiresAt) {
    }

    public record OrderCreatedResponse(String code, OrderStatus status, long subtotal, long shippingFee,
                                       long discount, long total, PaymentMethod paymentMethod,
                                       PaymentStatus paymentStatus, BankTransferInfo bankTransferInfo) {
    }

    public record PartyResponse(String name, String phone, String email) {
    }

    public record ZoneRef(Long id, String name) {
    }

    public record HistoryResponse(OrderStatus fromStatus, OrderStatus toStatus, String changedBy, String reason,
                                  OffsetDateTime createdAt) {
    }

    public record OrderResponse(
            String code,
            OrderStatus status,
            PaymentMethod paymentMethod,
            PaymentStatus paymentStatus,
            long paidAmount,
            OffsetDateTime paidAt,
            PartyResponse sender,
            PartyResponse receiver,
            boolean hideSender,
            String deliveryAddress,
            ZoneRef deliveryZone,
            LocalDate deliveryDate,
            DeliverySlot deliverySlot,
            String deliverySlotLabel,
            String cardMessage,
            String note,
            List<LineResponse> items,
            long subtotal,
            long shippingFee,
            long discount,
            long total,
            String couponCode,
            String deliveryPhotoUrl,
            boolean cancellable,
            long version,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            List<HistoryResponse> history,
            BankTransferInfo bankTransferInfo) {
    }

    public record OrderSummary(String code, OrderStatus status, PaymentMethod paymentMethod,
                               PaymentStatus paymentStatus, String senderName, String senderPhone,
                               String receiverName, String receiverPhone, LocalDate deliveryDate,
                               DeliverySlot deliverySlot, long total, int itemCount, String firstItemName,
                               OffsetDateTime createdAt) {
    }

    /** Dữ liệu phẳng cho listener gửi Telegram/email (chạy ngoài transaction). */
    public record OrderNotificationView(String code, OrderStatus status, String senderName, String senderPhone,
                                        String senderEmail, String receiverName, String receiverPhone,
                                        String deliveryAddress, String zoneName, LocalDate deliveryDate,
                                        String slotLabel, String cardMessage, String note, List<String> itemLines,
                                        long total, PaymentMethod paymentMethod, PaymentStatus paymentStatus,
                                        long paidAmount) {
    }

    /** Dùng cho trang thanh toán: frontend gọi lặp lại để biết khi nào SePay báo đã nhận tiền. */
    public record PaymentStatusResponse(String code, OrderStatus status, PaymentMethod paymentMethod,
                                        PaymentStatus paymentStatus, long total, long paidAmount,
                                        OffsetDateTime paidAt, BankTransferInfo bankTransferInfo) {
    }
}
