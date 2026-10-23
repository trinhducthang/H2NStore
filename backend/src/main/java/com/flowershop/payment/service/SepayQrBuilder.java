package com.flowershop.payment.service;

import com.flowershop.config.AppProperties;
import com.flowershop.order.dto.OrderDtos.BankTransferInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.OffsetDateTime;

/**
 * Tạo thông tin chuyển khoản + link ảnh VietQR của SePay:
 * https://qr.sepay.vn/img?acc=SO_TK&bank=NGAN_HANG&amount=SO_TIEN&des=NOI_DUNG
 * Nội dung chuyển khoản chứa mã đơn để webhook đối soát tự động.
 */
@Component
@RequiredArgsConstructor
public class SepayQrBuilder {

    private static final String QR_BASE_URL = "https://qr.sepay.vn/img";

    private final AppProperties props;

    public BankTransferInfo build(String orderCode, long amount, OffsetDateTime expiresAt) {
        AppProperties.Sepay sepay = props.sepay();
        String content = transferContent(orderCode);
        UriComponentsBuilder qr = UriComponentsBuilder.fromUriString(QR_BASE_URL)
                .queryParam("acc", sepay.accountNumber())
                .queryParam("bank", sepay.bankCode())
                .queryParam("amount", amount)
                .queryParam("des", content);
        if (sepay.qrTemplate() != null && !sepay.qrTemplate().isBlank()) {
            qr.queryParam("template", sepay.qrTemplate());
        }
        return new BankTransferInfo(sepay.bankCode(), sepay.accountNumber(), sepay.accountName(), amount, content,
                qr.encode().build().toUriString(), expiresAt);
    }

    public String transferContent(String orderCode) {
        String prefix = props.sepay().contentPrefix();
        return prefix == null || prefix.isBlank() ? orderCode : prefix.trim() + " " + orderCode;
    }
}
