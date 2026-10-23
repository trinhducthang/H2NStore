package com.flowershop.common.dto;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Chuẩn hóa tham số phân trang: page từ 0, size mặc định 20, tối đa 100.
 */
public final class PageQuery {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    private PageQuery() {
    }

    public static int page(Integer page) {
        return page == null || page < 0 ? 0 : page;
    }

    public static int size(Integer size) {
        if (size == null || size <= 0) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    public static Pageable of(Integer page, Integer size, Sort sort) {
        return PageRequest.of(page(page), size(size), sort);
    }

    public static Pageable of(Integer page, Integer size) {
        return of(page, size, Sort.unsorted());
    }
}
