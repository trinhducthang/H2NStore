package com.flowershop.catalog.service;

import com.flowershop.catalog.entity.Product;
import com.flowershop.catalog.entity.ProductVariant;
import com.flowershop.catalog.repository.ProductVariantRepository;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * API của module catalog cho giỏ hàng và đơn hàng: lấy biến thể, khóa, trừ/hoàn tồn kho.
 */
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final ProductVariantRepository variantRepository;

    @Transactional(readOnly = true)
    public Map<Long, ProductVariant> findVariants(Collection<Long> ids) {
        return toMap(variantRepository.findWithProduct(ids));
    }

    /** SELECT ... FOR UPDATE, phải gọi trong transaction của đơn hàng. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Map<Long, ProductVariant> lockVariants(Collection<Long> ids) {
        return toMap(variantRepository.lockWithProduct(ids));
    }

    @Transactional(readOnly = true)
    public ProductVariant getPurchasableVariant(Long id) {
        ProductVariant variant = variantRepository.findWithProduct(List.of(id)).stream().findFirst()
                .orElseThrow(() -> BusinessException.notFound("sản phẩm"));
        requirePurchasable(variant);
        return variant;
    }

    public void requirePurchasable(ProductVariant variant) {
        Product product = variant.getProduct();
        if (!variant.isActive() || !product.isPurchasable()) {
            throw new BusinessException(ErrorCode.OUT_OF_STOCK,
                    "Sản phẩm \"" + product.getName() + "\" hiện không còn bán");
        }
    }

    public void requireStock(ProductVariant variant, int quantity) {
        requirePurchasable(variant);
        if (variant.getStock() < quantity) {
            throw new BusinessException(ErrorCode.OUT_OF_STOCK, "\"%s - %s\" chỉ còn %d sản phẩm".formatted(
                    variant.getProduct().getName(), variant.getName(), variant.getStock()));
        }
    }

    /** Trừ tồn kho, tăng lượt bán. Biến thể phải đang bị khóa bởi {@link #lockVariants}. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void decreaseStock(ProductVariant variant, int quantity) {
        requireStock(variant, quantity);
        variant.setStock(variant.getStock() - quantity);
        Product product = variant.getProduct();
        product.setSoldCount(product.getSoldCount() + quantity);
    }

    /** Hoàn tồn kho khi hủy đơn. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void restoreStock(Map<Long, Integer> quantityByVariant) {
        Map<Long, ProductVariant> variants = lockVariants(quantityByVariant.keySet());
        quantityByVariant.forEach((variantId, qty) -> {
            ProductVariant variant = variants.get(variantId);
            if (variant == null) {
                return;
            }
            variant.setStock(variant.getStock() + qty);
            Product product = variant.getProduct();
            product.setSoldCount(Math.max(0, product.getSoldCount() - qty));
        });
    }

    private static Map<Long, ProductVariant> toMap(List<ProductVariant> variants) {
        return variants.stream().collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
    }
}
