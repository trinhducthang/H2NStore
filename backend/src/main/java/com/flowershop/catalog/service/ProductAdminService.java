package com.flowershop.catalog.service;

import com.flowershop.catalog.dto.CatalogDtos.AdminProductSummary;
import com.flowershop.catalog.dto.CatalogDtos.ImageResponse;
import com.flowershop.catalog.dto.CatalogDtos.ImageUpdateRequest;
import com.flowershop.catalog.dto.CatalogDtos.ProductDetail;
import com.flowershop.catalog.dto.CatalogDtos.ProductUpsertRequest;
import com.flowershop.catalog.dto.CatalogDtos.VariantRequest;
import com.flowershop.catalog.entity.Product;
import com.flowershop.catalog.entity.ProductImage;
import com.flowershop.catalog.entity.ProductStatus;
import com.flowershop.catalog.entity.ProductVariant;
import com.flowershop.catalog.mapper.CatalogMapper;
import com.flowershop.catalog.repository.ProductImageRepository;
import com.flowershop.catalog.repository.ProductRepository;
import com.flowershop.catalog.repository.ProductVariantRepository;
import com.flowershop.common.dto.PageQuery;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.SlugUtils;
import com.flowershop.common.util.TimeUtils;
import com.flowershop.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductAdminService {

    private static final int MAX_IMAGES_PER_PRODUCT = 10;

    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;
    private final ProductImageRepository imageRepository;
    private final CategoryService categoryService;
    private final StorageService storageService;
    private final CatalogMapper mapper;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<AdminProductSummary> search(String q, ProductStatus status, Integer page, Integer size) {
        var pageable = PageQuery.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        return PageResponse.of(productRepository.adminSearch(q, status, pageable), ProductAdminService::toSummary);
    }

    @Transactional(readOnly = true)
    public ProductDetail get(Long id) {
        Product product = getProduct(id);
        return mapper.toDetail(product, product.getVariants());
    }

    @Transactional
    public ProductDetail create(ProductUpsertRequest req) {
        Product product = new Product();
        apply(product, req);
        productRepository.save(product);
        return mapper.toDetail(product, product.getVariants());
    }

    @Transactional
    public ProductDetail update(Long id, ProductUpsertRequest req) {
        Product product = getProduct(id);
        apply(product, req);
        productRepository.flush();
        return mapper.toDetail(product, product.getVariants());
    }

    @Transactional
    public ProductDetail updateStatus(Long id, ProductStatus status) {
        Product product = getProduct(id);
        product.setStatus(status);
        return mapper.toDetail(product, product.getVariants());
    }

    /** Xóa mềm: giữ lại để đơn hàng cũ vẫn tham chiếu được; giải phóng slug. */
    @Transactional
    public void softDelete(Long id) {
        Product product = getProduct(id);
        product.setDeletedAt(TimeUtils.now(clock));
        product.setStatus(ProductStatus.HIDDEN);
        product.setSlug(product.getSlug() + "-deleted-" + product.getId());
        product.getVariants().forEach(v -> {
            v.setActive(false);
            v.setSku(v.getSku() + "-DEL" + v.getId());
        });
    }

    // ---------------------------------------------------------------- images

    @Transactional
    public List<ImageResponse> uploadImages(Long productId, List<MultipartFile> files) {
        Product product = getProduct(productId);
        if (files == null || files.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_FILE);
        }
        if (product.getImages().size() + files.size() > MAX_IMAGES_PER_PRODUCT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Mỗi sản phẩm tối đa " + MAX_IMAGES_PER_PRODUCT + " ảnh");
        }
        int nextOrder = product.getImages().stream().mapToInt(ProductImage::getSortOrder).max().orElse(-1) + 1;
        boolean hasThumbnail = product.getImages().stream().anyMatch(ProductImage::isThumbnail);
        List<StorageService.StoredFile> stored = new ArrayList<>();
        try {
            for (MultipartFile file : files) {
                StorageService.StoredFile saved = storageService.storeImage(file, "products/" + productId);
                stored.add(saved);
                ProductImage image = new ProductImage();
                image.setProduct(product);
                image.setUrl(saved.url());
                image.setStorageKey(saved.key());
                image.setSortOrder(nextOrder++);
                image.setThumbnail(!hasThumbnail);
                hasThumbnail = true;
                product.getImages().add(image);
            }
            productRepository.flush();
        } catch (RuntimeException e) {
            // Lỗi giữa chừng: dọn file đã ghi để không để lại rác
            stored.forEach(s -> storageService.delete(s.key()));
            throw e;
        }
        return mapper.toImages(product.getImages());
    }

    @Transactional
    public ImageResponse updateImage(Long imageId, ImageUpdateRequest req) {
        ProductImage image = imageRepository.findById(imageId)
                .orElseThrow(() -> BusinessException.notFound("ảnh"));
        if (req.sortOrder() != null) {
            image.setSortOrder(req.sortOrder());
        }
        if (Boolean.TRUE.equals(req.thumbnail())) {
            image.getProduct().getImages().forEach(i -> i.setThumbnail(false));
            image.setThumbnail(true);
        }
        return mapper.toImage(image);
    }

    @Transactional
    public void deleteImage(Long imageId) {
        ProductImage image = imageRepository.findById(imageId)
                .orElseThrow(() -> BusinessException.notFound("ảnh"));
        Product product = image.getProduct();
        product.getImages().remove(image);
        if (image.isThumbnail()) {
            product.getImages().stream().findFirst().ifPresent(i -> i.setThumbnail(true));
        }
        String key = image.getStorageKey();
        // Chỉ xóa file khi DB đã commit
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storageService.delete(key);
            }
        });
    }

    // ---------------------------------------------------------------- helpers

    private Product getProduct(Long id) {
        return productRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> BusinessException.notFound("sản phẩm"));
    }

    private void apply(Product product, ProductUpsertRequest req) {
        String slug = req.slug() != null ? req.slug() : SlugUtils.slugify(req.name());
        boolean slugTaken = product.getId() == null ? productRepository.existsBySlug(slug)
                : productRepository.existsBySlugAndIdNot(slug, product.getId());
        if (slugTaken) {
            throw new BusinessException(ErrorCode.DUPLICATE, "Slug sản phẩm đã tồn tại");
        }
        product.setName(req.name());
        product.setSlug(slug);
        product.setDescription(req.description());
        product.setStatus(req.status());
        product.setCategories(new LinkedHashSet<>(categoryService.findAllById(req.categoryIds())));
        applyVariants(product, req.variants());
    }

    /**
     * Biến thể có id thì cập nhật, không có id thì thêm mới. Biến thể cũ không còn trong request
     * thì tắt (active=false) chứ không xóa, vì order_items còn tham chiếu.
     */
    private void applyVariants(Product product, List<VariantRequest> requests) {
        Set<String> skus = new HashSet<>();
        for (VariantRequest r : requests) {
            if (!skus.add(r.sku().toUpperCase())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "SKU bị trùng: " + r.sku());
            }
            if (r.salePrice() != null && r.salePrice() > r.price()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Giá khuyến mãi phải nhỏ hơn giá gốc");
            }
        }
        Map<Long, ProductVariant> existing = product.getVariants().stream()
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        Set<Long> keep = new HashSet<>();
        for (VariantRequest r : requests) {
            ProductVariant variant;
            if (r.id() != null) {
                variant = existing.get(r.id());
                if (variant == null) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Biến thể không thuộc sản phẩm: " + r.id());
                }
                keep.add(r.id());
            } else {
                variant = new ProductVariant();
                variant.setProduct(product);
                product.getVariants().add(variant);
            }
            String sku = r.sku().toUpperCase();
            boolean skuTaken = variant.getId() == null ? variantRepository.existsBySku(sku)
                    : variantRepository.existsBySkuAndIdNot(sku, variant.getId());
            if (skuTaken) {
                throw new BusinessException(ErrorCode.DUPLICATE, "SKU đã tồn tại: " + sku);
            }
            variant.setName(r.name());
            variant.setSku(sku);
            variant.setPrice(r.price());
            variant.setSalePrice(r.salePrice());
            variant.setStock(r.stock());
            variant.setActive(r.active() == null || r.active());
        }
        existing.values().stream()
                .filter(v -> !keep.contains(v.getId()))
                .forEach(v -> v.setActive(false));
    }

    private static AdminProductSummary toSummary(Product p) {
        List<ProductVariant> active = p.getVariants().stream().filter(ProductVariant::isActive).toList();
        Long minPrice = active.stream().map(ProductVariant::effectivePrice).min(Long::compare).orElse(null);
        int totalStock = active.stream().mapToInt(ProductVariant::getStock).sum();
        return new AdminProductSummary(p.getId(), p.getName(), p.getSlug(), p.getStatus(), p.getSoldCount(),
                p.thumbnailUrl(), minPrice, totalStock, active.size(), p.getUpdatedAt());
    }
}
