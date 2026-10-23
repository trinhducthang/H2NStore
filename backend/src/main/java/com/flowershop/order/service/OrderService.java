package com.flowershop.order.service;

import com.flowershop.cart.service.CartService;
import com.flowershop.common.dto.PageQuery;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.MoneyFormat;
import com.flowershop.common.util.PhoneUtils;
import com.flowershop.common.util.TimeUtils;
import com.flowershop.config.AppProperties;
import com.flowershop.coupon.service.CouponService;
import com.flowershop.catalog.service.InventoryService;
import com.flowershop.delivery.entity.DeliveryZone;
import com.flowershop.delivery.service.DeliveryService;
import com.flowershop.order.dto.OrderDtos.BankTransferInfo;
import com.flowershop.order.dto.OrderDtos.CreateOrderRequest;
import com.flowershop.order.dto.OrderDtos.OrderCreatedResponse;
import com.flowershop.order.dto.OrderDtos.OrderNotificationView;
import com.flowershop.order.dto.OrderDtos.OrderResponse;
import com.flowershop.order.dto.OrderDtos.OrderSummary;
import com.flowershop.order.dto.OrderDtos.PartyResponse;
import com.flowershop.order.dto.OrderDtos.PaymentStatusResponse;
import com.flowershop.order.dto.OrderDtos.PreviewOrderRequest;
import com.flowershop.order.dto.OrderDtos.PreviewOrderResponse;
import com.flowershop.order.dto.OrderDtos.UpdatePaymentRequest;
import com.flowershop.order.dto.OrderDtos.UpdateStatusRequest;
import com.flowershop.order.entity.Order;
import com.flowershop.order.entity.OrderItem;
import com.flowershop.order.entity.OrderStatus;
import com.flowershop.order.entity.OrderStatusHistory;
import com.flowershop.order.entity.PaymentMethod;
import com.flowershop.order.entity.PaymentStatus;
import com.flowershop.order.event.OrderEvents.OrderCreatedEvent;
import com.flowershop.order.event.OrderEvents.OrderPaidEvent;
import com.flowershop.order.mapper.OrderMapper;
import com.flowershop.order.repository.OrderRepository;
import com.flowershop.order.repository.OrderSpecs;
import com.flowershop.order.repository.OrderSqlRepository;
import com.flowershop.payment.service.SepayQrBuilder;
import com.flowershop.security.UserPrincipal;
import com.flowershop.storage.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private static final DateTimeFormatter CODE_DATE = DateTimeFormatter.ofPattern("yyMMdd");
    private static final Duration IDEMPOTENCY_WINDOW = Duration.ofHours(24);
    private static final int EXPIRE_BATCH_SIZE = 100;

    private final OrderRepository orderRepository;
    private final OrderSqlRepository orderSqlRepository;
    private final OrderPricingService pricingService;
    private final OrderStateMachine stateMachine;
    private final DeliveryService deliveryService;
    private final CouponService couponService;
    private final InventoryService inventoryService;
    private final CartService cartService;
    private final SepayQrBuilder sepayQrBuilder;
    private final StorageService storageService;
    private final OrderMapper mapper;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transactionTemplate;
    private final AppProperties props;
    private final Clock clock;

    public record CreateResult(OrderCreatedResponse body, boolean replayed) {
    }

    // =================================================================== khách hàng / khách vãng lai

    /**
     * Không mở transaction bao ngoài: mỗi bước tự đọc trong transaction riêng, để lỗi mã giảm giá
     * (được trả về dạng couponError) không làm cả transaction bị đánh dấu rollback-only.
     */
    public PreviewOrderResponse preview(PreviewOrderRequest req) {
        DeliveryZone zone = req.deliveryZoneId() != null ? deliveryService.getActiveZone(req.deliveryZoneId()) : null;
        if (zone != null && req.deliveryDate() != null && req.deliverySlot() != null) {
            deliveryService.validate(req.deliveryDate(), req.deliverySlot(), zone);
        }
        var pricing = pricingService.preview(req.items(), zone, req.deliverySlot(), req.couponCode());
        return new PreviewOrderResponse(
                pricing.lines().stream().map(OrderPricingService.PricedLine::toResponse).toList(),
                pricing.subtotal(), pricing.shippingFee(), pricing.discount(), pricing.total(),
                pricing.coupon() != null ? pricing.coupon().code() : null, pricing.couponError());
    }

    /**
     * Luồng tạo đơn (mục 6.1). Idempotency-Key đã dùng trong 24h thì trả lại đơn cũ.
     */
    public CreateResult create(CreateOrderRequest req, String idempotencyKey, Optional<UserPrincipal> user) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 100) {
            throw new BusinessException(ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
                    "Header Idempotency-Key bắt buộc, tối đa 100 ký tự");
        }
        Optional<CreateResult> replay = findReplay(idempotencyKey);
        if (replay.isPresent()) {
            return replay.get();
        }
        try {
            OrderCreatedResponse body = transactionTemplate.execute(status -> doCreate(req, idempotencyKey, user));
            return new CreateResult(body, false);
        } catch (DataIntegrityViolationException e) {
            // Hai request cùng key chạy song song: request sau vướng UNIQUE(idempotency_key)
            String cause = String.valueOf(NestedExceptionUtils.getMostSpecificCause(e).getMessage());
            if (cause.contains("uq_orders_idempotency_key")) {
                return findReplay(idempotencyKey).orElseThrow(() -> e);
            }
            throw e;
        }
    }

    private Optional<CreateResult> findReplay(String idempotencyKey) {
        return transactionTemplate.execute(status -> orderRepository.findByIdempotencyKey(idempotencyKey)
                .map(existing -> {
                    if (existing.getCreatedAt().isBefore(TimeUtils.now(clock).minus(IDEMPOTENCY_WINDOW))) {
                        throw new BusinessException(ErrorCode.CONFLICT, "Idempotency-Key đã được dùng");
                    }
                    return new CreateResult(toCreatedResponse(existing), true);
                }));
    }

    private OrderCreatedResponse doCreate(CreateOrderRequest req, String idempotencyKey,
                                          Optional<UserPrincipal> user) {
        // 1-2. Khu vực + ngày giờ giao (khóa khung giờ để đếm không bị vượt)
        DeliveryZone zone = deliveryService.getActiveZone(req.deliveryZoneId());
        deliveryService.validateAndLock(req.deliveryDate(), req.deliverySlot(), zone);

        // 3-4. Khóa biến thể FOR UPDATE, kiểm tra tồn kho, tính giá ở server
        var pricing = pricingService.priceForCreate(req.items(), zone, req.deliverySlot(), req.couponCode());

        // 5. Trừ lượt coupon bằng UPDATE có điều kiện
        if (pricing.coupon() != null) {
            couponService.consume(pricing.coupon().couponId());
        }

        // 6. Trừ stock, tăng sold_count
        pricing.lines().forEach(line -> inventoryService.decreaseStock(line.variant(), line.quantity()));

        // 7. Lưu đơn, chụp lại tên + giá, dòng lịch sử đầu tiên
        LocalDate today = TimeUtils.today(clock);
        Order order = new Order();
        order.setCode("FS" + today.format(CODE_DATE) + "%04d".formatted(orderSqlRepository.nextDailySequence(today)));
        order.setUserId(user.map(UserPrincipal::id).orElse(null));
        order.setSenderName(req.sender().name());
        order.setSenderPhone(PhoneUtils.normalize(req.sender().phone()));
        order.setSenderEmail(req.sender().email() != null ? req.sender().email().toLowerCase(Locale.ROOT) : null);
        order.setReceiverName(req.receiver().name());
        order.setReceiverPhone(PhoneUtils.normalize(req.receiver().phone()));
        order.setDeliveryAddress(req.deliveryAddress());
        order.setDeliveryZone(zone);
        order.setDeliveryDate(req.deliveryDate());
        order.setDeliverySlot(req.deliverySlot());
        order.setCardMessage(req.cardMessage());
        order.setHideSender(req.hideSender());
        order.setNote(req.note());
        order.setSubtotal(pricing.subtotal());
        order.setShippingFee(pricing.shippingFee());
        order.setDiscount(pricing.discount());
        order.setTotal(pricing.total());
        if (pricing.coupon() != null) {
            order.setCouponId(pricing.coupon().couponId());
            order.setCouponCode(pricing.coupon().code());
        }
        order.setPaymentMethod(req.paymentMethod());
        order.setPaymentStatus(PaymentStatus.UNPAID);
        order.setStatus(OrderStatus.PENDING);
        order.setIdempotencyKey(idempotencyKey);
        if (pricing.total() == 0) {
            // Mã giảm giá phủ toàn bộ: coi như đã thanh toán
            order.setPaymentStatus(PaymentStatus.PAID);
            order.setPaidAt(TimeUtils.now(clock));
        }
        for (var line : pricing.lines()) {
            OrderItem item = new OrderItem();
            item.setVariantId(line.variant().getId());
            item.setProductId(line.variant().getProduct().getId());
            item.setProductName(line.variant().getProduct().getName());
            item.setVariantName(line.variant().getName());
            item.setUnitPrice(line.unitPrice());
            item.setQuantity(line.quantity());
            item.setLineTotal(line.lineTotal());
            order.addItem(item);
        }
        OrderStatusHistory first = new OrderStatusHistory();
        first.setFromStatus(null);
        first.setToStatus(OrderStatus.PENDING);
        first.setChangedBy(user.map(UserPrincipal::email).orElse("Khách: " + req.sender().name()));
        order.addHistory(first);
        orderRepository.save(order);

        // 8. Xóa các dòng tương ứng trong giỏ server
        user.ifPresent(u -> cartService.removeVariants(u.id(),
                pricing.lines().stream().map(l -> l.variant().getId()).toList()));

        // 9. Sau commit: Telegram cho shop + email cho khách
        events.publishEvent(new OrderCreatedEvent(order.getId()));
        log.info("Tạo đơn {} tổng {} ({}), người gửi {}", order.getCode(), order.getTotal(),
                order.getPaymentMethod(), PhoneUtils.mask(order.getSenderPhone()));
        return toCreatedResponse(order);
    }

    private OrderCreatedResponse toCreatedResponse(Order o) {
        return new OrderCreatedResponse(o.getCode(), o.getStatus(), o.getSubtotal(), o.getShippingFee(),
                o.getDiscount(), o.getTotal(), o.getPaymentMethod(), o.getPaymentStatus(), transferInfo(o));
    }

    /** Thông tin chuyển khoản SePay, chỉ khi đơn online còn chờ thanh toán. */
    private BankTransferInfo transferInfo(Order o) {
        if (o.getPaymentMethod() != PaymentMethod.SEPAY || o.getPaymentStatus() != PaymentStatus.UNPAID
                || o.getStatus() != OrderStatus.PENDING) {
            return null;
        }
        OffsetDateTime createdAt = o.getCreatedAt() != null ? o.getCreatedAt() : TimeUtils.now(clock);
        long remaining = Math.max(0, o.getTotal() - o.getPaidAmount());
        return sepayQrBuilder.build(o.getCode(), remaining, createdAt.plus(props.sepay().paymentTtl()));
    }

    /** Tra cứu cho khách vãng lai bằng mã đơn + SĐT người gửi hoặc người nhận. */
    @Transactional(readOnly = true)
    public OrderResponse track(String code, String phone) {
        Order order = findByCodeAndPhone(code, phone);
        boolean isSender = PhoneUtils.normalize(phone).equals(order.getSenderPhone());
        OrderResponse response = mapper.toResponse(order, false, true, transferInfo(order));
        if (!isSender && order.isHideSender()) {
            // Người nhận tra cứu đơn giấu tên: không lộ thông tin người gửi
            response = withSender(response, new PartyResponse("Ẩn danh", null, null));
        }
        return response;
    }

    @Transactional(readOnly = true)
    public PaymentStatusResponse paymentStatus(String code, String phone) {
        Order o = findByCodeAndPhone(code, phone);
        return new PaymentStatusResponse(o.getCode(), o.getStatus(), o.getPaymentMethod(), o.getPaymentStatus(),
                o.getTotal(), o.getPaidAmount(), o.getPaidAt(), transferInfo(o));
    }

    private Order findByCodeAndPhone(String code, String phone) {
        String normalized = PhoneUtils.normalize(phone);
        return orderRepository.findByCode(code.trim().toUpperCase(Locale.ROOT))
                .filter(o -> normalized != null
                        && (normalized.equals(o.getSenderPhone()) || normalized.equals(o.getReceiverPhone())))
                .orElseThrow(() -> BusinessException.notFound("đơn hàng"));
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummary> myOrders(Long userId, Integer page, Integer size) {
        var pageable = PageQuery.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.of(orderRepository.findByUserId(userId, pageable), mapper::toSummary);
    }

    @Transactional(readOnly = true)
    public OrderResponse myOrder(Long userId, String code) {
        Order order = getMine(userId, code);
        return mapper.toResponse(order, customerCanCancel(order), true, transferInfo(order));
    }

    @Transactional
    public OrderResponse cancelMyOrder(UserPrincipal me, String code, String reason) {
        Order order = getMine(me.id(), code);
        if (order.getPaymentStatus() == PaymentStatus.PAID) {
            throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION,
                    "Đơn đã thanh toán, vui lòng liên hệ shop để hủy và hoàn tiền");
        }
        stateMachine.transition(order, OrderStatus.CANCELLED, OrderActor.of(me),
                reason != null ? reason : "Khách tự hủy");
        return mapper.toResponse(order, false, true, null);
    }

    private Order getMine(Long userId, String code) {
        return orderRepository.findByCodeAndUserId(code.toUpperCase(Locale.ROOT), userId)
                .orElseThrow(() -> BusinessException.notFound("đơn hàng"));
    }

    private boolean customerCanCancel(Order order) {
        return order.getStatus() == OrderStatus.PENDING && order.getPaymentStatus() != PaymentStatus.PAID;
    }

    // =================================================================== quản trị

    @Transactional(readOnly = true)
    public PageResponse<OrderSummary> adminSearch(OrderStatus status, PaymentStatus paymentStatus,
                                                  LocalDate deliveryDate, String q, Integer page, Integer size) {
        var pageable = PageQuery.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.of(orderRepository.findAll(
                OrderSpecs.adminFilter(status, paymentStatus, deliveryDate, q), pageable), mapper::toSummary);
    }

    @Transactional(readOnly = true)
    public OrderResponse adminGet(String code) {
        Order order = getByCode(code);
        return toAdminResponse(order);
    }

    @Transactional
    public OrderResponse changeStatus(String code, UpdateStatusRequest req, UserPrincipal staff) {
        Order order = getByCode(code);
        checkVersion(order, req.version());
        stateMachine.transition(order, req.toStatus(), OrderActor.of(staff), req.reason());
        orderRepository.flush();
        return toAdminResponse(order);
    }

    /**
     * Nhân viên chỉnh trạng thái thanh toán (khi SePay không bắt được giao dịch, hoặc hoàn tiền).
     * UNPAID -> PAID, PAID -> REFUNDED, PAID -> UNPAID (sửa nhầm).
     */
    @Transactional
    public OrderResponse updatePayment(String code, UpdatePaymentRequest req, UserPrincipal staff) {
        Order order = getByCode(code);
        checkVersion(order, req.version());
        PaymentStatus from = order.getPaymentStatus();
        PaymentStatus to = req.paymentStatus();
        boolean allowed = (from == PaymentStatus.UNPAID && to == PaymentStatus.PAID
                && order.getStatus() != OrderStatus.CANCELLED)
                || (from == PaymentStatus.PAID && (to == PaymentStatus.REFUNDED || to == PaymentStatus.UNPAID));
        if (!allowed) {
            throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION,
                    "Không thể đổi thanh toán từ %s sang %s".formatted(from, to));
        }
        switch (to) {
            case PAID -> {
                order.setPaidAmount(Math.max(order.getPaidAmount(), order.getTotal()));
                order.setPaidAt(TimeUtils.now(clock));
                events.publishEvent(new OrderPaidEvent(order.getId(), order.getTotal(), "MANUAL"));
            }
            case UNPAID -> {
                order.setPaidAmount(0);
                order.setPaidAt(null);
            }
            case REFUNDED -> {
            }
        }
        order.setPaymentStatus(to);
        // Ghi vết thay đổi tiền vào lịch sử (trạng thái đơn giữ nguyên)
        OrderStatusHistory entry = new OrderStatusHistory();
        entry.setFromStatus(order.getStatus());
        entry.setToStatus(order.getStatus());
        entry.setChangedBy(staff.email());
        entry.setReason("Thanh toán: %s → %s%s".formatted(from, to, req.note() != null ? ". " + req.note() : ""));
        order.addHistory(entry);
        orderRepository.flush();
        return toAdminResponse(order);
    }

    @Transactional
    public OrderResponse uploadDeliveryPhoto(String code, MultipartFile file) {
        Order order = getByCode(code);
        var stored = storageService.storeImage(file, "orders/" + order.getCode());
        order.setDeliveryPhotoUrl(stored.url());
        return toAdminResponse(order);
    }

    private OrderResponse toAdminResponse(Order order) {
        boolean cancellable = stateMachine.canTransition(order, OrderStatus.CANCELLED, OrderActor.Type.STAFF);
        return mapper.toResponse(order, cancellable, true, transferInfo(order));
    }

    private Order getByCode(String code) {
        return orderRepository.findByCode(code.toUpperCase(Locale.ROOT))
                .orElseThrow(() -> BusinessException.notFound("đơn hàng"));
    }

    private static void checkVersion(Order order, Long expectedVersion) {
        if (expectedVersion != null && !Objects.equals(expectedVersion, order.getVersion())) {
            throw new BusinessException(ErrorCode.CONFLICT);
        }
    }

    // =================================================================== thanh toán online (module payment gọi)

    /**
     * Cộng một khoản tiền vào đơn (khóa dòng đơn để không đua với job hủy đơn quá hạn).
     * Đủ tiền thì chuyển PAID và phát OrderPaidEvent.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public PaymentApplyResult applyOnlinePayment(String orderCode, long amount, String source) {
        Optional<Order> found = orderRepository.findByCodeForUpdate(orderCode.toUpperCase(Locale.ROOT));
        if (found.isEmpty()) {
            return PaymentApplyResult.notFound(orderCode);
        }
        Order order = found.get();
        if (order.getStatus() == OrderStatus.CANCELLED || order.getPaymentStatus() != PaymentStatus.UNPAID) {
            String reason = order.getStatus() == OrderStatus.CANCELLED ? "Đơn đã hủy"
                    : "Đơn đã ở trạng thái thanh toán " + order.getPaymentStatus();
            return new PaymentApplyResult(PaymentApplyResult.Outcome.NOT_PAYABLE, order.getId(), order.getCode(),
                    order.getPaidAmount(), order.getTotal(), reason + ", cần hoàn tiền thủ công");
        }
        order.setPaidAmount(order.getPaidAmount() + amount);
        if (order.getPaidAmount() >= order.getTotal()) {
            order.setPaymentStatus(PaymentStatus.PAID);
            order.setPaidAt(TimeUtils.now(clock));
            events.publishEvent(new OrderPaidEvent(order.getId(), order.getPaidAmount(), source));
            String note = order.getPaidAmount() > order.getTotal()
                    ? "Khách chuyển dư " + MoneyFormat.vnd(order.getPaidAmount() - order.getTotal()) + "đ" : null;
            return new PaymentApplyResult(PaymentApplyResult.Outcome.PAID, order.getId(), order.getCode(),
                    order.getPaidAmount(), order.getTotal(), note);
        }
        return new PaymentApplyResult(PaymentApplyResult.Outcome.PARTIAL, order.getId(), order.getCode(),
                order.getPaidAmount(), order.getTotal(),
                "Còn thiếu " + MoneyFormat.vnd(order.getTotal() - order.getPaidAmount()) + "đ");
    }

    // =================================================================== job hủy đơn online quá hạn

    @Transactional(readOnly = true)
    public List<Long> findExpiredUnpaidOnlineOrderIds() {
        OffsetDateTime cutoff = TimeUtils.now(clock).minus(props.sepay().paymentTtl());
        return orderRepository.findExpiredUnpaidIds(PaymentMethod.SEPAY, cutoff, PageRequest.of(0, EXPIRE_BATCH_SIZE));
    }

    /** Hủy đơn SePay quá hạn chưa thanh toán để trả lại hàng và khung giờ. */
    @Transactional
    public boolean expireUnpaidOnlineOrder(Long orderId) {
        OffsetDateTime cutoff = TimeUtils.now(clock).minus(props.sepay().paymentTtl());
        Order order = orderRepository.findByIdForUpdate(orderId).orElse(null);
        // Kiểm tra lại sau khi khóa: webhook có thể vừa ghi nhận tiền
        if (order == null || order.getStatus() != OrderStatus.PENDING
                || order.getPaymentStatus() != PaymentStatus.UNPAID || order.getPaidAmount() > 0
                || !order.getCreatedAt().isBefore(cutoff)) {
            return false;
        }
        stateMachine.transition(order, OrderStatus.CANCELLED, OrderActor.SYSTEM,
                "Quá hạn thanh toán online (" + props.sepay().paymentTtl().toMinutes() + " phút)");
        return true;
    }

    // =================================================================== thông báo

    @Transactional(readOnly = true)
    public OrderNotificationView notificationView(Long orderId) {
        Order o = orderRepository.findById(orderId).orElseThrow(() -> BusinessException.notFound("đơn hàng"));
        List<String> lines = o.getItems().stream()
                .map(i -> "%s (%s) x%d".formatted(i.getProductName(), i.getVariantName(), i.getQuantity()))
                .toList();
        return new OrderNotificationView(o.getCode(), o.getStatus(), o.getSenderName(), o.getSenderPhone(),
                o.getSenderEmail(), o.getReceiverName(), o.getReceiverPhone(), o.getDeliveryAddress(),
                o.getDeliveryZone().getName(), o.getDeliveryDate(), o.getDeliverySlot().getLabel(),
                o.getCardMessage(), o.getNote(), lines, o.getTotal(), o.getPaymentMethod(), o.getPaymentStatus(),
                o.getPaidAmount());
    }

    /** Kiểm tra đơn của user có ở trạng thái DELIVERED và chứa sản phẩm không (dùng cho đánh giá). */
    @Transactional(readOnly = true)
    public Optional<Long> findDeliveredOrderIdContainingProduct(Long userId, String code, Long productId) {
        return orderRepository.findByCodeAndUserId(code.toUpperCase(Locale.ROOT), userId)
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
                .filter(o -> o.getItems().stream().anyMatch(i -> i.getProductId().equals(productId)))
                .map(Order::getId);
    }

    private static OrderResponse withSender(OrderResponse r, PartyResponse sender) {
        return new OrderResponse(r.code(), r.status(), r.paymentMethod(), r.paymentStatus(), r.paidAmount(),
                r.paidAt(), sender, r.receiver(), r.hideSender(), r.deliveryAddress(), r.deliveryZone(),
                r.deliveryDate(), r.deliverySlot(), r.deliverySlotLabel(), r.cardMessage(), r.note(), r.items(),
                r.subtotal(), r.shippingFee(), r.discount(), r.total(), r.couponCode(), r.deliveryPhotoUrl(),
                r.cancellable(), r.version(), r.createdAt(), r.updatedAt(), r.history(), r.bankTransferInfo());
    }
}
