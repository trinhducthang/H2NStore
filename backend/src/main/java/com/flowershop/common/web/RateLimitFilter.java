package com.flowershop.common.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.exception.GlobalExceptionHandler;
import com.flowershop.config.AppProperties;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giới hạn request/phút/IP (Bucket4j, in-memory):
 * <ul>
 *   <li>POST /api/orders và /api/auth/** (đăng nhập, đăng ký, quên mật khẩu...): N lần/phút</li>
 *   <li>/api/public/delivery/reverse-geocode (gọi sang Nominatim): N lần/phút</li>
 *   <li>/api/auth/refresh, /api/auth/logout: hạn mức riêng rộng hơn, vì SPA gọi refresh mỗi lần tải trang</li>
 * </ul>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int SESSION_REQUESTS_PER_MINUTE = 60;

    private record Limited(Bucket bucket, int capacity) {
    }

    private final Map<String, Limited> buckets = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final int requestsPerMinute;

    public RateLimitFilter(ObjectMapper objectMapper, AppProperties props) {
        this.objectMapper = objectMapper;
        this.requestsPerMinute = props.rateLimit().requestsPerMinute();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return group(request) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String group = group(request);
        int capacity = "session".equals(group) ? SESSION_REQUESTS_PER_MINUTE : requestsPerMinute;
        // forward-headers-strategy=native: remoteAddr đã là IP thật phía sau nginx
        String key = group + ":" + request.getRemoteAddr();
        Limited limited = buckets.computeIfAbsent(key, k -> new Limited(newBucket(capacity), capacity));
        if (limited.bucket().tryConsume(1)) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(ErrorCode.TOO_MANY_REQUESTS.getHttpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Retry-After", "60");
        objectMapper.writeValue(response.getOutputStream(),
                GlobalExceptionHandler.body(ErrorCode.TOO_MANY_REQUESTS, null, null));
    }

    /** @return nhóm giới hạn, hoặc null nếu request không bị giới hạn */
    private static String group(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getRequestURI();
        if ("OPTIONS".equalsIgnoreCase(method)) {
            return null; // CORS preflight không tính lượt
        }
        if ("POST".equalsIgnoreCase(method) && "/api/orders".equals(path)) {
            return "order";
        }
        if ("/api/auth/refresh".equals(path) || "/api/auth/logout".equals(path)) {
            return "session";
        }
        if ("/api/public/delivery/reverse-geocode".equals(path)) {
            return "geocode";
        }
        return path.startsWith("/api/auth/") ? "auth" : null;
    }

    private static Bucket newBucket(int capacity) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(capacity)
                        .refillGreedy(capacity, Duration.ofMinutes(1))
                        .build())
                .build();
    }

    /** Dọn bucket đã đầy lại (IP không còn hoạt động) để map không phình. */
    @Scheduled(fixedDelay = 10 * 60 * 1000)
    void cleanup() {
        buckets.entrySet().removeIf(e -> e.getValue().bucket().getAvailableTokens() >= e.getValue().capacity());
    }
}
