package com.flowershop.catalog.controller;

import com.flowershop.catalog.dto.CatalogDtos.CategoryResponse;
import com.flowershop.catalog.dto.CatalogDtos.ProductDetail;
import com.flowershop.catalog.dto.CatalogDtos.ProductSummary;
import com.flowershop.catalog.entity.CategoryType;
import com.flowershop.catalog.service.CategoryService;
import com.flowershop.catalog.service.ProductQueryService;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.review.dto.ReviewDtos.RatingBreakdown;
import com.flowershop.review.dto.ReviewDtos.RatingSummary;
import com.flowershop.review.dto.ReviewDtos.ReviewResponse;
import com.flowershop.review.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Public - catalog")
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicCatalogController {

    private final CategoryService categoryService;
    private final ProductQueryService productQueryService;
    private final ReviewService reviewService;

    @GetMapping("/categories")
    public List<CategoryResponse> categories(@RequestParam(required = false) CategoryType type) {
        return categoryService.publicTree(type);
    }

    @Operation(summary = "Danh sách sản phẩm",
            description = "sort: price,asc | price,desc | newest | bestseller; onSale=true: chỉ sản phẩm đang giảm giá")
    @GetMapping("/products")
    public PageResponse<ProductSummary> products(@RequestParam(required = false) String q,
                                                 @RequestParam(required = false) String categorySlug,
                                                 @RequestParam(required = false) Long minPrice,
                                                 @RequestParam(required = false) Long maxPrice,
                                                 @RequestParam(defaultValue = "false") boolean onSale,
                                                 @RequestParam(required = false) String sort,
                                                 @RequestParam(required = false) Integer page,
                                                 @RequestParam(required = false) Integer size) {
        return productQueryService.search(q, categorySlug, minPrice, maxPrice, onSale, sort, page, size);
    }

    @GetMapping("/products/{slug}")
    public ProductDetail product(@PathVariable String slug) {
        ProductDetail detail = productQueryService.getPublicDetail(slug);
        RatingSummary rating = reviewService.ratingSummary(detail.id());
        return detail.withRating(rating.average(), rating.count());
    }

    @GetMapping("/products/{slug}/related")
    public List<ProductSummary> related(@PathVariable String slug) {
        return productQueryService.related(slug);
    }

    @Operation(summary = "Đánh giá đã duyệt", description = "rating: lọc theo số sao; withMedia=true: chỉ đánh giá có ảnh/video")
    @GetMapping("/products/{slug}/reviews")
    public PageResponse<ReviewResponse> reviews(@PathVariable String slug,
                                                @RequestParam(required = false) Integer rating,
                                                @RequestParam(defaultValue = "false") boolean withMedia,
                                                @RequestParam(required = false) Integer page,
                                                @RequestParam(required = false) Integer size) {
        return reviewService.approvedForProduct(productQueryService.getPublicProductId(slug), rating, withMedia,
                page, size);
    }

    @Operation(summary = "Điểm trung bình, số đánh giá theo từng mức sao, số đánh giá có ảnh/video")
    @GetMapping("/products/{slug}/reviews/summary")
    public RatingBreakdown reviewSummary(@PathVariable String slug) {
        return reviewService.ratingBreakdown(productQueryService.getPublicProductId(slug));
    }
}
