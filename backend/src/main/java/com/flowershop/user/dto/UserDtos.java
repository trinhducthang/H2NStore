package com.flowershop.user.dto;

import com.flowershop.common.util.PhoneUtils;
import com.flowershop.user.entity.Address;
import com.flowershop.user.entity.Role;
import com.flowershop.user.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

/** DTO của module user, gom một file cho gọn. */
public final class UserDtos {

    private UserDtos() {
    }

    public record UserResponse(Long id, String email, String fullName, String phone, Role role,
                               boolean enabled, OffsetDateTime createdAt) {
        public static UserResponse from(User u) {
            return new UserResponse(u.getId(), u.getEmail(), u.getFullName(), u.getPhone(), u.getRole(),
                    u.isEnabled(), u.getCreatedAt());
        }
    }

    public record UpdateProfileRequest(
            @NotBlank @Size(max = 100) String fullName,
            @Pattern(regexp = PhoneUtils.VN_PHONE_REGEX, message = PhoneUtils.VN_PHONE_MESSAGE) String phone) {
    }

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, max = 72, message = "Mật khẩu từ 8 đến 72 ký tự") String newPassword) {
    }

    public record AddressRequest(
            @NotBlank @Size(max = 100) String receiverName,
            @NotBlank @Pattern(regexp = PhoneUtils.VN_PHONE_REGEX, message = PhoneUtils.VN_PHONE_MESSAGE)
            String receiverPhone,
            @NotBlank @Size(max = 255) String addressLine,
            @Size(max = 100) String ward,
            @Size(max = 100) String district,
            @Size(max = 100) String city,
            boolean isDefault) {
    }

    public record AddressResponse(Long id, String receiverName, String receiverPhone, String addressLine,
                                  String ward, String district, String city, boolean isDefault) {
        public static AddressResponse from(Address a) {
            return new AddressResponse(a.getId(), a.getReceiverName(), a.getReceiverPhone(), a.getAddressLine(),
                    a.getWard(), a.getDistrict(), a.getCity(), a.isDefault());
        }
    }

    public record AdminCreateUserRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 72, message = "Mật khẩu từ 8 đến 72 ký tự") String password,
            @NotBlank @Size(max = 100) String fullName,
            @Pattern(regexp = PhoneUtils.VN_PHONE_REGEX, message = PhoneUtils.VN_PHONE_MESSAGE) String phone,
            @NotNull Role role) {
    }

    public record UpdateEnabledRequest(boolean enabled) {
    }

    public record UpdateRoleRequest(@NotNull Role role) {
    }
}
