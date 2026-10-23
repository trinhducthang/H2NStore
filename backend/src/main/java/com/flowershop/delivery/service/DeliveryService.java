package com.flowershop.delivery.service;

import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.TimeUtils;
import com.flowershop.config.AppProperties;
import com.flowershop.config.CacheConfig;
import com.flowershop.delivery.dto.DeliveryDtos.SlotAvailability;
import com.flowershop.delivery.dto.DeliveryDtos.ZoneRequest;
import com.flowershop.delivery.dto.DeliveryDtos.ZoneResponse;
import com.flowershop.delivery.entity.DeliverySlot;
import com.flowershop.delivery.entity.DeliveryZone;
import com.flowershop.delivery.repository.DeliveryZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DeliveryService {

    private static final DateTimeFormatter HOLIDAY_KEY = DateTimeFormatter.ofPattern("MM-dd");

    private final DeliveryZoneRepository zoneRepository;
    private final SlotUsageCounter slotUsageCounter;
    private final AppProperties props;
    private final Clock clock;

    // ---------------------------------------------------------------- zones

    @Cacheable(cacheNames = CacheConfig.DELIVERY_ZONES, key = "'active'")
    @Transactional(readOnly = true)
    public List<ZoneResponse> activeZones() {
        return zoneRepository.findByActiveTrueOrderByShippingFeeAscIdAsc().stream().map(ZoneResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ZoneResponse> allZones() {
        return zoneRepository.findAllByOrderByIdAsc().stream().map(ZoneResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public DeliveryZone getActiveZone(Long id) {
        return zoneRepository.findById(id).filter(DeliveryZone::isActive)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Khu vực giao không hợp lệ"));
    }

    @CacheEvict(cacheNames = CacheConfig.DELIVERY_ZONES, allEntries = true)
    @Transactional
    public ZoneResponse createZone(ZoneRequest req) {
        DeliveryZone zone = new DeliveryZone();
        apply(zone, req);
        return ZoneResponse.from(zoneRepository.save(zone));
    }

    @CacheEvict(cacheNames = CacheConfig.DELIVERY_ZONES, allEntries = true)
    @Transactional
    public ZoneResponse updateZone(Long id, ZoneRequest req) {
        DeliveryZone zone = zoneRepository.findById(id).orElseThrow(() -> BusinessException.notFound("khu vực"));
        apply(zone, req);
        return ZoneResponse.from(zone);
    }

    /** Khu vực đã có đơn thì chỉ tắt, không xóa. */
    @CacheEvict(cacheNames = CacheConfig.DELIVERY_ZONES, allEntries = true)
    @Transactional
    public void deactivateZone(Long id) {
        DeliveryZone zone = zoneRepository.findById(id).orElseThrow(() -> BusinessException.notFound("khu vực"));
        zone.setActive(false);
    }

    private static void apply(DeliveryZone zone, ZoneRequest req) {
        zone.setName(req.name());
        zone.setDistricts(req.districts());
        zone.setShippingFee(req.shippingFee());
        zone.setExpressFee(req.expressFee());
        zone.setActive(req.active() == null || req.active());
    }

    public long shippingFee(DeliveryZone zone, DeliverySlot slot) {
        if (slot == DeliverySlot.EXPRESS) {
            if (zone.getExpressFee() == null) {
                throw new BusinessException(ErrorCode.INVALID_DELIVERY_TIME, "Khu vực này không hỗ trợ giao nhanh");
            }
            return zone.getExpressFee();
        }
        return zone.getShippingFee();
    }

    // ---------------------------------------------------------------- slots

    /** Khung giờ còn nhận đơn trong ngày; zoneId dùng để biết có hỗ trợ EXPRESS không. */
    @Transactional(readOnly = true)
    public List<SlotAvailability> availableSlots(LocalDate date, Long zoneId) {
        OffsetDateTime now = TimeUtils.now(clock);
        DeliveryZone zone = zoneId != null ? zoneRepository.findById(zoneId).orElse(null) : null;
        Map<DeliverySlot, Long> used = slotUsageCounter.countActiveByDate(date);
        int max = maxPerSlot(date);
        List<SlotAvailability> result = new ArrayList<>();
        for (DeliverySlot slot : DeliverySlot.values()) {
            String reason = timeRuleViolation(date, slot, zone, now);
            long remaining = Math.max(0, max - used.getOrDefault(slot, 0L));
            if (reason == null && remaining == 0) {
                reason = ErrorCode.SLOT_FULL.getDefaultMessage();
            }
            result.add(new SlotAvailability(slot, slot.getLabel(), slot.getStartHour(), slot.getEndHour(),
                    reason == null, reason == null ? remaining : 0, reason));
        }
        return result;
    }

    /** Kiểm tra cho /orders/preview (không khóa). */
    @Transactional(readOnly = true)
    public void validate(LocalDate date, DeliverySlot slot, DeliveryZone zone) {
        OffsetDateTime now = TimeUtils.now(clock);
        String violation = timeRuleViolation(date, slot, zone, now);
        if (violation != null) {
            throw new BusinessException(ErrorCode.INVALID_DELIVERY_TIME, violation);
        }
        if (slotUsageCounter.countActive(date, slot) >= maxPerSlot(date)) {
            throw new BusinessException(ErrorCode.SLOT_FULL);
        }
    }

    /** Kiểm tra khi tạo đơn: khóa khung giờ rồi mới đếm, để 2 đơn đồng thời không vượt giới hạn. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void validateAndLock(LocalDate date, DeliverySlot slot, DeliveryZone zone) {
        OffsetDateTime now = TimeUtils.now(clock);
        String violation = timeRuleViolation(date, slot, zone, now);
        if (violation != null) {
            throw new BusinessException(ErrorCode.INVALID_DELIVERY_TIME, violation);
        }
        slotUsageCounter.lock(date, slot);
        if (slotUsageCounter.countActive(date, slot) >= maxPerSlot(date)) {
            throw new BusinessException(ErrorCode.SLOT_FULL);
        }
    }

    public int maxPerSlot(LocalDate date) {
        Map<String, Integer> holidays = props.order().holidayMaxPerSlot();
        if (holidays != null) {
            Integer holidayMax = holidays.get(date.format(HOLIDAY_KEY));
            if (holidayMax != null) {
                return holidayMax;
            }
        }
        return props.order().maxPerSlot();
    }

    /** @return null nếu hợp lệ, ngược lại là thông báo lỗi. */
    private String timeRuleViolation(LocalDate date, DeliverySlot slot, DeliveryZone zone, OffsetDateTime now) {
        LocalDate today = now.toLocalDate();
        if (date == null || date.isBefore(today) || date.isAfter(today.plusDays(props.order().maxDaysAhead()))) {
            return "Ngày giao phải từ hôm nay đến " + props.order().maxDaysAhead() + " ngày tới";
        }
        if (slot == DeliverySlot.EXPRESS) {
            if (zone != null && !zone.isExpressAvailable()) {
                return "Khu vực này không hỗ trợ giao nhanh";
            }
            if (!date.equals(today)) {
                return "Giao nhanh chỉ áp dụng cho đơn giao trong ngày";
            }
            LocalTime time = now.toLocalTime();
            if (time.isBefore(LocalTime.of(props.order().expressStartHour(), 0))
                    || !time.isBefore(LocalTime.of(props.order().expressEndHour(), 0))) {
                return "Giao nhanh chỉ nhận đơn từ %d:00 đến %d:00".formatted(
                        props.order().expressStartHour(), props.order().expressEndHour());
            }
            return null;
        }
        OffsetDateTime slotStart = date.atTime(slot.getStartHour(), 0).atZone(TimeUtils.ZONE).toOffsetDateTime();
        if (slotStart.isBefore(now.plusHours(props.order().minPrepareHours()))) {
            return "Khung giờ này cần đặt trước ít nhất " + props.order().minPrepareHours() + " giờ";
        }
        return null;
    }
}
