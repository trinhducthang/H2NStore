package com.flowershop.coupon.repository;

import com.flowershop.coupon.entity.Coupon;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {

    Optional<Coupon> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    @Query("""
            SELECT c FROM Coupon c
            WHERE (:q IS NULL OR lower(c.code) LIKE lower(concat('%', CAST(:q AS string), '%')))
            """)
    Page<Coupon> search(@Param("q") String q, Pageable pageable);

    /** Tăng lượt dùng có điều kiện: 0 dòng bị ảnh hưởng = hết lượt. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            UPDATE coupons SET used_count = used_count + 1, updated_at = now()
            WHERE id = :id AND (usage_limit IS NULL OR used_count < usage_limit)
            """, nativeQuery = true)
    int incrementUsage(@Param("id") Long id);

    @Modifying(flushAutomatically = true)
    @Query(value = """
            UPDATE coupons SET used_count = used_count - 1, updated_at = now()
            WHERE id = :id AND used_count > 0
            """, nativeQuery = true)
    int decrementUsage(@Param("id") Long id);
}
