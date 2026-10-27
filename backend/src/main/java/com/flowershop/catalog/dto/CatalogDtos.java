package com.flowershop.catalog.dto;

import com.flowershop.catalog.entity.CategoryType;
import com.flowershop.catalog.entity.ProductStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

public final class CatalogDtos {

    private CatalogDtos() {
    }

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
    private static final String SLUG_MESSAGE = "Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang";

    // ------------------------------------------------------------ public

    public record CategoryResponse(Long id, String name, String slug, CategoryType type, Long parentId,
                                   int sortOrder, boolean active, List<CategoryResponse> children) {
    }

    public record CategoryRef(Long id, String name, String slug, CategoryType type) {
    }

    /** price: giá bán thấp nhất; compareAtPrice: giá gốc nếu đang giảm giá. */
    public record ProductSummary(Long id, String name, String slug, ProductStatus status, int soldCount,
                                 String thumbnailUrl, Long price, Long compareAtPrice) {
    }

    /** Thông tin gọn để hiển thị kèm đánh giá; slug null nếu sản phẩm đã ẩn/xóa (không mở trang được). */
    public record ProductRef(Long id, String name, String slug, String thumbnailUrl) {
    }

    public record VariantResponse(Long id, String name, String sku, long price, Long salePrice,
                                  long effectivePrice, int stock, boolean active) {
    }

    public record ImageResponse(Long id, String url, int sortOrder, boolean thumbnail) {
    }

    public record ProductDetail(Long id, String name, String slug, String description, ProductStatus status,
                                int soldCount, List<CategoryRef> categories, List<VariantResponse> variants,
                                List<ImageResponse> images, Double ratingAvg, Long ratingCount) {

        public ProductDetail withRating(Double avg, long count) {
            return new ProductDetail(id, name, slug, description, status, soldCount, categories, variants, images,
                    avg, count);
        }
    }

    // ------------------------------------------------------------ admin

    public record AdminProductSummary(Long id, String name, String slug, ProductStatus status, int soldCount,
                                      String thumbnailUrl, Long minPrice, int totalStock, int variantCount,
                                      OffsetDateTime updatedAt) {
    }

    public record VariantRequest(
            Long id,
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Size(max = 64) String sku,
            @NotNull @PositiveOrZero Long price,
            @PositiveOrZero Long salePrice,
            @NotNull @PositiveOrZero @Max(100_000) Integer stock,
            Boolean active) {
    }

    public record ProductUpsertRequest(
            @NotBlank @Size(max = 200) String name,
            @Size(max = 220) @Pattern(regexp = SLUG_REGEX, message = SLUG_MESSAGE) String slug,
            @Size(max = 10_000) String description,
            @NotNull ProductStatus status,
            List<Long> categoryIds,
            @NotEmpty(message = "Cần ít nhất 1 biến thể") @Size(max = 10) List<@Valid VariantRequest> variants) {
    }

    public record ProductStatusRequest(@NotNull ProductStatus status) {
    }

    public record ImageUpdateRequest(@PositiveOrZero Integer sortOrder, Boolean thumbnail) {
    }

    public record CategoryRequest(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 120) @Pattern(regexp = SLUG_REGEX, message = SLUG_MESSAGE) String slug,
            @NotNull CategoryType type,
            Long parentId,
            Integer sortOrder,
            Boolean active) {
    }
}
