package com.flowershop.order;

import com.flowershop.TestcontainersConfig;
import com.flowershop.common.util.TimeUtils;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Luồng chính trên PostgreSQL thật: tìm kiếm không dấu, tạo đơn có idempotency,
 * thanh toán qua webhook SePay (kể cả gửi trùng, thiếu tiền, sai API key).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.sepay.webhook-api-key=test-key",
        "app.sepay.account-number=0123456789",
        "app.storage.local-dir=target/test-uploads"})
@ActiveProfiles("dev")
@Import(TestcontainersConfig.class)
class OrderPaymentFlowTest {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };
    private static final AtomicLong TXN_ID = new AtomicLong(System.currentTimeMillis());

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JdbcTemplate jdbc;

    private final LocalDate tomorrow = LocalDate.now(TimeUtils.ZONE).plusDays(1);

    @Test
    void searchIgnoresVietnameseAccents() {
        Map<String, Object> page = rest.exchange("/api/public/products?q=hoa hong", HttpMethod.GET, null, MAP)
                .getBody();
        assertThat(page).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) page.get("content");
        assertThat(content).extracting(p -> (String) p.get("slug"))
                .contains("bo-hoa-hong-do-tinh-nong", "bo-hoa-hong-trang-thanh-khiet");
    }

    @Test
    void sameIdempotencyKeyReturnsSameOrderWithoutDoubleStock() {
        String key = UUID.randomUUID().toString();
        int stockBefore = stock(3);

        ResponseEntity<Map<String, Object>> first = createOrder(orderBody(3, "SLOT_10_12", "COD"), key);
        ResponseEntity<Map<String, Object>> second = createOrder(orderBody(3, "SLOT_10_12", "COD"), key);

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(second.getBody().get("code")).isEqualTo(first.getBody().get("code"));
        assertThat(stock(3)).isEqualTo(stockBefore - 1);
    }

    @Test
    void sepayOrderBecomesPaidThroughWebhook() {
        ResponseEntity<Map<String, Object>> created =
                createOrder(orderBody(2, "SLOT_14_16", "SEPAY"), UUID.randomUUID().toString());
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String code = (String) created.getBody().get("code");
        long total = ((Number) created.getBody().get("total")).longValue();
        @SuppressWarnings("unchecked")
        Map<String, Object> transfer = (Map<String, Object>) created.getBody().get("bankTransferInfo");
        assertThat(transfer.get("content")).isEqualTo(code);
        assertThat((String) transfer.get("qrUrl")).startsWith("https://qr.sepay.vn/img?acc=0123456789");

        // Sai API key -> 401, không ghi nhận
        assertThat(webhook(TXN_ID.incrementAndGet(), code, total, "wrong").getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        // Chuyển thiếu -> vẫn UNPAID
        long partialId = TXN_ID.incrementAndGet();
        assertThat(webhook(partialId, "MBVCB.1234." + code + ".CT", total - 1000, "test-key").getBody())
                .containsEntry("success", true);
        assertThat(paymentStatus(code)).isEqualTo("UNPAID");

        // Chuyển nốt -> PAID; SePay gửi lại cùng id -> không cộng 2 lần
        long restId = TXN_ID.incrementAndGet();
        webhook(restId, code.toLowerCase(), 1000, "test-key");
        webhook(restId, code.toLowerCase(), 1000, "test-key");

        assertThat(paymentStatus(code)).isEqualTo("PAID");
        assertThat(jdbc.queryForObject("SELECT paid_amount FROM orders WHERE code = ?", Long.class, code))
                .isEqualTo(total);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM payment_transactions WHERE provider_txn_id = ?",
                Long.class, String.valueOf(restId))).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM payment_transactions WHERE provider_txn_id = ?",
                String.class, String.valueOf(partialId))).isEqualTo("PARTIAL");
    }

    @Test
    void transferWithoutOrderCodeIsKeptForManualMatching() {
        long id = TXN_ID.incrementAndGet();
        assertThat(webhook(id, "chuyen tien mua hoa", 500_000, "test-key").getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(jdbc.queryForObject("SELECT status FROM payment_transactions WHERE provider_txn_id = ?",
                String.class, String.valueOf(id))).isEqualTo("UNMATCHED");
    }

    // ------------------------------------------------------------------ helpers

    private Map<String, Object> orderBody(long variantId, String slot, String paymentMethod) {
        Map<String, Object> body = new HashMap<>();
        body.put("items", List.of(Map.of("variantId", variantId, "quantity", 1)));
        body.put("sender", Map.of("name", "Nguyễn Văn A", "phone", "0912345678", "email", "a@example.com"));
        body.put("receiver", Map.of("name", "Trần Thị B", "phone", "0987654321"));
        body.put("deliveryAddress", "12 Phạm Hùng, Nam Từ Liêm, Hà Nội");
        body.put("deliveryZoneId", 1);
        body.put("deliveryDate", tomorrow.toString());
        body.put("deliverySlot", slot);
        body.put("paymentMethod", paymentMethod);
        return body;
    }

    private ResponseEntity<Map<String, Object>> createOrder(Map<String, Object> body, String idempotencyKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Idempotency-Key", idempotencyKey);
        return rest.exchange("/api/orders", HttpMethod.POST, new HttpEntity<>(body, headers), MAP);
    }

    private ResponseEntity<Map<String, Object>> webhook(long id, String content, long amount, String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.AUTHORIZATION, "Apikey " + apiKey);
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", id);
        payload.put("gateway", "MBBank");
        payload.put("transactionDate", "2026-10-23 10:00:00");
        payload.put("accountNumber", "0123456789");
        payload.put("content", content);
        payload.put("transferType", "in");
        payload.put("transferAmount", amount);
        payload.put("referenceCode", "FT" + id);
        return rest.exchange("/api/public/payments/sepay/webhook", HttpMethod.POST,
                new HttpEntity<>(payload, headers), MAP);
    }

    private String paymentStatus(String code) {
        Map<String, Object> body = rest.exchange("/api/orders/" + code + "/payment?phone=0912345678",
                HttpMethod.GET, null, MAP).getBody();
        return (String) body.get("paymentStatus");
    }

    private int stock(long variantId) {
        return jdbc.queryForObject("SELECT stock FROM product_variants WHERE id = ?", Integer.class, variantId);
    }
}
