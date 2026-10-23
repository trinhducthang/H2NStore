package com.flowershop.auth.service;

import com.flowershop.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Migration V2 tạo sẵn admin với mật khẩu mặc định; cảnh báo mỗi lần khởi động cho tới khi được đổi.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultAdminPasswordCheck implements ApplicationRunner {

    private static final String DEFAULT_ADMIN_EMAIL = "admin@flowershop.local";
    private static final String DEFAULT_ADMIN_PASSWORD = "Admin@123";

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        userService.findByEmail(DEFAULT_ADMIN_EMAIL)
                .filter(u -> passwordEncoder.matches(DEFAULT_ADMIN_PASSWORD, u.getPasswordHash()))
                .ifPresent(u -> log.warn("Tài khoản {} vẫn dùng mật khẩu mặc định, hãy đổi ngay!", DEFAULT_ADMIN_EMAIL));
    }
}
