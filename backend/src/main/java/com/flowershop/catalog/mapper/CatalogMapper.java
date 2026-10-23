package com.flowershop.catalog.mapper;

import com.flowershop.catalog.dto.CatalogDtos.CategoryRef;
import com.flowershop.catalog.dto.CatalogDtos.ImageResponse;
import com.flowershop.catalog.dto.CatalogDtos.ProductDetail;
import com.flowershop.catalog.dto.CatalogDtos.VariantResponse;
import com.flowershop.catalog.entity.Category;
import com.flowershop.catalog.entity.Product;
import com.flowershop.catalog.entity.ProductImage;
import com.flowershop.catalog.entity.ProductVariant;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper
public interface CatalogMapper {

    CategoryRef toRef(Category category);

    @Mapping(target = "effectivePrice", expression = "java(variant.effectivePrice())")
    VariantResponse toVariant(ProductVariant variant);

    ImageResponse toImage(ProductImage image);

    List<ImageResponse> toImages(List<ProductImage> images);

    @Mapping(target = "variants", ignore = true)
    @Mapping(target = "ratingAvg", ignore = true)
    @Mapping(target = "ratingCount", ignore = true)
    ProductDetail toDetailBase(Product product);

    /** variants truyền vào để lọc tùy ngữ cảnh (public chỉ biến thể active, admin tất cả). */
    default ProductDetail toDetail(Product product, List<ProductVariant> variants) {
        ProductDetail base = toDetailBase(product);
        return new ProductDetail(base.id(), base.name(), base.slug(), base.description(), base.status(),
                base.soldCount(), base.categories(), variants.stream().map(this::toVariant).toList(),
                base.images(), null, null);
    }
}
