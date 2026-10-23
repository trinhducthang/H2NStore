-- Dữ liệu mẫu cho profile dev. KHÔNG chạy ở prod (prod chỉ dùng db/migration).

INSERT INTO delivery_zones (name, districts, shipping_fee, express_fee, active) VALUES
('Nội thành', 'Hoàn Kiếm, Ba Đình, Đống Đa, Hai Bà Trưng, Cầu Giấy, Thanh Xuân, Tây Hồ', 30000, 60000, TRUE),
('Ngoại thành gần', 'Nam Từ Liêm, Bắc Từ Liêm, Hoàng Mai, Long Biên, Hà Đông', 50000, NULL, TRUE),
('Ngoại thành xa', 'Gia Lâm, Đông Anh, Thanh Trì, Hoài Đức', 80000, NULL, TRUE);

INSERT INTO categories (name, slug, type, parent_id, sort_order, active) VALUES
('Hoa sinh nhật', 'hoa-sinh-nhat', 'OCCASION', NULL, 1, TRUE),
('Hoa khai trương', 'hoa-khai-truong', 'OCCASION', NULL, 2, TRUE),
('Hoa tình yêu', 'hoa-tinh-yeu', 'OCCASION', NULL, 3, TRUE),
('Hoa chia buồn', 'hoa-chia-buon', 'OCCASION', NULL, 4, TRUE),
('Hoa hồng', 'hoa-hong', 'FLOWER_TYPE', NULL, 1, TRUE),
('Hoa hướng dương', 'hoa-huong-duong', 'FLOWER_TYPE', NULL, 2, TRUE),
('Hoa tulip', 'hoa-tulip', 'FLOWER_TYPE', NULL, 3, TRUE),
('Bó hoa', 'bo-hoa', 'STYLE', NULL, 1, TRUE),
('Giỏ hoa', 'gio-hoa', 'STYLE', NULL, 2, TRUE),
('Kệ hoa', 'ke-hoa', 'STYLE', NULL, 3, TRUE);

INSERT INTO products (name, slug, description, status, sold_count) VALUES
('Bó hoa hồng đỏ Tình Nồng', 'bo-hoa-hong-do-tinh-nong', 'Bó 20 bông hồng đỏ Đà Lạt, giấy gói Hàn Quốc, kèm thiệp.', 'ACTIVE', 42),
('Giỏ hoa hướng dương Nắng Mai', 'gio-hoa-huong-duong-nang-mai', 'Giỏ hoa hướng dương phối cúc tana, tươi sáng cho ngày sinh nhật.', 'ACTIVE', 18),
('Kệ hoa khai trương Phát Tài', 'ke-hoa-khai-truong-phat-tai', 'Kệ 2 tầng hoa đồng tiền, hồng môn và lan, cao 1m6.', 'ACTIVE', 7),
('Bó tulip Hà Lan Pastel', 'bo-tulip-ha-lan-pastel', 'Bó 10 tulip nhập khẩu tông pastel nhẹ nhàng.', 'ACTIVE', 25),
('Bó hoa hồng trắng Thanh Khiết', 'bo-hoa-hong-trang-thanh-khiet', 'Hồng trắng phối baby, phù hợp chúc mừng và chia buồn.', 'ACTIVE', 11);

INSERT INTO product_categories (product_id, category_id)
SELECT p.id, c.id FROM products p, categories c
WHERE (p.slug, c.slug) IN (
    ('bo-hoa-hong-do-tinh-nong', 'hoa-tinh-yeu'), ('bo-hoa-hong-do-tinh-nong', 'hoa-hong'), ('bo-hoa-hong-do-tinh-nong', 'bo-hoa'),
    ('bo-hoa-hong-do-tinh-nong', 'hoa-sinh-nhat'),
    ('gio-hoa-huong-duong-nang-mai', 'hoa-sinh-nhat'), ('gio-hoa-huong-duong-nang-mai', 'hoa-huong-duong'), ('gio-hoa-huong-duong-nang-mai', 'gio-hoa'),
    ('ke-hoa-khai-truong-phat-tai', 'hoa-khai-truong'), ('ke-hoa-khai-truong-phat-tai', 'ke-hoa'),
    ('bo-tulip-ha-lan-pastel', 'hoa-tinh-yeu'), ('bo-tulip-ha-lan-pastel', 'hoa-tulip'), ('bo-tulip-ha-lan-pastel', 'bo-hoa'),
    ('bo-hoa-hong-trang-thanh-khiet', 'hoa-chia-buon'), ('bo-hoa-hong-trang-thanh-khiet', 'hoa-hong'), ('bo-hoa-hong-trang-thanh-khiet', 'bo-hoa')
);

INSERT INTO product_variants (product_id, name, sku, price, sale_price, stock, active)
SELECT p.id, v.name, v.sku, v.price, v.sale_price, v.stock, TRUE
FROM (VALUES
    ('bo-hoa-hong-do-tinh-nong', 'Tiêu chuẩn', 'HHD-STD', 550000, NULL::BIGINT, 30),
    ('bo-hoa-hong-do-tinh-nong', 'Cao cấp', 'HHD-PRE', 850000, 790000, 15),
    ('gio-hoa-huong-duong-nang-mai', 'Tiêu chuẩn', 'HD-STD', 650000, NULL, 20),
    ('gio-hoa-huong-duong-nang-mai', 'Cao cấp', 'HD-PRE', 950000, NULL, 10),
    ('ke-hoa-khai-truong-phat-tai', 'Tiêu chuẩn', 'KT-STD', 1500000, 1350000, 8),
    ('bo-tulip-ha-lan-pastel', 'Tiêu chuẩn', 'TL-STD', 1200000, NULL, 12),
    ('bo-hoa-hong-trang-thanh-khiet', 'Tiêu chuẩn', 'HHT-STD', 600000, NULL, 25)
) AS v(slug, name, sku, price, sale_price, stock)
JOIN products p ON p.slug = v.slug;

INSERT INTO coupons (code, type, value, max_discount, min_order, usage_limit, starts_at, ends_at, active) VALUES
('AZ5', 'PERCENT', 5, 50000, 300000, 100, now() - interval '1 day', now() + interval '60 days', TRUE),
('GIAM50K', 'FIXED', 50000, NULL, 500000, 50, now() - interval '1 day', now() + interval '60 days', TRUE);

-- Tài khoản test: staff@flowershop.local / customer@flowershop.local, mật khẩu Admin@123
INSERT INTO users (email, password_hash, full_name, phone, role, enabled) VALUES
('staff@flowershop.local', '$2a$10$A6LSd54Vrlj46urTyx8Nee6ixSsKD9JzYFeKF1ifOYZlgGeyhDYFq', 'Nhân viên Shop', '0911111111', 'STAFF', TRUE),
('customer@flowershop.local', '$2a$10$A6LSd54Vrlj46urTyx8Nee6ixSsKD9JzYFeKF1ifOYZlgGeyhDYFq', 'Khách Hàng Mẫu', '0912345678', 'CUSTOMER', TRUE);
