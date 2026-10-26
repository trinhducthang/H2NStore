package com.flowershop.review.entity;

import com.flowershop.common.entity.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "reviews")
public class Review extends BaseEntity {

    public enum Status { PENDING, APPROVED, HIDDEN }

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    /** Phân loại khách đã mua, chụp lại lúc đánh giá (VD: "Tiêu chuẩn, Cao cấp") */
    @Column(name = "variant_name")
    private String variantName;

    @Column(nullable = false)
    private int rating;

    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    /** Khách chỉ được sửa 1 lần */
    @Column(nullable = false)
    private boolean edited;

    /** Phản hồi của shop */
    private String reply;

    @Column(name = "replied_at")
    private OffsetDateTime repliedAt;

    @OneToMany(mappedBy = "review", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<ReviewMedia> media = new ArrayList<>();

    public void addMedia(ReviewMedia item) {
        item.setReview(this);
        media.add(item);
    }
}
