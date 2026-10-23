package com.flowershop.order.mapper;

import com.flowershop.order.dto.OrderDtos.BankTransferInfo;
import com.flowershop.order.dto.OrderDtos.HistoryResponse;
import com.flowershop.order.dto.OrderDtos.LineResponse;
import com.flowershop.order.dto.OrderDtos.OrderResponse;
import com.flowershop.order.dto.OrderDtos.OrderSummary;
import com.flowershop.order.dto.OrderDtos.PartyResponse;
import com.flowershop.order.dto.OrderDtos.ZoneRef;
import com.flowershop.order.entity.Order;
import com.flowershop.order.entity.OrderItem;
import com.flowershop.order.entity.OrderStatusHistory;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper
public interface OrderMapper {

    LineResponse toLine(OrderItem item);

    List<LineResponse> toLines(List<OrderItem> items);

    HistoryResponse toHistory(OrderStatusHistory history);

    List<HistoryResponse> toHistories(List<OrderStatusHistory> history);

    default OrderResponse toResponse(Order o, boolean cancellable, boolean includeHistory, BankTransferInfo transfer) {
        return new OrderResponse(
                o.getCode(), o.getStatus(), o.getPaymentMethod(), o.getPaymentStatus(), o.getPaidAmount(),
                o.getPaidAt(),
                new PartyResponse(o.getSenderName(), o.getSenderPhone(), o.getSenderEmail()),
                new PartyResponse(o.getReceiverName(), o.getReceiverPhone(), null),
                o.isHideSender(), o.getDeliveryAddress(),
                new ZoneRef(o.getDeliveryZone().getId(), o.getDeliveryZone().getName()),
                o.getDeliveryDate(), o.getDeliverySlot(), o.getDeliverySlot().getLabel(),
                o.getCardMessage(), o.getNote(), toLines(o.getItems()),
                o.getSubtotal(), o.getShippingFee(), o.getDiscount(), o.getTotal(), o.getCouponCode(),
                o.getDeliveryPhotoUrl(), cancellable, o.getVersion(), o.getCreatedAt(), o.getUpdatedAt(),
                includeHistory ? toHistories(o.getHistory()) : null,
                transfer);
    }

    default OrderSummary toSummary(Order o) {
        List<OrderItem> items = o.getItems();
        return new OrderSummary(o.getCode(), o.getStatus(), o.getPaymentMethod(), o.getPaymentStatus(),
                o.getSenderName(), o.getSenderPhone(), o.getReceiverName(), o.getReceiverPhone(),
                o.getDeliveryDate(), o.getDeliverySlot(), o.getTotal(),
                items.stream().mapToInt(OrderItem::getQuantity).sum(),
                items.isEmpty() ? null : items.getFirst().getProductName(),
                o.getCreatedAt());
    }
}
