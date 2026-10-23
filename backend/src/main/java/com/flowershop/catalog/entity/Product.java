package com.flowershop.catalog.entity;

import com.flowershop.common.entity.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "products")
public class Product extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String slug;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductStatus status = ProductStatus.ACTIVE;

    @Column(name = "sold_count", nullable = false)
    private int soldCount;

    /** Xóa mềm */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @ManyToMany
    @JoinTable(name = "product_categories",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id"))
    private Set<Category> categories = new LinkedHashSet<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL)
    @OrderBy("id ASC")
    private List<ProductVariant> variants = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<ProductImage> images = new ArrayList<>();

    public boolean isPurchasable() {
        return deletedAt == null && status == ProductStatus.ACTIVE;
    }

    /** Ảnh đại diện: ảnh đánh dấu thumbnail, không có thì ảnh đầu tiên. */
    public String thumbnailUrl() {
        return images.stream()
                .min(Comparator.comparing((ProductImage i) -> !i.isThumbnail())
                        .thenComparingInt(ProductImage::getSortOrder))
                .map(ProductImage::getUrl)
                .orElse(null);
    }
}
