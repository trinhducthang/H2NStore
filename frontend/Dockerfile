# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Thông tin hiển thị nhận lúc build (docker compose lấy từ biến SHOP_* trong .env gốc).
# Để trống = mặc định trong src/config.ts; "-" = ẩn.
ARG VITE_SHOP_NAME
ARG VITE_SHOP_TAGLINE
ARG VITE_SHOP_HOTLINE
ARG VITE_SHOP_ADDRESS
ARG VITE_FACEBOOK_URL
ARG VITE_TWITTER_URL
ARG VITE_INSTAGRAM_URL
ARG VITE_ZALO
ARG VITE_MESSENGER
ENV VITE_SHOP_NAME=$VITE_SHOP_NAME \
    VITE_SHOP_TAGLINE=$VITE_SHOP_TAGLINE \
    VITE_SHOP_HOTLINE=$VITE_SHOP_HOTLINE \
    VITE_SHOP_ADDRESS=$VITE_SHOP_ADDRESS \
    VITE_FACEBOOK_URL=$VITE_FACEBOOK_URL \
    VITE_TWITTER_URL=$VITE_TWITTER_URL \
    VITE_INSTAGRAM_URL=$VITE_INSTAGRAM_URL \
    VITE_ZALO=$VITE_ZALO \
    VITE_MESSENGER=$VITE_MESSENGER
RUN npm run build

# ---------- runtime: nginx phục vụ SPA, proxy /api sang backend, phục vụ ảnh /uploads ----------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
