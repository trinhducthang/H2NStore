package com.flowershop.seo;

import com.flowershop.TestcontainersConfig;
import com.flowershop.seo.controller.SeoController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Cùng cấu hình với OrderPaymentFlowTest để dùng chung Spring context và container PostgreSQL. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.sepay.webhook-api-key=test-key",
        "app.sepay.account-number=0123456789",
        "app.storage.local-dir=target/test-uploads"})
@ActiveProfiles("dev")
@Import(TestcontainersConfig.class)
class SeoFlowTest {

    private static final String PRODUCT = "/products/bo-hoa-hong-do-tinh-nong";

    @Autowired
    private TestRestTemplate rest;

    @Value("${app.frontend-url}")
    private String base;

    @Test
    void productPageHasMetaStructuredDataAndFallbackContent() {
        String head = seo("head", PRODUCT + "?utm_source=zalo");
        assertThat(head)
                .contains("<title>Bó hoa hồng đỏ Tình Nồng | H2N Store</title>")
                .contains("<link rel=\"canonical\" href=\"" + base + PRODUCT + "\">")
                .contains("<meta property=\"og:type\" content=\"product\">")
                .contains("\"@type\":\"Product\"", "\"priceCurrency\":\"VND\"", "\"@type\":\"BreadcrumbList\"")
                .doesNotContain("noindex");
        // Đủ trường cho Merchant listing của Google: Offer (không phải AggregateOffer), phí giao, đổi trả, brand
        assertThat(head)
                .contains("\"brand\":{\"@type\":\"Brand\",\"name\":\"H2N Store\"}")
                .contains("\"shippingRate\":{\"@type\":\"MonetaryAmount\",\"value\":30000,\"currency\":\"VND\"}")
                .contains("\"shippingDestination\":{\"@type\":\"DefinedRegion\",\"addressCountry\":\"VN\"}")
                .contains("\"handlingTime\":{\"@type\":\"QuantitativeValue\",\"minValue\":0,\"maxValue\":1,"
                        + "\"unitCode\":\"DAY\"}")
                .contains("\"returnPolicyCategory\":\"https://schema.org/MerchantReturnFiniteReturnWindow\"",
                        "\"merchantReturnDays\":7", "\"returnFees\":\"https://schema.org/ReturnShippingFees\"")
                .doesNotContain("AggregateOffer");

        String body = seo("body", PRODUCT);
        assertThat(body).contains("class=\"seo-fallback\"", "<h1>Bó hoa hồng đỏ Tình Nồng</h1>", "đ");
    }

    @Test
    void listingCanonicalKeepsOnlyCategoryAndPage() {
        String head = seo("head", "/products?categorySlug=hoa-tuoi&sort=price,asc&minPrice=100000&page=1");
        assertThat(head)
                .contains("<title>Hoa tươi – Trang 2 | H2N Store</title>")
                .contains("<link rel=\"canonical\" href=\"" + base + "/products?categorySlug=hoa-tuoi&amp;page=1\">");

        assertThat(seo("head", "/")).contains("\"@type\":\"OnlineStore\"", "\"@type\":\"WebSite\"",
                "\"@type\":\"MerchantReturnPolicy\"");
        assertThat(seo("body", "/")).contains("href=\"" + PRODUCT + "\"");
    }

    @Test
    void privateSearchAndMissingPagesAreNoindex() {
        for (String uri : List.of("/cart", "/admin/orders", "/products?q=hoa", "/products?categorySlug=khong-co",
                "/products/khong-ton-tai")) {
            assertThat(seo("head", uri)).as(uri).contains("<meta name=\"robots\" content=\"noindex\">")
                    .doesNotContain("canonical");
            assertThat(seo("body", uri)).as(uri).isEmpty();
        }
        assertThat(seo("head", "/products/khong-ton-tai")).contains("Không tìm thấy sản phẩm");
    }

    @Test
    void productTextCannotBreakOutOfHtml() {
        String admin = login();
        Map<String, Object> request = Map.of(
                "name", "Hoa <script>alert(1)</script>",
                "slug", "hoa-seo-xss",
                "description", "Mô tả </script><img src=x onerror=alert(1)>",
                "status", "ACTIVE",
                "variants", List.of(Map.of("name", "Mặc định", "sku", "SEO-XSS-1", "price", 100000, "stock", 5)));
        ResponseEntity<Map<String, Object>> created = rest.exchange("/api/admin/products", HttpMethod.POST,
                new HttpEntity<>(request, auth(admin)), new ParameterizedTypeReference<>() {
                });
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        String head = seo("head", "/products/hoa-seo-xss");
        assertThat(head)
                .contains("<title>Hoa &lt;script&gt;alert(1)&lt;/script&gt; | H2N Store</title>")
                .contains("\\u003c/script>\\u003cimg")
                .doesNotContain("<script>alert", "<img");
        // Thẻ <script> duy nhất là JSON-LD do backend tạo
        assertThat(head.split("<script", -1)).hasSize(3);
        assertThat(head.split("</script>", -1)).hasSize(3);

        assertThat(seo("body", "/products/hoa-seo-xss"))
                .contains("&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;")
                .doesNotContain("<script", "<img src=x");
    }

    @Test
    void robotsSitemapAndLlmsTxt() {
        String robots = rest.getForObject("/api/public/seo/robots.txt", String.class);
        assertThat(robots).contains("Disallow: /admin", "Allow: /api/public/", "Sitemap: " + base + "/sitemap.xml");

        ResponseEntity<String> sitemap = rest.getForEntity("/api/public/seo/sitemap.xml", String.class);
        assertThat(sitemap.getHeaders().getContentType()).isNotNull()
                .satisfies(type -> assertThat(type.isCompatibleWith(MediaType.APPLICATION_XML)).isTrue());
        assertThat(sitemap.getBody())
                .startsWith("<?xml")
                .contains("<loc>" + base + PRODUCT + "</loc><lastmod>")
                .contains("<loc>" + base + "/products?categorySlug=hoa-tuoi</loc>");

        String llms = rest.getForObject("/api/public/seo/llms.txt", String.class);
        assertThat(llms)
                .startsWith("# H2N Store\n")
                .contains("## Danh mục", "## Sản phẩm")
                .contains("[Bó hoa hồng đỏ Tình Nồng](" + base + PRODUCT + "): ");
    }

    // ------------------------------------------------------------------ helpers

    /** Gọi như nginx SSI: URL khách mở nằm trong header */
    private String seo(String part, String uri) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(SeoController.URI_HEADER, uri);
        ResponseEntity<String> res = rest.exchange("/api/public/seo/" + part, HttpMethod.GET,
                new HttpEntity<>(headers), String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        return res.getBody() == null ? "" : res.getBody();
    }

    private String login() {
        Map<String, Object> body = rest.exchange("/api/auth/login", HttpMethod.POST,
                new HttpEntity<>(Map.of("email", "admin@flowershop.local", "password", "Admin@123"), auth(null)),
                new ParameterizedTypeReference<Map<String, Object>>() {
                }).getBody();
        return (String) body.get("accessToken");
    }

    private static HttpHeaders auth(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return headers;
    }
}
