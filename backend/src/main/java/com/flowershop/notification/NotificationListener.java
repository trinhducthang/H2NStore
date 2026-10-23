package com.flowershop.notification;

import com.flowershop.common.util.MoneyFormat;
import com.flowershop.config.AppProperties;
import com.flowershop.order.dto.OrderDtos.OrderNotificationView;
import com.flowershop.order.entity.OrderStatus;
import com.flowershop.order.entity.PaymentMethod;
import com.flowershop.order.event.OrderEvents.OrderCreatedEvent;
import com.flowershop.order.event.OrderEvents.OrderPaidEvent;
import com.flowershop.order.event.OrderEvents.OrderStatusChangedEvent;
import com.flowershop.order.service.OrderService;
import com.flowershop.payment.event.PaymentNeedsAttentionEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.format.DateTimeFormatter;

import static com.flowershop.notification.TelegramNotifier.escape;

/**
 * Việc phụ sau khi giao dịch đã commit: báo Telegram cho shop, email cho khách.
 * Lỗi ở đây không ảnh hưởng tới đơn hàng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationListener {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final OrderService orderService;
    private final TelegramNotifier telegram;
    private final EmailSender email;
    private final AppProperties props;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderCreated(OrderCreatedEvent event) {
        OrderNotificationView o = orderService.notificationView(event.orderId());
        telegram.send("""
                🌸 <b>ĐƠN MỚI %s</b>
                Người gửi: %s - %s
                Người nhận: %s - %s
                Địa chỉ: %s (%s)
                Giao: %s, %s
                %s
                Thiệp: %s
                Ghi chú: %s
                <b>Tổng: %sđ</b> - %s""".formatted(
                escape(o.code()), escape(o.senderName()), escape(o.senderPhone()),
                escape(o.receiverName()), escape(o.receiverPhone()),
                escape(o.deliveryAddress()), escape(o.zoneName()),
                o.deliveryDate().format(DATE), escape(o.slotLabel()),
                escape(String.join("\n", o.itemLines())),
                escape(nullToDash(o.cardMessage())), escape(nullToDash(o.note())),
                MoneyFormat.vnd(o.total()),
                o.paymentMethod() == PaymentMethod.SEPAY ? "Chuyển khoản SePay (chờ tiền về)" : "COD"));
        email.send(o.senderEmail(), "Đã nhận đơn hàng " + o.code(), orderEmail(o,
                "Cảm ơn bạn đã đặt hàng! Shop đã nhận đơn và sẽ liên hệ xác nhận sớm."));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderPaid(OrderPaidEvent event) {
        OrderNotificationView o = orderService.notificationView(event.orderId());
        telegram.send("💰 <b>%s đã thanh toán</b> %sđ (%s)".formatted(
                escape(o.code()), MoneyFormat.vnd(event.amount()), escape(event.source())));
        email.send(o.senderEmail(), "Đã nhận thanh toán đơn " + o.code(), orderEmail(o,
                "Shop đã nhận được thanh toán " + MoneyFormat.vnd(event.amount()) + "đ cho đơn hàng của bạn."));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStatusChanged(OrderStatusChangedEvent event) {
        OrderNotificationView o = orderService.notificationView(event.orderId());
        String message = switch (event.to()) {
            case CONFIRMED -> "Đơn hàng của bạn đã được xác nhận. Shop sẽ chuẩn bị hàng và giao đúng hẹn.";
            case DELIVERED -> "Đơn hàng đã được giao thành công. Cảm ơn bạn đã tin tưởng shop!";
            case CANCELLED -> "Đơn hàng đã bị hủy." + (event.reason() != null ? " Lý do: " + event.reason() : "");
            default -> null;
        };
        if (message != null) {
            email.send(o.senderEmail(), "Cập nhật đơn hàng " + o.code(), orderEmail(o, message));
        }
        if (event.to() == OrderStatus.CANCELLED) {
            telegram.send("❌ Đơn <b>%s</b> đã hủy. %s".formatted(escape(o.code()),
                    escape(nullToDash(event.reason()))));
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPaymentNeedsAttention(PaymentNeedsAttentionEvent event) {
        telegram.send("""
                ⚠️ <b>Giao dịch SePay cần xử lý</b> (#%d - %s)
                Số tiền: %sđ
                Nội dung: %s
                Mã đơn: %s
                %s""".formatted(event.transactionId(), escape(event.status()), MoneyFormat.vnd(event.amount()),
                escape(nullToDash(event.content())), escape(nullToDash(event.orderCode())),
                escape(nullToDash(event.note()))));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPasswordReset(PasswordResetRequestedEvent event) {
        email.send(event.email(), "Đặt lại mật khẩu", """
                <p>Chào %s,</p>
                <p>Bấm vào liên kết dưới đây để đặt lại mật khẩu (hiệu lực %d phút, dùng một lần):</p>
                <p><a href="%s">Đặt lại mật khẩu</a></p>
                <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>""".formatted(
                escape(event.fullName()), props.auth().resetTokenTtl().toMinutes(), event.resetLink()));
    }

    private String orderEmail(OrderNotificationView o, String message) {
        String trackUrl = props.frontendUrl() + "/track?code=" + o.code();
        return """
                <p>Chào %s,</p>
                <p>%s</p>
                <p><b>Mã đơn:</b> %s<br>
                <b>Giao tới:</b> %s - %s<br>
                <b>Thời gian:</b> %s, %s<br>
                <b>Tổng tiền:</b> %sđ</p>
                <p><a href="%s">Tra cứu đơn hàng</a></p>""".formatted(
                escape(o.senderName()), escape(message), escape(o.code()), escape(o.receiverName()),
                escape(o.deliveryAddress()), o.deliveryDate().format(DATE), escape(o.slotLabel()),
                MoneyFormat.vnd(o.total()), trackUrl);
    }

    private static String nullToDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
