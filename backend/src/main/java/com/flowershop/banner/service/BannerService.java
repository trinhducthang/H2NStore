package com.flowershop.banner.service;

import com.flowershop.banner.dto.BannerDtos.BannerRequest;
import com.flowershop.banner.dto.BannerDtos.BannerResponse;
import com.flowershop.banner.dto.BannerDtos.PublicBanner;
import com.flowershop.banner.entity.Banner;
import com.flowershop.banner.repository.BannerRepository;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.TimeUtils;
import com.flowershop.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BannerService {

    private final BannerRepository bannerRepository;
    private final StorageService storageService;
    private final Clock clock;

    /** Banner trang chủ: đang bật, đã có ảnh và đang trong khung giờ hiển thị. */
    @Transactional(readOnly = true)
    public List<PublicBanner> publicBanners() {
        OffsetDateTime now = TimeUtils.now(clock);
        return bannerRepository.findByActiveTrueAndImageUrlIsNotNullOrderBySortOrderAscIdAsc().stream()
                .filter(b -> b.isInWindow(now))
                .map(b -> new PublicBanner(b.getId(), b.getTitle(), b.getSubtitle(), b.getButtonText(),
                        b.getLinkUrl(), b.getImageUrl(), b.getImagePositionX(), b.getImagePositionY()))
                .toList();
    }

    // ---------------------------------------------------------------- admin

    @Transactional(readOnly = true)
    public List<BannerResponse> list() {
        OffsetDateTime now = TimeUtils.now(clock);
        return bannerRepository.findAllByOrderBySortOrderAscIdAsc().stream().map(b -> toResponse(b, now)).toList();
    }

    @Transactional
    public BannerResponse create(BannerRequest req) {
        Banner banner = new Banner();
        apply(banner, req);
        return toResponse(bannerRepository.save(banner), TimeUtils.now(clock));
    }

    @Transactional
    public BannerResponse update(Long id, BannerRequest req) {
        Banner banner = get(id);
        apply(banner, req);
        return toResponse(banner, TimeUtils.now(clock));
    }

    /** Thay ảnh banner; ảnh cũ chỉ bị xóa khỏi ổ đĩa khi DB đã commit. */
    @Transactional
    public BannerResponse uploadImage(Long id, MultipartFile file) {
        Banner banner = get(id);
        String oldKey = banner.getStorageKey();
        StorageService.StoredFile stored = storageService.storeImage(file, "banners");
        banner.setImageUrl(stored.url());
        banner.setStorageKey(stored.key());
        deleteFileAfterCommit(oldKey);
        return toResponse(banner, TimeUtils.now(clock));
    }

    @Transactional
    public void delete(Long id) {
        Banner banner = get(id);
        bannerRepository.delete(banner);
        deleteFileAfterCommit(banner.getStorageKey());
    }

    private Banner get(Long id) {
        return bannerRepository.findById(id).orElseThrow(() -> BusinessException.notFound("banner"));
    }

    private static void apply(Banner banner, BannerRequest req) {
        if (req.startsAt() != null && req.endsAt() != null && !req.endsAt().isAfter(req.startsAt())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Thời gian kết thúc phải sau thời gian bắt đầu");
        }
        banner.setTitle(req.title());
        banner.setSubtitle(req.subtitle());
        banner.setButtonText(req.buttonText());
        banner.setLinkUrl(req.linkUrl());
        banner.setImagePositionX(req.imagePositionX() != null ? req.imagePositionX() : 50);
        banner.setImagePositionY(req.imagePositionY() != null ? req.imagePositionY() : 50);
        banner.setSortOrder(req.sortOrder() != null ? req.sortOrder() : 0);
        banner.setActive(req.active() == null || req.active());
        banner.setStartsAt(req.startsAt());
        banner.setEndsAt(req.endsAt());
    }

    private void deleteFileAfterCommit(String storageKey) {
        if (storageKey == null) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storageService.delete(storageKey);
            }
        });
    }

    private static BannerResponse toResponse(Banner b, OffsetDateTime now) {
        String status;
        if (!b.isActive()) {
            status = "INACTIVE";
        } else if (b.getImageUrl() == null) {
            status = "NO_IMAGE";
        } else if (b.getStartsAt() != null && now.isBefore(b.getStartsAt())) {
            status = "SCHEDULED";
        } else if (b.getEndsAt() != null && !now.isBefore(b.getEndsAt())) {
            status = "EXPIRED";
        } else {
            status = "SHOWING";
        }
        return new BannerResponse(b.getId(), b.getTitle(), b.getSubtitle(), b.getButtonText(), b.getLinkUrl(),
                b.getImageUrl(), b.getImagePositionX(), b.getImagePositionY(), b.getSortOrder(), b.isActive(), b.getStartsAt(), b.getEndsAt(), status,
                b.getUpdatedAt());
    }
}
