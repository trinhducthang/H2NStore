package com.flowershop.order.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;

/**
 * Các câu SQL đặc thù PostgreSQL. JdbcTemplate dùng chung connection với transaction JPA hiện tại.
 */
@Repository
@RequiredArgsConstructor
public class OrderSqlRepository {

    private final JdbcTemplate jdbc;

    /** Số thứ tự đơn trong ngày, tăng nguyên tử (UPSERT ... RETURNING). */
    public int nextDailySequence(LocalDate day) {
        Integer value = jdbc.queryForObject("""
                INSERT INTO order_daily_counters (day, value) VALUES (?, 1)
                ON CONFLICT (day) DO UPDATE SET value = order_daily_counters.value + 1
                RETURNING value
                """, Integer.class, day);
        if (value == null) {
            throw new IllegalStateException("Không sinh được số thứ tự đơn");
        }
        return value;
    }

    /** Khóa tư vấn, tự nhả khi transaction kết thúc. */
    public void advisoryXactLock(long key) {
        jdbc.queryForObject("SELECT 1 FROM pg_advisory_xact_lock(?)", Integer.class, key);
    }
}
