package com.flowershop.catalog.repository;

import com.flowershop.catalog.dto.CatalogDtos.ProductSummary;
import com.flowershop.catalog.entity.ProductStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Tìm kiếm sản phẩm công khai bằng SQL động: lọc giá theo biến thể rẻ nhất,
 * tìm không dấu bằng unaccent + pg_trgm ("hoa hong" ra "hoa hồng").
 */
@Repository
@RequiredArgsConstructor
public class ProductSearchRepository {

    private final NamedParameterJdbcTemplate jdbc;

    /** onSale = true: chỉ sản phẩm có biến thể rẻ nhất đang giảm giá (có sale_price). */
    public record Criteria(String q, String categorySlug, Long minPrice, Long maxPrice, boolean onSale,
                           String sort, int page, int size) {
    }

    public record Result(List<ProductSummary> content, long total) {
    }

    // Biến thể còn bán có giá thấp nhất đại diện cho sản phẩm
    private static final String FROM = """
            FROM products p
            JOIN LATERAL (
                SELECT COALESCE(v.sale_price, v.price) AS price,
                       CASE WHEN v.sale_price IS NOT NULL THEN v.price END AS compare_at_price
                FROM product_variants v
                WHERE v.product_id = p.id AND v.active
                ORDER BY COALESCE(v.sale_price, v.price), v.id
                LIMIT 1
            ) pr ON TRUE
            WHERE p.deleted_at IS NULL AND p.status <> 'HIDDEN'
            """;

    public Result search(Criteria c) {
        StringBuilder where = new StringBuilder();
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (c.q() != null && !c.q().isBlank()) {
            where.append(" AND f_unaccent(lower(p.name)) LIKE '%' || f_unaccent(lower(:q)) || '%'");
            params.addValue("q", c.q().trim());
        }
        if (c.categorySlug() != null && !c.categorySlug().isBlank()) {
            // Gồm cả danh mục con của danh mục được chọn
            where.append("""
                     AND EXISTS (SELECT 1 FROM product_categories pc JOIN categories cat ON cat.id = pc.category_id
                                 WHERE pc.product_id = p.id AND cat.active
                                   AND (cat.slug = :slug OR cat.parent_id = (SELECT id FROM categories WHERE slug = :slug)))
                    """);
            params.addValue("slug", c.categorySlug());
        }
        if (c.minPrice() != null) {
            where.append(" AND pr.price >= :minPrice");
            params.addValue("minPrice", c.minPrice());
        }
        if (c.maxPrice() != null) {
            where.append(" AND pr.price <= :maxPrice");
            params.addValue("maxPrice", c.maxPrice());
        }
        if (c.onSale()) {
            where.append(" AND pr.compare_at_price IS NOT NULL");
        }

        Long total = jdbc.queryForObject("SELECT count(*) " + FROM + where, params, Long.class);
        if (total == null || total == 0) {
            return new Result(List.of(), 0);
        }

        params.addValue("limit", c.size());
        params.addValue("offset", (long) c.page() * c.size());
        String sql = """
                SELECT p.id, p.name, p.slug, p.status, p.sold_count, pr.price, pr.compare_at_price,
                       (SELECT i.url FROM product_images i WHERE i.product_id = p.id
                        ORDER BY i.is_thumbnail DESC, i.sort_order, i.id LIMIT 1) AS thumbnail_url
                """ + FROM + where + " ORDER BY " + orderBy(c.sort()) + " LIMIT :limit OFFSET :offset";

        List<ProductSummary> content = jdbc.query(sql, params, (rs, i) -> new ProductSummary(
                rs.getLong("id"),
                rs.getString("name"),
                rs.getString("slug"),
                ProductStatus.valueOf(rs.getString("status")),
                rs.getInt("sold_count"),
                rs.getString("thumbnail_url"),
                rs.getLong("price"),
                (Long) rs.getObject("compare_at_price")));
        return new Result(content, total);
    }

    /** Chỉ nhận giá trị trong danh sách trắng, không ghép chuỗi từ client vào SQL. */
    private static String orderBy(String sort) {
        if (sort == null) {
            return "p.created_at DESC, p.id DESC";
        }
        return switch (sort) {
            case "price,asc" -> "pr.price ASC, p.id DESC";
            case "price,desc" -> "pr.price DESC, p.id DESC";
            case "bestseller" -> "p.sold_count DESC, p.id DESC";
            default -> "p.created_at DESC, p.id DESC"; // newest
        };
    }
}
