package com.flowershop.auth.dto;

import com.flowershop.common.util.PhoneUtils;
import com.flowershop.user.dto.UserDtos.UserResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 72, message = "Mật khẩu từ 8 đến 72 ký tự") String password,
            @NotBlank @Size(max = 100) String fullName,
            @Pattern(regexp = PhoneUtils.VN_PHONE_REGEX, message = PhoneUtils.VN_PHONE_MESSAGE) String phone) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    /** credential: ID token (JWT) mà nút Google trả cho trình duyệt */
    public record GoogleLoginRequest(@NotBlank @Size(max = 4096) String credential) {
    }

    /** Cấu hình cho trang đăng nhập; googleClientId vắng mặt = không hiện nút Google */
    public record AuthConfigResponse(String googleClientId) {
    }

    public record ForgotPasswordRequest(@NotBlank @Email String email) {
    }

    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank @Size(min = 8, max = 72, message = "Mật khẩu từ 8 đến 72 ký tự") String newPassword) {
    }

    /** accessToken trả trong body; refresh token chỉ nằm trong cookie HttpOnly. */
    public record AuthResponse(String accessToken, String tokenType, long expiresIn, UserResponse user) {
    }

    /** Kết quả nội bộ: response + refresh token gốc để controller set cookie. */
    public record AuthResult(AuthResponse response, String refreshToken) {
    }
}
