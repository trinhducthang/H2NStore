package com.flowershop.payment.repository;

import com.flowershop.payment.entity.PaymentTransaction;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    boolean existsByProviderAndProviderTxnId(String provider, String providerTxnId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM PaymentTransaction t WHERE t.id = :id")
    Optional<PaymentTransaction> findByIdForUpdate(@Param("id") Long id);

    List<PaymentTransaction> findByOrderIdOrderByIdAsc(Long orderId);

    @Query("""
            SELECT t FROM PaymentTransaction t
            WHERE (:status IS NULL OR t.status = :status)
              AND (:q IS NULL OR upper(t.content) LIKE concat('%', upper(CAST(:q AS string)), '%')
                   OR t.orderCode LIKE concat('%', upper(CAST(:q AS string)), '%')
                   OR t.referenceCode LIKE concat('%', CAST(:q AS string), '%'))
            """)
    Page<PaymentTransaction> search(@Param("status") PaymentTransaction.Status status, @Param("q") String q,
                                    Pageable pageable);
}
