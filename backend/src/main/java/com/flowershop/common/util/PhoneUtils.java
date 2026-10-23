package com.flowershop.common.util;

public final class PhoneUtils {

    /** Số điện thoại di động VN */
    public static final String VN_PHONE_REGEX = "^(0|\\+84)(3|5|7|8|9)\\d{8}$";
    public static final String VN_PHONE_MESSAGE = "Số điện thoại không hợp lệ";

    private PhoneUtils() {
    }

    /** +84912345678 -> 0912345678 */
    public static String normalize(String phone) {
        if (phone == null) {
            return null;
        }
        String p = phone.replaceAll("[\\s.-]", "");
        if (p.startsWith("+84")) {
            p = "0" + p.substring(3);
        }
        return p;
    }

    /** Che số điện thoại khi ghi log: 0912345678 -> 091****678 */
    public static String mask(String phone) {
        if (phone == null || phone.length() < 7) {
            return "***";
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 3);
    }
}
