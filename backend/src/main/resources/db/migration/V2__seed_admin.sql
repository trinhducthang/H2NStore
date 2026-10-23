-- Tài khoản ADMIN mặc định. ĐỔI MẬT KHẨU NGAY sau lần đăng nhập đầu tiên.
-- email: admin@flowershop.local / mật khẩu: Admin@123
INSERT INTO users (email, password_hash, full_name, phone, role, enabled)
VALUES ('admin@flowershop.local',
        '$2a$10$A6LSd54Vrlj46urTyx8Nee6ixSsKD9JzYFeKF1ifOYZlgGeyhDYFq',
        'Quản trị viên', NULL, 'ADMIN', TRUE);
