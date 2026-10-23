package com.flowershop.banner.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class BannerDtos {

    private BannerDtos() {
    }

    /** Đường dẫn nội bộ "/..." (không phải "//...") hoặc URL http(s). Chặn "javascript:", "data:"... */
    public static final String LINK_REGEX = "^(/(?!/)\\S*|https?://\\S+)$";

    public record BannerRequest(
            @Size(max = 150) String title,
            @Size(max = 300) String subtitle,
            @Size(max = 50) String buttonText,
            @Size(max = 500)
            @Pattern(regexp = LINK_REGEX, message = "Liên kết phải bắt đầu bằng / hoặc http(s)://")
            String linkUrl,
            @Min(0) @Max(9999) Integer sortOrder,
            Boolean active,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt) {
    }

    /**
     * displayStatus: SHOWING (đang hiện), INACTIVE (đã tắt), NO_IMAGE (chưa có ảnh),
     * SCHEDULED (chưa đến giờ), EXPIRED (đã hết hạn).
     */
    public record BannerResponse(Long id, String title, String subtitle, String buttonText, String linkUrl,
                                 String imageUrl, int sortOrder, boolean active, OffsetDateTime startsAt,
                                 OffsetDateTime endsAt, String displayStatus, OffsetDateTime updatedAt) {
    }

    /** Dữ liệu banner cho trang chủ (chỉ banner đang hiển thị). */
    public record PublicBanner(Long id, String title, String subtitle, String buttonText, String linkUrl,
                               String imageUrl) {
    }
}
