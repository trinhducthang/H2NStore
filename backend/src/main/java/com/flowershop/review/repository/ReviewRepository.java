package com.flowershop.review.repository;

import com.flowershop.review.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    Page<Review> findByProductIdAndStatus(Long productId, Review.Status status, Pageable pageable);

    Page<Review> findByStatus(Review.Status status, Pageable pageable);

    boolean existsByOrderIdAndProductId(Long orderId, Long productId);

    /** [avg, count] của đánh giá đã duyệt */
    @Query("""
            SELECT avg(r.rating), count(r) FROM Review r
            WHERE r.productId = :productId AND r.status = com.flowershop.review.entity.Review.Status.APPROVED
            """)
    List<Object[]> ratingSummary(@Param("productId") Long productId);
}
