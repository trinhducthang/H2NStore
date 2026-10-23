package com.flowershop.order.controller;

import com.flowershop.common.dto.PageResponse;
import com.flowershop.order.dto.OrderDtos.CancelOrderRequest;
import com.flowershop.order.dto.OrderDtos.CreateOrderRequest;
import com.flowershop.order.dto.OrderDtos.OrderCreatedResponse;
import com.flowershop.order.dto.OrderDtos.OrderResponse;
import com.flowershop.order.dto.OrderDtos.OrderSummary;
import com.flowershop.order.dto.OrderDtos.PaymentStatusResponse;
import com.flowershop.order.dto.OrderDtos.PreviewOrderRequest;
import com.flowershop.order.dto.OrderDtos.PreviewOrderResponse;
import com.flowershop.order.service.OrderService;
import com.flowershop.security.SecurityUtils;
import com.flowershop.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Orders - khách hàng")
@RestController
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @Operation(summary = "Tính trước subtotal, phí ship, giảm giá, tổng (không lưu)")
    @PostMapping("/api/orders/preview")
    public PreviewOrderResponse preview(@Valid @RequestBody PreviewOrderRequest req) {
        return orderService.preview(req);
    }

    @Operation(summary = "Tạo đơn (khách vãng lai hoặc đã đăng nhập)",
            description = "Header Idempotency-Key bắt buộc. paymentMethod=SEPAY trả về bankTransferInfo (VietQR).")
    @PostMapping("/api/orders")
    public ResponseEntity<OrderCreatedResponse> create(@RequestHeader("Idempotency-Key") String idempotencyKey,
                                                       @Valid @RequestBody CreateOrderRequest req) {
        var result = orderService.create(req, idempotencyKey, SecurityUtils.currentUser());
        // Gửi lại cùng key: trả đơn cũ với 200 thay vì 201
        return ResponseEntity.status(result.replayed() ? HttpStatus.OK : HttpStatus.CREATED).body(result.body());
    }

    @Operation(summary = "Tra cứu đơn cho khách vãng lai bằng mã đơn + SĐT")
    @GetMapping("/api/orders/track")
    public OrderResponse track(@RequestParam String code, @RequestParam String phone) {
        return orderService.track(code, phone);
    }

    @Operation(summary = "Trạng thái thanh toán (trang QR gọi lặp lại để biết SePay đã báo nhận tiền)")
    @GetMapping("/api/orders/{code}/payment")
    public PaymentStatusResponse paymentStatus(@PathVariable String code, @RequestParam String phone) {
        return orderService.paymentStatus(code, phone);
    }

    @GetMapping("/api/me/orders")
    public PageResponse<OrderSummary> myOrders(@AuthenticationPrincipal UserPrincipal me,
                                               @RequestParam(required = false) Integer page,
                                               @RequestParam(required = false) Integer size) {
        return orderService.myOrders(me.id(), page, size);
    }

    @GetMapping("/api/me/orders/{code}")
    public OrderResponse myOrder(@AuthenticationPrincipal UserPrincipal me, @PathVariable String code) {
        return orderService.myOrder(me.id(), code);
    }

    @Operation(summary = "Hủy đơn (chỉ khi còn PENDING và chưa thanh toán)")
    @PostMapping("/api/me/orders/{code}/cancel")
    public OrderResponse cancel(@AuthenticationPrincipal UserPrincipal me, @PathVariable String code,
                                @Valid @RequestBody(required = false) CancelOrderRequest req) {
        return orderService.cancelMyOrder(me, code, req != null ? req.reason() : null);
    }
}
