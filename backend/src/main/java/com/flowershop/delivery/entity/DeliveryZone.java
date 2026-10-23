package com.flowershop.delivery.entity;

import com.flowershop.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "delivery_zones")
public class DeliveryZone extends BaseEntity {

    @Column(nullable = false)
    private String name;

    /** Danh sách quận/huyện, phân tách bằng dấu phẩy */
    private String districts;

    @Column(name = "shipping_fee", nullable = false)
    private long shippingFee;

    /** null = không hỗ trợ giao EXPRESS */
    @Column(name = "express_fee")
    private Long expressFee;

    @Column(nullable = false)
    private boolean active = true;

    public boolean isExpressAvailable() {
        return expressFee != null;
    }
}
