package com.flowershop.banner.entity;

import com.flowershop.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "banners")
public class Banner extends BaseEntity {

    private String title;

    private String subtitle;

    @Column(name = "button_text")
    private String buttonText;

    @Column(name = "link_url")
    private String linkUrl;

    /** null = chưa upload ảnh, banner chưa được hiển thị */
    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "storage_key")
    private String storageKey;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "starts_at")
    private OffsetDateTime startsAt;

    @Column(name = "ends_at")
    private OffsetDateTime endsAt;

    /** Đang trong khung giờ hiển thị (bỏ qua cờ active và ảnh). */
    public boolean isInWindow(OffsetDateTime now) {
        return (startsAt == null || !now.isBefore(startsAt)) && (endsAt == null || now.isBefore(endsAt));
    }
}
