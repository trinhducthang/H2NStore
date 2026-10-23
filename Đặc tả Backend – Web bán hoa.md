# Đặc tả Backend – Web bán hoa

Oct 23, 2026 · @Thang Trinh Duc

## 1. Tổng quan

Backend là một ứng dụng Spring Boot dạng monolith, cung cấp REST API cho web khách hàng và trang quản trị của một shop hoa cá nhân. Bản đầu tiên (MVP) gồm: sản phẩm, giỏ hàng, đặt hàng có chọn ngày giờ giao, mã giảm giá và quản lý đơn hàng.

**Ngoài phạm vi MVP:** thanh toán online (VNPay, MoMo), tích điểm, blog, tích hợp đơn vị vận chuyển. Thiết kế vẫn chừa chỗ để thêm các phần này sau.

### Tech stack

| Thành phần | Lựa chọn | Ghi chú |
| --- | --- | --- |
| Ngôn ngữ | Java 21 | LTS, dùng record cho DTO |
| Framework | Spring Boot 3.x | Web, Validation, Data JPA, Security |
| Database | PostgreSQL 16 | Migration bằng Flyway |
| Xác thực | Spring Security + JWT | Access token 15 phút, refresh token 7 ngày |
| Cache | Redis (tùy chọn) | Cache danh mục, sản phẩm; tắt được nếu RAM thiếu |
| Mapping | MapStruct | Entity sang DTO |
| Lưu ảnh | Thư mục local, sau chuyển Cloudinary/S3 | Ẩn sau interface `StorageService` |
| Tài liệu API | springdoc-openapi | Swagger UI ở `/swagger-ui.html` |
| Test | JUnit 5, Testcontainers | Test repository với PostgreSQL thật |
| Build/chạy | Maven, Docker Compose | Triển khai trên VPS 1 vCPU / 2GB |

## 2. Kiến trúc và cấu trúc package

Tổ chức code theo **module nghiệp vụ** (package-by-feature). Mỗi module có đủ các lớp controller, service, repository và DTO. Cách này giúp tách thành service riêng dễ hơn nếu sau này cần.

```text
com.flowershop
├── FlowerShopApplication.java
├── common/            # BaseEntity, ApiResponse, PageResponse, exception, util
├── config/            # SecurityConfig, JwtConfig, OpenApiConfig, CacheConfig, WebConfig (CORS)
├── security/          # JwtProvider, JwtAuthFilter, UserPrincipal
├── auth/              # đăng ký, đăng nhập, refresh token, quên mật khẩu
├── user/              # hồ sơ khách hàng, sổ địa chỉ
├── catalog/           # category, product, product_variant, product_image
├── cart/
├── order/             # order, order_item, order_status_history
├── coupon/
├── delivery/          # khu vực giao, khung giờ, phí ship
├── review/
├── storage/           # StorageService (local / cloud)
├── notification/      # gửi Telegram / email khi có đơn mới
└── report/            # dashboard, doanh thu
```

Trong mỗi module, ví dụ `order/`:

```text
order/
├── controller/   # OrderController (customer), AdminOrderController
├── service/      # OrderService, OrderPricingService
├── repository/   # OrderRepository
├── entity/       # Order, OrderItem, OrderStatusHistory
├── dto/          # CreateOrderRequest, OrderResponse...
├── mapper/       # OrderMapper (MapStruct)
└── event/        # OrderCreatedEvent
```

**Quy tắc phụ thuộc:**

- Controller chỉ gọi service, không gọi repository trực tiếp.
- Module khác chỉ gọi qua service, không dùng repository của module khác.
- Việc phụ (gửi thông báo, ghi log) dùng `ApplicationEvent` + `@TransactionalEventListener(phase = AFTER_COMMIT)` và `@Async`.

## 3. Mô hình dữ liệu

Hệ thống có 16 bảng. Mọi bảng đều có `id BIGSERIAL`, `created_at` và `updated_at` (kế thừa từ `BaseEntity`). Tiền lưu bằng `BIGINT` theo đơn vị VNĐ, không dùng số thực.

### Quan hệ chính

```text
users 1──n addresses
users 1──n orders ──n order_items n──1 product_variants n──1 products n──1 categories
products 1──n product_images
users 1──1 carts 1──n cart_items n──1 product_variants
orders 1──n order_status_history
orders n──1 coupons (nullable)
orders n──1 delivery_zones
products 1──n reviews n──1 users
```

### Chi tiết các bảng

| Bảng | Cột chính | Ràng buộc / ghi chú |
| --- | --- | --- |
| users | email, password\_hash, full\_name, phone, role, enabled | email UNIQUE; role: CUSTOMER, STAFF, ADMIN |
| refresh\_tokens | user\_id, token\_hash, expires\_at, revoked | Lưu hash, không lưu token gốc |
| addresses | user\_id, receiver\_name, receiver\_phone, address\_line, ward, district, city, is\_default | Mỗi user tối đa 1 địa chỉ mặc định |
| categories | name, slug, type, parent\_id, sort\_order, active | slug UNIQUE; type: OCCASION, FLOWER\_TYPE, STYLE |
| products | name, slug, description, status, sold\_count | slug UNIQUE; status: ACTIVE, HIDDEN, OUT\_OF\_STOCK |
| product\_categories | product\_id, category\_id | Bảng nối n-n (1 sản phẩm thuộc nhiều danh mục) |
| product\_variants | product\_id, name, sku, price, sale\_price, stock, active | Ví dụ: Tiêu chuẩn / Cao cấp; sale\_price nullable |
| product\_images | product\_id, url, sort\_order, is\_thumbnail |  |
| carts, cart\_items | user\_id; cart\_id, variant\_id, quantity | UNIQUE(cart\_id, variant\_id) |
| orders | code, user\_id (nullable), sender\_*, receiver\_*, delivery\_address, delivery\_zone\_id, delivery\_date, delivery\_slot, card\_message, hide\_sender, note, subtotal, shipping\_fee, discount, total, coupon\_id, payment\_method, payment\_status, status, version | code UNIQUE dạng `FS2610230001`; `version` cho optimistic lock |
| order\_items | order\_id, variant\_id, product\_name, variant\_name, unit\_price, quantity, line\_total | Chụp lại tên và giá lúc đặt |
| order\_status\_history | order\_id, from\_status, to\_status, changed\_by, reason | Ghi mỗi lần đổi trạng thái |
| coupons | code, type, value, max\_discount, min\_order, usage\_limit, used\_count, starts\_at, ends\_at, active | type: PERCENT, FIXED; code UNIQUE |
| delivery\_zones | name, districts, shipping\_fee, express\_fee, active | Ví dụ: Nội thành, Ngoại thành |
| reviews | product\_id, user\_id, order\_id, rating, content, status | rating 1–5; UNIQUE(order\_id, product\_id) |

### Enum

- `OrderStatus`: PENDING, CONFIRMED, ARRANGING, DELIVERING, DELIVERED, CANCELLED
- `PaymentMethod`: COD, BANK\_TRANSFER (sau này thêm VNPAY, MOMO)
- `PaymentStatus`: UNPAID, PAID, REFUNDED
- `DeliverySlot`: SLOT\_08\_10, SLOT\_10\_12, SLOT\_14\_16, SLOT\_16\_18, SLOT\_18\_20, EXPRESS

### Index cần tạo

- `orders(status, created_at DESC)` cho trang admin
- `orders(user_id, created_at DESC)` cho lịch sử đơn
- `orders(delivery_date, delivery_slot)` để đếm số đơn mỗi khung giờ
- `products(status)`, `product_categories(category_id)`
- Tìm kiếm tên sản phẩm: extension `unaccent` + `pg_trgm` để tìm không dấu ("hoa hong" ra "hoa hồng")

## 4. Xác thực và phân quyền

Dùng JWT không trạng thái (stateless). Khách vãng lai vẫn đặt hàng được, không cần đăng nhập.

### Token

| Loại | Thời hạn | Nơi lưu ở client | Ghi chú |
| --- | --- | --- | --- |
| Access token | 15 phút | Bộ nhớ (biến JS) | Ký HS256, claim: `sub` (user id), `role` |
| Refresh token | 7 ngày | Cookie `HttpOnly`, `Secure`, `SameSite=Strict` | DB lưu hash; mỗi lần refresh thì cấp token mới và thu hồi token cũ (rotation) |

### Vai trò

| Vai trò | Được làm gì |
| --- | --- |
| Khách (chưa đăng nhập) | Xem sản phẩm, đặt hàng, tra cứu đơn bằng mã đơn + số điện thoại |
| CUSTOMER | Thêm: giỏ hàng lưu trên server, lịch sử đơn, sổ địa chỉ, đánh giá |
| STAFF | `/api/admin/**`: xem và xử lý đơn, sửa sản phẩm. Không được xóa sản phẩm, quản lý user, xem báo cáo |
| ADMIN | Toàn quyền |

### Quy tắc trong `SecurityConfig`

```java
.requestMatchers("/api/auth/**", "/api/public/**", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
.requestMatchers(HttpMethod.POST, "/api/orders").permitAll()   // khách vãng lai đặt hàng
.requestMatchers("/api/admin/**").hasAnyRole("STAFF", "ADMIN")
.anyRequest().authenticated()
```

Các quyền chi tiết hơn (chỉ ADMIN được xóa) dùng `@PreAuthorize("hasRole('ADMIN')")` trên method.

### Bảo mật khác

- Mật khẩu mã hóa bằng BCrypt (strength 10).
- Khóa đăng nhập 15 phút sau 5 lần sai liên tiếp (đếm trong Redis hoặc bảng `login_attempts`).
- Rate limit `POST /api/orders` và `/api/auth/**`: 10 request/phút/IP (Bucket4j).
- CORS chỉ cho phép domain của frontend.
- Quên mật khẩu: gửi link chứa token ngẫu nhiên, hết hạn sau 30 phút, dùng một lần.

## 5. Đặc tả API

Prefix chung là `/api`. API công khai nằm dưới `/api/public`, API quản trị dưới `/api/admin`. Cột **Quyền**: P = công khai, C = CUSTOMER, S = STAFF, A = ADMIN.

### 5.1 Auth

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | /api/auth/register | P | Đăng ký (email, password, fullName, phone) |
| POST | /api/auth/login | P | Trả access token, set cookie refresh token |
| POST | /api/auth/refresh | P | Đổi refresh token lấy access token mới |
| POST | /api/auth/logout | C | Thu hồi refresh token |
| POST | /api/auth/forgot-password | P | Gửi email đặt lại mật khẩu |
| POST | /api/auth/reset-password | P | Đặt mật khẩu mới bằng token |

### 5.2 Catalog (công khai)

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | /api/public/categories | P | Cây danh mục, lọc theo `type` |
| GET | /api/public/products | P | Danh sách + lọc: `q`, `categorySlug`, `minPrice`, `maxPrice`, `sort` (price,asc / newest / bestseller), `page`, `size` |
| GET | /api/public/products/{slug} | P | Chi tiết, kèm variants, images, điểm đánh giá trung bình |
| GET | /api/public/products/{slug}/related | P | Tối đa 8 sản phẩm cùng danh mục |
| GET | /api/public/products/{slug}/reviews | P | Đánh giá đã duyệt, phân trang |
| GET | /api/public/delivery/zones | P | Khu vực giao và phí ship |
| GET | /api/public/delivery/slots?date= | P | Khung giờ còn nhận đơn trong ngày đó |
| POST | /api/public/coupons/validate | P | Kiểm tra mã + subtotal, trả số tiền giảm |

### 5.3 Giỏ hàng và đơn hàng (khách hàng)

Khách vãng lai giữ giỏ hàng ở localStorage phía frontend. Khi đăng nhập, frontend gọi `POST /api/cart/merge` để gộp vào giỏ trên server.

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | /api/cart | C | Xem giỏ, kèm tạm tính |
| POST | /api/cart/items | C | Thêm `{variantId, quantity}` |
| PATCH | /api/cart/items/{id} | C | Sửa số lượng |
| DELETE | /api/cart/items/{id} | C | Xóa 1 dòng |
| POST | /api/cart/merge | C | Gộp giỏ từ localStorage |
| POST | /api/orders/preview | P | Tính trước subtotal, phí ship, giảm giá, tổng (không lưu) |
| POST | /api/orders | P | Tạo đơn (header `Idempotency-Key` bắt buộc) |
| GET | /api/orders/track?code=&phone= | P | Tra cứu đơn cho khách vãng lai |
| GET | /api/me/orders | C | Lịch sử đơn của tôi |
| GET | /api/me/orders/{code} | C | Chi tiết đơn + lịch sử trạng thái |
| POST | /api/me/orders/{code}/cancel | C | Chỉ hủy được khi đơn còn PENDING |
| GET, PUT | /api/me/profile | C | Xem, sửa hồ sơ |
| GET, POST, PUT, DELETE | /api/me/addresses | C | Sổ địa chỉ |
| POST | /api/me/reviews | C | Đánh giá sản phẩm trong đơn đã DELIVERED |

**Ví dụ `POST /api/orders`:**

```json
{
  "items": [{ "variantId": 12, "quantity": 1 }],
  "sender":   { "name": "Nguyễn Văn A", "phone": "0912345678", "email": "a@gmail.com" },
  "receiver": { "name": "Trần Thị B", "phone": "0987654321" },
  "deliveryAddress": "12 Phạm Hùng, Mỹ Đình, Nam Từ Liêm, Hà Nội",
  "deliveryZoneId": 1,
  "deliveryDate": "2026-10-20",
  "deliverySlot": "SLOT_08_10",
  "cardMessage": "Chúc mừng 20/10!",
  "hideSender": false,
  "couponCode": "AZ5",
  "paymentMethod": "COD",
  "note": "Gọi trước khi giao"
}
```

Response `201`: `{ code, status, subtotal, shippingFee, discount, total, paymentMethod, bankTransferInfo? }`. Nếu chọn BANK\_TRANSFER, `bankTransferInfo` chứa số tài khoản, số tiền, nội dung chuyển khoản = mã đơn, và link ảnh VietQR.

### 5.4 Quản trị

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | /api/admin/products | S, A | Danh sách, gồm cả sản phẩm ẩn |
| POST, PUT | /api/admin/products\[/{id}\] | S, A | Tạo / sửa sản phẩm kèm variants |
| PATCH | /api/admin/products/{id}/status | S, A | ACTIVE / HIDDEN / OUT\_OF\_STOCK |
| DELETE | /api/admin/products/{id} | A | Xóa mềm (soft delete) |
| POST | /api/admin/products/{id}/images | S, A | Upload multipart, tối đa 5MB/ảnh, chỉ jpg/png/webp |
| DELETE | /api/admin/images/{id} | S, A | Xóa ảnh |
| CRUD | /api/admin/categories | A | Quản lý danh mục |
| GET | /api/admin/orders | S, A | Lọc theo `status`, `deliveryDate`, `q` (mã đơn, SĐT) |
| GET | /api/admin/orders/{code} | S, A | Chi tiết đơn |
| PATCH | /api/admin/orders/{code}/status | S, A | `{toStatus, reason}`, kiểm tra theo bảng chuyển trạng thái |
| PATCH | /api/admin/orders/{code}/payment | S, A | Đánh dấu PAID khi đã nhận chuyển khoản |
| CRUD | /api/admin/coupons | A | Quản lý mã giảm giá |
| CRUD | /api/admin/delivery-zones | A | Khu vực, phí ship |
| GET | /api/admin/users | A | Danh sách khách hàng |
| PATCH | /api/admin/users/{id}/enabled | A | Khóa / mở tài khoản |
| GET, PATCH | /api/admin/reviews | S, A | Duyệt / ẩn đánh giá |
| GET | /api/admin/reports/summary?from=&to= | A | Doanh thu, số đơn, top sản phẩm |
| GET | /api/admin/reports/export?from=&to= | A | Xuất Excel (Apache POI) |

## 6. Nghiệp vụ

### 6.1 Luồng tạo đơn (`OrderService.create`)

Toàn bộ chạy trong một `@Transactional`:

1. Kiểm tra `Idempotency-Key`. Nếu key đã dùng trong 24 giờ thì trả lại đơn cũ, không tạo mới.
2. Validate ngày giờ giao (mục 6.4).
3. Load các variant bằng `SELECT ... FOR UPDATE`. Kiểm tra variant còn `active`, sản phẩm `ACTIVE`, đủ `stock`.
4. Tính giá ở server (mục 6.2). Không tin giá do client gửi lên.
5. Áp mã giảm giá nếu có (mục 6.3), tăng `used_count` bằng câu UPDATE có điều kiện.
6. Trừ `stock`, tăng `sold_count`.
7. Lưu `orders`, `order_items` (chụp lại tên và giá), dòng đầu tiên của `order_status_history`.
8. Nếu user đã đăng nhập thì xóa các dòng tương ứng trong giỏ.
9. Phát `OrderCreatedEvent`. Sau commit, listener gửi Telegram cho shop và email xác nhận cho khách.

Mã đơn: `FS` + `yyMMdd` + số thứ tự 4 chữ số trong ngày, lấy từ PostgreSQL sequence.

### 6.2 Tính giá

```text
unit_price   = sale_price nếu có, ngược lại price
subtotal     = Σ unit_price × quantity
shipping_fee = zone.shipping_fee  (hoặc zone.express_fee nếu slot = EXPRESS)
discount     = tính từ coupon trên subtotal
total        = subtotal + shipping_fee − discount   (không nhỏ hơn 0)
```

Dùng chung `OrderPricingService` cho cả `/orders/preview` và `/orders` để hai nơi luôn ra cùng kết quả.

### 6.3 Mã giảm giá

Mã hợp lệ khi đủ tất cả điều kiện: `active = true`, thời điểm hiện tại nằm trong `[starts_at, ends_at]`, `used_count < usage_limit`, `subtotal >= min_order`.

- PERCENT: `discount = min(subtotal × value / 100, max_discount)`
- FIXED: `discount = min(value, subtotal)`

Tránh dùng vượt lượt khi nhiều người đặt cùng lúc:

```sql
UPDATE coupons SET used_count = used_count + 1
WHERE id = :id AND used_count < usage_limit;
-- 0 dòng bị ảnh hưởng → ném COUPON_EXHAUSTED
```

Khi đơn bị hủy thì giảm lại `used_count`.

### 6.4 Ngày giờ giao

- `delivery_date` từ hôm nay đến tối đa 30 ngày sau.
- Khung giờ phải bắt đầu sau thời điểm đặt ít nhất 2 giờ (thời gian cắm hoa).
- Mỗi khung giờ nhận tối đa `MAX_ORDERS_PER_SLOT` đơn (cấu hình, mặc định 10). Đếm các đơn chưa hủy.
- EXPRESS (giao trong 2–3 giờ) chỉ nhận từ 8:00 đến 17:00 và chỉ cho khu vực nội thành.
- Các ngày lễ (14/2, 8/3, 20/10, 20/11) có thể cấu hình giới hạn riêng.
- Giờ tính theo múi `Asia/Ho_Chi_Minh`.

### 6.5 Trạng thái đơn

Mọi lần đổi trạng thái đều qua `OrderStateMachine.transition(order, to, actor, reason)`. Chuyển không hợp lệ trả lỗi `INVALID_STATUS_TRANSITION`. Ghi lại trong `order_status_history`.

&#91;embedded content: vòng đời đơn hàng · 6 trạng thái\]

Từ ARRANGING trở đi, đơn không hủy được vì hoa đã cắm. Bảng dưới ghi rõ ai được thực hiện từng bước.

| Từ | Sang | Ai được làm | Việc kèm theo |
| --- | --- | --- | --- |
| PENDING | CONFIRMED | Staff, Admin | Gửi email xác nhận |
| PENDING | CANCELLED | Khách, Staff, Admin | Hoàn stock, hoàn lượt coupon |
| CONFIRMED | ARRANGING | Staff, Admin |  |
| CONFIRMED | CANCELLED | Staff, Admin | Bắt buộc nhập lý do; hoàn stock, coupon |
| ARRANGING | DELIVERING | Staff, Admin | Có thể đính kèm ảnh hoa thực tế |
| DELIVERING | DELIVERED | Staff, Admin | Đơn COD tự chuyển `payment_status = PAID` |

Khi hai nhân viên cùng sửa một đơn, cột `version` (optimistic lock) khiến người sau nhận lỗi `409 CONFLICT`.

## 7. Quy ước API

### Response thành công

Trả thẳng dữ liệu, không bọc thêm lớp. Danh sách phân trang dùng `PageResponse`:

```json
{ "content": [ ... ], "page": 0, "size": 20, "totalElements": 135, "totalPages": 7 }
```

- `page` bắt đầu từ 0, `size` mặc định 20, tối đa 100.
- Không trả trực tiếp `Page` của Spring vì JSON của nó không ổn định giữa các phiên bản.
- JSON dùng camelCase. Ngày dạng `yyyy-MM-dd`, thời điểm dạng ISO-8601 có múi giờ (`2026-10-23T09:30:00+07:00`).

### Response lỗi

Một `@RestControllerAdvice` xử lý mọi exception và trả về cùng một dạng:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ",
  "errors": [{ "field": "receiver.phone", "message": "Số điện thoại không hợp lệ" }],
  "traceId": "7f3a...",
  "timestamp": "2026-10-23T09:30:00+07:00"
}
```

| HTTP | code | Khi nào |
| --- | --- | --- |
| 400 | VALIDATION\_ERROR | Sai dữ liệu đầu vào (Bean Validation) |
| 400 | INVALID\_DELIVERY\_TIME | Ngày giờ giao không hợp lệ |
| 400 | COUPON\_INVALID | Mã hết hạn, chưa đến hạn, không đủ đơn tối thiểu |
| 401 | UNAUTHORIZED | Thiếu hoặc sai token |
| 403 | FORBIDDEN | Không đủ quyền |
| 404 | NOT\_FOUND | Không tìm thấy tài nguyên |
| 409 | OUT\_OF\_STOCK | Không đủ hàng |
| 409 | SLOT\_FULL | Khung giờ đã đủ đơn |
| 409 | COUPON\_EXHAUSTED | Mã đã hết lượt |
| 409 | INVALID\_STATUS\_TRANSITION | Chuyển trạng thái không được phép |
| 409 | CONFLICT | Optimistic lock, dữ liệu đã bị người khác sửa |
| 429 | TOO\_MANY\_REQUESTS | Vượt rate limit |
| 500 | INTERNAL\_ERROR | Lỗi không lường trước; chỉ log stack trace, không trả về client |

Khai báo các mã này trong enum `ErrorCode(httpStatus, defaultMessage)`, ném bằng `BusinessException(ErrorCode)`.

### Validation

- Số điện thoại VN: `^(0|\+84)(3|5|7|8|9)\d{8}$`
- `quantity` từ 1 đến 20; `cardMessage` tối đa 300 ký tự; `note` tối đa 500.
- `items` không rỗng, tối đa 20 dòng.
- Chuỗi đầu vào được `trim`; nội dung đánh giá lọc HTML để chống XSS.

### Log

- Mỗi request có `traceId` (MDC), trả về trong header `X-Trace-Id`.
- Không log mật khẩu, token, số điện thoại đầy đủ (che còn `091****678`).

## 8. Cấu hình, triển khai và lộ trình code

### Cấu hình

Dùng 2 profile `dev` và `prod`. Mọi thông tin bí mật lấy từ biến môi trường, không commit lên Git.

```yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
    hikari.maximum-pool-size: 10
  jpa:
    open-in-view: false
    hibernate.ddl-auto: validate      # schema do Flyway quản lý
  servlet.multipart.max-file-size: 5MB
app:
  jwt.secret: ${JWT_SECRET}
  jwt.access-ttl: 15m
  jwt.refresh-ttl: 7d
  cors.allowed-origins: ${FRONTEND_URL}
  order.max-per-slot: 10
  order.min-prepare-hours: 2
  storage.type: local                 # local | cloudinary
  telegram.bot-token: ${TG_TOKEN}
  telegram.chat-id: ${TG_CHAT_ID}
```

### Triển khai trên VPS 1 vCPU / 2GB

- Docker Compose gồm: `app`, `postgres`, `nginx` (và `redis` nếu bật cache).
- JVM: `-Xms256m -Xmx512m -XX:+UseSerialGC`.
- PostgreSQL: `shared_buffers=256MB`, `max_connections=30`.
- Tạo swap 2GB.
- Nginx làm reverse proxy, bật gzip, phục vụ trực tiếp thư mục ảnh; SSL qua Cloudflare.
- Backup: `pg_dump` hằng ngày bằng cron, giữ 7 bản, đẩy một bản ra ngoài VPS.
- Health check: Spring Actuator `/actuator/health` (chỉ mở trong nội bộ).

### Lộ trình code

Mỗi bước làm xong thì viết test và chạy được trên Swagger trước khi sang bước sau.

- [ ] **Bước 1 – Nền tảng:** tạo project, Docker Compose cho PostgreSQL, Flyway `V1__init.sql`, `BaseEntity`, `GlobalExceptionHandler`, `ErrorCode`, `PageResponse`, Swagger.
- [ ] **Bước 2 – Auth:** bảng users, refresh\_tokens; đăng ký, đăng nhập, refresh, JWT filter, phân quyền; tạo sẵn 1 tài khoản ADMIN bằng migration.
- [ ] **Bước 3 – Catalog:** categories, products, variants, images; API admin CRUD và API public có lọc, phân trang, tìm không dấu.
- [ ] **Bước 4 – Giao hàng và coupon:** delivery\_zones, API khung giờ trống, coupons, API validate.
- [ ] **Bước 5 – Đơn hàng:** `OrderPricingService`, preview, tạo đơn (lock stock, idempotency), tra cứu đơn, state machine, API admin đơn hàng.
- [ ] **Bước 6 – Thông báo:** event sau commit, gửi Telegram cho shop, email cho khách.
- [ ] **Bước 7 – Khách hàng:** giỏ hàng server + merge, hồ sơ, sổ địa chỉ, lịch sử đơn, đánh giá.
- [ ] **Bước 8 – Báo cáo và triển khai:** dashboard, xuất Excel, rate limit, Dockerfile, deploy lên VPS.

### Câu hỏi cần chốt

- Shop giao ở những quận nào, phí ship mỗi khu vực bao nhiêu?
- Có quản lý tồn kho thật không, hay hoa cắm theo đơn và chỉ cần bật/tắt "hết hàng"?
- Đơn chuyển khoản xác nhận thủ công hay tích hợp webhook ngân hàng (SePay, Casso)?
