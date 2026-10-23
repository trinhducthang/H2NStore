package com.flowershop.banner;

import com.flowershop.TestcontainersConfig;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.util.LinkedMultiValueMap;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Cùng cấu hình với OrderPaymentFlowTest để dùng chung Spring context và container PostgreSQL. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.sepay.webhook-api-key=test-key",
        "app.sepay.account-number=0123456789",
        "app.storage.local-dir=target/test-uploads"})
@ActiveProfiles("dev")
@Import(TestcontainersConfig.class)
class BannerFlowTest {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST =
            new ParameterizedTypeReference<>() {
            };

    @Autowired
    private TestRestTemplate rest;

    @Test
    void adminManagesHomeBanners() throws IOException {
        String admin = login("admin@flowershop.local");

        ResponseEntity<Map<String, Object>> xss = rest.exchange("/api/admin/banners", HttpMethod.POST,
                json(Map.of("title", "X", "linkUrl", "javascript:alert(1)"), admin), MAP);
        assertThat(xss.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        ResponseEntity<Map<String, Object>> protocolRelative = rest.exchange("/api/admin/banners", HttpMethod.POST,
                json(Map.of("linkUrl", "//evil.example.com"), admin), MAP);
        assertThat(protocolRelative.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        ResponseEntity<Map<String, Object>> created = rest.exchange("/api/admin/banners", HttpMethod.POST,
                json(Map.of("title", "Chúc mừng 20/10", "buttonText", "Đặt hoa ngay",
                        "linkUrl", "/products?categorySlug=hoa-tinh-yeu", "sortOrder", 1), admin), MAP);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).containsEntry("displayStatus", "NO_IMAGE");
        long id = ((Number) created.getBody().get("id")).longValue();
        assertThat(publicIds()).doesNotContain(id);

        ResponseEntity<Map<String, Object>> withImage = uploadImage(id, admin);
        assertThat(withImage.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(withImage.getBody()).containsEntry("displayStatus", "SHOWING");
        assertThat((String) withImage.getBody().get("imageUrl")).startsWith("/uploads/banners/");
        assertThat(publicIds()).contains(id);

        // Hẹn giờ ngày mai mới hiện
        ResponseEntity<Map<String, Object>> scheduled = rest.exchange("/api/admin/banners/" + id, HttpMethod.PUT,
                json(Map.of("title", "Chúc mừng 20/10", "startsAt", OffsetDateTime.now().plusDays(1).toString()),
                        admin), MAP);
        assertThat(scheduled.getBody()).containsEntry("displayStatus", "SCHEDULED");
        assertThat(publicIds()).doesNotContain(id);

        String staff = login("staff@flowershop.local");
        ResponseEntity<Map<String, Object>> forbidden = rest.exchange("/api/admin/banners", HttpMethod.GET,
                json(null, staff), MAP);
        assertThat(forbidden.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        assertThat(rest.exchange("/api/admin/banners/" + id, HttpMethod.DELETE, json(null, admin), Void.class)
                .getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(publicIds()).doesNotContain(id);
    }

    @Test
    void onSaleFilterReturnsOnlyDiscountedProducts() {
        Map<String, Object> page = rest.exchange("/api/public/products?onSale=true", HttpMethod.GET, null, MAP)
                .getBody();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) page.get("content");
        assertThat(content).isNotEmpty();
        assertThat(content).allSatisfy(p -> assertThat(p.get("compareAtPrice")).isNotNull());
        assertThat(content).extracting(p -> (String) p.get("slug")).contains("ke-hoa-khai-truong-phat-tai");
    }

    // ------------------------------------------------------------------ helpers

    private String login(String email) {
        Map<String, Object> body = rest.exchange("/api/auth/login", HttpMethod.POST,
                json(Map.of("email", email, "password", "Admin@123"), null), MAP).getBody();
        return (String) body.get("accessToken");
    }

    private List<Long> publicIds() {
        return rest.exchange("/api/public/banners", HttpMethod.GET, null, LIST).getBody().stream()
                .map(b -> ((Number) b.get("id")).longValue()).toList();
    }

    private ResponseEntity<Map<String, Object>> uploadImage(long id, String token) throws IOException {
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(300, 100, BufferedImage.TYPE_INT_RGB), "png", png);
        LinkedMultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", new ByteArrayResource(png.toByteArray()) {
            @Override
            public String getFilename() {
                return "banner.png";
            }
        });
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.setBearerAuth(token);
        return rest.exchange("/api/admin/banners/" + id + "/image", HttpMethod.POST, new HttpEntity<>(form, headers),
                MAP);
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
