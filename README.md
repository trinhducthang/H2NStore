# H2N Store – web bán hoa tươi, đồ gia dụng, đồ chơi...

Xây dựng theo [Đặc tả Backend – Web bán hoa](Đặc%20tả%20Backend%20–%20Web%20bán%20hoa.md), mở rộng cho nhiều ngành hàng (hoa tươi, đồ gia dụng, đồ chơi, mẹ & bé, văn phòng phẩm), có thêm **thanh toán online qua SePay** (VietQR + webhook tự xác nhận).

| Thư mục | Nội dung |
| --- | --- |
| `backend/` | Spring Boot 3.5 / Java 21, PostgreSQL 16, Flyway, JWT, MapStruct, Bucket4j, Apache POI |
| `frontend/` | React + Vite + TypeScript (trang khách hàng + trang quản trị) |
| `docker-compose.yml` | `postgres` + `app` + `web` (nginx phục vụ frontend, proxy `/api`), `redis` tùy chọn |
| `scripts/backup.sh` | `pg_dump` hằng ngày, giữ 7 bản |

## 1. Thanh toán SePay hoạt động thế nào

```text
Khách đặt đơn (paymentMethod = SEPAY)
  └─> API trả bankTransferInfo: STK, số tiền, nội dung CK = mã đơn (FS2610230001), link ảnh VietQR
        └─> Khách quét QR bằng app ngân hàng, chuyển khoản
              └─> SePay thấy biến động số dư, POST webhook tới /api/public/payments/sepay/webhook
                    └─> Backend: kiểm tra API key -> chống trùng theo id giao dịch -> tìm mã đơn trong nội dung
                          -> cộng tiền vào đơn -> đủ tiền thì payment_status = PAID
                          -> Telegram báo shop, email báo khách
Trang thanh toán của frontend hỏi GET /api/orders/{code}/payment mỗi 3 giây, thấy PAID thì báo thành công.
```

Các tình huống đã xử lý:

| Tình huống | Kết quả |
| --- | --- |
| SePay gửi lại cùng một giao dịch (retry) | Ghi nhận 1 lần duy nhất (`UNIQUE(provider, provider_txn_id)`) |
| Khách chuyển thiếu | Giao dịch `PARTIAL`, đơn vẫn `UNPAID`, QR mới chỉ yêu cầu **số tiền còn thiếu** |
| Khách chuyển nhiều lần | Cộng dồn `paid_amount`, đủ thì `PAID` |
| Khách ghi sai nội dung (không có mã đơn) | Giao dịch `UNMATCHED`, báo Telegram; nhân viên gán tay vào đơn ở trang quản trị |
| Tiền về khi đơn đã hủy / đã thanh toán | Giao dịch `NEEDS_REFUND`, báo Telegram để hoàn tiền |
| Đơn SePay quá 30 phút chưa trả đồng nào | Job tự hủy đơn, hoàn tồn kho, lượt coupon và chỗ trong khung giờ |
| Tiền ra / sai số tài khoản | `IGNORED` |
| Sai API key | `401`, không ghi gì |

Nhân viên **không xác nhận được đơn SEPAY chưa thanh toán** (`ORDER_NOT_PAID`). Vẫn có thể đánh dấu PAID/REFUNDED thủ công qua `PATCH /api/admin/orders/{code}/payment` (có ghi vết vào lịch sử đơn).

### Cấu hình trên my.sepay.vn

1. Liên kết tài khoản ngân hàng nhận tiền với SePay.
2. Vào **Tích hợp Webhooks → Thêm webhook**:
   - **Gọi đến URL:** `https://<domain>/api/public/payments/sepay/webhook`
   - **Sự kiện:** Có tiền vào
   - **Kiểu chứng thực:** API Key → dán giá trị `SEPAY_WEBHOOK_API_KEY`
   - **Content type:** `application/json`
   - **Bỏ qua giao dịch không có code thanh toán:** chọn *Không*, để giao dịch khách ghi sai nội dung vẫn được lưu và đối soát tay
3. (Tùy chọn) **Cấu hình công ty → Cấu trúc mã thanh toán:** tiền tố `FS`, hậu tố 10 ký tự số. SePay sẽ tự tách mã vào trường `code`; nếu không cấu hình, backend vẫn tự tìm mã trong `content`.
4. Điền `.env`: `SEPAY_BANK_CODE` (mã ngân hàng theo qr.sepay.vn, ví dụ `MBBank`, `Vietcombank`, `ACB`), `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`. Nếu tài khoản VA của bạn yêu cầu tiền tố nội dung (ví dụ `SEVQR`), đặt `SEPAY_CONTENT_PREFIX`.

Dùng nút **Gửi thử** của SePay hoặc lệnh `curl` ở mục 2 để kiểm tra.

## 2. Chạy môi trường dev

### Cách 1: toàn bộ bằng Docker (chỉ cần Docker)

```bash
# .env local đặt SPRING_PROFILES_ACTIVE=dev để có dữ liệu mẫu (tạo từ .env.example nếu chưa có)
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

- Web: http://localhost — Swagger UI: http://localhost:8080/swagger-ui.html
- Banner trang chủ: đăng nhập ADMIN → **Quản trị → Banner trang chủ** (chưa có banner thì trang chủ hiện phần giới thiệu mặc định).
- Tên shop, slogan, hotline, link Facebook/X/Instagram trên header, số Zalo và trang Messenger của nút chat nổi (`SHOP_ZALO`, `SHOP_MESSENGER`): biến `SHOP_*` trong `.env` (đổi xong chạy lại lệnh `up -d --build`).
- Xem log: `docker compose logs -f app`; dừng: `docker compose down` (thêm `-v` để xóa luôn dữ liệu DB và ảnh upload)
- Sửa code xong chạy lại lệnh `up -d --build` ở trên để build lại image.

### Cách 2: chạy từng phần (để sửa code nhanh)

Cần: Java 21, Maven, Node 22, Docker.

```bash
docker compose up -d postgres                 # PostgreSQL ở localhost:5432
cd backend && mvn spring-boot:run             # http://localhost:8080 (profile dev, có dữ liệu mẫu)
cd frontend && npm install && npm run dev     # http://localhost:5173 (proxy /api sang :8080)
```

- Swagger UI: http://localhost:8080/swagger-ui.html
- Tài khoản mẫu (mật khẩu `Admin@123`): `admin@flowershop.local` (ADMIN, có ở cả prod – **đổi mật khẩu ngay**), `staff@flowershop.local` (STAFF), `customer@flowershop.local` (CUSTOMER).
- Dữ liệu mẫu (`db/dev/V100`, `V101`): 37 sản phẩm thuộc 5 ngành hàng (Hoa tươi, Đồ gia dụng, Đồ chơi, Mẹ & bé, Văn phòng phẩm, mỗi ngành có danh mục con) và 4 dịp tặng quà; 8 sản phẩm đang giảm giá. Ảnh mẫu là SVG trong `frontend/public/sample/products/`.
- Mã giảm giá mẫu: `AZ5` (giảm 5%, tối đa 50.000đ, đơn từ 300.000đ), `GIAM50K`.
- Profile dev: Telegram/email chưa cấu hình thì chỉ ghi log; API key webhook là `dev-sepay-key`; tài khoản nhận tiền mặc định `0000000000`.

Giả lập SePay báo tiền về cho đơn `FS2610230001` tổng 552.500đ:

```bash
curl -X POST http://localhost:8080/api/public/payments/sepay/webhook \
  -H "Authorization: Apikey dev-sepay-key" -H "Content-Type: application/json" \
  -d '{"id":1001,"gateway":"MBBank","transactionDate":"2026-10-23 14:02:37","accountNumber":"0000000000",
       "code":null,"content":"FS2610230001 chuyen tien","transferType":"in","transferAmount":552500,
       "accumulated":0,"subAccount":null,"referenceCode":"FT001","description":""}'
# => {"success":true}
```

### Test

```bash
cd backend && mvn test     # cần Docker đang chạy (Testcontainers khởi tạo PostgreSQL thật)
```

## 3. Triển khai VPS (1 vCPU / 2GB)

```bash
cp .env.example .env        # sửa mật khẩu DB, JWT_SECRET (>= 32 ký tự), SePay, Telegram...
docker compose up -d --build
```

- `web` (nginx) mở cổng 80, phục vụ frontend, proxy `/api/` sang `app`, phục vụ trực tiếp ảnh `/uploads/`. `/actuator` không được mở ra ngoài.
- JVM: `-Xms256m -Xmx512m -XX:+UseSerialGC`; PostgreSQL: `shared_buffers=256MB`, `max_connections=30`.
- Tạo swap 2GB: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`.
- SSL qua Cloudflare. Nếu đi qua Cloudflare proxy, nên cấu hình nginx `real_ip_header CF-Connecting-IP` + `set_real_ip_from <dải IP Cloudflare>` để rate limit theo IP thật của khách.
- Backup: thêm cron `30 2 * * * /đường-dẫn/scripts/backup.sh`, rồi đồng bộ thư mục `backups/` ra ngoài VPS.
- Bật Redis cache: đặt `CACHE_TYPE=redis`, `REDIS_ENABLED=true` trong `.env`, chạy `docker compose --profile redis up -d`.

## 4. Khác biệt so với đặc tả

| Đặc tả | Thực hiện | Lý do |
| --- | --- | --- |
| Shop chỉ bán hoa; loại danh mục `OCCASION`, `FLOWER_TYPE`, `STYLE` | Thêm loại `DEPARTMENT` (ngành hàng, 2 cấp) làm menu chính; `OCCASION` dùng cho dịp tặng quà của mọi ngành. Chữ trên giao diện và email đổi "hoa" thành "hàng/đơn" (trạng thái `ARRANGING` hiển thị "Đang chuẩn bị hàng") | Shop bán cả đồ gia dụng, đồ chơi... |
| Thanh toán online ngoài phạm vi MVP; `PaymentMethod`: COD, BANK_TRANSFER | `PaymentMethod`: **COD, SEPAY**. Response tạo đơn giữ trường `bankTransferInfo` như đặc tả | Theo yêu cầu tích hợp SePay; chuyển khoản giờ được xác nhận tự động |
| 16 bảng | Thêm `payment_transactions` (đối soát SePay), `password_reset_tokens`, `order_daily_counters` (số thứ tự đơn theo ngày), `banners` (slider trang chủ) | Sequence của PostgreSQL không tự reset theo ngày; bảng đếm dùng UPSERT nguyên tử |
| Đếm đăng nhập sai trong Redis hoặc bảng `login_attempts` | Cột `failed_login_count`, `locked_until` trên `users` | Đơn giản, không phụ thuộc Redis |
| Cột trên `orders` | Thêm `paid_amount`, `paid_at`, `coupon_code`, `delivery_photo_url`, `idempotency_key` | Cộng dồn tiền SePay, ảnh hoa thực tế, idempotency |
| Khách hủy đơn khi còn PENDING | Thêm điều kiện: **chưa thanh toán** | Đơn đã trả tiền phải liên hệ shop để hoàn tiền |
| Rate limit `/api/auth/**` 10 lần/phút/IP | Giữ 10/phút cho đăng nhập, đăng ký, quên/đặt lại mật khẩu; `/api/auth/refresh` và `/logout` có hạn mức riêng 60/phút | SPA gọi refresh mỗi lần tải trang, gộp chung sẽ khiến khách dùng chung IP bị 429 |
| `delivery_zones` | `express_fee = NULL` nghĩa là khu vực không hỗ trợ EXPRESS | Thay cho cờ "nội thành" |

API bổ sung ngoài đặc tả: `GET /api/public/banners` và `GET|POST|PUT|DELETE /api/admin/banners[/{id}]`, `POST /api/admin/banners/{id}/image` (banner trang chủ, chỉ ADMIN), tham số `onSale=true` cho `GET /api/public/products` (mục "Đang giảm giá"), `GET /api/orders/{code}/payment?phone=` (trạng thái thanh toán), `POST /api/public/payments/sepay/webhook`, `GET|POST /api/admin/payments/transactions[/{id}/assign|/resolve]` (đối soát), `POST /api/admin/orders/{code}/photo`, `PATCH /api/admin/images/{id}`, `PUT /api/me/password`, `POST /api/admin/users`, `PATCH /api/admin/users/{id}/role`.

## 5. Câu hỏi cần chốt (còn mở từ đặc tả)

- Khu vực giao và phí ship thật (dữ liệu hiện tại chỉ là mẫu ở profile dev; prod cần tạo trong trang quản trị).
- Có quản lý tồn kho thật không, hay chỉ bật/tắt "hết hàng" (hiện tại trừ `stock` theo đơn).
- Thời gian giữ đơn chờ thanh toán SePay (mặc định 30 phút, `SEPAY_PAYMENT_TTL`).
