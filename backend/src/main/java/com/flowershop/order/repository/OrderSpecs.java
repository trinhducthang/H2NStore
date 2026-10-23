package com.flowershop.order.repository;

import com.flowershop.order.entity.Order;
import com.flowershop.order.entity.OrderStatus;
import com.flowershop.order.entity.PaymentStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Bộ lọc đơn cho trang quản trị. Chỉ thêm điều kiện khi có giá trị: tránh mẫu "(:p IS NULL OR ...)"
 * vì PostgreSQL không suy ra được kiểu tham số ngày khi pgjdbc gửi LocalDate dạng unspecified.
 */
public final class OrderSpecs {

    private OrderSpecs() {
    }

    public static Specification<Order> adminFilter(OrderStatus status, PaymentStatus paymentStatus,
                                                   LocalDate deliveryDate, String q) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (paymentStatus != null) {
                predicates.add(cb.equal(root.get("paymentStatus"), paymentStatus));
            }
            if (deliveryDate != null) {
                predicates.add(cb.equal(root.get("deliveryDate"), deliveryDate));
            }
            if (q != null && !q.isBlank()) {
                String keyword = q.trim();
                predicates.add(cb.or(
                        cb.like(root.get("code"), "%" + keyword.toUpperCase(Locale.ROOT) + "%"),
                        cb.like(root.get("senderPhone"), "%" + keyword + "%"),
                        cb.like(root.get("receiverPhone"), "%" + keyword + "%")));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
