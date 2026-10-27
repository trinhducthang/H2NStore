package com.flowershop.seo.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowershop.banner.dto.BannerDtos.PublicBanner;
import com.flowershop.banner.service.BannerService;
import com.flowershop.catalog.dto.CatalogDtos.CategoryRef;
import com.flowershop.catalog.dto.CatalogDtos.CategoryResponse;
import com.flowershop.catalog.dto.CatalogDtos.ImageResponse;
import com.flowershop.catalog.dto.CatalogDtos.ProductDetail;
import com.flowershop.catalog.dto.CatalogDtos.ProductSummary;
import com.flowershop.catalog.dto.CatalogDtos.VariantResponse;
import com.flowershop.catalog.entity.CategoryType;
import com.flowershop.catalog.entity.ProductStatus;
import com.flowershop.catalog.service.CategoryService;
import com.flowershop.catalog.service.ProductQueryService;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.MoneyFormat;
import com.flowershop.config.AppProperties;
import com.flowershop.review.dto.ReviewDtos.RatingSummary;
import com.flowershop.review.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.LongSummaryStatistics;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Thẻ trong &lt;head&gt; (title, description, canonical, Open Graph, JSON-LD) và nội dung HTML tóm tắt theo từng URL.
 * nginx chèn vào index.html bằng SSI (frontend/nginx.conf) nên bot không chạy JS (bot AI, Zalo/Facebook khi
 * xem trước link) vẫn đọc được tên, giá, mô tả; Google chạy JS nhưng cũng dùng thẻ meta và JSON-LD này.
 * Chỉ trang chủ, danh sách và chi tiết sản phẩm được index; các trang khác (giỏ hàng, tài khoản, quản trị...) noindex.
 */
@Service
@RequiredArgsConstructor
public class SeoPageService {

    private static final String SCHEMA = "https://schema.org";
    /** Khớp PAGE_SIZE của ProductListPage để link "Trang sau" trùng trang trên web */
    private static final int LIST_PAGE_SIZE = 12;
    /** Khớp SLIDER_SIZE của HomePage */
    private static final int HOME_SECTION_SIZE = 12;
    private static final int DESCRIPTION_MAX = 160;
    private static final int HOME_TITLE_MAX = 70;
    private static final Pattern PRODUCT_PATH = Pattern.compile("/products/([a-z0-9]+(?:-[a-z0-9]+)*)/?");
    private static final String ALL_PRODUCTS = "Tất cả sản phẩm";

    private final AppProperties props;
    private final SiteUrls urls;
    private final CategoryService categoryService;
    private final ProductQueryService productQueryService;
    private final ReviewService reviewService;
    private final BannerService bannerService;
    private final ObjectMapper objectMapper;

    /** @param uri đường dẫn + query khách đang mở, VD "/products?categorySlug=hoa-tuoi" */
    public String head(String uri) {
        Route route = Route.parse(uri);
        Head head = switch (route.kind()) {
            case HOME -> homeHead();
            case LISTING -> listingHead(route);
            case SEARCH -> Head.noIndex(withSite("Tìm kiếm"));
            case PRODUCT -> productHead(route.slug());
            case OTHER -> Head.noIndex(siteName());
        };
        return render(head);
    }

    /** Nội dung đặt trong #root, React thay bằng giao diện thật khi chạy; rỗng với trang noindex */
    public String body(String uri) {
        Route route = Route.parse(uri);
        String main = switch (route.kind()) {
            case HOME -> homeBody();
            case LISTING -> listingBody(route);
            case PRODUCT -> productBody(route.slug());
            case SEARCH, OTHER -> null;
        };
        if (main == null) {
            return "";
        }
        return "<div class=\"seo-fallback\">\n" + siteHeader() + "<main>\n" + main + "</main>\n" + siteFooter()
                + "</div>\n";
    }

    /** Giới thiệu shop dựng từ các ngành hàng, dùng cho trang chủ và llms.txt */
    public String homeDescription() {
        List<String> names = departments().stream().map(CategoryResponse::name).toList();
        String offer = names.isEmpty() ? siteName() : siteName() + " – " + String.join(", ", names);
        return offer + ": đặt online, giao tận nơi, chọn ngày giờ giao, thanh toán khi nhận hàng hoặc chuyển khoản QR.";
    }

    // ---------------------------------------------------------------- route

    private enum Kind { HOME, LISTING, SEARCH, PRODUCT, OTHER }

    /** slug: danh mục (LISTING) hoặc sản phẩm (PRODUCT); page tính từ 0 như ProductListPage */
    private record Route(Kind kind, String slug, boolean onSale, int page) {

        static Route parse(String uri) {
            try {
                UriComponents parts = UriComponentsBuilder.fromUriString(uri).build();
                String path = Objects.requireNonNullElse(parts.getPath(), "/");
                MultiValueMap<String, String> query = parts.getQueryParams();
                if (path.equals("/")) {
                    return new Route(Kind.HOME, null, false, 0);
                }
                if (path.equals("/products") || path.equals("/products/")) {
                    if (StringUtils.hasText(query.getFirst("q"))) {
                        return new Route(Kind.SEARCH, null, false, 0);
                    }
                    String category = query.getFirst("categorySlug");
                    return new Route(Kind.LISTING, StringUtils.hasText(category) ? category : null,
                            "true".equals(query.getFirst("onSale")), page(query.getFirst("page")));
                }
                Matcher product = PRODUCT_PATH.matcher(path);
                if (product.matches()) {
                    return new Route(Kind.PRODUCT, product.group(1), false, 0);
                }
            } catch (IllegalArgumentException e) {
                // URL sai định dạng: xử lý như trang không index
            }
            return new Route(Kind.OTHER, null, false, 0);
        }

        private static int page(String value) {
            try {
                return value == null ? 0 : Math.clamp(Integer.parseInt(value), 0, 10_000);
            } catch (NumberFormatException e) {
                return 0;
            }
        }
    }

    // ---------------------------------------------------------------- head

    /** canonicalPath null: trang không index (chỉ có title + noindex) */
    private record Head(String title, String description, String canonicalPath, String ogType, String image,
                        Long price, List<Map<String, Object>> jsonLd) {

        static Head noIndex(String title) {
            return new Head(title, null, null, null, null, null, List.of());
        }
    }

    private Head homeHead() {
        StringBuilder title = new StringBuilder(siteName());
        String separator = " – ";
        for (CategoryResponse c : departments()) {
            if (title.length() + separator.length() + c.name().length() > HOME_TITLE_MAX) {
                break;
            }
            title.append(separator).append(c.name());
            separator = ", ";
        }
        String description = homeDescription();
        String image = bannerService.publicBanners().stream().map(PublicBanner::imageUrl).findFirst().orElse(null);
        String phone = blankToNull(props.seo().phone());
        String address = blankToNull(props.seo().address());
        Map<String, Object> website = obj("@context", SCHEMA, "@type", "WebSite",
                "name", siteName(), "url", urls.absolute("/"), "inLanguage", "vi");
        Map<String, Object> store = obj("@context", SCHEMA, "@type", "OnlineStore",
                "name", siteName(),
                "url", urls.absolute("/"),
                "description", description,
                "image", image == null ? null : urls.absolute(image),
                "telephone", phone,
                "address", address == null ? null
                        : obj("@type", "PostalAddress", "streetAddress", address, "addressCountry", "VN"));
        return new Head(title.toString(), description, "/", "website", image, null, List.of(website, store));
    }

    private Head listingHead(Route route) {
        CategoryResponse category = route.slug() == null ? null : findCategory(route.slug());
        if (route.slug() != null && category == null) {
            return Head.noIndex(withSite("Tất cả sản phẩm"));
        }
        String name = listingName(category, route.onSale());
        PageResponse<ProductSummary> cheapest = search(route.slug(), route.onSale(), "price,asc", 0, 1);
        ProductSummary first = cheapest.content().isEmpty() ? null : cheapest.content().getFirst();
        String description = first == null
                ? "%s tại %s. Đặt online, giao tận nơi, chọn ngày giờ giao.".formatted(name, siteName())
                : "%s tại %s: %d sản phẩm, giá từ %s. Đặt online, giao tận nơi, chọn ngày giờ giao."
                        .formatted(name, siteName(), cheapest.totalElements(), vnd(first.price()));
        String title = withSite(route.page() > 0 ? name + " – Trang " + (route.page() + 1) : name);
        return new Head(title, description, listingPath(route.slug(), route.onSale(), route.page()), "website",
                first == null ? null : first.thumbnailUrl(), null, List.of(breadcrumbLd(listingCrumbs(name))));
    }

    private Head productHead(String slug) {
        ProductDetail p = findProduct(slug);
        if (p == null) {
            return Head.noIndex(withSite("Không tìm thấy sản phẩm"));
        }
        String path = SiteUrls.product(p.slug());
        // Biến thể còn bán, rẻ nhất đứng đầu (ProductQueryService.getPublicDetail)
        List<VariantResponse> variants = p.variants();
        Long price = variants.isEmpty() ? null : variants.getFirst().effectivePrice();
        String description;
        if (StringUtils.hasText(p.description())) {
            description = summary(p.description());
        } else if (price != null) {
            description = "%s giá từ %s tại %s. Đặt online, giao tận nơi, chọn ngày giờ giao."
                    .formatted(p.name(), vnd(price), siteName());
        } else {
            description = p.name() + " tại " + siteName() + ".";
        }
        List<String> images = p.images().stream().map(i -> urls.absolute(i.url())).toList();
        boolean rated = p.ratingCount() != null && p.ratingCount() > 0;
        Map<String, Object> product = obj("@context", SCHEMA, "@type", "Product",
                "name", p.name(),
                "description", StringUtils.hasText(p.description()) ? p.description().strip() : null,
                "image", images.isEmpty() ? null : images,
                "sku", variants.size() == 1 ? variants.getFirst().sku() : null,
                "category", p.categories().isEmpty() ? null : p.categories().getFirst().name(),
                "url", urls.absolute(path),
                "offers", offers(p, path),
                "aggregateRating", rated ? obj("@type", "AggregateRating", "ratingValue", p.ratingAvg(),
                        "reviewCount", p.ratingCount(), "bestRating", 5) : null);
        return new Head(withSite(p.name()), description, path, "product", mainImage(p), price,
                List.of(product, breadcrumbLd(productCrumbs(p))));
    }

    private Map<String, Object> offers(ProductDetail p, String path) {
        List<VariantResponse> variants = p.variants();
        if (variants.isEmpty()) {
            return null;
        }
        boolean inStock = p.status() == ProductStatus.ACTIVE && variants.stream().anyMatch(v -> v.stock() > 0);
        String availability = SCHEMA + (inStock ? "/InStock" : "/OutOfStock");
        if (variants.size() == 1) {
            return obj("@type", "Offer", "price", variants.getFirst().effectivePrice(), "priceCurrency", "VND",
                    "availability", availability, "itemCondition", SCHEMA + "/NewCondition",
                    "url", urls.absolute(path));
        }
        LongSummaryStatistics prices = variants.stream().mapToLong(VariantResponse::effectivePrice)
                .summaryStatistics();
        return obj("@type", "AggregateOffer", "lowPrice", prices.getMin(), "highPrice", prices.getMax(),
                "offerCount", variants.size(), "priceCurrency", "VND", "availability", availability,
                "url", urls.absolute(path));
    }

    private String render(Head h) {
        StringBuilder out = new StringBuilder();
        out.append("<title>").append(esc(h.title())).append("</title>\n");
        if (h.canonicalPath() == null) {
            meta(out, "name", "robots", "noindex");
            return out.toString();
        }
        String url = urls.absolute(h.canonicalPath());
        String image = h.image() == null ? null : urls.absolute(h.image());
        meta(out, "name", "description", h.description());
        meta(out, "name", "robots", "max-image-preview:large");
        out.append("<link rel=\"canonical\" href=\"").append(esc(url)).append("\">\n");
        meta(out, "property", "og:site_name", siteName());
        meta(out, "property", "og:locale", "vi_VN");
        meta(out, "property", "og:type", h.ogType());
        meta(out, "property", "og:title", h.title());
        meta(out, "property", "og:description", h.description());
        meta(out, "property", "og:url", url);
        meta(out, "property", "og:image", image);
        if (h.price() != null) {
            meta(out, "property", "product:price:amount", h.price().toString());
            meta(out, "property", "product:price:currency", "VND");
        }
        meta(out, "name", "twitter:card", image == null ? "summary" : "summary_large_image");
        for (Map<String, Object> data : h.jsonLd()) {
            out.append("<script type=\"application/ld+json\">").append(json(data)).append("</script>\n");
        }
        return out.toString();
    }

    private static void meta(StringBuilder out, String attribute, String key, String content) {
        if (content != null) {
            out.append("<meta ").append(attribute).append("=\"").append(key).append("\" content=\"")
                    .append(esc(content)).append("\">\n");
        }
    }

    private String json(Map<String, Object> data) {
        try {
            // "<" trong chuỗi JSON đổi thành < để tên/mô tả sản phẩm không đóng được thẻ <script>
            return objectMapper.writeValueAsString(data).replace("<", "\\u003c");
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    // ---------------------------------------------------------------- body

    private String homeBody() {
        StringBuilder out = new StringBuilder();
        out.append("<h1>").append(esc(siteName())).append("</h1>\n");
        out.append("<p>").append(esc(homeDescription())).append("</p>\n");
        productSection(out, "Đang giảm giá", search(null, true, "bestseller", 0, HOME_SECTION_SIZE).content());
        productSection(out, "Bán chạy nhất", search(null, false, "bestseller", 0, HOME_SECTION_SIZE).content());
        productSection(out, "Mẫu mới", search(null, false, "newest", 0, HOME_SECTION_SIZE).content());
        return out.toString();
    }

    private String listingBody(Route route) {
        CategoryResponse category = route.slug() == null ? null : findCategory(route.slug());
        if (route.slug() != null && category == null) {
            return null;
        }
        String name = listingName(category, route.onSale());
        PageResponse<ProductSummary> page = search(route.slug(), route.onSale(), "newest", route.page(),
                LIST_PAGE_SIZE);
        StringBuilder out = new StringBuilder();
        breadcrumbNav(out, listingCrumbs(name));
        out.append("<h1>").append(esc(name)).append("</h1>\n");
        out.append("<p>").append(page.totalElements()).append(" sản phẩm</p>\n");
        productList(out, page.content());
        boolean hasPrevious = route.page() > 0;
        boolean hasNext = route.page() + 1 < page.totalPages();
        if (hasPrevious || hasNext) {
            out.append("<nav aria-label=\"Phân trang\">\n");
            if (hasPrevious) {
                out.append(link(listingPath(route.slug(), route.onSale(), route.page() - 1), "Trang trước"))
                        .append('\n');
            }
            if (hasNext) {
                out.append(link(listingPath(route.slug(), route.onSale(), route.page() + 1), "Trang sau"))
                        .append('\n');
            }
            out.append("</nav>\n");
        }
        return out.toString();
    }

    private String productBody(String slug) {
        ProductDetail p = findProduct(slug);
        if (p == null) {
            return null;
        }
        StringBuilder out = new StringBuilder();
        breadcrumbNav(out, productCrumbs(p));
        out.append("<article>\n<h1>").append(esc(p.name())).append("</h1>\n");
        String image = mainImage(p);
        if (image != null) {
            out.append("<img src=\"").append(esc(image)).append("\" alt=\"").append(esc(p.name())).append("\">\n");
        }
        List<VariantResponse> variants = p.variants();
        if (variants.size() == 1) {
            out.append("<p>Giá: ").append(variantPrice(p, variants.getFirst())).append("</p>\n");
        } else if (!variants.isEmpty()) {
            out.append("<ul>\n");
            for (VariantResponse v : variants) {
                out.append("<li>").append(esc(v.name())).append(": ").append(variantPrice(p, v)).append("</li>\n");
            }
            out.append("</ul>\n");
        }
        if (p.ratingCount() != null && p.ratingCount() > 0) {
            out.append("<p>Đánh giá: ").append(p.ratingAvg()).append("/5 từ ").append(p.ratingCount())
                    .append(" khách đã mua</p>\n");
        }
        if (p.soldCount() > 0) {
            out.append("<p>Đã bán: ").append(p.soldCount()).append("</p>\n");
        }
        if (StringUtils.hasText(p.description())) {
            out.append("<h2>Mô tả</h2>\n<p>").append(esc(p.description().strip()).replace("\n", "<br>\n"))
                    .append("</p>\n");
        }
        if (!p.categories().isEmpty()) {
            out.append("<p>Danh mục: ");
            String separator = "";
            for (CategoryRef c : p.categories()) {
                out.append(separator).append(link(SiteUrls.category(c.slug()), c.name()));
                separator = ", ";
            }
            out.append("</p>\n");
        }
        out.append("</article>\n");
        return out.toString();
    }

    private static String variantPrice(ProductDetail p, VariantResponse v) {
        StringBuilder out = new StringBuilder(vnd(v.effectivePrice()));
        if (v.salePrice() != null && v.salePrice() < v.price()) {
            out.append(" (giá gốc ").append(vnd(v.price())).append(')');
        }
        boolean inStock = p.status() == ProductStatus.ACTIVE && v.stock() > 0;
        return out.append(inStock ? " – còn hàng" : " – tạm hết hàng").toString();
    }

    private void productSection(StringBuilder out, String title, List<ProductSummary> products) {
        if (products.isEmpty()) {
            return;
        }
        out.append("<section>\n<h2>").append(esc(title)).append("</h2>\n");
        productList(out, products);
        out.append("</section>\n");
    }

    private static void productList(StringBuilder out, List<ProductSummary> products) {
        out.append("<ul>\n");
        for (ProductSummary p : products) {
            out.append("<li>").append(link(SiteUrls.product(p.slug()), p.name()));
            if (p.price() != null) {
                out.append(": ").append(vnd(p.price()));
            }
            if (p.compareAtPrice() != null) {
                out.append(" (giá gốc ").append(vnd(p.compareAtPrice())).append(')');
            }
            if (p.status() == ProductStatus.OUT_OF_STOCK) {
                out.append(" – tạm hết hàng");
            }
            out.append("</li>\n");
        }
        out.append("</ul>\n");
    }

    private String siteHeader() {
        StringBuilder out = new StringBuilder("<header>\n<p>").append(link("/", siteName())).append("</p>\n");
        out.append("<nav aria-label=\"Danh mục\">\n<ul>\n");
        for (CategoryResponse c : departments()) {
            out.append("<li>").append(link(SiteUrls.category(c.slug()), c.name())).append("</li>\n");
        }
        out.append("<li>").append(link("/products?onSale=true", "Đang giảm giá")).append("</li>\n");
        out.append("</ul>\n</nav>\n</header>\n");
        return out.toString();
    }

    private String siteFooter() {
        StringBuilder out = new StringBuilder("<footer>\n");
        String phone = blankToNull(props.seo().phone());
        String address = blankToNull(props.seo().address());
        if (phone != null) {
            out.append("<p>Hotline: ").append(esc(phone)).append("</p>\n");
        }
        if (address != null) {
            out.append("<p>Địa chỉ: ").append(esc(address)).append("</p>\n");
        }
        out.append("<p>").append(link("/track", "Tra cứu đơn hàng")).append("</p>\n</footer>\n");
        return out.toString();
    }

    // ---------------------------------------------------------------- breadcrumb

    /** path null: mục cuối (trang hiện tại) */
    private record Crumb(String name, String path) {
    }

    private static List<Crumb> listingCrumbs(String name) {
        List<Crumb> crumbs = new ArrayList<>(List.of(new Crumb("Trang chủ", "/"), new Crumb("Sản phẩm", "/products")));
        if (!name.equals(ALL_PRODUCTS)) {
            crumbs.add(new Crumb(name, null));
        }
        return crumbs;
    }

    private static List<Crumb> productCrumbs(ProductDetail p) {
        List<Crumb> crumbs = new ArrayList<>(List.of(new Crumb("Trang chủ", "/"), new Crumb("Sản phẩm", "/products")));
        if (!p.categories().isEmpty()) {
            CategoryRef category = p.categories().getFirst();
            crumbs.add(new Crumb(category.name(), SiteUrls.category(category.slug())));
        }
        crumbs.add(new Crumb(p.name(), null));
        return crumbs;
    }

    private Map<String, Object> breadcrumbLd(List<Crumb> crumbs) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 0; i < crumbs.size(); i++) {
            Crumb c = crumbs.get(i);
            items.add(obj("@type", "ListItem", "position", i + 1, "name", c.name(),
                    "item", c.path() == null ? null : urls.absolute(c.path())));
        }
        return obj("@context", SCHEMA, "@type", "BreadcrumbList", "itemListElement", items);
    }

    private static void breadcrumbNav(StringBuilder out, List<Crumb> crumbs) {
        out.append("<nav aria-label=\"Breadcrumb\">");
        String separator = "";
        for (Crumb c : crumbs) {
            out.append(separator).append(c.path() == null ? esc(c.name()) : link(c.path(), c.name()));
            separator = " › ";
        }
        out.append("</nav>\n");
    }

    // ---------------------------------------------------------------- data

    /** Tiêu đề trang danh sách, khớp ProductListPage */
    private static String listingName(CategoryResponse category, boolean onSale) {
        if (category != null) {
            return category.name();
        }
        return onSale ? "Đang giảm giá" : ALL_PRODUCTS;
    }

    /** URL chuẩn của trang danh sách: bỏ sắp xếp và lọc giá, chỉ giữ danh mục, giảm giá, số trang */
    private static String listingPath(String categorySlug, boolean onSale, int page) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromPath("/products");
        if (categorySlug != null) {
            builder.queryParam("categorySlug", categorySlug);
        }
        if (onSale) {
            builder.queryParam("onSale", true);
        }
        if (page > 0) {
            builder.queryParam("page", page);
        }
        return builder.encode().build().toUriString();
    }

    private List<CategoryResponse> departments() {
        return categoryService.publicTree(CategoryType.DEPARTMENT);
    }

    private CategoryResponse findCategory(String slug) {
        return SiteUrls.flatten(categoryService.publicTree(null)).stream()
                .filter(c -> c.slug().equals(slug))
                .findFirst()
                .orElse(null);
    }

    private PageResponse<ProductSummary> search(String categorySlug, boolean onSale, String sort, int page,
                                                int size) {
        return productQueryService.search(null, categorySlug, null, null, onSale, sort, page, size);
    }

    /** Chi tiết kèm điểm đánh giá như PublicCatalogController; null nếu không có hoặc đã ẩn */
    private ProductDetail findProduct(String slug) {
        try {
            ProductDetail detail = productQueryService.getPublicDetail(slug);
            RatingSummary rating = reviewService.ratingSummary(detail.id());
            return detail.withRating(rating.average(), rating.count());
        } catch (BusinessException e) {
            if (e.getErrorCode() == ErrorCode.NOT_FOUND) {
                return null;
            }
            throw e;
        }
    }

    /** Ảnh đánh dấu đại diện, không có thì ảnh đầu tiên */
    private static String mainImage(ProductDetail p) {
        return p.images().stream().filter(ImageResponse::thumbnail).findFirst()
                .or(() -> p.images().stream().findFirst())
                .map(ImageResponse::url)
                .orElse(null);
    }

    // ---------------------------------------------------------------- helpers

    private String siteName() {
        return props.seo().siteName();
    }

    private String withSite(String title) {
        return title + " | " + siteName();
    }

    /** Gộp khoảng trắng, cắt ở ranh giới từ cho vừa thẻ description */
    private static String summary(String text) {
        String clean = text.replaceAll("\\s+", " ").strip();
        if (clean.length() <= DESCRIPTION_MAX) {
            return clean;
        }
        int cut = clean.lastIndexOf(' ', DESCRIPTION_MAX - 1);
        return clean.substring(0, cut > DESCRIPTION_MAX / 2 ? cut : DESCRIPTION_MAX - 1) + "…";
    }

    private static String vnd(long amount) {
        return MoneyFormat.vnd(amount) + "đ";
    }

    private static String link(String path, String text) {
        return "<a href=\"" + esc(path) + "\">" + esc(text) + "</a>";
    }

    private static String esc(String text) {
        return HtmlUtils.htmlEscape(text, "UTF-8");
    }

    private static String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.strip() : null;
    }

    /** Object JSON giữ thứ tự khóa, bỏ cặp có giá trị null; tham số: key1, value1, key2, value2... */
    private static Map<String, Object> obj(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            if (keyValues[i + 1] != null) {
                map.put((String) keyValues[i], keyValues[i + 1]);
            }
        }
        return map;
    }
}
