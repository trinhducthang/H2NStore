-- Phần ảnh banner được hiển thị khi khung cắt bớt ảnh (CSS object-position, % theo chiều ngang/dọc).
-- 50/50 = giữa ảnh, như trước khi có tính năng kéo chỉnh vị trí.
ALTER TABLE banners
    ADD COLUMN image_position_x INT NOT NULL DEFAULT 50,
    ADD COLUMN image_position_y INT NOT NULL DEFAULT 50,
    ADD CONSTRAINT ck_banners_image_position
        CHECK (image_position_x BETWEEN 0 AND 100 AND image_position_y BETWEEN 0 AND 100);
