package com.flowershop.delivery.entity;

import lombok.Getter;

@Getter
public enum DeliverySlot {
    SLOT_08_10(8, 10, "08:00 - 10:00"),
    SLOT_10_12(10, 12, "10:00 - 12:00"),
    SLOT_14_16(14, 16, "14:00 - 16:00"),
    SLOT_16_18(16, 18, "16:00 - 18:00"),
    SLOT_18_20(18, 20, "18:00 - 20:00"),
    /** Giao nhanh trong 2–3 giờ, chỉ nội thành, nhận đơn 8:00–17:00 */
    EXPRESS(null, null, "Giao nhanh 2 - 3 giờ");

    private final Integer startHour;
    private final Integer endHour;
    private final String label;

    DeliverySlot(Integer startHour, Integer endHour, String label) {
        this.startHour = startHour;
        this.endHour = endHour;
        this.label = label;
    }
}
