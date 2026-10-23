package com.flowershop.delivery.service;

import com.flowershop.delivery.entity.DeliverySlot;

import java.time.LocalDate;
import java.util.Map;

/**
 * Đếm số đơn chưa hủy theo khung giờ. Module order cài đặt interface này
 * (đảo phụ thuộc để delivery không phải gọi ngược vào order).
 */
public interface SlotUsageCounter {

    long countActive(LocalDate date, DeliverySlot slot);

    Map<DeliverySlot, Long> countActiveByDate(LocalDate date);

    /** Khóa tư vấn theo (ngày, khung giờ) trong transaction hiện tại để đếm-rồi-ghi không bị vượt giới hạn. */
    void lock(LocalDate date, DeliverySlot slot);
}
