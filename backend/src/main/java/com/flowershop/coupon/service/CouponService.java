package com.flowershop.coupon.service;

import com.flowershop.common.dto.PageQuery;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.MoneyFormat;
import com.flowershop.common.util.TimeUtils;
import com.flowershop.coupon.dto.CouponDtos.CouponQuote;
import com.flowershop.coupon.dto.CouponDtos.CouponRequest;
import com.flowershop.coupon.dto.CouponDtos.CouponResponse;
import com.flowershop.coupon.dto.CouponDtos.ValidateCouponResponse;
import com.flowershop.coupon.entity.Coupon;
import com.flowershop.coupon.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CouponService {

    private final CouponRepository couponRepository;
    private final Clock clock;

    /**
     * Tính số tiền giảm. Mã hợp lệ khi: active, now trong [starts_at, ends_at],
     * used_count &lt; usage_limit, subtotal &gt;= min_order.
     */
    @Transactional(readOnly = true)
    public CouponQuote quote(String code, long subtotal) {
        CouponEvaluation evaluation = evaluate(code, subtotal);
        if (evaluation.error() != null) {
            throw new BusinessException(evaluation.error(), evaluation.message());
        }
        return evaluation.quote();
    }

    /**
     * Như {@link #quote} nhưng không ném exception (exception trong transaction đang tham gia sẽ đánh dấu
     * rollback-only), dùng cho /orders/preview để vẫn trả kết quả kèm thông báo lỗi mã.
     */
    @Transactional(readOnly = true)
    public CouponEvaluation evaluate(String code, long subtotal) {
        Coupon coupon = couponRepository.findByCodeIgnoreCase(code.trim()).orElse(null);
        if (coupon == null) {
            return CouponEvaluation.error(ErrorCode.COUPON_INVALID, "Mã giảm giá không tồn tại");
        }
        OffsetDateTime now = TimeUtils.now(clock);
        if (!coupon.isActive()) {
            return CouponEvaluation.error(ErrorCode.COUPON_INVALID, "Mã giảm giá đã ngừng áp dụng");
        }
        if (coupon.getStartsAt() != null && now.isBefore(coupon.getStartsAt())) {
            return CouponEvaluation.error(ErrorCode.COUPON_INVALID, "Mã giảm giá chưa đến thời gian áp dụng");
        }
        if (coupon.getEndsAt() != null && now.isAfter(coupon.getEndsAt())) {
            return CouponEvaluation.error(ErrorCode.COUPON_INVALID, "Mã giảm giá đã hết hạn");
        }
        if (coupon.getUsageLimit() != null && coupon.getUsedCount() >= coupon.getUsageLimit()) {
            return CouponEvaluation.error(ErrorCode.COUPON_EXHAUSTED, ErrorCode.COUPON_EXHAUSTED.getDefaultMessage());
        }
        if (subtotal < coupon.getMinOrder()) {
            return CouponEvaluation.error(ErrorCode.COUPON_INVALID,
                    "Đơn tối thiểu %sđ để dùng mã này".formatted(MoneyFormat.vnd(coupon.getMinOrder())));
        }
        return new CouponEvaluation(new CouponQuote(coupon.getId(), coupon.getCode(),
                calculateDiscount(coupon, subtotal)), null, null);
    }

    public record CouponEvaluation(CouponQuote quote, ErrorCode error, String message) {
        static CouponEvaluation error(ErrorCode error, String message) {
            return new CouponEvaluation(null, error, message);
        }
    }

    @Transactional(readOnly = true)
    public ValidateCouponResponse validate(String code, long subtotal) {
        CouponQuote quote = quote(code, subtotal);
        Coupon coupon = couponRepository.findById(quote.couponId()).orElseThrow();
        return new ValidateCouponResponse(coupon.getCode(), coupon.getType(), coupon.getValue(), quote.discount());
    }

    static long calculateDiscount(Coupon coupon, long subtotal) {
        long discount = switch (coupon.getType()) {
            case PERCENT -> {
                long percent = subtotal * coupon.getValue() / 100;
                yield coupon.getMaxDiscount() != null ? Math.min(percent, coupon.getMaxDiscount()) : percent;
            }
            case FIXED -> Math.min(coupon.getValue(), subtotal);
        };
        return Math.max(0, discount);
    }

    /** Tăng used_count bằng UPDATE có điều kiện, tránh dùng vượt lượt khi nhiều người đặt cùng lúc. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void consume(Long couponId) {
        if (couponRepository.incrementUsage(couponId) == 0) {
            throw new BusinessException(ErrorCode.COUPON_EXHAUSTED);
        }
    }

    /** Hoàn lượt khi đơn bị hủy. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void release(Long couponId) {
        couponRepository.decrementUsage(couponId);
    }

    // ---------------------------------------------------------------- admin

    @Transactional(readOnly = true)
    public PageResponse<CouponResponse> search(String q, Integer page, Integer size) {
        var pageable = PageQuery.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.of(couponRepository.search(q, pageable), CouponResponse::from);
    }

    @Transactional(readOnly = true)
    public CouponResponse get(Long id) {
        return CouponResponse.from(getCoupon(id));
    }

    @Transactional
    public CouponResponse create(CouponRequest req) {
        Coupon coupon = new Coupon();
        apply(coupon, req);
        return CouponResponse.from(couponRepository.save(coupon));
    }

    @Transactional
    public CouponResponse update(Long id, CouponRequest req) {
        Coupon coupon = getCoupon(id);
        apply(coupon, req);
        return CouponResponse.from(coupon);
    }

    /** Mã đã dùng trong đơn thì chỉ tắt; chưa dùng thì xóa hẳn. */
    @Transactional
    public void delete(Long id) {
        Coupon coupon = getCoupon(id);
        if (coupon.getUsedCount() > 0) {
            coupon.setActive(false);
        } else {
            couponRepository.delete(coupon);
        }
    }

    private Coupon getCoupon(Long id) {
        return couponRepository.findById(id).orElseThrow(() -> BusinessException.notFound("mã giảm giá"));
    }

    private void apply(Coupon coupon, CouponRequest req) {
        String code = req.code().toUpperCase(Locale.ROOT);
        boolean taken = coupon.getId() == null ? couponRepository.existsByCodeIgnoreCase(code)
                : couponRepository.existsByCodeIgnoreCaseAndIdNot(code, coupon.getId());
        if (taken) {
            throw new BusinessException(ErrorCode.DUPLICATE, "Mã giảm giá đã tồn tại");
        }
        if (req.type() == Coupon.Type.PERCENT && req.value() > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Giảm theo % phải từ 1 đến 100");
        }
        if (req.startsAt() != null && req.endsAt() != null && !req.endsAt().isAfter(req.startsAt())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Thời gian kết thúc phải sau thời gian bắt đầu");
        }
        coupon.setCode(code);
        coupon.setType(req.type());
        coupon.setValue(req.value());
        coupon.setMaxDiscount(req.maxDiscount());
        coupon.setMinOrder(req.minOrder() != null ? req.minOrder() : 0);
        coupon.setUsageLimit(req.usageLimit());
        coupon.setStartsAt(req.startsAt());
        coupon.setEndsAt(req.endsAt());
        coupon.setActive(req.active() == null || req.active());
    }
}
