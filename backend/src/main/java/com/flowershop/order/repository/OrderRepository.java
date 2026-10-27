package com.flowershop.order.repository;

import com.flowershop.delivery.entity.DeliverySlot;
import com.flowershop.order.entity.Order;
import com.flowershop.order.entity.OrderStatus;
import com.flowershop.order.entity.PaymentMethod;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    Optional<Order> findByCode(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.code = :code")
    Optional<Order> findByCodeForUpdate(@Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);

    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    Optional<Order> findByCodeAndUserId(String code, Long userId);

    Page<Order> findByUserId(Long userId, Pageable pageable);

    /** updatedAt luôn >= thời điểm giao, nên lọc theo updatedAt để bỏ bớt đơn giao quá lâu (dùng cho đánh giá) */
    List<Order> findByUserIdAndStatusAndUpdatedAtGreaterThanEqualOrderByIdDesc(Long userId,
                                                                               OrderStatus status,
                                                                               OffsetDateTime since);

    @Query("""
            SELECT count(o) FROM Order o
            WHERE o.deliveryDate = :date AND o.deliverySlot = :slot
              AND o.status <> com.flowershop.order.entity.OrderStatus.CANCELLED
            """)
    long countActiveBySlot(@Param("date") LocalDate date, @Param("slot") DeliverySlot slot);

    @Query("""
            SELECT o.deliverySlot, count(o) FROM Order o
            WHERE o.deliveryDate = :date AND o.status <> com.flowershop.order.entity.OrderStatus.CANCELLED
            GROUP BY o.deliverySlot
            """)
    List<Object[]> countActiveByDate(@Param("date") LocalDate date);

    /** Đơn thanh toán online còn PENDING, chưa nhận đồng nào, tạo trước mốc cutoff. */
    @Query("""
            SELECT o.id FROM Order o
            WHERE o.paymentMethod = :method
              AND o.paymentStatus = com.flowershop.order.entity.PaymentStatus.UNPAID
              AND o.status = com.flowershop.order.entity.OrderStatus.PENDING
              AND o.paidAmount = 0
              AND o.createdAt < :cutoff
            ORDER BY o.id
            """)
    List<Long> findExpiredUnpaidIds(@Param("method") PaymentMethod method, @Param("cutoff") OffsetDateTime cutoff,
                                    Pageable pageable);
}
