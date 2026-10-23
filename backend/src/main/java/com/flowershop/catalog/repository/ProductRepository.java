package com.flowershop.catalog.repository;

import com.flowershop.catalog.entity.Product;
import com.flowershop.catalog.entity.ProductStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {

    @EntityGraph(attributePaths = {"categories"})
    Optional<Product> findBySlugAndDeletedAtIsNull(String slug);

    Optional<Product> findByIdAndDeletedAtIsNull(Long id);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, Long id);

    @Query("""
            SELECT p FROM Product p
            WHERE p.deletedAt IS NULL
              AND (:status IS NULL OR p.status = :status)
              AND (:q IS NULL OR lower(p.name) LIKE lower(concat('%', CAST(:q AS string), '%'))
                   OR lower(p.slug) LIKE lower(concat('%', CAST(:q AS string), '%'))
                   OR EXISTS (SELECT 1 FROM ProductVariant v WHERE v.product = p
                              AND lower(v.sku) LIKE lower(concat('%', CAST(:q AS string), '%'))))
            """)
    Page<Product> adminSearch(@Param("q") String q, @Param("status") ProductStatus status, Pageable pageable);

    /** Sản phẩm cùng danh mục, còn bán, sắp theo bán chạy. */
    @Query("""
            SELECT DISTINCT p FROM Product p JOIN p.categories c
            WHERE c.id IN :categoryIds AND p.id <> :excludeId
              AND p.deletedAt IS NULL AND p.status = com.flowershop.catalog.entity.ProductStatus.ACTIVE
            ORDER BY p.soldCount DESC, p.id DESC
            """)
    List<Product> findRelated(@Param("categoryIds") Collection<Long> categoryIds,
                              @Param("excludeId") Long excludeId, Pageable pageable);
}
