package com.flowershop.catalog.service;

import com.flowershop.catalog.dto.CatalogDtos.ProductDetail;
import com.flowershop.catalog.dto.CatalogDtos.ProductRef;
import com.flowershop.catalog.dto.CatalogDtos.ProductSummary;
import com.flowershop.catalog.dto.CatalogDtos.SitemapProduct;
import com.flowershop.catalog.entity.Category;
import com.flowershop.catalog.entity.Product;
import com.flowershop.catalog.entity.ProductStatus;
import com.flowershop.catalog.entity.ProductVariant;
import com.flowershop.catalog.mapper.CatalogMapper;
import com.flowershop.catalog.repository.ProductRepository;
import com.flowershop.catalog.repository.ProductSearchRepository;
import com.flowershop.common.dto.PageQuery;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductQueryService {

    private static final int RELATED_LIMIT = 8;

    private final ProductRepository productRepository;
    private final ProductSearchRepository searchRepository;
    private final CatalogMapper mapper;

    @Transactional(readOnly = true)
    public PageResponse<ProductSummary> search(String q, String categorySlug, Long minPrice, Long maxPrice,
                                               boolean onSale, String sort, Integer page, Integer size) {
        int p = PageQuery.page(page);
        int s = PageQuery.size(size);
        var result = searchRepository.search(
                new ProductSearchRepository.Criteria(q, categorySlug, minPrice, maxPrice, onSale, sort, p, s));
        return PageResponse.of(result.content(), p, s, result.total());
    }

    /** Chi tiết công khai: ẩn sản phẩm HIDDEN/đã xóa, chỉ trả biến thể đang bán. */
    @Transactional(readOnly = true)
    public ProductDetail getPublicDetail(String slug) {
        Product product = productRepository.findBySlugAndDeletedAtIsNull(slug)
                .filter(p -> p.getStatus() != ProductStatus.HIDDEN)
                .orElseThrow(() -> BusinessException.notFound("sản phẩm"));
        // Biến thể rẻ nhất lên đầu để làm lựa chọn mặc định
        List<ProductVariant> variants = product.getVariants().stream().filter(ProductVariant::isActive)
                .sorted(Comparator.comparingLong(ProductVariant::effectivePrice)).toList();
        return mapper.toDetail(product, variants);
    }

    @Transactional(readOnly = true)
    public List<ProductSummary> related(String slug) {
        Product product = productRepository.findBySlugAndDeletedAtIsNull(slug)
                .orElseThrow(() -> BusinessException.notFound("sản phẩm"));
        List<Long> categoryIds = product.getCategories().stream().map(Category::getId).toList();
        if (categoryIds.isEmpty()) {
            return List.of();
        }
        return productRepository.findRelated(categoryIds, product.getId(), PageRequest.of(0, RELATED_LIMIT))
                .stream()
                .map(ProductQueryService::toSummary)
                .filter(s -> s.price() != null)
                .toList();
    }

    @Transactional(readOnly = true)
    public Long getPublicProductId(String slug) {
        return productRepository.findBySlugAndDeletedAtIsNull(slug)
                .filter(p -> p.getStatus() != ProductStatus.HIDDEN)
                .map(Product::getId)
                .orElseThrow(() -> BusinessException.notFound("sản phẩm"));
    }

    /** Sản phẩm mở được trang chi tiết (chưa xóa, không ẩn), cho sitemap.xml. */
    @Transactional(readOnly = true)
    public List<SitemapProduct> sitemapEntries() {
        return productRepository.findByDeletedAtIsNullAndStatusNotOrderByIdAsc(ProductStatus.HIDDEN).stream()
                .map(p -> new SitemapProduct(p.getSlug(), p.getUpdatedAt()))
                .toList();
    }

    /** Tra nhanh tên, slug, ảnh đại diện theo id (gồm cả sản phẩm đã ẩn/xóa). */
    @Transactional(readOnly = true)
    public Map<Long, ProductRef> findRefs(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return productRepository.findAllById(ids).stream().collect(Collectors.toMap(Product::getId, p -> {
            boolean visible = p.getDeletedAt() == null && p.getStatus() != ProductStatus.HIDDEN;
            return new ProductRef(p.getId(), p.getName(), visible ? p.getSlug() : null, p.thumbnailUrl());
        }));
    }

    static ProductSummary toSummary(Product p) {
        ProductVariant cheapest = p.getVariants().stream()
                .filter(ProductVariant::isActive)
                .min(Comparator.comparingLong(ProductVariant::effectivePrice))
                .orElse(null);
        return new ProductSummary(p.getId(), p.getName(), p.getSlug(), p.getStatus(), p.getSoldCount(),
                p.thumbnailUrl(),
                cheapest != null ? cheapest.effectivePrice() : null,
                cheapest != null && cheapest.getSalePrice() != null ? cheapest.getPrice() : null);
    }
}
