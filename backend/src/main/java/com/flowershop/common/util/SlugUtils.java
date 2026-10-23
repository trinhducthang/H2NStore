package com.flowershop.common.util;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

public final class SlugUtils {

    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");

    private SlugUtils() {
    }

    /** "Bó hoa Hồng đỏ" -> "bo-hoa-hong-do" */
    public static String slugify(String input) {
        if (input == null) {
            return "";
        }
        String s = input.trim().toLowerCase(Locale.ROOT).replace('đ', 'd');
        s = DIACRITICS.matcher(Normalizer.normalize(s, Normalizer.Form.NFD)).replaceAll("");
        s = NON_ALNUM.matcher(s).replaceAll("-");
        return s.replaceAll("(^-+)|(-+$)", "");
    }
}
