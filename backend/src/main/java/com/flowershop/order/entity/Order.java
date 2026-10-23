package com.flowershop.order.entity;

import com.flowershop.common.entity.BaseEntity;
import com.flowershop.delivery.entity.DeliverySlot;
import com.flowershop.delivery.entity.DeliveryZone;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "orders")
public class Order extends BaseEntity {

    @Column(nullable = false)
    private String code;

    /** null = khách vãng lai */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "sender_name", nullable = false)
    private String senderName;

    @Column(name = "sender_phone", nullable = false)
    private String senderPhone;

    @Column(name = "sender_email")
    private String senderEmail;

    @Column(name = "receiver_name", nullable = false)
    private String receiverName;

    @Column(name = "receiver_phone", nullable = false)
    private String receiverPhone;

    @Column(name = "delivery_address", nullable = false)
    private String deliveryAddress;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "delivery_zone_id", nullable = false)
    private DeliveryZone deliveryZone;

    @Column(name = "delivery_date", nullable = false)
    private LocalDate deliveryDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_slot", nullable = false)
    private DeliverySlot deliverySlot;

    @Column(name = "card_message")
    private String cardMessage;

    @Column(name = "hide_sender", nullable = false)
    private boolean hideSender;

    private String note;

    @Column(nullable = false)
    private long subtotal;

    @Column(name = "shipping_fee", nullable = false)
    private long shippingFee;

    @Column(nullable = false)
    private long discount;

    @Column(nullable = false)
    private long total;

    @Column(name = "coupon_id")
    private Long couponId;

    @Column(name = "coupon_code")
    private String couponCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;

    /** Tổng tiền đã nhận (cộng dồn các giao dịch SePay) */
    @Column(name = "paid_amount", nullable = false)
    private long paidAmount;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    @Column(name = "delivery_photo_url")
    private String deliveryPhotoUrl;

    @Column(name = "idempotency_key")
    private String idempotencyKey;

    /** Optimistic lock: 2 nhân viên cùng sửa thì người sau nhận 409 CONFLICT */
    @Version
    @Column(nullable = false)
    private long version;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<OrderStatusHistory> history = new ArrayList<>();

    public void addItem(OrderItem item) {
        item.setOrder(this);
        items.add(item);
    }

    public void addHistory(OrderStatusHistory entry) {
        entry.setOrder(this);
        history.add(entry);
    }
}
