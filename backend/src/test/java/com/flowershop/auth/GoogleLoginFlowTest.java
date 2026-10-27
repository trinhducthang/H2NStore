package com.flowershop.auth;

import com.flowershop.TestcontainersConfig;
import com.flowershop.auth.service.GoogleTokenVerifier;
import com.flowershop.auth.service.GoogleTokenVerifier.GoogleUser;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Đăng nhập bằng Google trên PostgreSQL thật; chữ ký ID token đã có GoogleTokenVerifierTest nên ở đây giả lập.
 * Context riêng (có MockitoBean) nên có bộ đếm rate limit riêng: cả lớp gọi /api/auth/** dưới 10 lần.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.sepay.webhook-api-key=test-key",
        "app.sepay.account-number=0123456789",
        "app.storage.local-dir=target/test-uploads",
        "app.google.client-id=test-client.apps.googleusercontent.com"})
@ActiveProfiles("dev")
@Import(TestcontainersConfig.class)
class GoogleLoginFlowTest {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JdbcTemplate jdbc;

    @MockitoBean
    private GoogleTokenVerifier googleTokenVerifier;

    @Test
    void firstGoogleLoginCreatesCustomerWithoutPassword() {
        assertThat(rest.exchange("/api/public/auth/config", HttpMethod.GET, null, MAP).getBody())
                .containsEntry("googleClientId", "test-client.apps.googleusercontent.com");
        when(googleTokenVerifier.verify("token-new"))
                .thenReturn(new GoogleUser("sub-new", "Lan.Nguyen@Gmail.com", true, "  Nguyễn Lan "));

        ResponseEntity<Map<String, Object>> created = google("token-new");
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(created.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).startsWith("refresh_token=");
        Map<String, Object> user = user(created);
        assertThat(user).containsEntry("email", "lan.nguyen@gmail.com")
                .containsEntry("fullName", "Nguyễn Lan")
                .containsEntry("role", "CUSTOMER")
                .containsEntry("hasPassword", false);

        // Chưa có mật khẩu: đăng nhập bằng email được hướng sang Google
        ResponseEntity<Map<String, Object>> byPassword = login("lan.nguyen@gmail.com", "MatKhau@123");
        assertThat(byPassword.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(byPassword.getBody()).containsEntry("code", "PASSWORD_NOT_SET");

        // Đặt mật khẩu đầu tiên không cần mật khẩu hiện tại, sau đó đăng nhập được cả hai cách
        String accessToken = (String) created.getBody().get("accessToken");
        assertThat(rest.exchange("/api/me/password", HttpMethod.PUT,
                json(Map.of("newPassword", "MatKhau@123"), accessToken), Void.class).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        ResponseEntity<Map<String, Object>> afterSet = login("lan.nguyen@gmail.com", "MatKhau@123");
        assertThat(afterSet.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(user(afterSet)).containsEntry("id", user.get("id")).containsEntry("hasPassword", true);
        assertThat(user(google("token-new"))).containsEntry("id", user.get("id"));
    }

    @Test
    void linksGoogleToExistingAccountWithSameEmail() {
        when(googleTokenVerifier.verify("token-existing"))
                .thenReturn(new GoogleUser("sub-existing", "Customer@flowershop.local", true, "Tên trên Google"));

        ResponseEntity<Map<String, Object>> res = google("token-existing");

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        Long customerId = jdbc.queryForObject("SELECT id FROM users WHERE email = 'customer@flowershop.local'",
                Long.class);
        assertThat(((Number) user(res).get("id")).longValue()).isEqualTo(customerId);
        // Giữ hồ sơ và mật khẩu cũ, chỉ gắn thêm Google
        assertThat(user(res)).containsEntry("fullName", "Khách Hàng Mẫu").containsEntry("hasPassword", true);
        assertThat(jdbc.queryForObject("SELECT google_id FROM users WHERE id = ?", String.class, customerId))
                .isEqualTo("sub-existing");
    }

    @Test
    void unverifiedGoogleEmailCannotCreateOrLinkAccount() {
        when(googleTokenVerifier.verify("token-unverified"))
                .thenReturn(new GoogleUser("sub-unverified", "staff@flowershop.local", false, "Kẻ mạo danh"));

        ResponseEntity<Map<String, Object>> res = google("token-unverified");

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(res.getBody()).containsEntry("code", "GOOGLE_LOGIN_FAILED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE google_id = 'sub-unverified'",
                Integer.class)).isZero();
    }

    @Test
    void disabledAccountCannotLoginWithGoogle() {
        jdbc.update("""
                INSERT INTO users (email, full_name, role, enabled, google_id)
                VALUES ('bi.khoa@gmail.com', 'Bị Khóa', 'CUSTOMER', FALSE, 'sub-disabled')""");
        when(googleTokenVerifier.verify("token-disabled"))
                .thenReturn(new GoogleUser("sub-disabled", "bi.khoa@gmail.com", true, "Bị Khóa"));

        ResponseEntity<Map<String, Object>> res = google("token-disabled");

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(res.getBody()).containsEntry("code", "ACCOUNT_DISABLED");
    }

    // ------------------------------------------------------------------ helpers

    private ResponseEntity<Map<String, Object>> google(String credential) {
        return rest.exchange("/api/auth/google", HttpMethod.POST, json(Map.of("credential", credential), null), MAP);
    }

    private ResponseEntity<Map<String, Object>> login(String email, String password) {
        return rest.exchange("/api/auth/login", HttpMethod.POST,
                json(Map.of("email", email, "password", password), null), MAP);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> user(ResponseEntity<Map<String, Object>> authResponse) {
        return (Map<String, Object>) authResponse.getBody().get("user");
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
