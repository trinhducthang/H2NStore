package com.flowershop.common.util;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;

public final class TimeUtils {

    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private TimeUtils() {
    }

    public static OffsetDateTime now(Clock clock) {
        return OffsetDateTime.now(clock.withZone(ZONE));
    }

    public static LocalDate today(Clock clock) {
        return LocalDate.now(clock.withZone(ZONE));
    }

    public static OffsetDateTime startOfDay(LocalDate date) {
        return date.atStartOfDay(ZONE).toOffsetDateTime();
    }
}
