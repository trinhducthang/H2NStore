package com.flowershop.auth.controller;

import com.flowershop.auth.dto.AuthDtos.AuthConfigResponse;
import com.flowershop.config.AppProperties;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Frontend đọc Client ID lúc chạy, nên bật/tắt đăng nhập Google chỉ cần đổi GOOGLE_CLIENT_ID của backend,
 * không phải build lại web. Nằm ngoài /api/auth để không tính vào hạn mức đăng nhập theo IP.
 */
@Tag(name = "Auth")
@RestController
@RequiredArgsConstructor
public class AuthConfigController {

    private final AppProperties props;

    @GetMapping("/api/public/auth/config")
    public AuthConfigResponse config() {
        String clientId = props.google().clientId();
        return new AuthConfigResponse(clientId == null || clientId.isBlank() ? null : clientId);
    }
}
