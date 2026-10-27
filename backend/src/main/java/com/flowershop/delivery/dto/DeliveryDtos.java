package com.flowershop.delivery.dto;

import com.flowershop.delivery.entity.DeliverySlot;
import com.flowershop.delivery.entity.DeliveryZone;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class DeliveryDtos {

    private DeliveryDtos() {
    }

    public record ZoneResponse(Long id, String name, String districts, long shippingFee, Long expressFee,
                               boolean expressAvailable, boolean active) {
        public static ZoneResponse from(DeliveryZone z) {
            return new ZoneResponse(z.getId(), z.getName(), z.getDistricts(), z.getShippingFee(), z.getExpressFee(),
                    z.isExpressAvailable(), z.isActive());
        }
    }

    public record ZoneRequest(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 2000) String districts,
            @NotNull @PositiveOrZero Long shippingFee,
            @PositiveOrZero Long expressFee,
            Boolean active) {
    }

    /** remaining: số đơn còn nhận; reason: lý do không nhận (nếu available=false). */
    public record SlotAvailability(DeliverySlot slot, String label, Integer startHour, Integer endHour,
                                   boolean available, long remaining, String reason) {
    }

    /** Địa chỉ tại một tọa độ, cùng dạng với sổ địa chỉ; district chỉ có ở vùng bản đồ chưa theo ĐVHC mới. */
    public record LocationResponse(double lat, double lng, String addressLine, String ward, String district,
                                   String city) {
    }
}
