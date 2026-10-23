package com.flowershop.common.util;

import java.util.Locale;

public final class MoneyFormat {

    private MoneyFormat() {
    }

    /** 1250000 -> "1.250.000" */
    public static String vnd(long amount) {
        return String.format(Locale.US, "%,d", amount).replace(',', '.');
    }
}
