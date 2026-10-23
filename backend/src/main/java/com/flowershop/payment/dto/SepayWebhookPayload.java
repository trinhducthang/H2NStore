package com.flowershop.payment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Body SePay POST tới webhook khi tài khoản ngân hàng có giao dịch. Ví dụ:
 * <pre>
 * {
 *   "id": 92704,                              // ID giao dịch trên SePay
 *   "gateway": "Vietcombank",                 // Ngân hàng
 *   "transactionDate": "2023-03-25 14:02:37", // Thời gian giao dịch phía ngân hàng
 *   "accountNumber": "0123499999",            // Số tài khoản
 *   "code": null,                             // Mã thanh toán SePay tự nhận diện (nếu đã cấu hình)
 *   "content": "FS2610230001 chuyen tien",   // Nội dung chuyển khoản
 *   "transferType": "in",                     // in: tiền vào, out: tiền ra
 *   "transferAmount": 2277000,                // Số tiền giao dịch
 *   "accumulated": 19077000,                  // Số dư lũy kế
 *   "subAccount": null,                       // Tài khoản phụ (VA)
 *   "referenceCode": "MBVCB.3278907687",      // Mã tham chiếu
 *   "description": ""                         // Toàn bộ nội dung SMS/biến động
 * }
 * </pre>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SepayWebhookPayload(
        Long id,
        String gateway,
        String transactionDate,
        String accountNumber,
        String code,
        String content,
        String transferType,
        Long transferAmount,
        Long accumulated,
        String subAccount,
        String referenceCode,
        String description) {
}
