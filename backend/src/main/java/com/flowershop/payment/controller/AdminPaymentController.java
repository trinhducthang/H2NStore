package com.flowershop.payment.controller;

import com.flowershop.common.dto.PageResponse;
import com.flowershop.payment.dto.PaymentDtos.AssignTransactionRequest;
import com.flowershop.payment.dto.PaymentDtos.PaymentTransactionResponse;
import com.flowershop.payment.dto.PaymentDtos.ResolveTransactionRequest;
import com.flowershop.payment.entity.PaymentTransaction;
import com.flowershop.payment.service.SepayWebhookService;
import com.flowershop.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - đối soát SePay")
@RestController
@RequestMapping("/api/admin/payments/transactions")
@RequiredArgsConstructor
public class AdminPaymentController {

    private final SepayWebhookService webhookService;

    @Operation(summary = "Giao dịch nhận từ SePay", description = "q: nội dung CK, mã đơn, mã tham chiếu")
    @GetMapping
    public PageResponse<PaymentTransactionResponse> list(
            @RequestParam(required = false) PaymentTransaction.Status status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return webhookService.search(status, q, page, size);
    }

    @Operation(summary = "Gán giao dịch chưa khớp (UNMATCHED) vào một đơn")
    @PostMapping("/{id}/assign")
    public PaymentTransactionResponse assign(@PathVariable Long id, @Valid @RequestBody AssignTransactionRequest req,
                                             @AuthenticationPrincipal UserPrincipal me) {
        return webhookService.assign(id, req.orderCode(), me.email());
    }

    @Operation(summary = "Đánh dấu đã xử lý (VD: đã hoàn tiền) -> IGNORED")
    @PostMapping("/{id}/resolve")
    public PaymentTransactionResponse resolve(@PathVariable Long id, @Valid @RequestBody ResolveTransactionRequest req,
                                              @AuthenticationPrincipal UserPrincipal me) {
        return webhookService.resolve(id, req.note(), me.email());
    }
}
