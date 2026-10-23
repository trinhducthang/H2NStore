package com.flowershop.notification;

public record PasswordResetRequestedEvent(String email, String fullName, String resetLink) {
}
