package com.flowershop.payment.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowershop.payment.dto.SepayWebhookPayload;
import com.flowershop.payment.service.SepayWebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Cấu hình ở my.sepay.vn > Tích hợp Webhooks:
 * <ul>
 *   <li>URL: https://{domain}/api/public/payments/sepay/webhook</li>
 *   <li>Kiểu chứng thực: API Key (= SEPAY_WEBHOOK_API_KEY)</li>
 *   <li>Content type: application/json</li>
 * </ul>
 * Trả 200 {"success": true} khi đã nhận (kể cả giao dịch không khớp đơn) để SePay không gửi lại;
 * chỉ trả lỗi 5xx khi hệ thống lỗi thật, để SePay tự gửi lại sau.
 */
@Slf4j
@Tag(name = "Payment - SePay webhook")
@RestController
@RequiredArgsConstructor
public class SepayWebhookController {

    private final SepayWebhookService webhookService;
    private final ObjectMapper objectMapper;

    @Operation(summary = "Webhook SePay báo biến động số dư", description = "Header: Authorization: Apikey {key}")
    @PostMapping("/api/public/payments/sepay/webhook")
    public ResponseEntity<Map<String, Object>> webhook(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestBody String rawBody) {
        if (!webhookService.isAuthorized(authorization)) {
            log.warn("Webhook SePay sai API key");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success", false));
        }
        SepayWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, SepayWebhookPayload.class);
        } catch (JsonProcessingException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid JSON"));
        }
        webhookService.handle(payload, rawBody);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
