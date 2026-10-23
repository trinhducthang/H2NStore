# Frontend – H2N Store

React 19 + TypeScript + Vite + React Router. Gọi REST API của backend Spring Boot (`../backend`).

## Chạy dev

Cần backend chạy ở `http://localhost:8080` (Vite proxy `/api` và `/uploads` sang đó, nên cookie refresh token là same-origin).

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Tài khoản mẫu (profile `dev` của backend): `admin@flowershop.local` / `Admin@123`.

Đổi tên shop, hotline, địa chỉ: sao chép `.env.example` thành `.env.local` rồi sửa.

## Header và banner

- Header (`src/components/Layout.tsx`): desktop 3 hàng (mạng xã hội · logo + slogan · tìm kiếm/tài khoản/giỏ; menu danh mục có dropdown; dải hotline), mobile 1 hàng + menu trượt.
- Điện thoại: dưới logo có hàng [Danh mục ▾][Tìm kiếm ...] dính đầu trang (dải hotline nằm ngoài header nên cuộn đi). Nút "Danh mục" mở bảng `MobileCategoryPanel.tsx`: trái là các ngành hàng, phải là danh mục con dạng ô lớn và 4 sản phẩm bán chạy của ngành. Đổi chiều cao header thì sửa `--header-h` trong `styles.css`.
- Menu sinh tự động từ danh mục: mỗi ngành hàng (loại `DEPARTMENT`) là một mục, có danh mục con thì xổ xuống (mục đầu "Xem tất cả"); "Theo dịp", "Loại hoa", "Kiểu dáng" mỗi loại gom thành một dropdown (chỉ hiện khi có danh mục loại đó); thêm "Đang giảm giá" và "Tra cứu đơn".
- Icon danh mục ở trang chủ chọn theo cụm từ trong slug (`CATEGORY_ICONS` trong `src/pages/HomePage.tsx`), không khớp thì dùng 🛍️.
- Ảnh mẫu của dữ liệu dev: `public/sample/products/*.svg` (phục vụ tại `/sample/...`).
- Tên shop, slogan, hotline, địa chỉ, link mạng xã hội: biến `VITE_*` (xem `.env.example`); để trống = mặc định, `-` = ẩn.
- Banner trang chủ (`src/components/BannerCarousel.tsx`): admin quản lý ở `/admin/banners`; tự chuyển 5 giây, dừng khi rê chuột, vuốt trên điện thoại. Tỉ lệ 3:1 trên máy tính, 2:1 trên điện thoại.

## Cột bên trang chủ và nút chat

- Màn hình từ 1400px (`SIDEBARS_QUERY` trong `HomePage.tsx`), trang chủ có 3 cột (`HomeSidebars.tsx`), hai cột bên bám theo khi cuộn:
  - trái: danh mục sản phẩm (rê chuột xổ danh mục con), "Quà theo dịp", "Đang giảm giá", cam kết dịch vụ và hotline;
  - phải: thẻ khuyến mãi theo ngành tự trượt ("Giảm đến X%" tính từ sản phẩm đang giảm giá thật), "Vừa xem gần đây" (lưu ở trình duyệt, `h2n.recent`; chưa xem gì thì "Gợi ý cho bạn"), ô ưu đãi thành viên.
- Chữ cam kết dịch vụ (`SERVICE_PERKS`, `SUPPORT_HOURS`) và ưu đãi thành viên (`MEMBER_OFFER`) sửa trong `src/config.ts`. Hệ thống chưa tự áp dụng freeship, đổi trả hay giảm giá đơn đầu: viết đúng chính sách thật của shop.
- Icon, màu, câu khẩu hiệu của từng ngành: `src/utils/categoryStyle.ts`.
- Nút chat nổi góc phải (`ChatButtons.tsx`, không hiện ở trang quản trị): `VITE_ZALO` (số điện thoại hoặc link, mặc định là hotline), `VITE_MESSENGER` (tên trang Facebook hoặc link m.me, mặc định lấy từ `VITE_FACEBOOK_URL`); "-" = ẩn.

## Hiệu ứng trượt

- Banner (`BannerCarousel.tsx`): trượt ngang vòng tròn (bản sao slide đầu/cuối ở hai đầu dải), kéo bằng chuột hoặc vuốt theo tay, tự chuyển sau `AUTOPLAY_MS`, ảnh đang hiện phóng nhẹ, chữ trên banner trượt vào lần lượt.
- Dải sản phẩm ở trang chủ (`ProductSlider.tsx`): cuộn ngang có snap, nút ‹ › trên máy tính, vuốt trên điện thoại; mục "Đang giảm giá" tự trượt (`autoplay`), dừng khi rê chuột hoặc khách vừa vuốt.
- Hiện dần khi cuộn tới: thêm class `reveal` và ref từ `useReveal()` (`src/hooks/useReveal.ts`); thẻ trong lưới sản phẩm trượt lên lần lượt.
- Thẻ sản phẩm nhấc lên, ảnh phóng nhẹ khi rê chuột; ảnh ở trang chi tiết trượt vào khi đổi ảnh.
- Các hiệu ứng này vẫn chạy khi máy bật "giảm chuyển động" (Windows tắt Animation effects...), giống hoa rơi. Muốn tôn trọng cài đặt đó thì bỏ class tương ứng khỏi danh sách `:not(...)` trong khối `prefers-reduced-motion` cuối `src/styles.css`.

## Hiệu ứng hoa rơi

Component `src/components/FallingPetals.tsx`, gắn trong `Layout`:

- Hiện ở các trang khách; không hiện ở `/admin`, `/checkout`, `/payment` (tránh che mã QR khi khách quét).
- Nút 🌸 góc dưới bên trái để khách bật/tắt, lựa chọn lưu trong `localStorage` (`h2n.petals`).
- Mặc định bật với mọi khách (kể cả máy đặt "giảm chuyển động"); khách tắt bằng nút 🌸.
- Chỉnh số cánh hoa (`DESKTOP_COUNT`, `MOBILE_COUNT`), màu (`COLORS`), kích thước/tốc độ trong `makePetals`; đổi trang không rắc hoa ở `NO_PETALS_PATH` trong `Layout.tsx`.

## Build

```bash
npm run build      # kiểm tra kiểu (tsc) rồi build ra dist/
npm run preview    # xem thử bản build
```

## Docker

`Dockerfile` build ra image nginx:
- phục vụ SPA (mọi đường dẫn trả về `index.html`),
- proxy `/api/` sang service `app:8080` (backend trong docker compose),
- phục vụ ảnh `/uploads/` trực tiếp từ volume mount tại `/var/www/uploads/`,
- không mở `/actuator`.

## Các trang chính

| Đường dẫn | Mô tả |
| --- | --- |
| `/`, `/products`, `/products/:slug` | Trang chủ, danh sách (lọc, tìm không dấu), chi tiết sản phẩm |
| `/cart`, `/checkout` | Giỏ hàng (localStorage khi chưa đăng nhập, server khi đã đăng nhập), đặt hàng |
| `/payment/:code?phone=` | Mã VietQR SePay, tự cập nhật khi tiền về |
| `/order-success/:code`, `/track` | Đặt hàng thành công, tra cứu đơn |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Tài khoản |
| `/account/*` | Đơn của tôi, hồ sơ, sổ địa chỉ, đánh giá |
| `/admin/*` | Quản trị: đơn hàng, đối soát SePay, sản phẩm, đánh giá; ADMIN thêm báo cáo, danh mục, mã giảm giá, khu vực giao, người dùng |
