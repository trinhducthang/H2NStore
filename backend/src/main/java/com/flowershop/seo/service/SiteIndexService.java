package com.flowershop.seo.service;

import com.flowershop.catalog.dto.CatalogDtos.CategoryResponse;
import com.flowershop.catalog.dto.CatalogDtos.ProductSummary;
import com.flowershop.catalog.dto.CatalogDtos.SitemapProduct;
import com.flowershop.catalog.entity.ProductStatus;
import com.flowershop.catalog.service.CategoryService;
import com.flowershop.catalog.service.ProductQueryService;
import com.flowershop.common.dto.PageQuery;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.util.MoneyFormat;
import com.flowershop.config.AppProperties;
import com.flowershop.delivery.dto.DeliveryDtos.ZoneResponse;
import com.flowershop.delivery.service.DeliveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/** robots.txt, sitemap.xml và llms.txt (giới thiệu shop dạng Markdown cho bot AI, theo llmstxt.org). */
@Service
@RequiredArgsConstructor
public class SiteIndexService {

    /** llms.txt liệt kê tối đa ngần này sản phẩm, bán chạy trước */
    private static final int LLMS_MAX_PRODUCTS = 500;

    private final AppProperties props;
    private final SiteUrls urls;
    private final SeoPageService seoPageService;
    private final CategoryService categoryService;
    private final ProductQueryService productQueryService;
    private final DeliveryService deliveryService;

    public String robotsTxt() {
        return """
                # Mọi bot (Googlebot, Bingbot, bot AI như GPTBot, ClaudeBot, PerplexityBot...) được đọc trang công khai.
                # Không chặn /api/public/: Google chạy JS, cần gọi API này mới thấy sản phẩm trên trang.
                User-agent: *
                Disallow: /admin
                Disallow: /account
                Disallow: /cart
                Disallow: /checkout
                Disallow: /payment/
                Disallow: /order-success/
                Disallow: /api/
                Allow: /api/public/

                Sitemap: %s
                """.formatted(urls.absolute("/sitemap.xml"));
    }

    public String sitemapXml() {
        StringBuilder out = new StringBuilder("""
                <?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                """);
        sitemapUrl(out, "/", null);
        sitemapUrl(out, "/products", null);
        for (CategoryResponse c : SiteUrls.flatten(categoryService.publicTree(null))) {
            sitemapUrl(out, SiteUrls.category(c.slug()), null);
        }
        for (SitemapProduct p : productQueryService.sitemapEntries()) {
            sitemapUrl(out, SiteUrls.product(p.slug()), p.updatedAt());
        }
        return out.append("</urlset>\n").toString();
    }

    private void sitemapUrl(StringBuilder out, String path, OffsetDateTime lastModified) {
        out.append("  <url><loc>").append(HtmlUtils.htmlEscape(urls.absolute(path), "UTF-8")).append("</loc>");
        if (lastModified != null) {
            out.append("<lastmod>").append(lastModified.toLocalDate()).append("</lastmod>");
        }
        out.append("</url>\n");
    }

    public String llmsTxt() {
        AppProperties.Seo seo = props.seo();
        AppProperties.Order order = props.order();
        StringBuilder out = new StringBuilder();
        out.append("# ").append(seo.siteName()).append("\n\n");
        out.append("> ").append(seoPageService.homeDescription()).append("\n\n");
        out.append("- Website: ").append(urls.absolute("/")).append('\n');
        if (StringUtils.hasText(seo.phone())) {
            out.append("- Hotline: ").append(seo.phone().strip()).append('\n');
        }
        if (StringUtils.hasText(seo.address())) {
            out.append("- Địa chỉ: ").append(seo.address().strip()).append('\n');
        }

        out.append("\n## Mua hàng\n\n");
        out.append("- Đặt hàng trên website, không cần tạo tài khoản. Chọn ngày và khung giờ giao, đặt trước tối thiểu ")
                .append(order.minPrepareHours()).append(" giờ.\n");
        out.append("- Thanh toán khi nhận hàng (COD) hoặc chuyển khoản VietQR, hệ thống tự xác nhận khi nhận được tiền.\n");
        out.append("- Tra cứu đơn hàng: ").append(urls.absolute("/track")).append('\n');

        List<ZoneResponse> zones = deliveryService.activeZones();
        if (!zones.isEmpty()) {
            out.append("\n## Khu vực giao hàng\n\n");
            for (ZoneResponse z : zones) {
                out.append("- ").append(z.name());
                if (StringUtils.hasText(z.districts())) {
                    out.append(" (").append(z.districts().strip()).append(')');
                }
                out.append(": phí giao ").append(vnd(z.shippingFee()));
                if (z.expressAvailable() && z.expressFee() != null) {
                    out.append("; giao nhanh 2–3 giờ ").append(vnd(z.expressFee()))
                            .append(" (nhận đơn ").append(order.expressStartHour()).append("h–")
                            .append(order.expressEndHour()).append("h)");
                }
                out.append('\n');
            }
        }

        out.append("\n## Danh mục\n\n");
        for (CategoryResponse c : categoryService.publicTree(null)) {
            out.append("- ").append(mdLink(c.name(), SiteUrls.category(c.slug()))).append('\n');
            for (CategoryResponse child : c.children()) {
                out.append("  - ").append(mdLink(child.name(), SiteUrls.category(child.slug()))).append('\n');
            }
        }

        out.append("\n## Sản phẩm\n\n");
        for (ProductSummary p : products()) {
            out.append("- ").append(mdLink(p.name(), SiteUrls.product(p.slug())));
            if (p.price() != null) {
                out.append(": ").append(vnd(p.price()));
            }
            if (p.compareAtPrice() != null) {
                out.append(" (giá gốc ").append(vnd(p.compareAtPrice())).append(')');
            }
            if (p.status() == ProductStatus.OUT_OF_STOCK) {
                out.append(", tạm hết hàng");
            }
            out.append('\n');
        }
        return out.toString();
    }

    /** Sản phẩm đang hiển thị, bán chạy trước */
    private List<ProductSummary> products() {
        List<ProductSummary> all = new ArrayList<>();
        for (int page = 0; all.size() < LLMS_MAX_PRODUCTS; page++) {
            PageResponse<ProductSummary> result = productQueryService.search(null, null, null, null, false,
                    "bestseller", page, PageQuery.MAX_SIZE);
            all.addAll(result.content());
            if (page + 1 >= result.totalPages()) {
                break;
            }
        }
        return all.size() > LLMS_MAX_PRODUCTS ? all.subList(0, LLMS_MAX_PRODUCTS) : all;
    }

    private String mdLink(String text, String path) {
        return "[" + text.replaceAll("([\\\\\\[\\]])", "\\\\$1") + "](" + urls.absolute(path) + ")";
    }

    private static String vnd(long amount) {
        return MoneyFormat.vnd(amount) + "đ";
    }
}
