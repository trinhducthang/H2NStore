package com.flowershop.banner.controller;

import com.flowershop.banner.dto.BannerDtos.BannerRequest;
import com.flowershop.banner.dto.BannerDtos.BannerResponse;
import com.flowershop.banner.dto.BannerDtos.PublicBanner;
import com.flowershop.banner.service.BannerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "Banner trang chủ")
@RestController
@RequiredArgsConstructor
public class BannerController {

    private final BannerService bannerService;

    @Operation(summary = "Banner đang hiển thị trên trang chủ")
    @GetMapping("/api/public/banners")
    public List<PublicBanner> publicBanners() {
        return bannerService.publicBanners();
    }

    @GetMapping("/api/admin/banners")
    @PreAuthorize("hasRole('ADMIN')")
    public List<BannerResponse> list() {
        return bannerService.list();
    }

    @PostMapping("/api/admin/banners")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public BannerResponse create(@Valid @RequestBody BannerRequest req) {
        return bannerService.create(req);
    }

    @PutMapping("/api/admin/banners/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public BannerResponse update(@PathVariable Long id, @Valid @RequestBody BannerRequest req) {
        return bannerService.update(id, req);
    }

    @Operation(summary = "Upload/thay ảnh banner", description = "multipart field \"file\", jpg/png/webp tối đa 5MB")
    @PostMapping(value = "/api/admin/banners/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public BannerResponse uploadImage(@PathVariable Long id, @RequestPart("file") MultipartFile file) {
        return bannerService.uploadImage(id, file);
    }

    @DeleteMapping("/api/admin/banners/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        bannerService.delete(id);
    }
}
