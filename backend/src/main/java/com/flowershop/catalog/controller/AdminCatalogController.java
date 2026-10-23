package com.flowershop.catalog.controller;

import com.flowershop.catalog.dto.CatalogDtos.AdminProductSummary;
import com.flowershop.catalog.dto.CatalogDtos.CategoryRequest;
import com.flowershop.catalog.dto.CatalogDtos.CategoryResponse;
import com.flowershop.catalog.dto.CatalogDtos.ImageResponse;
import com.flowershop.catalog.dto.CatalogDtos.ImageUpdateRequest;
import com.flowershop.catalog.dto.CatalogDtos.ProductDetail;
import com.flowershop.catalog.dto.CatalogDtos.ProductStatusRequest;
import com.flowershop.catalog.dto.CatalogDtos.ProductUpsertRequest;
import com.flowershop.catalog.entity.ProductStatus;
import com.flowershop.catalog.service.CategoryService;
import com.flowershop.catalog.service.ProductAdminService;
import com.flowershop.common.dto.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "Admin - catalog")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminCatalogController {

    private final ProductAdminService productAdminService;
    private final CategoryService categoryService;

    // ---------------------------------------------------------------- products (STAFF, ADMIN)

    @GetMapping("/products")
    public PageResponse<AdminProductSummary> products(@RequestParam(required = false) String q,
                                                      @RequestParam(required = false) ProductStatus status,
                                                      @RequestParam(required = false) Integer page,
                                                      @RequestParam(required = false) Integer size) {
        return productAdminService.search(q, status, page, size);
    }

    @GetMapping("/products/{id}")
    public ProductDetail product(@PathVariable Long id) {
        return productAdminService.get(id);
    }

    @PostMapping("/products")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductDetail create(@Valid @RequestBody ProductUpsertRequest req) {
        return productAdminService.create(req);
    }

    @PutMapping("/products/{id}")
    public ProductDetail update(@PathVariable Long id, @Valid @RequestBody ProductUpsertRequest req) {
        return productAdminService.update(id, req);
    }

    @PatchMapping("/products/{id}/status")
    public ProductDetail updateStatus(@PathVariable Long id, @Valid @RequestBody ProductStatusRequest req) {
        return productAdminService.updateStatus(id, req.status());
    }

    @DeleteMapping("/products/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        productAdminService.softDelete(id);
    }

    /** multipart, field "files" (1 hoặc nhiều ảnh), tối đa 5MB/ảnh, chỉ jpg/png/webp. */
    @PostMapping(value = "/products/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<ImageResponse> uploadImages(@PathVariable Long id,
                                            @RequestPart("files") List<MultipartFile> files) {
        return productAdminService.uploadImages(id, files);
    }

    @PatchMapping("/images/{id}")
    public ImageResponse updateImage(@PathVariable Long id, @Valid @RequestBody ImageUpdateRequest req) {
        return productAdminService.updateImage(id, req);
    }

    @DeleteMapping("/images/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteImage(@PathVariable Long id) {
        productAdminService.deleteImage(id);
    }

    // ---------------------------------------------------------------- categories (ADMIN)

    @GetMapping("/categories")
    @PreAuthorize("hasRole('ADMIN')")
    public List<CategoryResponse> categories() {
        return categoryService.adminList();
    }

    @PostMapping("/categories")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse createCategory(@Valid @RequestBody CategoryRequest req) {
        return categoryService.create(req);
    }

    @PutMapping("/categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CategoryResponse updateCategory(@PathVariable Long id, @Valid @RequestBody CategoryRequest req) {
        return categoryService.update(id, req);
    }

    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable Long id) {
        categoryService.delete(id);
    }
}
