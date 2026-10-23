-- Shop bán nhiều ngành hàng (hoa tươi, gia dụng, đồ chơi...): thêm loại danh mục DEPARTMENT.
ALTER TABLE categories DROP CONSTRAINT ck_categories_type;
ALTER TABLE categories ADD CONSTRAINT ck_categories_type
    CHECK (type IN ('DEPARTMENT', 'OCCASION', 'FLOWER_TYPE', 'STYLE'));
