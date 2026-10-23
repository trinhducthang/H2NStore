package com.flowershop.order.service;

import com.flowershop.catalog.service.InventoryService;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.TimeUtils;
import com.flowershop.coupon.service.CouponService;
import com.flowershop.order.entity.Order;
import com.flowershop.order.entity.OrderItem;
import com.flowershop.order.entity.OrderStatus;
import com.flowershop.order.entity.OrderStatusHistory;
import com.flowershop.order.entity.PaymentMethod;
import com.flowershop.order.entity.PaymentStatus;
import com.flowershop.order.event.OrderEvents.OrderStatusChangedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static com.flowershop.order.entity.OrderStatus.ARRANGING;
import static com.flowershop.order.entity.OrderStatus.CANCELLED;
import static com.flowershop.order.entity.OrderStatus.CONFIRMED;
import static com.flowershop.order.entity.OrderStatus.DELIVERED;
import static com.flowershop.order.entity.OrderStatus.DELIVERING;
import static com.flowershop.order.entity.OrderStatus.PENDING;

/**
 * Mọi lần đổi trạng thái đơn đều đi qua đây.
 * <pre>
 * PENDING    -> CONFIRMED   Staff, Admin         (đơn SEPAY phải PAID trước)
 * PENDING    -> CANCELLED   Khách, Staff, Admin, SYSTEM (hoàn stock, coupon)
 * CONFIRMED  -> ARRANGING   Staff, Admin
 * CONFIRMED  -> CANCELLED   Staff, Admin         (bắt buộc lý do; hoàn stock, coupon)
 * ARRANGING  -> DELIVERING  Staff, Admin
 * DELIVERING -> DELIVERED   Staff, Admin         (COD tự chuyển PAID)
 * </pre>
 * Từ ARRANGING trở đi không hủy được vì shop đã chuẩn bị hàng (hoa đã cắm).
 */
@Component
@RequiredArgsConstructor
public class OrderStateMachine {

    private record Transition(OrderStatus from, OrderStatus to) {
    }

    private static final Set<OrderActor.Type> STAFF = EnumSet.of(OrderActor.Type.STAFF, OrderActor.Type.ADMIN);
    private static final Set<OrderActor.Type> ANYONE = EnumSet.of(OrderActor.Type.CUSTOMER, OrderActor.Type.GUEST,
            OrderActor.Type.STAFF, OrderActor.Type.ADMIN, OrderActor.Type.SYSTEM);

    private static final Map<Transition, Set<OrderActor.Type>> RULES = Map.of(
            new Transition(PENDING, CONFIRMED), STAFF,
            new Transition(PENDING, CANCELLED), ANYONE,
            new Transition(CONFIRMED, ARRANGING), STAFF,
            new Transition(CONFIRMED, CANCELLED), STAFF,
            new Transition(ARRANGING, DELIVERING), STAFF,
            new Transition(DELIVERING, DELIVERED), STAFF);

    private final InventoryService inventoryService;
    private final CouponService couponService;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public boolean canTransition(Order order, OrderStatus to, OrderActor.Type actorType) {
        Set<OrderActor.Type> allowed = RULES.get(new Transition(order.getStatus(), to));
        return allowed != null && allowed.contains(actorType);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void transition(Order order, OrderStatus to, OrderActor actor, String reason) {
        OrderStatus from = order.getStatus();
        if (!canTransition(order, to, actor.type())) {
            throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION,
                    "Không thể chuyển đơn từ %s sang %s".formatted(from, to));
        }
        if (from == CONFIRMED && to == CANCELLED && (reason == null || reason.isBlank())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Hủy đơn đã xác nhận phải nhập lý do");
        }
        if (to == CONFIRMED && order.getPaymentMethod() == PaymentMethod.SEPAY
                && order.getPaymentStatus() != PaymentStatus.PAID) {
            throw new BusinessException(ErrorCode.ORDER_NOT_PAID);
        }

        switch (to) {
            case CANCELLED -> releaseResources(order);
            case DELIVERED -> {
                if (order.getPaymentMethod() == PaymentMethod.COD && order.getPaymentStatus() == PaymentStatus.UNPAID) {
                    order.setPaymentStatus(PaymentStatus.PAID);
                    order.setPaidAmount(order.getTotal());
                    order.setPaidAt(TimeUtils.now(clock));
                }
            }
            default -> {
            }
        }

        order.setStatus(to);
        OrderStatusHistory entry = new OrderStatusHistory();
        entry.setFromStatus(from);
        entry.setToStatus(to);
        entry.setChangedBy(actor.name());
        entry.setReason(reason);
        order.addHistory(entry);

        events.publishEvent(new OrderStatusChangedEvent(order.getId(), from, to, reason));
    }

    /** Hoàn stock và lượt coupon khi hủy. */
    private void releaseResources(Order order) {
        Map<Long, Integer> quantities = order.getItems().stream()
                .collect(Collectors.toMap(OrderItem::getVariantId, OrderItem::getQuantity, Integer::sum));
        inventoryService.restoreStock(quantities);
        if (order.getCouponId() != null) {
            couponService.release(order.getCouponId());
        }
    }
}
