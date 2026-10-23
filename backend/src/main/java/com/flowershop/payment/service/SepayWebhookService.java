package com.flowershop.payment.service;

import com.flowershop.common.dto.PageQuery;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.MoneyFormat;
import com.flowershop.common.util.TimeUtils;
import com.flowershop.common.util.TokenUtils;
import com.flowershop.config.AppProperties;
import com.flowershop.order.service.OrderService;
import com.flowershop.order.service.PaymentApplyResult;
import com.flowershop.payment.dto.PaymentDtos.PaymentTransactionResponse;
import com.flowershop.payment.dto.SepayWebhookPayload;
import com.flowershop.payment.entity.PaymentTransaction;
import com.flowershop.payment.entity.PaymentTransaction.Status;
import com.flowershop.payment.event.PaymentNeedsAttentionEvent;
import com.flowershop.payment.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Xử lý webhook SePay: xác thực API key, chống trùng theo id giao dịch, tìm mã đơn trong nội dung
 * chuyển khoản và cộng tiền vào đơn.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SepayWebhookService {

    /** Mã đơn: FS + yyMMdd + 4 số. Ngân hàng có thể chèn thêm chữ trước/sau nên không dùng \b. */
    private static final Pattern ORDER_CODE = Pattern.compile("FS\\d{10}");
    private static final DateTimeFormatter SEPAY_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String AUTH_PREFIX = "apikey ";

    private final PaymentTransactionRepository transactionRepository;
    private final OrderService orderService;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transactionTemplate;
    private final AppProperties props;

    /** SePay gửi header: Authorization: Apikey {API_KEY} */
    public boolean isAuthorized(String authorizationHeader) {
        String expected = props.sepay().webhookApiKey();
        if (expected == null || expected.isBlank()) {
            log.error("Chưa cấu hình app.sepay.webhook-api-key, từ chối mọi webhook SePay");
            return false;
        }
        if (authorizationHeader == null
                || !authorizationHeader.toLowerCase(Locale.ROOT).startsWith(AUTH_PREFIX)) {
            return false;
        }
        return TokenUtils.constantTimeEquals(authorizationHeader.substring(AUTH_PREFIX.length()).trim(), expected);
    }

    /**
     * Idempotent: cùng một id giao dịch SePay gửi lại nhiều lần chỉ được ghi nhận một lần.
     */
    public void handle(SepayWebhookPayload payload, String rawBody) {
        if (payload.id() == null || payload.transferAmount() == null || payload.transferType() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Payload SePay thiếu id/transferAmount/transferType");
        }
        String txnId = String.valueOf(payload.id());
        if (transactionRepository.existsByProviderAndProviderTxnId(PaymentTransaction.PROVIDER_SEPAY, txnId)) {
            log.info("Bỏ qua webhook SePay trùng, id={}", txnId);
            return;
        }
        try {
            transactionTemplate.executeWithoutResult(status -> process(payload, rawBody));
        } catch (DataIntegrityViolationException e) {
            String cause = String.valueOf(NestedExceptionUtils.getMostSpecificCause(e).getMessage());
            if (cause.contains("uq_payment_transactions_provider_txn")) {
                log.info("Webhook SePay id={} đang/đã được xử lý bởi request khác", txnId);
                return;
            }
            throw e;
        }
    }

    private void process(SepayWebhookPayload p, String rawBody) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setProvider(PaymentTransaction.PROVIDER_SEPAY);
        tx.setProviderTxnId(String.valueOf(p.id()));
        tx.setGateway(p.gateway());
        tx.setAccountNumber(p.accountNumber());
        tx.setSubAccount(p.subAccount());
        tx.setTransferType(p.transferType().toLowerCase(Locale.ROOT));
        tx.setAmount(p.transferAmount());
        tx.setContent(truncate(p.content(), 1000));
        tx.setReferenceCode(truncate(p.referenceCode(), 100));
        tx.setTransactionDate(parseDate(p.transactionDate()));
        tx.setRawPayload(rawBody);
        tx.setStatus(Status.IGNORED);
        // Ghi trước để "giữ chỗ" id giao dịch: request trùng song song sẽ chờ ở UNIQUE rồi lỗi, không cộng tiền 2 lần
        transactionRepository.saveAndFlush(tx);

        if (!"in".equals(tx.getTransferType())) {
            tx.setNote("Giao dịch tiền ra");
            return;
        }
        if (!accountMatches(p)) {
            tx.setNote("Không phải tài khoản nhận tiền của shop");
            log.warn("Webhook SePay id={} cho tài khoản {} không khớp cấu hình", p.id(), p.accountNumber());
            return;
        }
        if (tx.getAmount() <= 0) {
            tx.setNote("Số tiền không hợp lệ");
            return;
        }

        String orderCode = extractOrderCode(p.code(), p.content(), p.description());
        if (orderCode == null) {
            markUnmatched(tx, "Không tìm thấy mã đơn trong nội dung chuyển khoản");
            return;
        }
        tx.setOrderCode(orderCode);
        applyToOrder(tx, orderCode);
    }

    private void applyToOrder(PaymentTransaction tx, String orderCode) {
        PaymentApplyResult result = orderService.applyOnlinePayment(orderCode, tx.getAmount(), "SEPAY");
        tx.setOrderId(result.orderId());
        switch (result.outcome()) {
            case PAID -> {
                tx.setStatus(Status.MATCHED);
                tx.setNote(result.message());
                log.info("SePay: đơn {} đã thanh toán đủ ({}đ)", orderCode, MoneyFormat.vnd(result.paidAmount()));
            }
            case PARTIAL -> {
                tx.setStatus(Status.PARTIAL);
                tx.setNote(result.message());
                notifyAttention(tx);
            }
            case ORDER_NOT_FOUND -> markUnmatched(tx, result.message());
            case NOT_PAYABLE -> {
                tx.setStatus(Status.NEEDS_REFUND);
                tx.setNote(result.message());
                notifyAttention(tx);
            }
        }
    }

    private void markUnmatched(PaymentTransaction tx, String note) {
        tx.setStatus(Status.UNMATCHED);
        tx.setNote(note);
        notifyAttention(tx);
    }

    private void notifyAttention(PaymentTransaction tx) {
        events.publishEvent(new PaymentNeedsAttentionEvent(tx.getId(), tx.getStatus().name(), tx.getAmount(),
                tx.getContent(), tx.getOrderCode(), tx.getNote()));
    }

    private boolean accountMatches(SepayWebhookPayload p) {
        String configured = props.sepay().accountNumber();
        if (configured == null || configured.isBlank() || p.accountNumber() == null) {
            return true;
        }
        return configured.equals(p.accountNumber()) || configured.equals(p.subAccount());
    }

    /** Ưu tiên trường code (SePay tự nhận diện nếu đã cấu hình), sau đó tìm trong content/description. */
    static String extractOrderCode(String... candidates) {
        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            String upper = candidate.toUpperCase(Locale.ROOT);
            Matcher m = ORDER_CODE.matcher(upper);
            if (m.find()) {
                return m.group();
            }
            // Một số ngân hàng chèn khoảng trắng/dấu chấm vào giữa nội dung
            m = ORDER_CODE.matcher(upper.replaceAll("[\\s.\\-_]", ""));
            if (m.find()) {
                return m.group();
            }
        }
        return null;
    }

    private static OffsetDateTime parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value.trim(), SEPAY_DATE).atZone(TimeUtils.ZONE).toOffsetDateTime();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    // =================================================================== quản trị đối soát

    @Transactional(readOnly = true)
    public PageResponse<PaymentTransactionResponse> search(Status status, String q, Integer page, Integer size) {
        var pageable = PageQuery.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
        String keyword = q == null || q.isBlank() ? null : q.trim();
        return PageResponse.of(transactionRepository.search(status, keyword, pageable),
                PaymentTransactionResponse::from);
    }

    /** Khách ghi sai nội dung CK: nhân viên gán giao dịch UNMATCHED vào đúng đơn. */
    @Transactional
    public PaymentTransactionResponse assign(Long id, String orderCode, String staffEmail) {
        PaymentTransaction tx = transactionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> BusinessException.notFound("giao dịch"));
        if (tx.getStatus() != Status.UNMATCHED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Chỉ gán được giao dịch chưa khớp đơn (UNMATCHED)");
        }
        String code = orderCode.trim().toUpperCase(Locale.ROOT);
        PaymentApplyResult result = orderService.applyOnlinePayment(code, tx.getAmount(), "MANUAL_ASSIGN");
        if (result.outcome() == PaymentApplyResult.Outcome.ORDER_NOT_FOUND) {
            throw BusinessException.notFound("đơn hàng " + code);
        }
        tx.setOrderCode(code);
        applyResultStatus(tx, result);
        tx.setNote(appendNote(tx.getNote(), "Gán tay bởi " + staffEmail));
        return PaymentTransactionResponse.from(tx);
    }

    @Transactional
    public PaymentTransactionResponse resolve(Long id, String note, String staffEmail) {
        PaymentTransaction tx = transactionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> BusinessException.notFound("giao dịch"));
        if (tx.getStatus() == Status.MATCHED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Giao dịch đã khớp đơn, không cần xử lý");
        }
        tx.setStatus(Status.IGNORED);
        tx.setNote(appendNote(tx.getNote(), "Đã xử lý bởi %s: %s".formatted(staffEmail, note)));
        return PaymentTransactionResponse.from(tx);
    }

    private static void applyResultStatus(PaymentTransaction tx, PaymentApplyResult result) {
        tx.setOrderId(result.orderId());
        tx.setStatus(switch (result.outcome()) {
            case PAID -> Status.MATCHED;
            case PARTIAL -> Status.PARTIAL;
            case NOT_PAYABLE -> Status.NEEDS_REFUND;
            case ORDER_NOT_FOUND -> Status.UNMATCHED;
        });
        tx.setNote(result.message());
    }

    private static String appendNote(String current, String extra) {
        String note = current == null || current.isBlank() ? extra : current + " | " + extra;
        return truncate(note, 500);
    }
}
