package com.flowershop.payment.dto;

import com.flowershop.payment.entity.PaymentTransaction;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class PaymentDtos {

    private PaymentDtos() {
    }

    public record PaymentTransactionResponse(Long id, String provider, String providerTxnId, String gateway,
                                             String accountNumber, String subAccount, String transferType,
                                             long amount, String content, String referenceCode,
                                             OffsetDateTime transactionDate, String orderCode,
                                             PaymentTransaction.Status status, String note,
                                             OffsetDateTime createdAt) {
        public static PaymentTransactionResponse from(PaymentTransaction t) {
            return new PaymentTransactionResponse(t.getId(), t.getProvider(), t.getProviderTxnId(), t.getGateway(),
                    t.getAccountNumber(), t.getSubAccount(), t.getTransferType(), t.getAmount(), t.getContent(),
                    t.getReferenceCode(), t.getTransactionDate(), t.getOrderCode(), t.getStatus(), t.getNote(),
                    t.getCreatedAt());
        }
    }

    /** Gán tay giao dịch UNMATCHED (khách ghi sai nội dung) vào một đơn. */
    public record AssignTransactionRequest(@NotBlank @Size(max = 20) String orderCode) {
    }

    /** Đánh dấu đã xử lý (VD: đã hoàn tiền cho khách) -> IGNORED. */
    public record ResolveTransactionRequest(@NotBlank @Size(max = 500) String note) {
    }
}
