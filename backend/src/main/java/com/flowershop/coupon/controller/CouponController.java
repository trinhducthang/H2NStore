package com.flowershop.coupon.controller;

import com.flowershop.common.dto.PageResponse;
import com.flowershop.coupon.dto.CouponDtos.CouponRequest;
import com.flowershop.coupon.dto.CouponDtos.CouponResponse;
import com.flowershop.coupon.dto.CouponDtos.ValidateCouponRequest;
import com.flowershop.coupon.dto.CouponDtos.ValidateCouponResponse;
import com.flowershop.coupon.service.CouponService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Coupon")
@RestController
@RequiredArgsConstructor
public class CouponController {

    private final CouponService couponService;

    @PostMapping("/api/public/coupons/validate")
    public ValidateCouponResponse validate(@Valid @RequestBody ValidateCouponRequest req) {
        return couponService.validate(req.code(), req.subtotal());
    }

    @GetMapping("/api/admin/coupons")
    @PreAuthorize("hasRole('ADMIN')")
    public PageResponse<CouponResponse> list(@RequestParam(required = false) String q,
                                             @RequestParam(required = false) Integer page,
                                             @RequestParam(required = false) Integer size) {
        return couponService.search(q, page, size);
    }

    @GetMapping("/api/admin/coupons/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CouponResponse get(@PathVariable Long id) {
        return couponService.get(id);
    }

    @PostMapping("/api/admin/coupons")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public CouponResponse create(@Valid @RequestBody CouponRequest req) {
        return couponService.create(req);
    }

    @PutMapping("/api/admin/coupons/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CouponResponse update(@PathVariable Long id, @Valid @RequestBody CouponRequest req) {
        return couponService.update(id, req);
    }

    @DeleteMapping("/api/admin/coupons/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        couponService.delete(id);
    }
}
