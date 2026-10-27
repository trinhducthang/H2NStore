package com.flowershop.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String frontendUrl,
        Jwt jwt,
        Cors cors,
        RateLimit rateLimit,
        Auth auth,
        Order order,
        Storage storage,
        Mail mail,
        Telegram telegram,
        Sepay sepay,
        Review review,
        Geocoding geocoding) {

    public record Jwt(String secret, Duration accessTtl, Duration refreshTtl, boolean cookieSecure) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record RateLimit(int requestsPerMinute) {
    }

    public record Auth(int maxFailedAttempts, Duration lockDuration, Duration resetTokenTtl) {
    }

    public record Order(int maxPerSlot, int minPrepareHours, int maxDaysAhead,
                        int expressStartHour, int expressEndHour,
                        Map<String, Integer> holidayMaxPerSlot) {
    }

    public record Storage(String type, String localDir, String publicUrl) {
    }

    /** windowDays: số ngày sau khi giao được đánh giá, và sau khi đánh giá được sửa (1 lần) */
    public record Review(int windowDays) {
    }

    public record Mail(String from) {
    }

    public record Telegram(String botToken, String chatId) {
    }

    /** Dịch vụ đổi tọa độ thành địa chỉ, theo API của Nominatim */
    public record Geocoding(String baseUrl, String userAgent) {
    }

    public record Sepay(String webhookApiKey, String bankCode, String accountNumber, String accountName,
                        String contentPrefix, String qrTemplate, Duration paymentTtl,
                        Duration expireCheckInterval) {
    }
}
