package com.flowershop.review.service;

import com.flowershop.common.dto.PageQuery;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.order.service.OrderService;
import com.flowershop.review.dto.ReviewDtos.CreateReviewRequest;
import com.flowershop.review.dto.ReviewDtos.RatingSummary;
import com.flowershop.review.dto.ReviewDtos.ReviewResponse;
import com.flowershop.review.entity.Review;
import com.flowershop.review.repository.ReviewRepository;
import com.flowershop.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.parser.Parser;
import org.jsoup.safety.Safelist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final OrderService orderService;
    private final UserService userService;

    @Transactional(readOnly = true)
    public RatingSummary ratingSummary(Long productId) {
        List<Object[]> rows = reviewRepository.ratingSummary(productId);
        if (rows.isEmpty() || rows.getFirst()[0] == null) {
            return new RatingSummary(null, 0);
        }
        Object[] row = rows.getFirst();
        double avg = ((Number) row[0]).doubleValue();
        return new RatingSummary(Math.round(avg * 10) / 10.0, ((Number) row[1]).longValue());
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> approvedForProduct(Long productId, Integer page, Integer size) {
        var pageable = PageQuery.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return toPage(reviewRepository.findByProductIdAndStatus(productId, Review.Status.APPROVED, pageable));
    }

    /** Chỉ đánh giá được sản phẩm trong đơn của mình đã DELIVERED; mỗi (đơn, sản phẩm) một lần. */
    @Transactional
    public ReviewResponse create(Long userId, CreateReviewRequest req) {
        Long orderId = orderService.findDeliveredOrderIdContainingProduct(userId, req.orderCode(), req.productId())
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Chỉ đánh giá được sản phẩm trong đơn đã giao thành công"));
        if (reviewRepository.existsByOrderIdAndProductId(orderId, req.productId())) {
            throw new BusinessException(ErrorCode.DUPLICATE, "Bạn đã đánh giá sản phẩm này trong đơn hàng");
        }
        Review review = new Review();
        review.setProductId(req.productId());
        review.setUserId(userId);
        review.setOrderId(orderId);
        review.setRating(req.rating());
        review.setContent(sanitize(req.content()));
        review.setStatus(Review.Status.PENDING);
        reviewRepository.save(review);
        return toResponse(review, userService.findFullNames(List.of(userId)));
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> adminList(Review.Status status, Integer page, Integer size) {
        var pageable = PageQuery.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Review> result = status != null ? reviewRepository.findByStatus(status, pageable)
                : reviewRepository.findAll(pageable);
        return toPage(result);
    }

    @Transactional
    public ReviewResponse updateStatus(Long id, Review.Status status) {
        Review review = reviewRepository.findById(id).orElseThrow(() -> BusinessException.notFound("đánh giá"));
        review.setStatus(status);
        return toResponse(review, userService.findFullNames(List.of(review.getUserId())));
    }

    /** Bỏ toàn bộ thẻ HTML (chống XSS), giữ chữ thuần. */
    static String sanitize(String content) {
        if (content == null) {
            return null;
        }
        String cleaned = Jsoup.clean(content, "", Safelist.none(), new Document.OutputSettings().prettyPrint(false));
        String text = Parser.unescapeEntities(cleaned, false).trim();
        return text.isEmpty() ? null : text;
    }

    private PageResponse<ReviewResponse> toPage(Page<Review> page) {
        Map<Long, String> names = userService.findFullNames(page.getContent().stream().map(Review::getUserId).toList());
        return PageResponse.of(page, r -> toResponse(r, names));
    }

    private static ReviewResponse toResponse(Review r, Map<Long, String> names) {
        return new ReviewResponse(r.getId(), r.getProductId(), maskName(names.get(r.getUserId())), r.getRating(),
                r.getContent(), r.getStatus(), r.getCreatedAt());
    }

    /** "Nguyễn Văn An" -> "Nguyễn V***" */
    static String maskName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return "Khách hàng";
        }
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) {
            return parts[0];
        }
        return parts[0] + " " + parts[1].charAt(0) + "***";
    }
}
