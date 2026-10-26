package com.flowershop.review.dto;

import com.flowershop.review.entity.Review;
import com.flowershop.review.entity.ReviewMedia;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class ReviewDtos {

    private ReviewDtos() {
    }

    /** Phần JSON "review" của request multipart; ảnh/video gửi ở phần "files". */
    public record CreateReviewRequest(@NotBlank String orderCode,
                                      @NotNull Long productId,
                                      @NotNull @Min(1) @Max(5) Integer rating,
                                      @Size(max = 2000) String content) {
    }

    /** keepMediaIds: ảnh/video cũ muốn giữ (không gửi = bỏ hết); file mới gửi ở phần "files". */
    public record UpdateReviewRequest(@NotNull @Min(1) @Max(5) Integer rating,
                                      @Size(max = 2000) String content,
                                      List<Long> keepMediaIds) {
    }

    public record UpdateReviewStatusRequest(@NotNull Review.Status status) {
    }

    /** Để trống = gỡ phản hồi */
    public record ReplyRequest(@Size(max = 1000) String reply) {
    }

    public record MediaResponse(Long id, ReviewMedia.Type type, String url) {
    }

    /**
     * authorName đã che bớt, ví dụ "Nguyễn V***".
     * product*, orderCode chỉ có ở trang của khách và admin; editable/editableUntil chỉ có ở trang của khách.
     */
    public record ReviewResponse(Long id, Long productId, String productName, String productSlug,
                                 String productThumbnail, String variantName, String authorName, int rating,
                                 String content, List<MediaResponse> media, String reply,
                                 OffsetDateTime repliedAt, Review.Status status, boolean edited,
                                 Boolean editable, OffsetDateTime editableUntil, String orderCode,
                                 OffsetDateTime createdAt) {
    }

    /** Sản phẩm đã giao, chưa đánh giá. deadline: hết hạn đánh giá. */
    public record PendingReviewItem(String orderCode, Long productId, String productName, String productSlug,
                                    String thumbnailUrl, String variantName, OffsetDateTime deliveredAt,
                                    OffsetDateTime deadline) {
    }

    /** Dữ liệu phẳng cho listener báo Telegram (chạy ngoài transaction). */
    public record ReviewNotificationView(String productName, int rating, String content, long imageCount,
                                         long videoCount) {
    }

    public record RatingSummary(Double average, long count) {
    }

    /** distribution: số sao -> số đánh giá (đủ 1..5); withMedia: số đánh giá có ảnh/video. Chỉ tính đã duyệt. */
    public record RatingBreakdown(Double average, long count, Map<Integer, Long> distribution, long withMedia) {
    }
}
