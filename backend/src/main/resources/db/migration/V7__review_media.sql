-- Đánh giá có ảnh/video, sửa 1 lần, shop phản hồi
ALTER TABLE reviews
    ADD COLUMN variant_name VARCHAR(255),
    ADD COLUMN edited       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN reply        VARCHAR(1000),
    ADD COLUMN replied_at   TIMESTAMPTZ;

CREATE INDEX idx_reviews_user_created ON reviews (user_id, created_at DESC);

CREATE TABLE review_media (
    id          BIGSERIAL PRIMARY KEY,
    review_id   BIGINT       NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    type        VARCHAR(10)  NOT NULL,
    url         VARCHAR(500) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_review_media_type CHECK (type IN ('IMAGE', 'VIDEO'))
);
CREATE INDEX idx_review_media_review ON review_media (review_id);
