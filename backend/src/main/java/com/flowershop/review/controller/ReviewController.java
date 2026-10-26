package com.flowershop.review.controller;

import com.flowershop.common.dto.PageResponse;
import com.flowershop.review.dto.ReviewDtos.CreateReviewRequest;
import com.flowershop.review.dto.ReviewDtos.PendingReviewItem;
import com.flowershop.review.dto.ReviewDtos.ReplyRequest;
import com.flowershop.review.dto.ReviewDtos.ReviewResponse;
import com.flowershop.review.dto.ReviewDtos.UpdateReviewRequest;
import com.flowershop.review.dto.ReviewDtos.UpdateReviewStatusRequest;
import com.flowershop.review.entity.Review;
import com.flowershop.review.service.ReviewService;
import com.flowershop.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "Reviews")
@RestController
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    // ------------------------------------------------------------------ khách hàng

    @Operation(summary = "Sản phẩm đã giao, còn hạn và chưa đánh giá")
    @GetMapping("/api/me/reviews/pending")
    public List<PendingReviewItem> pending(@AuthenticationPrincipal UserPrincipal me,
                                           @RequestParam(required = false) String orderCode) {
        return reviewService.pending(me.id(), orderCode);
    }

    @GetMapping("/api/me/reviews")
    public PageResponse<ReviewResponse> mine(@AuthenticationPrincipal UserPrincipal me,
                                             @RequestParam(required = false) String orderCode,
                                             @RequestParam(required = false) Integer page,
                                             @RequestParam(required = false) Integer size) {
        return reviewService.mine(me.id(), orderCode, page, size);
    }

    @Operation(summary = "Gửi đánh giá",
            description = "multipart: phần \"review\" (JSON) + phần \"files\" (tối đa 5 ảnh jpg/png/webp ≤5MB "
                    + "và 1 video mp4/mov/webm ≤30MB)")
    @PostMapping(value = "/api/me/reviews", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewResponse create(@AuthenticationPrincipal UserPrincipal me,
                                 @Valid @RequestPart("review") CreateReviewRequest req,
                                 @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        return reviewService.create(me.id(), req, files);
    }

    @Operation(summary = "Sửa đánh giá (1 lần)",
            description = "multipart: phần \"review\" (JSON, keepMediaIds = ảnh/video cũ giữ lại) + phần \"files\"")
    @PutMapping(value = "/api/me/reviews/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ReviewResponse update(@AuthenticationPrincipal UserPrincipal me, @PathVariable Long id,
                                 @Valid @RequestPart("review") UpdateReviewRequest req,
                                 @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        return reviewService.update(me.id(), id, req, files);
    }

    // ------------------------------------------------------------------ quản trị

    @GetMapping("/api/admin/reviews")
    public PageResponse<ReviewResponse> adminList(@RequestParam(required = false) Review.Status status,
                                                  @RequestParam(required = false) Integer rating,
                                                  @RequestParam(defaultValue = "false") boolean withMedia,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
        return reviewService.adminList(status, rating, withMedia, page, size);
    }

    @PatchMapping("/api/admin/reviews/{id}")
    public ReviewResponse updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateReviewStatusRequest req) {
        return reviewService.updateStatus(id, req.status());
    }

    @Operation(summary = "Shop phản hồi đánh giá (để trống = gỡ phản hồi)")
    @PutMapping("/api/admin/reviews/{id}/reply")
    public ReviewResponse reply(@PathVariable Long id, @Valid @RequestBody ReplyRequest req) {
        return reviewService.reply(id, req.reply());
    }

    @Operation(summary = "Gỡ 1 ảnh/video không phù hợp")
    @DeleteMapping("/api/admin/reviews/{id}/media/{mediaId}")
    public ReviewResponse deleteMedia(@PathVariable Long id, @PathVariable Long mediaId) {
        return reviewService.deleteMedia(id, mediaId);
    }
}
