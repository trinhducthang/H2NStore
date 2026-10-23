package com.flowershop.security;

import com.flowershop.user.entity.Role;

/**
 * Thông tin user lấy từ JWT (không truy vấn DB mỗi request).
 */
public record UserPrincipal(Long id, String email, Role role) {

    public boolean isStaffOrAdmin() {
        return role == Role.STAFF || role == Role.ADMIN;
    }
}
