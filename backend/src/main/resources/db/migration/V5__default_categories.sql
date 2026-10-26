-- Danh mục mặc định cho shop mới (cùng cây danh mục với dữ liệu mẫu V101). Admin sửa, ẩn, xóa được.
-- Profile dev tắt (seed-default-categories=false): V100 tạo lại các slug hoa-* không có ON CONFLICT nên sẽ lỗi trùng.

-- Ngành hàng
INSERT INTO categories (name, slug, type, parent_id, sort_order)
SELECT v.name, v.slug, 'DEPARTMENT', NULL, v.sort_order
FROM (VALUES
    ('Hoa tươi', 'hoa-tuoi', 1),
    ('Đồ gia dụng', 'do-gia-dung', 2),
    ('Đồ chơi', 'do-choi', 3),
    ('Mẹ & bé', 'me-va-be', 4),
    ('Văn phòng phẩm', 'van-phong-pham', 5)
) AS v(name, slug, sort_order)
WHERE '${seed-default-categories}' = 'true'
ON CONFLICT (slug) DO NOTHING;

-- Nhóm con của từng ngành hàng
INSERT INTO categories (name, slug, type, parent_id, sort_order)
SELECT v.name, v.slug, 'DEPARTMENT', parent.id, v.sort_order
FROM (VALUES
    ('hoa-tuoi', 'Hoa sinh nhật', 'hoa-sinh-nhat', 1),
    ('hoa-tuoi', 'Hoa khai trương', 'hoa-khai-truong', 2),
    ('hoa-tuoi', 'Hoa tình yêu', 'hoa-tinh-yeu', 3),
    ('hoa-tuoi', 'Hoa chia buồn', 'hoa-chia-buon', 4),
    ('do-gia-dung', 'Nhà bếp', 'nha-bep', 1),
    ('do-gia-dung', 'Điện gia dụng', 'dien-gia-dung', 2),
    ('do-gia-dung', 'Phòng tắm', 'phong-tam', 3),
    ('do-gia-dung', 'Dọn dẹp & lưu trữ', 'don-dep-luu-tru', 4),
    ('do-choi', 'Đồ chơi giáo dục', 'do-choi-giao-duc', 1),
    ('do-choi', 'Lắp ráp & xếp hình', 'lap-rap-xep-hinh', 2),
    ('do-choi', 'Thú bông & búp bê', 'thu-bong-bup-be', 3),
    ('do-choi', 'Xe & mô hình', 'xe-mo-hinh', 4),
    ('me-va-be', 'Ăn dặm & bình sữa', 'an-dam-binh-sua', 1),
    ('me-va-be', 'Chăm sóc bé', 'cham-soc-be', 2),
    ('me-va-be', 'Quần áo sơ sinh', 'quan-ao-so-sinh', 3),
    ('van-phong-pham', 'Bút & mực', 'but-muc', 1),
    ('van-phong-pham', 'Sổ & giấy', 'so-giay', 2),
    ('van-phong-pham', 'Dụng cụ học tập', 'dung-cu-hoc-tap', 3)
) AS v(parent_slug, name, slug, sort_order)
JOIN categories parent ON parent.slug = v.parent_slug
WHERE '${seed-default-categories}' = 'true'
ON CONFLICT (slug) DO NOTHING;

-- Dịp tặng quà dùng chung cho mọi ngành hàng
INSERT INTO categories (name, slug, type, parent_id, sort_order)
SELECT v.name, v.slug, 'OCCASION', NULL, v.sort_order
FROM (VALUES
    ('Quà sinh nhật', 'qua-sinh-nhat', 1),
    ('Quà tân gia', 'qua-tan-gia', 2),
    ('Quà cho bé', 'qua-cho-be', 3),
    ('Quà tặng nàng', 'qua-tang-nang', 4)
) AS v(name, slug, sort_order)
WHERE '${seed-default-categories}' = 'true'
ON CONFLICT (slug) DO NOTHING;
