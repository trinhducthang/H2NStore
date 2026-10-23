package com.flowershop.payment.entity;

import com.flowershop.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Giao dịch ngân hàng nhận từ webhook SePay. Lưu tất cả (kể cả không khớp đơn) để đối soát.
 */
@Getter
@Setter
@Entity
@Table(name = "payment_transactions")
public class PaymentTransaction extends BaseEntity {

    public static final String PROVIDER_SEPAY = "SEPAY";

    public enum Status {
        /** Khớp đơn và đơn đã đủ tiền */
        MATCHED,
        /** Khớp đơn nhưng chưa đủ tiền */
        PARTIAL,
        /** Không tìm thấy mã đơn / đơn không tồn tại: chờ nhân viên gán tay */
        UNMATCHED,
        /** Tiền vào đơn đã hủy hoặc đã thanh toán: cần hoàn tiền cho khách */
        NEEDS_REFUND,
        /** Tiền ra, sai tài khoản, hoặc nhân viên đã xử lý xong */
        IGNORED
    }

    @Column(nullable = false)
    private String provider;

    /** id giao dịch phía SePay, UNIQUE(provider, provider_txn_id) chống ghi nhận trùng */
    @Column(name = "provider_txn_id", nullable = false)
    private String providerTxnId;

    private String gateway;

    @Column(name = "account_number")
    private String accountNumber;

    @Column(name = "sub_account")
    private String subAccount;

    @Column(name = "transfer_type", nullable = false)
    private String transferType;

    @Column(nullable = false)
    private long amount;

    private String content;

    @Column(name = "reference_code")
    private String referenceCode;

    @Column(name = "transaction_date")
    private OffsetDateTime transactionDate;

    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "order_code")
    private String orderCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    private String note;

    @Column(name = "raw_payload")
    private String rawPayload;
}
