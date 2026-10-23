package com.flowershop.order.service;

import com.flowershop.catalog.entity.ProductVariant;
import com.flowershop.catalog.service.InventoryService;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.coupon.dto.CouponDtos.CouponQuote;
import com.flowershop.coupon.service.CouponService;
import com.flowershop.delivery.entity.DeliverySlot;
import com.flowershop.delivery.entity.DeliveryZone;
import com.flowershop.delivery.service.DeliveryService;
import com.flowershop.order.dto.OrderDtos.LineResponse;
import com.flowershop.order.dto.OrderDtos.OrderItemRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tính giá ở server, dùng chung cho /orders/preview và /orders để hai nơi luôn ra cùng kết quả.
 * <pre>
 * unit_price   = sale_price nếu có, ngược lại price
 * subtotal     = Σ unit_price × quantity
 * shipping_fee = zone.shipping_fee (hoặc express_fee nếu slot = EXPRESS)
 * discount     = tính từ coupon trên subtotal
 * total        = max(0, subtotal + shipping_fee − discount)
 * </pre>
 */
@Service
@RequiredArgsConstructor
public class OrderPricingService {

    static final int MAX_QUANTITY_PER_LINE = 20;

    private final InventoryService inventoryService;
    private final CouponService couponService;
    private final DeliveryService deliveryService;

    public record PricedLine(ProductVariant variant, int quantity, long unitPrice, long lineTotal) {
        public LineResponse toResponse() {
            return new LineResponse(variant.getId(), variant.getProduct().getId(), variant.getProduct().getName(),
                    variant.getName(), unitPrice, quantity, lineTotal);
        }
    }

    public record Pricing(List<PricedLine> lines, long subtotal, long shippingFee, long discount, long total,
                          CouponQuote coupon, String couponError) {
    }

    /** Preview: không khóa, mã giảm giá sai thì trả couponError thay vì ném lỗi. */
    public Pricing preview(List<OrderItemRequest> items, DeliveryZone zone, DeliverySlot slot, String couponCode) {
        Map<Long, Integer> quantities = mergeItems(items);
        Map<Long, ProductVariant> variants = inventoryService.findVariants(quantities.keySet());
        List<PricedLine> lines = priceLines(quantities, variants);
        long subtotal = lines.stream().mapToLong(PricedLine::lineTotal).sum();
        long shipping = zone != null ? deliveryService.shippingFee(zone, slot) : 0;

        CouponQuote coupon = null;
        String couponError = null;
        if (couponCode != null && !couponCode.isBlank()) {
            var evaluation = couponService.evaluate(couponCode, subtotal);
            coupon = evaluation.quote();
            couponError = evaluation.message();
        }
        return build(lines, subtotal, shipping, coupon, couponError);
    }

    /** Tạo đơn: khóa biến thể (FOR UPDATE), mã giảm giá sai thì ném lỗi. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Pricing priceForCreate(List<OrderItemRequest> items, DeliveryZone zone, DeliverySlot slot,
                                  String couponCode) {
        Map<Long, Integer> quantities = mergeItems(items);
        Map<Long, ProductVariant> variants = inventoryService.lockVariants(quantities.keySet());
        List<PricedLine> lines = priceLines(quantities, variants);
        long subtotal = lines.stream().mapToLong(PricedLine::lineTotal).sum();
        long shipping = deliveryService.shippingFee(zone, slot);
        CouponQuote coupon = couponCode != null && !couponCode.isBlank()
                ? couponService.quote(couponCode, subtotal) : null;
        return build(lines, subtotal, shipping, coupon, null);
    }

    private static Pricing build(List<PricedLine> lines, long subtotal, long shipping, CouponQuote coupon,
                                 String couponError) {
        long discount = coupon != null ? coupon.discount() : 0;
        long total = Math.max(0, subtotal + shipping - discount);
        return new Pricing(lines, subtotal, shipping, discount, total, coupon, couponError);
    }

    private List<PricedLine> priceLines(Map<Long, Integer> quantities, Map<Long, ProductVariant> variants) {
        List<PricedLine> lines = new ArrayList<>();
        quantities.forEach((variantId, qty) -> {
            ProductVariant variant = variants.get(variantId);
            if (variant == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Sản phẩm không tồn tại (variant " + variantId + ")");
            }
            inventoryService.requireStock(variant, qty);
            long unitPrice = variant.effectivePrice();
            lines.add(new PricedLine(variant, qty, unitPrice, unitPrice * qty));
        });
        return lines;
    }

    /** Gộp các dòng trùng biến thể. */
    static Map<Long, Integer> mergeItems(List<OrderItemRequest> items) {
        Map<Long, Integer> merged = new LinkedHashMap<>();
        for (OrderItemRequest item : items) {
            merged.merge(item.variantId(), item.quantity(), Integer::sum);
        }
        merged.forEach((variantId, qty) -> {
            if (qty > MAX_QUANTITY_PER_LINE) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Mỗi sản phẩm tối đa " + MAX_QUANTITY_PER_LINE + " cái");
            }
        });
        return merged;
    }
}
