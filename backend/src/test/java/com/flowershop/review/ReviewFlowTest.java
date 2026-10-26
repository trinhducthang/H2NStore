package com.flowershop.review;

import com.flowershop.TestcontainersConfig;
import com.flowershop.common.util.TimeUtils;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.util.LinkedMultiValueMap;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Luồng đánh giá: chỉ người mua có đơn đã giao, trong hạn; kèm ảnh/video; chờ duyệt; sửa 1 lần.
 * Cùng cấu hình với OrderPaymentFlowTest để dùng chung Spring context và container PostgreSQL.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.sepay.webhook-api-key=test-key",
        "app.sepay.account-number=0123456789",
        "app.storage.local-dir=target/test-uploads"})
@ActiveProfiles("dev")
@Import(TestcontainersConfig.class)
class ReviewFlowTest {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST =
            new ParameterizedTypeReference<>() {
            };
    private static final String SLUG = "bo-hoa-hong-do-tinh-nong";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void onlyBuyerOfDeliveredOrderCanReviewWithPhotosAndVideo() throws IOException {
        String customer = register();
        String admin = login("admin@flowershop.local");
        String code = createOrder(customer, 1);
        long productId = jdbc.queryForObject(
                "SELECT product_id FROM order_items WHERE order_id = (SELECT id FROM orders WHERE code = ?) LIMIT 1",
                Long.class, code);

        // Chưa giao: không có trong "chờ đánh giá", gửi đánh giá bị từ chối
        assertThat(pending(customer, code)).isEmpty();
        assertThat(postReview(customer, code, productId, 5, "Đẹp", List.of()).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        deliver(code, admin);
        String variantName = jdbc.queryForObject("SELECT name FROM product_variants WHERE id = 1", String.class);
        assertThat(pending(customer, code)).singleElement()
                .satisfies(p -> assertThat(p).containsEntry("variantName", variantName).containsKey("deadline"));

        // Người khác không đánh giá được đơn này
        assertThat(postReview(register(), code, productId, 1, "Tệ", List.of()).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        // Ảnh HEIC (ftyp heic) không được nhận là video; quá 5 ảnh bị từ chối
        assertThat(postReview(customer, code, productId, 5, null, List.of(fakeFile("heic", "a.heic")))
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(postReview(customer, code, productId, 5, null,
                List.of(png(), png(), png(), png(), png(), png())).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        ResponseEntity<Map<String, Object>> created = postReview(customer, code, productId, 4,
                "<b>Hoa tươi</b>, giao đúng giờ", List.of(png(), fakeFile("isom", "clip.mp4")));
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Map<String, Object> review = created.getBody();
        assertThat(review).containsEntry("status", "PENDING").containsEntry("content", "Hoa tươi, giao đúng giờ")
                .containsEntry("editable", true).containsEntry("orderCode", code);
        assertThat(media(review)).extracting(m -> m.get("type")).containsExactly("VIDEO", "IMAGE");
        assertThat(media(review)).allSatisfy(m -> assertThat((String) m.get("url")).startsWith("/uploads/reviews/"));
        long reviewId = ((Number) review.get("id")).longValue();

        assertThat(postReview(customer, code, productId, 5, "Lần 2", List.of()).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        assertThat(pending(customer, code)).isEmpty();

        // Chờ duyệt thì chưa công khai
        assertThat(publicReviewIds("")).doesNotContain(reviewId);
        approve(reviewId, admin);
        assertThat(publicReviewIds("")).contains(reviewId);
        assertThat(publicReviewIds("?withMedia=true&rating=4")).contains(reviewId);
        assertThat(publicReviewIds("?rating=5")).doesNotContain(reviewId);
        Map<String, Object> summary = rest.exchange("/api/public/products/" + SLUG + "/reviews/summary",
                HttpMethod.GET, null, MAP).getBody();
        assertThat(((Number) summary.get("withMedia")).longValue()).isPositive();
        @SuppressWarnings("unchecked")
        Map<String, Object> distribution = (Map<String, Object>) summary.get("distribution");
        assertThat(((Number) distribution.get("4")).longValue()).isPositive();

        // Shop phản hồi
        Map<String, Object> replied = rest.exchange("/api/admin/reviews/" + reviewId + "/reply", HttpMethod.PUT,
                json(Map.of("reply", "Cảm ơn bạn!"), admin), MAP).getBody();
        assertThat(replied).containsEntry("reply", "Cảm ơn bạn!").containsKey("repliedAt");

        // Sửa 1 lần: bỏ video, giữ ảnh, thêm 1 ảnh -> chờ duyệt lại
        Long imageId = media(review).stream().filter(m -> "IMAGE".equals(m.get("type")))
                .map(m -> ((Number) m.get("id")).longValue()).findFirst().orElseThrow();
        ResponseEntity<Map<String, Object>> updated = putReview(customer, reviewId,
                Map.of("rating", 5, "content", "Rất hài lòng", "keepMediaIds", List.of(imageId)), List.of(png()));
        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody()).containsEntry("status", "PENDING").containsEntry("rating", 5)
                .containsEntry("edited", true).containsEntry("editable", false);
        assertThat(media(updated.getBody())).extracting(m -> m.get("type")).containsExactly("IMAGE", "IMAGE");
        assertThat(publicReviewIds("")).doesNotContain(reviewId);
        assertThat(putReview(customer, reviewId, Map.of("rating", 1), List.of()).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        Map<String, Object> mine = rest.exchange("/api/me/reviews?orderCode=" + code, HttpMethod.GET,
                json(null, customer), MAP).getBody();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) mine.get("content");
        assertThat(content).singleElement().satisfies(r -> assertThat(r)
                .containsEntry("productSlug", SLUG).containsEntry("reply", "Cảm ơn bạn!"));
    }

    @Test
    void cannotReviewAfterWindowExpires() throws IOException {
        String customer = register();
        String code = createOrder(customer, 2);
        deliver(code, login("admin@flowershop.local"));
        long productId = jdbc.queryForObject(
                "SELECT product_id FROM order_items WHERE order_id = (SELECT id FROM orders WHERE code = ?) LIMIT 1",
                Long.class, code);
        jdbc.update("""
                UPDATE order_status_history SET created_at = now() - interval '31 days'
                WHERE order_id = (SELECT id FROM orders WHERE code = ?) AND to_status = 'DELIVERED'""", code);

        assertThat(pending(customer, code)).isEmpty();
        ResponseEntity<Map<String, Object>> late = postReview(customer, code, productId, 5, null, List.of());
        assertThat(late.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat((String) late.getBody().get("message")).contains("quá hạn");
    }

    // ------------------------------------------------------------------ helpers

    private String register() {
        String email = "review-" + UUID.randomUUID() + "@example.com";
        Map<String, Object> body = rest.exchange("/api/auth/register", HttpMethod.POST,
                json(Map.of("email", email, "password", "Review@123", "fullName", "Nguyễn Văn Khách"), null), MAP)
                .getBody();
        return (String) body.get("accessToken");
    }

    private String login(String email) {
        Map<String, Object> body = rest.exchange("/api/auth/login", HttpMethod.POST,
                json(Map.of("email", email, "password", "Admin@123"), null), MAP).getBody();
        return (String) body.get("accessToken");
    }

    private String createOrder(String token, long variantId) {
        Map<String, Object> body = new HashMap<>();
        body.put("items", List.of(Map.of("variantId", variantId, "quantity", 1)));
        body.put("sender", Map.of("name", "Nguyễn Văn Khách", "phone", "0912345678"));
        body.put("receiver", Map.of("name", "Trần Thị B", "phone", "0987654321"));
        body.put("deliveryAddress", "12 Phạm Hùng, Nam Từ Liêm, Hà Nội");
        body.put("deliveryZoneId", 1);
        body.put("deliveryDate", LocalDate.now(TimeUtils.ZONE).plusDays(1).toString());
        body.put("deliverySlot", "SLOT_16_18");
        body.put("paymentMethod", "COD");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);
        headers.set("Idempotency-Key", UUID.randomUUID().toString());
        ResponseEntity<Map<String, Object>> res = rest.exchange("/api/orders", HttpMethod.POST,
                new HttpEntity<>(body, headers), MAP);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return (String) res.getBody().get("code");
    }

    private void deliver(String code, String admin) {
        for (String status : List.of("CONFIRMED", "ARRANGING", "DELIVERING", "DELIVERED")) {
            assertThat(rest.exchange("/api/admin/orders/" + code + "/status", HttpMethod.PATCH,
                    json(Map.of("toStatus", status), admin), MAP).getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }

    private void approve(long reviewId, String admin) {
        assertThat(rest.exchange("/api/admin/reviews/" + reviewId, HttpMethod.PATCH,
                json(Map.of("status", "APPROVED"), admin), MAP).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    private List<Map<String, Object>> pending(String token, String code) {
        return rest.exchange("/api/me/reviews/pending?orderCode=" + code, HttpMethod.GET, json(null, token), LIST)
                .getBody();
    }

    private List<Long> publicReviewIds(String query) {
        Map<String, Object> page = rest.exchange("/api/public/products/" + SLUG + "/reviews" + query
                + (query.isEmpty() ? "?" : "&") + "size=100", HttpMethod.GET, null, MAP).getBody();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) page.get("content");
        return content.stream().map(r -> ((Number) r.get("id")).longValue()).toList();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> media(Map<String, Object> review) {
        return (List<Map<String, Object>>) review.get("media");
    }

    private ResponseEntity<Map<String, Object>> postReview(String token, String code, long productId, int rating,
                                                           String content, List<ByteArrayResource> files) {
        Map<String, Object> review = new HashMap<>();
        review.put("orderCode", code);
        review.put("productId", productId);
        review.put("rating", rating);
        review.put("content", content);
        return rest.exchange("/api/me/reviews", HttpMethod.POST, multipart(review, files, token), MAP);
    }

    private ResponseEntity<Map<String, Object>> putReview(String token, long id, Map<String, Object> review,
                                                          List<ByteArrayResource> files) {
        return rest.exchange("/api/me/reviews/" + id, HttpMethod.PUT, multipart(review, files, token), MAP);
    }

    private static HttpEntity<Object> multipart(Map<String, Object> review, List<ByteArrayResource> files,
                                                String token) {
        HttpHeaders jsonPart = new HttpHeaders();
        jsonPart.setContentType(MediaType.APPLICATION_JSON);
        LinkedMultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("review", new HttpEntity<>(review, jsonPart));
        files.forEach(f -> form.add("files", f));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.setBearerAuth(token);
        return new HttpEntity<>(form, headers);
    }

    private static ByteArrayResource png() throws IOException {
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(40, 40, BufferedImage.TYPE_INT_RGB), "png", png);
        return named(png.toByteArray(), "photo.png");
    }

    /** File bắt đầu bằng hộp ftyp với brand cho trước (isom = MP4, heic = ảnh HEIC) */
    private static ByteArrayResource fakeFile(String brand, String filename) {
        byte[] bytes = new byte[64];
        byte[] head = ("\0\0\0\u0018ftyp" + brand).getBytes(StandardCharsets.ISO_8859_1);
        System.arraycopy(head, 0, bytes, 0, head.length);
        return named(bytes, filename);
    }

    private static ByteArrayResource named(byte[] bytes, String filename) {
        return new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }

    private static HttpEntity<Object> json(Object body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return new HttpEntity<>(body, headers);
    }
}
