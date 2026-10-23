-- Banner trang chủ (slider), quản lý ở trang admin.
CREATE TABLE banners (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(150),
    subtitle    VARCHAR(300),
    button_text VARCHAR(50),
    -- Đường dẫn nội bộ "/..." hoặc URL http(s); không cho "javascript:" (chống XSS qua href)
    link_url    VARCHAR(500),
    image_url   VARCHAR(500),
    storage_key VARCHAR(300),
    sort_order  INT         NOT NULL DEFAULT 0,
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Hẹn giờ hiển thị (NULL = không giới hạn)
    starts_at   TIMESTAMPTZ,
    ends_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_banners_active_sort ON banners (active, sort_order);
