package com.flowershop.order.service;

import com.flowershop.security.UserPrincipal;

/**
 * Người thực hiện thao tác trên đơn: ghi vào order_status_history.changed_by.
 */
public record OrderActor(Type type, Long userId, String name) {

    public enum Type { GUEST, CUSTOMER, STAFF, ADMIN, SYSTEM }

    public static final OrderActor SYSTEM = new OrderActor(Type.SYSTEM, null, "SYSTEM");

    public static OrderActor guest(String senderName) {
        return new OrderActor(Type.GUEST, null, "Khách: " + senderName);
    }

    public static OrderActor of(UserPrincipal principal) {
        Type type = switch (principal.role()) {
            case ADMIN -> Type.ADMIN;
            case STAFF -> Type.STAFF;
            case CUSTOMER -> Type.CUSTOMER;
        };
        return new OrderActor(type, principal.id(), principal.email());
    }

    public boolean isStaffOrAdmin() {
        return type == Type.STAFF || type == Type.ADMIN;
    }
}
