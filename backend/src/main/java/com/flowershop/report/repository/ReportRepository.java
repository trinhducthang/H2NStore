package com.flowershop.report.repository;

import com.flowershop.report.dto.ReportDtos.DailyRevenue;
import com.flowershop.report.dto.ReportDtos.OrderRow;
import com.flowershop.report.dto.ReportDtos.TopProduct;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Truy vấn tổng hợp chỉ đọc cho báo cáo (read model), khoảng thời gian [from, to).
 */
@Repository
@RequiredArgsConstructor
public class ReportRepository {

    private static final String RANGE = " o.created_at >= :from AND o.created_at < :to ";

    private final NamedParameterJdbcTemplate jdbc;

    public record Totals(long orderCount, long deliveredCount, long cancelledCount, long revenue, long paidRevenue) {
    }

    public Totals totals(OffsetDateTime from, OffsetDateTime to) {
        return jdbc.queryForObject("""
                SELECT count(*) AS order_count,
                       count(*) FILTER (WHERE o.status = 'DELIVERED') AS delivered,
                       count(*) FILTER (WHERE o.status = 'CANCELLED') AS cancelled,
                       COALESCE(sum(o.total) FILTER (WHERE o.status <> 'CANCELLED'), 0) AS revenue,
                       COALESCE(sum(o.total) FILTER (WHERE o.status <> 'CANCELLED' AND o.payment_status = 'PAID'), 0)
                           AS paid_revenue
                FROM orders o WHERE""" + RANGE, params(from, to), (rs, i) -> new Totals(
                rs.getLong("order_count"), rs.getLong("delivered"), rs.getLong("cancelled"),
                rs.getLong("revenue"), rs.getLong("paid_revenue")));
    }

    public Map<String, Long> countByStatus(OffsetDateTime from, OffsetDateTime to) {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbc.query("SELECT o.status, count(*) AS c FROM orders o WHERE" + RANGE + "GROUP BY o.status",
                params(from, to), rs -> {
                    result.put(rs.getString("status"), rs.getLong("c"));
                });
        return result;
    }

    public List<DailyRevenue> revenueByDay(OffsetDateTime from, OffsetDateTime to) {
        return jdbc.query("""
                SELECT (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
                       count(*) FILTER (WHERE o.status <> 'CANCELLED') AS orders,
                       COALESCE(sum(o.total) FILTER (WHERE o.status <> 'CANCELLED'), 0) AS revenue
                FROM orders o WHERE""" + RANGE + """
                GROUP BY day ORDER BY day
                """, params(from, to), (rs, i) -> new DailyRevenue(rs.getObject("day", java.time.LocalDate.class),
                rs.getLong("orders"), rs.getLong("revenue")));
    }

    public List<TopProduct> topProducts(OffsetDateTime from, OffsetDateTime to, int limit) {
        MapSqlParameterSource p = params(from, to).addValue("limit", limit);
        return jdbc.query("""
                SELECT oi.product_id, max(oi.product_name) AS product_name,
                       sum(oi.quantity) AS quantity, sum(oi.line_total) AS revenue
                FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE o.status <> 'CANCELLED' AND""" + RANGE + """
                GROUP BY oi.product_id
                ORDER BY quantity DESC, revenue DESC
                LIMIT :limit
                """, p, (rs, i) -> new TopProduct(rs.getLong("product_id"), rs.getString("product_name"),
                rs.getLong("quantity"), rs.getLong("revenue")));
    }

    public List<OrderRow> orders(OffsetDateTime from, OffsetDateTime to) {
        return jdbc.query("""
                SELECT o.code, o.created_at, o.status, o.payment_method, o.payment_status, o.sender_name,
                       o.sender_phone, o.receiver_name, o.delivery_date, o.delivery_slot, o.subtotal,
                       o.shipping_fee, o.discount, o.total
                FROM orders o WHERE""" + RANGE + "ORDER BY o.created_at", params(from, to), (rs, i) -> new OrderRow(
                rs.getString("code"), rs.getObject("created_at", OffsetDateTime.class), rs.getString("status"),
                rs.getString("payment_method"), rs.getString("payment_status"), rs.getString("sender_name"),
                rs.getString("sender_phone"), rs.getString("receiver_name"),
                rs.getObject("delivery_date", java.time.LocalDate.class), rs.getString("delivery_slot"),
                rs.getLong("subtotal"), rs.getLong("shipping_fee"), rs.getLong("discount"), rs.getLong("total")));
    }

    private static MapSqlParameterSource params(OffsetDateTime from, OffsetDateTime to) {
        return new MapSqlParameterSource().addValue("from", from).addValue("to", to);
    }
}
