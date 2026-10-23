package com.flowershop.review.controller;

import com.flowershop.common.dto.PageResponse;
import com.flowershop.review.dto.ReviewDtos.CreateReviewRequest;
import com.flowershop.review.dto.ReviewDtos.ReviewResponse;
import com.flowershop.review.dto.ReviewDtos.UpdateReviewStatusRequest;
import com.flowershop.review.entity.Review;
import com.flowershop.review.service.ReviewService;
import com.flowershop.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Reviews")
@RestController
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping("/api/me/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewResponse create(@AuthenticationPrincipal UserPrincipal me,
                                 @Valid @RequestBody CreateReviewRequest req) {
        return reviewService.create(me.id(), req);
    }

    @GetMapping("/api/admin/reviews")
    public PageResponse<ReviewResponse> adminList(@RequestParam(required = false) Review.Status status,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
        return reviewService.adminList(status, page, size);
    }

    @PatchMapping("/api/admin/reviews/{id}")
    public ReviewResponse updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateReviewStatusRequest req) {
        return reviewService.updateStatus(id, req.status());
    }
}
