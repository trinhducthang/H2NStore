package com.flowershop.catalog.repository;

import com.flowershop.catalog.entity.ProductVariant;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    @Query("SELECT v FROM ProductVariant v JOIN FETCH v.product WHERE v.id IN :ids")
    List<ProductVariant> findWithProduct(@Param("ids") Collection<Long> ids);

    /** SELECT ... FOR UPDATE, sắp theo id để các giao dịch khóa cùng thứ tự (tránh deadlock). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM ProductVariant v JOIN FETCH v.product WHERE v.id IN :ids ORDER BY v.id")
    List<ProductVariant> lockWithProduct(@Param("ids") Collection<Long> ids);

    boolean existsBySku(String sku);

    boolean existsBySkuAndIdNot(String sku, Long id);
}
