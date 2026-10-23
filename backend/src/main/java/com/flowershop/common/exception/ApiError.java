package com.flowershop.common.exception;

import java.time.OffsetDateTime;
import java.util.List;

public record ApiError(String code, String message, List<FieldError> errors, String traceId, OffsetDateTime timestamp) {

    public record FieldError(String field, String message) {
    }
}
