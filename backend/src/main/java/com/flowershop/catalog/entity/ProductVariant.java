package com.flowershop.catalog.entity;

import com.flowershop.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "product_variants")
public class ProductVariant extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String sku;

    @Column(nullable = false)
    private long price;

    @Column(name = "sale_price")
    private Long salePrice;

    @Column(nullable = false)
    private int stock;

    @Column(nullable = false)
    private boolean active = true;

    /** Giá bán thực tế: sale_price nếu có, ngược lại price. */
    public long effectivePrice() {
        return salePrice != null ? salePrice : price;
    }
}
