package com.flowershop.coupon.entity;

import com.flowershop.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "coupons")
public class Coupon extends BaseEntity {

    public enum Type { PERCENT, FIXED }

    @Column(nullable = false)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    /** PERCENT: phần trăm (1-100); FIXED: số tiền VNĐ */
    @Column(nullable = false)
    private long value;

    @Column(name = "max_discount")
    private Long maxDiscount;

    @Column(name = "min_order", nullable = false)
    private long minOrder;

    /** null = không giới hạn lượt */
    @Column(name = "usage_limit")
    private Integer usageLimit;

    @Column(name = "used_count", nullable = false)
    private int usedCount;

    @Column(name = "starts_at")
    private OffsetDateTime startsAt;

    @Column(name = "ends_at")
    private OffsetDateTime endsAt;

    @Column(nullable = false)
    private boolean active = true;
}
