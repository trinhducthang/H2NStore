package com.flowershop.delivery.controller;

import com.flowershop.delivery.dto.DeliveryDtos.LocationResponse;
import com.flowershop.delivery.dto.DeliveryDtos.SlotAvailability;
import com.flowershop.delivery.dto.DeliveryDtos.ZoneRequest;
import com.flowershop.delivery.dto.DeliveryDtos.ZoneResponse;
import com.flowershop.delivery.service.DeliveryService;
import com.flowershop.delivery.service.ReverseGeocoder;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "Delivery")
@RestController
@RequiredArgsConstructor
public class DeliveryController {

    private final DeliveryService deliveryService;
    private final ReverseGeocoder reverseGeocoder;

    @GetMapping("/api/public/delivery/zones")
    public List<ZoneResponse> zones() {
        return deliveryService.activeZones();
    }

    @GetMapping("/api/public/delivery/slots")
    public List<SlotAvailability> slots(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                        @RequestParam(required = false) Long zoneId) {
        return deliveryService.availableSlots(date, zoneId);
    }

    /** Địa chỉ tại tọa độ GPS của khách (nút "Vị trí hiện tại" khi đặt hàng). */
    @GetMapping("/api/public/delivery/reverse-geocode")
    public LocationResponse reverseGeocode(@RequestParam double lat, @RequestParam double lng) {
        return reverseGeocoder.reverse(lat, lng);
    }

    @GetMapping("/api/admin/delivery-zones")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ZoneResponse> adminZones() {
        return deliveryService.allZones();
    }

    @PostMapping("/api/admin/delivery-zones")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ZoneResponse create(@Valid @RequestBody ZoneRequest req) {
        return deliveryService.createZone(req);
    }

    @PutMapping("/api/admin/delivery-zones/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ZoneResponse update(@PathVariable Long id, @Valid @RequestBody ZoneRequest req) {
        return deliveryService.updateZone(id, req);
    }

    @DeleteMapping("/api/admin/delivery-zones/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        deliveryService.deactivateZone(id);
    }
}
