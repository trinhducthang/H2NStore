package com.flowershop.review.repository;

import com.flowershop.review.entity.Review;
import com.flowershop.review.entity.ReviewMedia;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/** Bộ lọc đánh giá; chỉ thêm điều kiện khi có giá trị (giống OrderSpecs). */
public final class ReviewSpecs {

    private ReviewSpecs() {
    }

    public record Filter(Long productId, Long userId, List<Long> orderIds, Review.Status status, Integer rating,
                         boolean withMediaOnly) {
    }

    public static Specification<Review> of(Filter f) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (f.productId() != null) {
                predicates.add(cb.equal(root.get("productId"), f.productId()));
            }
            if (f.userId() != null) {
                predicates.add(cb.equal(root.get("userId"), f.userId()));
            }
            if (f.orderIds() != null) {
                predicates.add(f.orderIds().isEmpty() ? cb.disjunction() : root.get("orderId").in(f.orderIds()));
            }
            if (f.status() != null) {
                predicates.add(cb.equal(root.get("status"), f.status()));
            }
            if (f.rating() != null) {
                predicates.add(cb.equal(root.get("rating"), f.rating()));
            }
            if (f.withMediaOnly()) {
                Subquery<Long> media = query.subquery(Long.class);
                var m = media.from(ReviewMedia.class);
                media.select(m.get("id")).where(cb.equal(m.get("review"), root));
                predicates.add(cb.exists(media));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
