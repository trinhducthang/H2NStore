package com.flowershop.seo.service;

import com.flowershop.catalog.dto.CatalogDtos.CategoryResponse;
import com.flowershop.config.AppProperties;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Stream;

/** Đường dẫn các trang công khai (khớp route trong App.tsx), tuyệt đối theo FRONTEND_URL. */
@Component
public class SiteUrls {

    private final String base;

    public SiteUrls(AppProperties props) {
        this.base = props.frontendUrl().replaceAll("/+$", "");
    }

    /** "/products" -> "https://shop.vn/products"; link http(s) giữ nguyên */
    public String absolute(String pathOrUrl) {
        return pathOrUrl.matches("^https?://.*") ? pathOrUrl : base + pathOrUrl;
    }

    public static String product(String slug) {
        return "/products/" + slug;
    }

    public static String category(String slug) {
        return "/products?categorySlug=" + slug;
    }

    /** Cây danh mục 2 cấp -> danh sách phẳng, cha đứng trước con */
    public static List<CategoryResponse> flatten(List<CategoryResponse> tree) {
        return tree.stream().flatMap(c -> Stream.concat(Stream.of(c), c.children().stream())).toList();
    }
}
