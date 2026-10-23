package com.flowershop.coupon.dto;

import com.flowershop.coupon.entity.Coupon;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class CouponDtos {

    private CouponDtos() {
    }

    public record ValidateCouponRequest(@NotBlank @Size(max = 50) String code,
                                        @NotNull @PositiveOrZero Long subtotal) {
    }

    public record ValidateCouponResponse(String code, Coupon.Type type, long value, long discount) {
    }

    /** Kết quả tính giảm giá dùng nội bộ cho OrderPricingService. */
    public record CouponQuote(Long couponId, String code, long discount) {
    }

    public record CouponRequest(
            @NotBlank @Size(max = 50) @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "Mã chỉ gồm chữ, số, _ và -")
            String code,
            @NotNull Coupon.Type type,
            @NotNull @Positive Long value,
            @PositiveOrZero Long maxDiscount,
            @PositiveOrZero Long minOrder,
            @Positive Integer usageLimit,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            Boolean active) {
    }

    public record CouponResponse(Long id, String code, Coupon.Type type, long value, Long maxDiscount,
                                 long minOrder, Integer usageLimit, int usedCount, OffsetDateTime startsAt,
                                 OffsetDateTime endsAt, boolean active, OffsetDateTime createdAt) {
        public static CouponResponse from(Coupon c) {
            return new CouponResponse(c.getId(), c.getCode(), c.getType(), c.getValue(), c.getMaxDiscount(),
                    c.getMinOrder(), c.getUsageLimit(), c.getUsedCount(), c.getStartsAt(), c.getEndsAt(),
                    c.isActive(), c.getCreatedAt());
        }
    }
}
