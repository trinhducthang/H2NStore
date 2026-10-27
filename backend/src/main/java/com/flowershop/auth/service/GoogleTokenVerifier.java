package com.flowershop.auth.service;

import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Clock;
import java.time.Duration;
import java.util.Set;

/**
 * Kiểm tra ID token mà Google Identity Services (nút "Tiếp tục với Google") trả cho trình duyệt:
 * chữ ký theo khóa công khai của Google (JWKS, tự cache và tải lại khi Google xoay khóa),
 * iss là Google, aud là Client ID của shop, còn hạn.
 */
@Slf4j
@Component
public class GoogleTokenVerifier {

    private static final String JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    /** Thông tin lấy từ ID token; id là "sub", định danh cố định của tài khoản Google */
    public record GoogleUser(String id, String email, boolean emailVerified, String name) {
    }

    /** null khi chưa cấu hình GOOGLE_CLIENT_ID */
    private final NimbusJwtDecoder decoder;

    @Autowired
    public GoogleTokenVerifier(AppProperties props, Clock clock) {
        this(props.google().clientId(), clock, googleDecoder());
    }

    /** Test truyền decoder dùng khóa tự sinh thay cho khóa của Google */
    GoogleTokenVerifier(String clientId, Clock clock, NimbusJwtDecoder decoder) {
        if (clientId == null || clientId.isBlank()) {
            this.decoder = null;
            return;
        }
        JwtTimestampValidator timestamps = new JwtTimestampValidator();
        timestamps.setClock(clock);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                timestamps,
                new JwtClaimValidator<Object>(JwtClaimNames.ISS, iss -> iss != null && ISSUERS.contains(iss.toString())),
                new JwtAudienceValidator(clientId)));
        this.decoder = decoder;
    }

    private static NimbusJwtDecoder googleDecoder() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        // Chỉ tải khóa ở lần kiểm tra đầu tiên, không gọi Google lúc khởi động
        return NimbusJwtDecoder.withJwkSetUri(JWK_SET_URI).restOperations(new RestTemplate(requestFactory)).build();
    }

    public GoogleUser verify(String idToken) {
        if (decoder == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Shop chưa bật đăng nhập bằng Google");
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (BadJwtException e) {
            // Sai chữ ký, hết hạn, token của ứng dụng khác...
            log.info("ID token Google không hợp lệ: {}", e.getMessage());
            throw new BusinessException(ErrorCode.GOOGLE_LOGIN_FAILED);
        } catch (JwtException e) {
            log.warn("Không tải được khóa công khai của Google: {}", e.getMessage());
            throw new BusinessException(ErrorCode.GOOGLE_UNAVAILABLE);
        }
        return new GoogleUser(jwt.getSubject(), jwt.getClaimAsString("email"),
                Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")), jwt.getClaimAsString("name"));
    }
}
