package com.flowershop.review.dto;

import com.flowershop.review.entity.Review;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class ReviewDtos {

    private ReviewDtos() {
    }

    public record CreateReviewRequest(@NotBlank String orderCode,
                                      @NotNull Long productId,
                                      @NotNull @Min(1) @Max(5) Integer rating,
                                      @Size(max = 2000) String content) {
    }

    public record UpdateReviewStatusRequest(@NotNull Review.Status status) {
    }

    /** authorName đã che bớt, ví dụ "Nguyễn V***" */
    public record ReviewResponse(Long id, Long productId, String authorName, int rating, String content,
                                 Review.Status status, OffsetDateTime createdAt) {
    }

    public record RatingSummary(Double average, long count) {
    }
}
