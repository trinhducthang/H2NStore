package com.flowershop.notification;

import com.flowershop.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

/**
 * Gửi tin nhắn Telegram cho shop qua Bot API. Chưa cấu hình token thì chỉ ghi log.
 */
@Slf4j
@Component
public class TelegramNotifier {

    private final RestClient restClient;
    private final String botToken;
    private final String chatId;

    public TelegramNotifier(RestClient.Builder builder, AppProperties props) {
        this.restClient = builder.baseUrl("https://api.telegram.org").build();
        this.botToken = props.telegram().botToken();
        this.chatId = props.telegram().chatId();
    }

    public boolean isEnabled() {
        return botToken != null && !botToken.isBlank() && chatId != null && !chatId.isBlank();
    }

    /** text dạng HTML của Telegram (chỉ dùng b, i, code), phải escape dữ liệu người dùng. */
    public void send(String html) {
        if (!isEnabled()) {
            // Chỉ log dòng đầu: phần sau có SĐT đầy đủ, không được ghi ra log
            log.info("[Telegram tắt] {}", html.replaceAll("<[^>]+>", "").lines().findFirst().orElse(""));
            return;
        }
        try {
            restClient.post()
                    .uri("/bot{token}/sendMessage", botToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("chat_id", chatId, "text", html, "parse_mode", "HTML",
                            "disable_web_page_preview", true))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            log.warn("Gửi Telegram thất bại: {}", e.getMessage());
        }
    }

    public static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
