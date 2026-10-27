package com.flowershop.review.repository;

import com.flowershop.review.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long>, JpaSpecificationExecutor<Review> {

    boolean existsByOrderIdAndProductId(Long orderId, Long productId);

    List<Review> findByUserIdAndOrderIdIn(Long userId, Collection<Long> orderIds);

    /** [avg, count] của đánh giá đã duyệt */
    @Query("""
            SELECT avg(r.rating), count(r) FROM Review r
            WHERE r.productId = :productId AND r.status = com.flowershop.review.entity.Review.Status.APPROVED
            """)
    List<Object[]> ratingSummary(@Param("productId") Long productId);

    /** [rating, count] của đánh giá đã duyệt */
    @Query("""
            SELECT r.rating, count(r) FROM Review r
            WHERE r.productId = :productId AND r.status = com.flowershop.review.entity.Review.Status.APPROVED
            GROUP BY r.rating
            """)
    List<Object[]> ratingDistribution(@Param("productId") Long productId);

    @Query("""
            SELECT count(r) FROM Review r
            WHERE r.productId = :productId AND r.status = com.flowershop.review.entity.Review.Status.APPROVED
              AND EXISTS (SELECT 1 FROM ReviewMedia m WHERE m.review = r)
            """)
    long countApprovedWithMedia(@Param("productId") Long productId);
}
