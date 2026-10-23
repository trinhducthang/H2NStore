package com.flowershop.coupon.service;

import com.flowershop.coupon.entity.Coupon;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CouponServiceTest {

    private static Coupon coupon(Coupon.Type type, long value, Long maxDiscount) {
        Coupon c = new Coupon();
        c.setType(type);
        c.setValue(value);
        c.setMaxDiscount(maxDiscount);
        return c;
    }

    @Test
    void percentDiscountIsCappedByMaxDiscount() {
        assertThat(CouponService.calculateDiscount(coupon(Coupon.Type.PERCENT, 5, 50_000L), 550_000))
                .isEqualTo(27_500);
        assertThat(CouponService.calculateDiscount(coupon(Coupon.Type.PERCENT, 10, 50_000L), 2_000_000))
                .isEqualTo(50_000);
        assertThat(CouponService.calculateDiscount(coupon(Coupon.Type.PERCENT, 10, null), 2_000_000))
                .isEqualTo(200_000);
    }

    @Test
    void fixedDiscountNeverExceedsSubtotal() {
        assertThat(CouponService.calculateDiscount(coupon(Coupon.Type.FIXED, 50_000, null), 600_000))
                .isEqualTo(50_000);
        assertThat(CouponService.calculateDiscount(coupon(Coupon.Type.FIXED, 50_000, null), 30_000))
                .isEqualTo(30_000);
    }
}
