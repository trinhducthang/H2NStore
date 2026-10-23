package com.flowershop.order.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Hủy đơn SePay quá hạn thanh toán (mặc định 30 phút) để trả lại tồn kho, lượt coupon và chỗ trong khung giờ.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderExpiryJob {

    private final OrderService orderService;

    @Scheduled(fixedDelayString = "${app.sepay.expire-check-interval:PT60S}", initialDelayString = "PT30S")
    public void cancelExpiredOnlineOrders() {
        for (Long id : orderService.findExpiredUnpaidOnlineOrderIds()) {
            try {
                if (orderService.expireUnpaidOnlineOrder(id)) {
                    log.info("Đã hủy đơn #{} do quá hạn thanh toán online", id);
                }
            } catch (RuntimeException e) {
                log.warn("Không hủy được đơn quá hạn #{}: {}", id, e.getMessage());
            }
        }
    }
}
