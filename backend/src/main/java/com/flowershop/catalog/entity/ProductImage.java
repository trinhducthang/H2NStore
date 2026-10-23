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
@Table(name = "product_images")
public class ProductImage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String url;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "is_thumbnail", nullable = false)
    private boolean thumbnail;
}
