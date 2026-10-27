package com.flowershop.seo.controller;

import com.flowershop.seo.service.SeoPageService;
import com.flowershop.seo.service.SiteIndexService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.function.Supplier;

/**
 * head/body: nginx gọi qua SSI mỗi lần trả index.html (frontend/nginx.conf), kèm header X-Seo-Uri là URL khách mở.
 * robots.txt, sitemap.xml, llms.txt: nginx chuyển /robots.txt, /sitemap.xml, /llms.txt về đây.
 */
@Tag(name = "Public - SEO")
@Slf4j
@RestController
@RequestMapping("/api/public/seo")
@RequiredArgsConstructor
public class SeoController {

    public static final String URI_HEADER = "X-Seo-Uri";
    private static final String HTML = "text/html;charset=UTF-8";
    private static final String TEXT = "text/plain;charset=UTF-8";
    private static final String XML = "application/xml;charset=UTF-8";

    private final SeoPageService seoPageService;
    private final SiteIndexService siteIndexService;

    @Operation(summary = "Thẻ <head> (title, description, canonical, Open Graph, JSON-LD) theo URL ở header X-Seo-Uri")
    @GetMapping(value = "/head", produces = HTML)
    public String head(@RequestHeader(value = URI_HEADER, defaultValue = "/") String uri) {
        return orEmpty(() -> seoPageService.head(uri), uri);
    }

    @Operation(summary = "Nội dung HTML tóm tắt cho bot không chạy JS, theo URL ở header X-Seo-Uri")
    @GetMapping(value = "/body", produces = HTML)
    public String body(@RequestHeader(value = URI_HEADER, defaultValue = "/") String uri) {
        return orEmpty(() -> seoPageService.body(uri), uri);
    }

    @GetMapping(value = "/robots.txt", produces = TEXT)
    public String robots() {
        return siteIndexService.robotsTxt();
    }

    @GetMapping(value = "/sitemap.xml", produces = XML)
    public String sitemap() {
        return siteIndexService.sitemapXml();
    }

    @GetMapping(value = "/llms.txt", produces = TEXT)
    public String llms() {
        return siteIndexService.llmsTxt();
    }

    /** Lỗi bất ngờ (VD: mất kết nối DB) trả rỗng để nginx dùng thẻ mặc định trong index.html, không chèn JSON lỗi */
    private static String orEmpty(Supplier<String> render, String uri) {
        try {
            return render.get();
        } catch (RuntimeException e) {
            log.warn("Không dựng được nội dung SEO cho {}: {}", uri.replaceAll("[\\r\\n]", ""), e.toString());
            return "";
        }
    }
}
