package com.flowershop.review.service;

import com.flowershop.catalog.dto.CatalogDtos.ProductRef;
import com.flowershop.catalog.service.ProductQueryService;
import com.flowershop.common.dto.PageQuery;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.config.AppProperties;
import com.flowershop.order.dto.OrderDtos.DeliveredItem;
import com.flowershop.order.service.OrderService;
import com.flowershop.review.dto.ReviewDtos.CreateReviewRequest;
import com.flowershop.review.dto.ReviewDtos.MediaResponse;
import com.flowershop.review.dto.ReviewDtos.PendingReviewItem;
import com.flowershop.review.dto.ReviewDtos.RatingBreakdown;
import com.flowershop.review.dto.ReviewDtos.RatingSummary;
import com.flowershop.review.dto.ReviewDtos.ReviewNotificationView;
import com.flowershop.review.dto.ReviewDtos.ReviewResponse;
import com.flowershop.review.dto.ReviewDtos.UpdateReviewRequest;
import com.flowershop.review.entity.Review;
import com.flowershop.review.entity.ReviewMedia;
import com.flowershop.review.event.ReviewSubmittedEvent;
import com.flowershop.review.repository.ReviewRepository;
import com.flowershop.review.repository.ReviewSpecs;
import com.flowershop.storage.ImageValidator;
import com.flowershop.storage.StorageService;
import com.flowershop.storage.VideoValidator;
import com.flowershop.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.parser.Parser;
import org.jsoup.safety.Safelist;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Luồng đánh giá:
 * <ol>
 *   <li>Đơn của khách (đã đăng nhập) chuyển DELIVERED -> từng sản phẩm vào danh sách "chờ đánh giá"
 *       trong {@code app.review.window-days} ngày.</li>
 *   <li>Mỗi (đơn, sản phẩm) đánh giá 1 lần: 1-5 sao, nội dung, tối đa 5 ảnh + 1 video.</li>
 *   <li>Đánh giá mới/sửa ở trạng thái PENDING, shop duyệt mới hiện công khai (báo Telegram).</li>
 *   <li>Khách được sửa 1 lần trong window-days ngày sau khi gửi; sửa xong phải duyệt lại.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class ReviewService {

    static final int MAX_IMAGES = 5;
    static final int MAX_VIDEOS = 1;
    private static final String MEDIA_FOLDER = "reviews";

    private enum View { PUBLIC, MINE, ADMIN }

    private record Lookups(Map<Long, String> names, Map<Long, ProductRef> products, Map<Long, String> orderCodes) {
    }

    private record Upload(MultipartFile file, ReviewMedia.Type type) {
    }

    private final ReviewRepository reviewRepository;
    private final OrderService orderService;
    private final UserService userService;
    private final ProductQueryService productQueryService;
    private final StorageService storageService;
    private final ApplicationEventPublisher events;
    private final AppProperties props;
    private final Clock clock;

    // =================================================================== công khai

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
    public RatingBreakdown ratingBreakdown(Long productId) {
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            distribution.put(star, 0L);
        }
        long count = 0;
        long sum = 0;
        for (Object[] row : reviewRepository.ratingDistribution(productId)) {
            int star = ((Number) row[0]).intValue();
            long n = ((Number) row[1]).longValue();
            distribution.put(star, n);
            count += n;
            sum += star * n;
        }
        if (count == 0) {
            return new RatingBreakdown(null, 0, distribution, 0);
        }
        return new RatingBreakdown(Math.round(sum * 10.0 / count) / 10.0, count, distribution,
                reviewRepository.countApprovedWithMedia(productId));
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> approvedForProduct(Long productId, Integer rating, boolean withMediaOnly,
                                                           Integer page, Integer size) {
        var filter = new ReviewSpecs.Filter(productId, null, null, Review.Status.APPROVED, rating, withMediaOnly);
        return toPage(findPage(filter, page, size), View.PUBLIC);
    }

    // =================================================================== khách hàng

    /** Sản phẩm đã giao trong hạn đánh giá mà khách chưa đánh giá; có orderCode thì chỉ xét đơn đó. */
    @Transactional(readOnly = true)
    public List<PendingReviewItem> pending(Long userId, String orderCode) {
        Duration window = window();
        List<DeliveredItem> items = orderService.deliveredItems(userId, OffsetDateTime.now(clock).minus(window),
                orderCode);
        if (items.isEmpty()) {
            return List.of();
        }
        Set<Long> orderIds = items.stream().map(DeliveredItem::orderId).collect(Collectors.toSet());
        Set<String> reviewed = reviewRepository.findByUserIdAndOrderIdIn(userId, orderIds).stream()
                .map(r -> key(r.getOrderId(), r.getProductId()))
                .collect(Collectors.toSet());
        List<DeliveredItem> todo = items.stream()
                .filter(i -> !reviewed.contains(key(i.orderId(), i.productId())))
                .toList();
        Map<Long, ProductRef> products = productQueryService.findRefs(
                todo.stream().map(DeliveredItem::productId).collect(Collectors.toSet()));
        return todo.stream().map(i -> {
            ProductRef p = products.get(i.productId());
            return new PendingReviewItem(i.orderCode(), i.productId(), i.productName(),
                    p != null ? p.slug() : null, p != null ? p.thumbnailUrl() : null, i.variantName(),
                    i.deliveredAt(), i.deliveredAt().plus(window));
        }).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> mine(Long userId, String orderCode, Integer page, Integer size) {
        List<Long> orderIds = null;
        if (orderCode != null && !orderCode.isBlank()) {
            orderIds = orderService.deliveredItems(userId, OffsetDateTime.MIN, orderCode).stream()
                    .map(DeliveredItem::orderId).distinct().toList();
        }
        var filter = new ReviewSpecs.Filter(null, userId, orderIds, null, null, false);
        return toPage(findPage(filter, page, size), View.MINE);
    }

    /** Chỉ đánh giá được sản phẩm trong đơn của mình đã DELIVERED, trong hạn; mỗi (đơn, sản phẩm) một lần. */
    @Transactional
    public ReviewResponse create(Long userId, CreateReviewRequest req, List<MultipartFile> files) {
        DeliveredItem item = orderService.findDeliveredItem(userId, req.orderCode(), req.productId())
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Chỉ đánh giá được sản phẩm trong đơn đã giao thành công"));
        if (OffsetDateTime.now(clock).isAfter(item.deliveredAt().plus(window()))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Đã quá hạn đánh giá (" + props.review().windowDays() + " ngày sau khi nhận hàng)");
        }
        if (reviewRepository.existsByOrderIdAndProductId(item.orderId(), item.productId())) {
            throw new BusinessException(ErrorCode.DUPLICATE, "Bạn đã đánh giá sản phẩm này trong đơn hàng");
        }
        List<Upload> uploads = classify(files);
        checkMediaLimits(List.of(), uploads);

        Review review = new Review();
        review.setProductId(item.productId());
        review.setUserId(userId);
        review.setOrderId(item.orderId());
        review.setVariantName(item.variantName());
        review.setRating(req.rating());
        review.setContent(sanitize(req.content()));
        review.setStatus(Review.Status.PENDING);
        storeAndSave(review, uploads);
        events.publishEvent(new ReviewSubmittedEvent(review.getId(), false));
        return toResponse(review, lookups(List.of(review), View.MINE), View.MINE);
    }

    /** Sửa 1 lần trong hạn; giữ các ảnh/video trong keepMediaIds, thêm file mới, rồi chờ duyệt lại. */
    @Transactional
    public ReviewResponse update(Long userId, Long id, UpdateReviewRequest req, List<MultipartFile> files) {
        Review review = reviewRepository.findById(id)
                .filter(r -> r.getUserId().equals(userId))
                .orElseThrow(() -> BusinessException.notFound("đánh giá"));
        if (!isEditable(review)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Mỗi đánh giá chỉ sửa được 1 lần, trong " + props.review().windowDays() + " ngày sau khi gửi");
        }
        Set<Long> keep = req.keepMediaIds() == null ? Set.of() : new HashSet<>(req.keepMediaIds());
        List<ReviewMedia> removed = review.getMedia().stream().filter(m -> !keep.contains(m.getId())).toList();
        List<ReviewMedia> kept = review.getMedia().stream().filter(m -> keep.contains(m.getId())).toList();
        List<Upload> uploads = classify(files);
        checkMediaLimits(kept, uploads);

        review.getMedia().removeAll(removed);
        review.setRating(req.rating());
        review.setContent(sanitize(req.content()));
        review.setEdited(true);
        review.setStatus(Review.Status.PENDING);
        storeAndSave(review, uploads);
        removed.forEach(m -> deleteFileAfterCommit(m.getStorageKey()));
        events.publishEvent(new ReviewSubmittedEvent(review.getId(), true));
        return toResponse(review, lookups(List.of(review), View.MINE), View.MINE);
    }

    // =================================================================== quản trị

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> adminList(Review.Status status, Integer rating, boolean withMediaOnly,
                                                  Integer page, Integer size) {
        var filter = new ReviewSpecs.Filter(null, null, null, status, rating, withMediaOnly);
        return toPage(findPage(filter, page, size), View.ADMIN);
    }

    @Transactional
    public ReviewResponse updateStatus(Long id, Review.Status status) {
        Review review = getReview(id);
        review.setStatus(status);
        return toResponse(review, lookups(List.of(review), View.ADMIN), View.ADMIN);
    }

    @Transactional
    public ReviewResponse reply(Long id, String reply) {
        Review review = getReview(id);
        String text = sanitize(reply);
        review.setReply(text);
        review.setRepliedAt(text != null ? OffsetDateTime.now(clock) : null);
        return toResponse(review, lookups(List.of(review), View.ADMIN), View.ADMIN);
    }

    /** Gỡ 1 ảnh/video không phù hợp nhưng vẫn giữ đánh giá. */
    @Transactional
    public ReviewResponse deleteMedia(Long id, Long mediaId) {
        Review review = getReview(id);
        ReviewMedia media = review.getMedia().stream().filter(m -> m.getId().equals(mediaId)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("ảnh/video"));
        review.getMedia().remove(media);
        deleteFileAfterCommit(media.getStorageKey());
        return toResponse(review, lookups(List.of(review), View.ADMIN), View.ADMIN);
    }

    @Transactional(readOnly = true)
    public ReviewNotificationView notificationView(Long id) {
        Review review = getReview(id);
        ProductRef product = productQueryService.findRefs(List.of(review.getProductId())).get(review.getProductId());
        long videos = review.getMedia().stream().filter(m -> m.getType() == ReviewMedia.Type.VIDEO).count();
        return new ReviewNotificationView(product != null ? product.name() : "#" + review.getProductId(),
                review.getRating(), review.getContent(), review.getMedia().size() - videos, videos);
    }

    // =================================================================== helpers

    private Duration window() {
        return Duration.ofDays(props.review().windowDays());
    }

    private OffsetDateTime editableUntil(Review review) {
        return review.getCreatedAt().plus(window());
    }

    private boolean isEditable(Review review) {
        return !review.isEdited() && OffsetDateTime.now(clock).isBefore(editableUntil(review));
    }

    private Review getReview(Long id) {
        return reviewRepository.findById(id).orElseThrow(() -> BusinessException.notFound("đánh giá"));
    }

    private Page<Review> findPage(ReviewSpecs.Filter filter, Integer page, Integer size) {
        var pageable = PageQuery.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        return reviewRepository.findAll(ReviewSpecs.of(filter), pageable);
    }

    private static String key(Long orderId, Long productId) {
        return orderId + ":" + productId;
    }

    /** Phân loại ảnh/video theo magic bytes; bỏ qua phần file rỗng. */
    private static List<Upload> classify(List<MultipartFile> files) {
        if (files == null) {
            return List.of();
        }
        List<Upload> uploads = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            byte[] head = new byte[12];
            try (InputStream in = file.getInputStream()) {
                in.readNBytes(head, 0, head.length);
            } catch (IOException e) {
                throw new BusinessException(ErrorCode.INVALID_FILE);
            }
            if (VideoValidator.extensionOf(head) != null) {
                uploads.add(new Upload(file, ReviewMedia.Type.VIDEO));
            } else if (ImageValidator.extensionOf(head) != null) {
                uploads.add(new Upload(file, ReviewMedia.Type.IMAGE));
            } else {
                throw new BusinessException(ErrorCode.INVALID_FILE,
                        "Tệp không hợp lệ: ảnh jpg/png/webp tối đa 5MB, video mp4/mov/webm tối đa 30MB");
            }
        }
        return uploads;
    }

    private static void checkMediaLimits(Collection<ReviewMedia> kept, List<Upload> uploads) {
        long images = kept.stream().filter(m -> m.getType() == ReviewMedia.Type.IMAGE).count()
                + uploads.stream().filter(u -> u.type() == ReviewMedia.Type.IMAGE).count();
        long videos = kept.stream().filter(m -> m.getType() == ReviewMedia.Type.VIDEO).count()
                + uploads.stream().filter(u -> u.type() == ReviewMedia.Type.VIDEO).count();
        if (images > MAX_IMAGES || videos > MAX_VIDEOS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Mỗi đánh giá tối đa " + MAX_IMAGES + " ảnh và " + MAX_VIDEOS + " video");
        }
    }

    /** Ghi file rồi lưu DB; lỗi giữa chừng thì dọn file đã ghi để không để lại rác. */
    private void storeAndSave(Review review, List<Upload> uploads) {
        List<StorageService.StoredFile> stored = new ArrayList<>();
        try {
            int nextOrder = review.getMedia().stream().mapToInt(ReviewMedia::getSortOrder).max().orElse(-1) + 1;
            for (Upload upload : uploads) {
                StorageService.StoredFile saved = upload.type() == ReviewMedia.Type.VIDEO
                        ? storageService.storeVideo(upload.file(), MEDIA_FOLDER)
                        : storageService.storeImage(upload.file(), MEDIA_FOLDER);
                stored.add(saved);
                ReviewMedia media = new ReviewMedia();
                media.setType(upload.type());
                media.setUrl(saved.url());
                media.setStorageKey(saved.key());
                media.setSortOrder(nextOrder++);
                review.addMedia(media);
            }
            reviewRepository.saveAndFlush(review);
        } catch (RuntimeException e) {
            stored.forEach(s -> storageService.delete(s.key()));
            throw e;
        }
    }

    /** Chỉ xóa file khi DB đã commit */
    private void deleteFileAfterCommit(String storageKey) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storageService.delete(storageKey);
            }
        });
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

    private PageResponse<ReviewResponse> toPage(Page<Review> page, View view) {
        Lookups lookups = lookups(page.getContent(), view);
        return PageResponse.of(page, r -> toResponse(r, lookups, view));
    }

    private Lookups lookups(List<Review> reviews, View view) {
        Map<Long, String> names = userService.findFullNames(reviews.stream().map(Review::getUserId).toList());
        if (view == View.PUBLIC) {
            return new Lookups(names, Map.of(), Map.of());
        }
        return new Lookups(names,
                productQueryService.findRefs(reviews.stream().map(Review::getProductId).collect(Collectors.toSet())),
                orderService.findCodes(reviews.stream().map(Review::getOrderId).collect(Collectors.toSet())));
    }

    private ReviewResponse toResponse(Review r, Lookups lookups, View view) {
        ProductRef product = lookups.products().get(r.getProductId());
        String fullName = lookups.names().get(r.getUserId());
        // Video lên đầu, sau đó ảnh theo thứ tự tải lên
        List<MediaResponse> media = r.getMedia().stream()
                .sorted(Comparator.comparing((ReviewMedia m) -> m.getType() != ReviewMedia.Type.VIDEO)
                        .thenComparingInt(ReviewMedia::getSortOrder))
                .map(m -> new MediaResponse(m.getId(), m.getType(), m.getUrl()))
                .toList();
        boolean mine = view == View.MINE;
        return new ReviewResponse(r.getId(), r.getProductId(),
                product != null ? product.name() : null,
                product != null ? product.slug() : null,
                product != null ? product.thumbnailUrl() : null,
                r.getVariantName(),
                view == View.ADMIN && fullName != null ? fullName : maskName(fullName),
                r.getRating(), r.getContent(), media, r.getReply(), r.getRepliedAt(), r.getStatus(), r.isEdited(),
                mine ? isEditable(r) : null,
                mine && !r.isEdited() ? editableUntil(r) : null,
                view != View.PUBLIC ? lookups.orderCodes().get(r.getOrderId()) : null,
                r.getCreatedAt());
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
