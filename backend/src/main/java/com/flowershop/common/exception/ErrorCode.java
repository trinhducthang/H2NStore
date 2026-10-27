package com.flowershop.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Dữ liệu không hợp lệ"),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "Yêu cầu không hợp lệ"),
    INVALID_DELIVERY_TIME(HttpStatus.BAD_REQUEST, "Ngày giờ giao không hợp lệ"),
    COUPON_INVALID(HttpStatus.BAD_REQUEST, "Mã giảm giá không hợp lệ"),
    IDEMPOTENCY_KEY_REQUIRED(HttpStatus.BAD_REQUEST, "Thiếu header Idempotency-Key"),
    INVALID_TOKEN(HttpStatus.BAD_REQUEST, "Liên kết không hợp lệ hoặc đã hết hạn"),
    INVALID_FILE(HttpStatus.BAD_REQUEST, "Tệp không hợp lệ (chỉ nhận jpg/png/webp, tối đa 5MB)"),
    INVALID_VIDEO(HttpStatus.BAD_REQUEST, "Video không hợp lệ (chỉ nhận mp4/mov/webm, tối đa 30MB)"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Chưa đăng nhập hoặc phiên đã hết hạn"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu không đúng"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này"),
    ACCOUNT_DISABLED(HttpStatus.FORBIDDEN, "Tài khoản đã bị khóa"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Không tìm thấy dữ liệu"),
    OUT_OF_STOCK(HttpStatus.CONFLICT, "Sản phẩm không đủ hàng"),
    SLOT_FULL(HttpStatus.CONFLICT, "Khung giờ đã đủ đơn"),
    COUPON_EXHAUSTED(HttpStatus.CONFLICT, "Mã giảm giá đã hết lượt"),
    INVALID_STATUS_TRANSITION(HttpStatus.CONFLICT, "Không thể chuyển sang trạng thái này"),
    ORDER_NOT_PAID(HttpStatus.CONFLICT, "Đơn thanh toán online chưa được thanh toán"),
    CONFLICT(HttpStatus.CONFLICT, "Dữ liệu đã bị người khác thay đổi, vui lòng tải lại"),
    DUPLICATE(HttpStatus.CONFLICT, "Dữ liệu đã tồn tại"),
    ACCOUNT_LOCKED(HttpStatus.LOCKED, "Tài khoản tạm khóa do đăng nhập sai nhiều lần, thử lại sau 15 phút"),
    PAYLOAD_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "Tệp quá lớn (ảnh tối đa 5MB, video tối đa 30MB)"),
    TOO_MANY_REQUESTS(HttpStatus.TOO_MANY_REQUESTS, "Bạn thao tác quá nhanh, vui lòng thử lại sau"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Có lỗi xảy ra, vui lòng thử lại sau"),
    GEOCODING_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE,
            "Chưa lấy được địa chỉ từ vị trí, vui lòng thử lại hoặc nhập tay");

    private final HttpStatus httpStatus;
    private final String defaultMessage;

    ErrorCode(HttpStatus httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }
}
