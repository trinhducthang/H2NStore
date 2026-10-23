package com.flowershop.auth.service;

import com.flowershop.auth.dto.AuthDtos.AuthResponse;
import com.flowershop.auth.dto.AuthDtos.AuthResult;
import com.flowershop.auth.dto.AuthDtos.LoginRequest;
import com.flowershop.auth.dto.AuthDtos.RegisterRequest;
import com.flowershop.auth.dto.AuthDtos.ResetPasswordRequest;
import com.flowershop.auth.entity.PasswordResetToken;
import com.flowershop.auth.entity.RefreshToken;
import com.flowershop.auth.repository.PasswordResetTokenRepository;
import com.flowershop.auth.repository.RefreshTokenRepository;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.TimeUtils;
import com.flowershop.common.util.TokenUtils;
import com.flowershop.config.AppProperties;
import com.flowershop.notification.PasswordResetRequestedEvent;
import com.flowershop.security.JwtProvider;
import com.flowershop.user.dto.UserDtos.UserResponse;
import com.flowershop.user.entity.Role;
import com.flowershop.user.entity.User;
import com.flowershop.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final AppProperties props;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional
    public AuthResult register(RegisterRequest req) {
        User user = userService.create(req.email(), req.password(), req.fullName(), req.phone(), Role.CUSTOMER);
        return issueTokens(user);
    }

    /** Sai mật khẩu vẫn phải commit bộ đếm, nên không rollback khi ném BusinessException. */
    @Transactional(noRollbackFor = BusinessException.class)
    public AuthResult login(LoginRequest req) {
        OffsetDateTime now = TimeUtils.now(clock);
        User user = userService.findByEmail(req.email())
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            throw new BusinessException(ErrorCode.ACCOUNT_LOCKED);
        }
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            int failed = user.getFailedLoginCount() + 1;
            if (failed >= props.auth().maxFailedAttempts()) {
                user.setLockedUntil(now.plus(props.auth().lockDuration()));
                user.setFailedLoginCount(0);
                log.warn("Khóa đăng nhập user {} trong {}", user.getId(), props.auth().lockDuration());
            } else {
                user.setFailedLoginCount(failed);
            }
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }
        if (!user.isEnabled()) {
            throw new BusinessException(ErrorCode.ACCOUNT_DISABLED);
        }
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        return issueTokens(user);
    }

    /** Rotation: cấp refresh token mới, thu hồi token cũ. Token đã thu hồi bị dùng lại -> thu hồi toàn bộ. */
    @Transactional(noRollbackFor = BusinessException.class)
    public AuthResult refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        RefreshToken token = refreshTokenRepository.findByTokenHash(TokenUtils.sha256(rawRefreshToken))
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (token.isRevoked()) {
            log.warn("Refresh token đã thu hồi bị dùng lại, thu hồi toàn bộ phiên của user {}", token.getUserId());
            refreshTokenRepository.revokeAllByUserId(token.getUserId());
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (token.getExpiresAt().isBefore(TimeUtils.now(clock))) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        User user = userService.getById(token.getUserId());
        if (!user.isEnabled()) {
            throw new BusinessException(ErrorCode.ACCOUNT_DISABLED);
        }
        token.setRevoked(true);
        return issueTokens(user);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(TokenUtils.sha256(rawRefreshToken))
                .ifPresent(t -> t.setRevoked(true));
    }

    /** Luôn trả OK dù email không tồn tại, tránh dò email. */
    @Transactional
    public void forgotPassword(String email) {
        userService.findByEmail(email).filter(User::isEnabled).ifPresent(user -> {
            resetTokenRepository.invalidateAllByUserId(user.getId());
            String raw = TokenUtils.randomToken();
            PasswordResetToken token = new PasswordResetToken();
            token.setUserId(user.getId());
            token.setTokenHash(TokenUtils.sha256(raw));
            token.setExpiresAt(TimeUtils.now(clock).plus(props.auth().resetTokenTtl()));
            resetTokenRepository.save(token);
            String link = props.frontendUrl() + "/reset-password?token=" + raw;
            events.publishEvent(new PasswordResetRequestedEvent(user.getEmail(), user.getFullName(), link));
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        PasswordResetToken token = resetTokenRepository.findByTokenHash(TokenUtils.sha256(req.token()))
                .filter(t -> !t.isUsed() && t.getExpiresAt().isAfter(TimeUtils.now(clock)))
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_TOKEN));
        token.setUsed(true);
        User user = userService.getById(token.getUserId());
        userService.changePasswordUnchecked(user, req.newPassword());
        refreshTokenRepository.revokeAllByUserId(user.getId());
    }

    private AuthResult issueTokens(User user) {
        String raw = TokenUtils.randomToken();
        RefreshToken refresh = new RefreshToken();
        refresh.setUserId(user.getId());
        refresh.setTokenHash(TokenUtils.sha256(raw));
        refresh.setExpiresAt(TimeUtils.now(clock).plus(props.jwt().refreshTtl()));
        refreshTokenRepository.save(refresh);
        String access = jwtProvider.createAccessToken(user.getId(), user.getEmail(), user.getRole());
        var response = new AuthResponse(access, "Bearer", jwtProvider.accessTtlSeconds(), UserResponse.from(user));
        return new AuthResult(response, raw);
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void purgeExpiredRefreshTokens() {
        int deleted = refreshTokenRepository.deleteExpired(TimeUtils.now(clock));
        log.info("Đã xóa {} refresh token hết hạn", deleted);
    }
}
