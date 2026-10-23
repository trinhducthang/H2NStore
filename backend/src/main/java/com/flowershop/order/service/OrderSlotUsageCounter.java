package com.flowershop.order.service;

import com.flowershop.delivery.entity.DeliverySlot;
import com.flowershop.delivery.service.SlotUsageCounter;
import com.flowershop.order.repository.OrderRepository;
import com.flowershop.order.repository.OrderSqlRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.EnumMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class OrderSlotUsageCounter implements SlotUsageCounter {

    /** Không gian khóa riêng cho khung giờ giao, tránh trùng với khóa khác. */
    private static final long LOCK_NAMESPACE = 0x5107L << 40;

    private final OrderRepository orderRepository;
    private final OrderSqlRepository orderSqlRepository;

    @Override
    @Transactional(readOnly = true)
    public long countActive(LocalDate date, DeliverySlot slot) {
        return orderRepository.countActiveBySlot(date, slot);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<DeliverySlot, Long> countActiveByDate(LocalDate date) {
        Map<DeliverySlot, Long> result = new EnumMap<>(DeliverySlot.class);
        for (Object[] row : orderRepository.countActiveByDate(date)) {
            result.put((DeliverySlot) row[0], (Long) row[1]);
        }
        return result;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void lock(LocalDate date, DeliverySlot slot) {
        orderSqlRepository.advisoryXactLock(LOCK_NAMESPACE + date.toEpochDay() * 16 + slot.ordinal());
    }
}
