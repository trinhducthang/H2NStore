-- Đăng nhập bằng Google. Tài khoản tạo qua Google chưa có mật khẩu (password_hash NULL),
-- khách tự đặt sau ở trang Tài khoản hoặc qua "Quên mật khẩu".
ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL,
    ADD COLUMN google_id VARCHAR(255);

-- "sub" trong ID token của Google: định danh cố định của tài khoản Google, không đổi khi đổi email
ALTER TABLE users
    ADD CONSTRAINT uq_users_google_id UNIQUE (google_id);
