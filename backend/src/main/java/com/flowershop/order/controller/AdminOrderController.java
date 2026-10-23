package com.flowershop.order.controller;

import com.flowershop.common.dto.PageResponse;
import com.flowershop.order.dto.OrderDtos.OrderResponse;
import com.flowershop.order.dto.OrderDtos.OrderSummary;
import com.flowershop.order.dto.OrderDtos.UpdatePaymentRequest;
import com.flowershop.order.dto.OrderDtos.UpdateStatusRequest;
import com.flowershop.order.entity.OrderStatus;
import com.flowershop.order.entity.PaymentStatus;
import com.flowershop.order.service.OrderService;
import com.flowershop.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;

@Tag(name = "Admin - đơn hàng")
@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {

    private final OrderService orderService;

    @Operation(summary = "Danh sách đơn", description = "q: mã đơn hoặc SĐT")
    @GetMapping
    public PageResponse<OrderSummary> list(@RequestParam(required = false) OrderStatus status,
                                           @RequestParam(required = false) PaymentStatus paymentStatus,
                                           @RequestParam(required = false)
                                           @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate deliveryDate,
                                           @RequestParam(required = false) String q,
                                           @RequestParam(required = false) Integer page,
                                           @RequestParam(required = false) Integer size) {
        return orderService.adminSearch(status, paymentStatus, deliveryDate, q, page, size);
    }

    @GetMapping("/{code}")
    public OrderResponse get(@PathVariable String code) {
        return orderService.adminGet(code);
    }

    @PatchMapping("/{code}/status")
    public OrderResponse changeStatus(@PathVariable String code, @Valid @RequestBody UpdateStatusRequest req,
                                      @AuthenticationPrincipal UserPrincipal me) {
        return orderService.changeStatus(code, req, me);
    }

    @Operation(summary = "Chỉnh trạng thái thanh toán thủ công (khi SePay không tự khớp, hoặc hoàn tiền)")
    @PatchMapping("/{code}/payment")
    public OrderResponse updatePayment(@PathVariable String code, @Valid @RequestBody UpdatePaymentRequest req,
                                       @AuthenticationPrincipal UserPrincipal me) {
        return orderService.updatePayment(code, req, me);
    }

    @Operation(summary = "Đính kèm ảnh thực tế của đơn trước khi giao")
    @PostMapping(value = "/{code}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public OrderResponse uploadPhoto(@PathVariable String code, @RequestPart("file") MultipartFile file) {
        return orderService.uploadDeliveryPhoto(code, file);
    }
}
