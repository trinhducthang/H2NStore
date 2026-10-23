-- Dữ liệu mẫu cho profile dev: H2N Store bán nhiều ngành hàng (hoa tươi, gia dụng, đồ chơi, mẹ & bé,
-- văn phòng phẩm), không chỉ hoa. KHÔNG chạy ở prod.
-- Giữ 5 sản phẩm hoa của V100 (test và đơn cũ còn tham chiếu biến thể), gom danh mục hoa vào ngành "Hoa tươi".
-- Ảnh mẫu là file SVG trong frontend/public/sample/products/ (Vite và nginx của web phục vụ tại /sample/...).

-- ---------------------------------------------------------- danh mục
INSERT INTO categories (name, slug, type, parent_id, sort_order, active) VALUES
('Hoa tươi', 'hoa-tuoi', 'DEPARTMENT', NULL, 1, TRUE),
('Đồ gia dụng', 'do-gia-dung', 'DEPARTMENT', NULL, 2, TRUE),
('Đồ chơi', 'do-choi', 'DEPARTMENT', NULL, 3, TRUE),
('Mẹ & bé', 'me-va-be', 'DEPARTMENT', NULL, 4, TRUE),
('Văn phòng phẩm', 'van-phong-pham', 'DEPARTMENT', NULL, 5, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Các dịp tặng hoa của V100 thành nhóm con của "Hoa tươi" (giữ slug để link cũ vẫn chạy)
UPDATE categories
SET type = 'DEPARTMENT', parent_id = (SELECT id FROM categories WHERE slug = 'hoa-tuoi')
WHERE slug IN ('hoa-sinh-nhat', 'hoa-khai-truong', 'hoa-tinh-yeu', 'hoa-chia-buon');

-- Loại hoa, kiểu dáng của V100 chỉ hợp shop hoa: bỏ cho menu gọn (liên kết sản phẩm tự xóa theo CASCADE)
DELETE FROM categories WHERE slug IN ('hoa-hong', 'hoa-huong-duong', 'hoa-tulip', 'bo-hoa', 'gio-hoa', 'ke-hoa');

INSERT INTO categories (name, slug, type, parent_id, sort_order, active)
SELECT v.name, v.slug, 'DEPARTMENT', parent.id, v.sort_order, TRUE
FROM (VALUES
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
ON CONFLICT (slug) DO NOTHING;

-- Dịp tặng quà dùng chung cho mọi ngành hàng
INSERT INTO categories (name, slug, type, parent_id, sort_order, active) VALUES
('Quà sinh nhật', 'qua-sinh-nhat', 'OCCASION', NULL, 1, TRUE),
('Quà tân gia', 'qua-tan-gia', 'OCCASION', NULL, 2, TRUE),
('Quà cho bé', 'qua-cho-be', 'OCCASION', NULL, 3, TRUE),
('Quà tặng nàng', 'qua-tang-nang', 'OCCASION', NULL, 4, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------- sản phẩm
-- Hoa của V100: rải ngày tạo, lượt bán để mục "Mẫu mới", "Bán chạy" có đủ ngành hàng
UPDATE products p
SET created_at = now() - make_interval(days => v.days_ago), sold_count = GREATEST(p.sold_count, v.sold_count)
FROM (VALUES
    ('bo-hoa-hong-do-tinh-nong', 31, 76),
    ('gio-hoa-huong-duong-nang-mai', 21, 18),
    ('ke-hoa-khai-truong-phat-tai', 26, 7),
    ('bo-tulip-ha-lan-pastel', 18, 25),
    ('bo-hoa-hong-trang-thanh-khiet', 30, 11)
) AS v(slug, days_ago, sold_count)
WHERE p.slug = v.slug;

-- Sản phẩm mới kèm ảnh mẫu. storage_key không nằm trong thư mục upload nên admin xóa ảnh mẫu không xóa file nào.
WITH inserted AS (
INSERT INTO products (name, slug, description, status, sold_count, created_at)
SELECT v.name, v.slug, v.description, 'ACTIVE', v.sold_count, now() - make_interval(days => v.days_ago)
FROM (VALUES
    -- Hoa tươi
    ('Chậu lan hồ điệp Hoàng Gia', 'chau-lan-ho-diep-hoang-gia',
     'Lan hồ điệp trắng viền tím trồng sẵn trong chậu sứ men lam, hoa bền 1 - 2 tháng nếu đặt nơi thoáng mát. Hợp tặng tân gia, khai trương, mừng thọ.', 9, 4),
    ('Bó cúc họa mi Mùa Thu', 'bo-cuc-hoa-mi-mua-thu',
     'Cúc họa mi Hà Nội đầu mùa (tháng 10 - 11), bó giấy kraft mộc mạc buộc dây cói. Cắm bình nước sạch tươi được 5 - 7 ngày.', 95, 1),
    -- Đồ gia dụng
    ('Chảo chống dính vân đá đáy từ', 'chao-chong-dinh-van-da-day-tu',
     'Lòng chảo phủ 5 lớp chống dính vân đá, dùng được mọi loại bếp: gas, hồng ngoại, điện từ. Tay cầm bọc silicone chống nóng, rửa được bằng máy rửa bát.', 87, 15),
    ('Bộ nồi inox 3 đáy 5 món', 'bo-noi-inox-3-day-5-mon',
     'Gồm 3 nồi 16 - 20 - 24cm, 1 quánh 16cm và 1 chảo 26cm. Inox 304 an toàn thực phẩm, nắp kính cường lực có lỗ thoát hơi, dùng được bếp từ.', 31, 10),
    ('Bộ 3 hộp thủy tinh đựng thực phẩm', 'bo-3-hop-thuy-tinh-dung-thuc-pham',
     'Thủy tinh chịu nhiệt dùng được trong lò vi sóng, lò nướng và tủ đông. Nắp 4 khóa kín hơi, chống tràn. Dung tích 370ml, 640ml và 1040ml.', 45, 23),
    ('Nồi cơm điện nắp gài', 'noi-com-dien-nap-gai',
     'Lòng nồi hợp kim nhôm phủ chống dính dày 1,5mm, cơm chín đều, tự chuyển sang giữ ấm. Kèm xửng hấp, cốc đong và muôi xới.', 52, 28),
    ('Nồi chiên không dầu 5,5 lít', 'noi-chien-khong-dau-5-5-lit',
     'Công suất 1700W, giỏ chiên 5,5 lít đủ cho gia đình 4 - 6 người. Bảng điều khiển cảm ứng 8 chế độ cài sẵn, hẹn giờ đến 60 phút, tự ngắt khi quá nhiệt.', 156, 7),
    ('Ấm siêu tốc inox 1,7 lít', 'am-sieu-toc-inox-1-7-lit',
     'Đun sôi 1,7 lít nước trong khoảng 5 phút, tự ngắt khi nước sôi hoặc cạn nước. Ruột inox 304 liền khối, đế xoay 360°.', 61, 33),
    ('Máy xay sinh tố 2 cối', 'may-xay-sinh-to-2-coi',
     'Cối lớn 1,5 lít xay sinh tố, cối nhỏ xay khô hạt và gia vị. Lưỡi dao 6 cánh bằng inox, công suất 600W, 2 tốc độ.', 28, 40),
    ('Bộ 2 khăn tắm cotton 70x140cm', 'bo-2-khan-tam-cotton-70x140',
     '100% cotton dệt sợi đôi, thấm hút nhanh, mềm mại và không xù lông sau nhiều lần giặt.', 39, 19),
    ('Kệ nhà tắm dán tường 2 tầng', 'ke-nha-tam-dan-tuong-2-tang',
     'Nhôm không gỉ, gắn tường bằng miếng dán chịu lực, không cần khoan. Mỗi tầng chịu tải đến 5kg, có móc treo khăn bên dưới.', 47, 35),
    ('Bộ cây lau nhà xoay 360°', 'bo-cay-lau-nha-xoay-360',
     'Thùng vắt 2 ngăn giặt và vắt riêng, cán inox dài 1,3m, kèm 2 bông lau microfiber thay thế.', 73, 12),
    ('Bộ 3 giỏ cói đựng đồ đa năng', 'bo-3-gio-coi-dung-do-da-nang',
     'Giỏ cói đan tay có quai xách, gấp gọn khi không dùng. Đựng quần áo, đồ chơi, đồ lặt vặt. Gồm 3 cỡ S, M, L.', 26, 5),
    -- Đồ chơi
    ('Bàn tính gỗ học đếm cho bé', 'ban-tinh-go-hoc-dem-cho-be',
     'Khung gỗ thông, 100 hạt sơn màu gốc nước an toàn cho trẻ. Giúp bé 3 - 6 tuổi làm quen với số đếm và phép cộng trừ.', 34, 14),
    ('Bộ thí nghiệm khoa học STEM 20 thí nghiệm', 'bo-thi-nghiem-khoa-hoc-stem',
     '20 thí nghiệm vui về núi lửa, nam châm, pha màu, nuôi tinh thể... kèm sách hướng dẫn tiếng Việt. Cho bé từ 6 tuổi, chơi cùng người lớn.', 22, 3),
    ('Bộ lắp ráp Trạm cứu hỏa 520 chi tiết', 'bo-lap-rap-tram-cuu-hoa-520',
     'Lắp được trạm cứu hỏa, xe thang và 4 nhân vật. Mảnh nhựa ABS an toàn, khớp chặt, tương thích các bộ lắp ráp phổ biến. Từ 6 tuổi.', 58, 9),
    ('Tranh ghép hình 1000 mảnh Phố cổ Hội An', 'tranh-ghep-hinh-1000-manh-hoi-an',
     'Kích thước khi hoàn thành 70x50cm, carton dày 2mm cắt khít, in sắc nét. Kèm ảnh mẫu và túi zip để chia mảnh.', 17, 32),
    ('Gấu bông Teddy lông mịn', 'gau-bong-teddy-long-min',
     'Lông nhung mịn, nhồi bông gòn 3D đàn hồi, đường may chắc chắn. Giặt máy được ở chế độ nhẹ.', 134, 6),
    ('Búp bê công chúa tóc dài', 'bup-be-cong-chua-toc-dai',
     'Búp bê cao 30cm, tóc dài chải được, tay chân cử động. Kèm 2 bộ váy và phụ kiện tóc. Từ 3 tuổi.', 41, 25),
    ('Xe địa hình điều khiển từ xa', 'xe-dia-hinh-dieu-khien-tu-xa',
     'Tỉ lệ 1:16, dẫn động 2 cầu, tốc độ tối đa 20km/h. Pin sạc chơi khoảng 25 phút, chạy được trên cỏ, cát, sỏi.', 49, 11),
    ('Mô hình máy bay chở khách 1:200', 'mo-hinh-may-bay-cho-khach-1-200',
     'Thân hợp kim đúc, bánh xe lăn được, kèm chân đế trưng bày. Dài khoảng 32cm, món quà cho người mê hàng không.', 12, 38),
    -- Mẹ & bé
    ('Bình sữa PPSU chống sặc', 'binh-sua-ppsu-chong-sac',
     'Nhựa PPSU chịu nhiệt, không chứa BPA. Núm silicone siêu mềm có van chống sặc và đầy hơi, cổ rộng dễ vệ sinh.', 98, 16),
    ('Bộ bát thìa ăn dặm silicone', 'bo-bat-thia-an-dam-silicone',
     'Silicone cấp thực phẩm, đế hút chân không chống đổ, kèm 2 thìa mềm. Dùng được máy rửa bát và lò vi sóng.', 37, 22),
    ('Khăn sữa sợi tre (hộp 6 chiếc)', 'khan-sua-soi-tre-hop-6-chiec',
     'Sợi tre kháng khuẩn tự nhiên, mềm và thấm hút tốt hơn cotton thường. Kích thước 30x30cm, giặt nhiều lần không bai.', 66, 29),
    ('Nhiệt kế điện tử hồng ngoại', 'nhiet-ke-dien-tu-hong-ngoai',
     'Đo trán hoặc tai trong 1 giây, màn hình đổi màu khi sốt, lưu 32 lần đo gần nhất. Có chế độ đo nhiệt độ sữa và nước tắm.', 44, 13),
    ('Set 3 body cotton sơ sinh', 'set-3-body-cotton-so-sinh',
     'Cotton organic mềm, cúc bấm ở đáy tiện thay tã. Họa tiết pastel, giặt không phai màu.', 29, 8),
    -- Văn phòng phẩm
    ('Hộp 20 bút bi 0,5mm', 'hop-20-but-bi-0-5mm',
     'Ngòi 0,5mm viết trơn, mực ra đều và không lem. Thân trong suốt dễ xem lượng mực còn lại.', 210, 27),
    ('Bộ 6 bút dạ quang pastel', 'bo-6-but-da-quang-pastel',
     'Màu pastel dịu mắt, ngòi vát 2 đầu 1mm và 5mm, mực gốc nước nhanh khô, không thấm sang trang sau.', 57, 17),
    ('Sổ tay bìa da A5 200 trang', 'so-tay-bia-da-a5-200-trang',
     'Bìa da PU có dây buộc, giấy ngà 100gsm chống lóa, dòng kẻ mờ. Hợp ghi chép, làm planner hoặc làm quà.', 64, 2),
    ('Giấy in A4 70gsm (ram 500 tờ)', 'giay-in-a4-70gsm',
     'Giấy trắng mịn, in 2 mặt không kẹt giấy, dùng được cho máy in laser và máy in phun.', 48, 36),
    ('Balo chống gù cho học sinh', 'balo-chong-gu-cho-hoc-sinh',
     'Đệm lưng thoáng khí, quai đeo chữ S trợ lực vai, vải chống thấm nhẹ. Nặng 650g, hợp học sinh lớp 1 - 5.', 33, 20),
    ('Bộ màu nước 24 màu kèm cọ', 'bo-mau-nuoc-24-mau-kem-co',
     'Màu nước dạng nén, màu tươi và dễ pha loãng. Kèm 3 cọ lông mềm và bảng pha màu.', 21, 24)
) AS v(name, slug, description, sold_count, days_ago)
ON CONFLICT (slug) DO NOTHING
RETURNING id, slug
)
INSERT INTO product_images (product_id, url, storage_key, sort_order, is_thumbnail)
SELECT id, '/sample/products/' || slug || '.svg', 'sample/products/' || slug || '.svg', 0, TRUE
FROM inserted;

-- Giá bán là giá thường; sale_price khác NULL thì đang giảm giá
INSERT INTO product_variants (product_id, name, sku, price, sale_price, stock, active)
SELECT p.id, v.name, v.sku, v.price, v.sale_price, v.stock, TRUE
FROM (VALUES
    ('chau-lan-ho-diep-hoang-gia', '3 cành', 'HT-LAN-3C', 1200000, NULL::BIGINT, 10),
    ('chau-lan-ho-diep-hoang-gia', '5 cành', 'HT-LAN-5C', 1900000, NULL, 6),
    ('bo-cuc-hoa-mi-mua-thu', '50 cành', 'HT-CUC-50', 350000, 299000, 40),
    ('bo-cuc-hoa-mi-mua-thu', '100 cành', 'HT-CUC-100', 590000, 520000, 20),
    ('chao-chong-dinh-van-da-day-tu', 'Size 24cm', 'GD-CHAO-24', 259000, NULL, 60),
    ('chao-chong-dinh-van-da-day-tu', 'Size 26cm', 'GD-CHAO-26', 289000, NULL, 50),
    ('chao-chong-dinh-van-da-day-tu', 'Size 28cm', 'GD-CHAO-28', 329000, NULL, 30),
    ('bo-noi-inox-3-day-5-mon', 'Bộ 5 món', 'GD-NOI-5M', 1290000, NULL, 15),
    ('bo-3-hop-thuy-tinh-dung-thuc-pham', 'Bộ 3 hộp', 'GD-HOP-TT3', 239000, NULL, 80),
    ('noi-com-dien-nap-gai', '1,2 lít', 'GD-NCD-12', 690000, NULL, 25),
    ('noi-com-dien-nap-gai', '1,8 lít', 'GD-NCD-18', 890000, 790000, 20),
    ('noi-chien-khong-dau-5-5-lit', 'Màu đen', 'GD-NCKD-DEN', 1590000, 1290000, 30),
    ('noi-chien-khong-dau-5-5-lit', 'Màu trắng', 'GD-NCKD-TRANG', 1590000, 1290000, 25),
    ('am-sieu-toc-inox-1-7-lit', '1,7 lít', 'GD-AST-17', 299000, NULL, 70),
    ('may-xay-sinh-to-2-coi', '2 cối', 'GD-MXST-2C', 790000, NULL, 20),
    ('bo-2-khan-tam-cotton-70x140', 'Màu trắng', 'GD-KHAN-TRANG', 249000, NULL, 40),
    ('bo-2-khan-tam-cotton-70x140', 'Màu xanh pastel', 'GD-KHAN-XANH', 249000, NULL, 35),
    ('bo-2-khan-tam-cotton-70x140', 'Màu hồng phấn', 'GD-KHAN-HONG', 249000, NULL, 35),
    ('ke-nha-tam-dan-tuong-2-tang', '2 tầng', 'GD-KE-NT2', 189000, NULL, 60),
    ('bo-cay-lau-nha-xoay-360', 'Bộ tiêu chuẩn', 'GD-LAU-360', 349000, 299000, 45),
    ('bo-3-gio-coi-dung-do-da-nang', 'Bộ 3 giỏ', 'GD-GIO-3', 159000, NULL, 50),
    ('ban-tinh-go-hoc-dem-cho-be', 'Tiêu chuẩn', 'DC-BTG', 159000, NULL, 40),
    ('bo-thi-nghiem-khoa-hoc-stem', '20 thí nghiệm', 'DC-STEM20', 349000, NULL, 25),
    ('bo-lap-rap-tram-cuu-hoa-520', '520 chi tiết', 'DC-LR520', 599000, 499000, 20),
    ('tranh-ghep-hinh-1000-manh-hoi-an', '1000 mảnh', 'DC-GH1000', 229000, NULL, 30),
    ('gau-bong-teddy-long-min', 'Cao 40cm', 'DC-GAU-40', 199000, 169000, 60),
    ('gau-bong-teddy-long-min', 'Cao 60cm', 'DC-GAU-60', 299000, 259000, 40),
    ('gau-bong-teddy-long-min', 'Cao 80cm', 'DC-GAU-80', 449000, 399000, 20),
    ('bup-be-cong-chua-toc-dai', 'Kèm 2 bộ váy', 'DC-BB-CC', 259000, NULL, 35),
    ('xe-dia-hinh-dieu-khien-tu-xa', 'Kèm 1 pin', 'DC-XE-1P', 459000, NULL, 25),
    ('xe-dia-hinh-dieu-khien-tu-xa', 'Kèm 2 pin', 'DC-XE-2P', 529000, NULL, 15),
    ('mo-hinh-may-bay-cho-khach-1-200', 'Kèm chân đế', 'DC-MB-A200', 489000, NULL, 12),
    ('binh-sua-ppsu-chong-sac', '160ml', 'MB-BS-160', 229000, NULL, 50),
    ('binh-sua-ppsu-chong-sac', '240ml', 'MB-BS-240', 259000, NULL, 50),
    ('bo-bat-thia-an-dam-silicone', 'Màu be', 'MB-BAT-BE', 179000, NULL, 40),
    ('bo-bat-thia-an-dam-silicone', 'Màu xanh mint', 'MB-BAT-MINT', 179000, NULL, 40),
    ('khan-sua-soi-tre-hop-6-chiec', 'Hộp 6 chiếc', 'MB-KS-6', 129000, NULL, 100),
    ('nhiet-ke-dien-tu-hong-ngoai', 'Tiêu chuẩn', 'MB-NK-HN', 390000, 349000, 30),
    ('set-3-body-cotton-so-sinh', '0 - 3 tháng', 'MB-BODY-03', 199000, NULL, 30),
    ('set-3-body-cotton-so-sinh', '3 - 6 tháng', 'MB-BODY-36', 199000, NULL, 30),
    ('set-3-body-cotton-so-sinh', '6 - 12 tháng', 'MB-BODY-612', 219000, NULL, 25),
    ('hop-20-but-bi-0-5mm', 'Mực xanh', 'VP-BB-XANH', 60000, NULL, 200),
    ('hop-20-but-bi-0-5mm', 'Mực đen', 'VP-BB-DEN', 60000, NULL, 150),
    ('hop-20-but-bi-0-5mm', 'Mực đỏ', 'VP-BB-DO', 60000, NULL, 100),
    ('bo-6-but-da-quang-pastel', '6 màu', 'VP-DQ-6', 45000, NULL, 120),
    ('so-tay-bia-da-a5-200-trang', 'Màu nâu', 'VP-SO-NAU', 89000, 69000, 80),
    ('so-tay-bia-da-a5-200-trang', 'Màu đen', 'VP-SO-DEN', 89000, 69000, 80),
    ('giay-in-a4-70gsm', '1 ram', 'VP-A4-1R', 72000, NULL, 150),
    ('giay-in-a4-70gsm', 'Thùng 5 ram', 'VP-A4-5R', 345000, NULL, 40),
    ('balo-chong-gu-cho-hoc-sinh', 'Xanh dương', 'VP-BL-XANH', 459000, NULL, 25),
    ('balo-chong-gu-cho-hoc-sinh', 'Hồng', 'VP-BL-HONG', 459000, NULL, 25),
    ('bo-mau-nuoc-24-mau-kem-co', '24 màu', 'VP-MN-24', 125000, NULL, 60)
) AS v(slug, name, sku, price, sale_price, stock)
JOIN products p ON p.slug = v.slug
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_categories (product_id, category_id)
SELECT p.id, c.id
FROM (VALUES
    -- Hoa (V100 đã gắn dịp tặng hoa, thêm dịp tặng quà)
    ('bo-hoa-hong-do-tinh-nong', 'qua-sinh-nhat'), ('bo-hoa-hong-do-tinh-nong', 'qua-tang-nang'),
    ('gio-hoa-huong-duong-nang-mai', 'qua-sinh-nhat'),
    ('bo-tulip-ha-lan-pastel', 'qua-tang-nang'),
    ('chau-lan-ho-diep-hoang-gia', 'hoa-khai-truong'), ('chau-lan-ho-diep-hoang-gia', 'qua-tan-gia'),
    ('bo-cuc-hoa-mi-mua-thu', 'hoa-sinh-nhat'), ('bo-cuc-hoa-mi-mua-thu', 'hoa-tinh-yeu'),
    ('bo-cuc-hoa-mi-mua-thu', 'qua-tang-nang'),
    -- Đồ gia dụng
    ('chao-chong-dinh-van-da-day-tu', 'nha-bep'),
    ('bo-noi-inox-3-day-5-mon', 'nha-bep'), ('bo-noi-inox-3-day-5-mon', 'qua-tan-gia'),
    ('bo-3-hop-thuy-tinh-dung-thuc-pham', 'nha-bep'),
    ('noi-com-dien-nap-gai', 'dien-gia-dung'), ('noi-com-dien-nap-gai', 'qua-tan-gia'),
    ('noi-chien-khong-dau-5-5-lit', 'dien-gia-dung'), ('noi-chien-khong-dau-5-5-lit', 'qua-tan-gia'),
    ('am-sieu-toc-inox-1-7-lit', 'dien-gia-dung'),
    ('may-xay-sinh-to-2-coi', 'dien-gia-dung'),
    ('bo-2-khan-tam-cotton-70x140', 'phong-tam'),
    ('ke-nha-tam-dan-tuong-2-tang', 'phong-tam'),
    ('bo-cay-lau-nha-xoay-360', 'don-dep-luu-tru'),
    ('bo-3-gio-coi-dung-do-da-nang', 'don-dep-luu-tru'),
    -- Đồ chơi
    ('ban-tinh-go-hoc-dem-cho-be', 'do-choi-giao-duc'), ('ban-tinh-go-hoc-dem-cho-be', 'qua-cho-be'),
    ('bo-thi-nghiem-khoa-hoc-stem', 'do-choi-giao-duc'), ('bo-thi-nghiem-khoa-hoc-stem', 'qua-cho-be'),
    ('bo-lap-rap-tram-cuu-hoa-520', 'lap-rap-xep-hinh'), ('bo-lap-rap-tram-cuu-hoa-520', 'qua-sinh-nhat'),
    ('bo-lap-rap-tram-cuu-hoa-520', 'qua-cho-be'),
    ('tranh-ghep-hinh-1000-manh-hoi-an', 'lap-rap-xep-hinh'),
    ('gau-bong-teddy-long-min', 'thu-bong-bup-be'), ('gau-bong-teddy-long-min', 'qua-sinh-nhat'),
    ('gau-bong-teddy-long-min', 'qua-cho-be'), ('gau-bong-teddy-long-min', 'qua-tang-nang'),
    ('bup-be-cong-chua-toc-dai', 'thu-bong-bup-be'), ('bup-be-cong-chua-toc-dai', 'qua-cho-be'),
    ('xe-dia-hinh-dieu-khien-tu-xa', 'xe-mo-hinh'), ('xe-dia-hinh-dieu-khien-tu-xa', 'qua-sinh-nhat'),
    ('xe-dia-hinh-dieu-khien-tu-xa', 'qua-cho-be'),
    ('mo-hinh-may-bay-cho-khach-1-200', 'xe-mo-hinh'),
    -- Mẹ & bé
    ('binh-sua-ppsu-chong-sac', 'an-dam-binh-sua'),
    ('bo-bat-thia-an-dam-silicone', 'an-dam-binh-sua'),
    ('khan-sua-soi-tre-hop-6-chiec', 'cham-soc-be'),
    ('nhiet-ke-dien-tu-hong-ngoai', 'cham-soc-be'),
    ('set-3-body-cotton-so-sinh', 'quan-ao-so-sinh'), ('set-3-body-cotton-so-sinh', 'qua-cho-be'),
    -- Văn phòng phẩm
    ('hop-20-but-bi-0-5mm', 'but-muc'),
    ('bo-6-but-da-quang-pastel', 'but-muc'),
    ('so-tay-bia-da-a5-200-trang', 'so-giay'),
    ('giay-in-a4-70gsm', 'so-giay'),
    ('balo-chong-gu-cho-hoc-sinh', 'dung-cu-hoc-tap'), ('balo-chong-gu-cho-hoc-sinh', 'qua-cho-be'),
    ('bo-mau-nuoc-24-mau-kem-co', 'dung-cu-hoc-tap'), ('bo-mau-nuoc-24-mau-kem-co', 'qua-cho-be')
) AS v(product_slug, category_slug)
JOIN products p ON p.slug = v.product_slug
JOIN categories c ON c.slug = v.category_slug
ON CONFLICT DO NOTHING;

-- Ảnh mẫu cho hoa của V100 nếu admin chưa tải ảnh thật lên
INSERT INTO product_images (product_id, url, storage_key, sort_order, is_thumbnail)
SELECT p.id, '/sample/products/' || p.slug || '.svg', 'sample/products/' || p.slug || '.svg', 0, TRUE
FROM products p
WHERE p.slug IN ('bo-hoa-hong-do-tinh-nong', 'gio-hoa-huong-duong-nang-mai', 'ke-hoa-khai-truong-phat-tai',
                 'bo-tulip-ha-lan-pastel', 'bo-hoa-hong-trang-thanh-khiet')
  AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id);
