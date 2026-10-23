package com.flowershop.payment.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SepayWebhookServiceTest {

    @Test
    void extractsOrderCodeFromBankContent() {
        assertThat(SepayWebhookService.extractOrderCode(null, "FS2610230001", null)).isEqualTo("FS2610230001");
        assertThat(SepayWebhookService.extractOrderCode(null, "MBVCB.3278907687.fs2610230012.CT tu NGUYEN VAN A", null))
                .isEqualTo("FS2610230012");
        // Ngân hàng dính liền chữ phía sau mã
        assertThat(SepayWebhookService.extractOrderCode(null, "SEVQR FS2610230003CHUYEN TIEN", null))
                .isEqualTo("FS2610230003");
        // Ngân hàng chèn khoảng trắng vào giữa
        assertThat(SepayWebhookService.extractOrderCode(null, "FS 2610 230004", null)).isEqualTo("FS2610230004");
    }

    @Test
    void prefersSepayCodeFieldThenDescription() {
        assertThat(SepayWebhookService.extractOrderCode("FS2610230005", "FS2610230006", null))
                .isEqualTo("FS2610230005");
        assertThat(SepayWebhookService.extractOrderCode(null, "chuyen tien", "BIDV: +500,000 ND FS2610230007"))
                .isEqualTo("FS2610230007");
    }

    @Test
    void returnsNullWhenNoOrderCode() {
        assertThat(SepayWebhookService.extractOrderCode(null, "chuyen tien mua hoa", "")).isNull();
        assertThat(SepayWebhookService.extractOrderCode(null, "FS12345", null)).isNull();
    }
}
