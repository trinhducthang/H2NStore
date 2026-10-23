-- =============================================================
-- V1: schema khởi tạo cho web bán hoa
-- Tiền lưu BIGINT (VNĐ). Thời điểm lưu TIMESTAMPTZ.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() không IMMUTABLE nên không dùng được trong index; bọc lại.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- ---------------------------------------------------------- users
CREATE TABLE users (
    id                 BIGSERIAL PRIMARY KEY,
    email              VARCHAR(255) NOT NULL,
    password_hash      VARCHAR(100) NOT NULL,
    full_name          VARCHAR(100) NOT NULL,
    phone              VARCHAR(20),
    role               VARCHAR(20)  NOT NULL DEFAULT 'CUSTOMER',
    enabled            BOOLEAN      NOT NULL DEFAULT TRUE,
    failed_login_count INT          NOT NULL DEFAULT 0,
    locked_until       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN ('CUSTOMER', 'STAFF', 'ADMIN'))
);

CREATE TABLE refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE password_reset_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_password_reset_tokens_hash UNIQUE (token_hash)
);

CREATE TABLE addresses (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    receiver_name  VARCHAR(100) NOT NULL,
    receiver_phone VARCHAR(20)  NOT NULL,
    address_line   VARCHAR(255) NOT NULL,
    ward           VARCHAR(100),
    district       VARCHAR(100),
    city           VARCHAR(100),
    is_default     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_addresses_user ON addresses (user_id);
-- Mỗi user tối đa 1 địa chỉ mặc định
CREATE UNIQUE INDEX ux_addresses_default ON addresses (user_id) WHERE is_default;

-- ---------------------------------------------------------- catalog
CREATE TABLE categories (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    slug       VARCHAR(120) NOT NULL,
    type       VARCHAR(20)  NOT NULL,
    parent_id  BIGINT REFERENCES categories (id),
    sort_order INT          NOT NULL DEFAULT 0,
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT ck_categories_type CHECK (type IN ('OCCASION', 'FLOWER_TYPE', 'STYLE'))
);

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    slug        VARCHAR(220) NOT NULL,
    description TEXT,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    sold_count  INT          NOT NULL DEFAULT 0,
    deleted_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_products_slug UNIQUE (slug),
    CONSTRAINT ck_products_status CHECK (status IN ('ACTIVE', 'HIDDEN', 'OUT_OF_STOCK'))
);
CREATE INDEX idx_products_status ON products (status);
CREATE INDEX idx_products_name_trgm ON products USING gin (f_unaccent(lower(name)) gin_trgm_ops);

CREATE TABLE product_categories (
    product_id  BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);
CREATE INDEX idx_product_categories_category ON product_categories (category_id);

CREATE TABLE product_variants (
    id         BIGSERIAL PRIMARY KEY,
    product_id BIGINT       NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    sku        VARCHAR(64)  NOT NULL,
    price      BIGINT       NOT NULL CHECK (price >= 0),
    sale_price BIGINT CHECK (sale_price >= 0),
    stock      INT          NOT NULL DEFAULT 0 CHECK (stock >= 0),
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_variants_sku UNIQUE (sku)
);
CREATE INDEX idx_product_variants_product ON product_variants (product_id);

CREATE TABLE product_images (
    id           BIGSERIAL PRIMARY KEY,
    product_id   BIGINT       NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    url          VARCHAR(500) NOT NULL,
    storage_key  VARCHAR(300) NOT NULL,
    sort_order   INT          NOT NULL DEFAULT 0,
    is_thumbnail BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_images_product ON product_images (product_id);

-- ---------------------------------------------------------- cart
CREATE TABLE carts (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_carts_user UNIQUE (user_id)
);

CREATE TABLE cart_items (
    id         BIGSERIAL PRIMARY KEY,
    cart_id    BIGINT      NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
    variant_id BIGINT      NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
    quantity   INT         NOT NULL CHECK (quantity BETWEEN 1 AND 20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cart_items_variant UNIQUE (cart_id, variant_id)
);

-- ---------------------------------------------------------- coupon, delivery
CREATE TABLE coupons (
    id           BIGSERIAL PRIMARY KEY,
    code         VARCHAR(50) NOT NULL,
    type         VARCHAR(10) NOT NULL,
    value        BIGINT      NOT NULL CHECK (value > 0),
    max_discount BIGINT,
    min_order    BIGINT      NOT NULL DEFAULT 0,
    usage_limit  INT,
    used_count   INT         NOT NULL DEFAULT 0,
    starts_at    TIMESTAMPTZ,
    ends_at      TIMESTAMPTZ,
    active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_coupons_code UNIQUE (code),
    CONSTRAINT ck_coupons_type CHECK (type IN ('PERCENT', 'FIXED'))
);

CREATE TABLE delivery_zones (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    districts    TEXT,
    shipping_fee BIGINT       NOT NULL DEFAULT 0,
    -- NULL = khu vực này không nhận giao EXPRESS (chỉ nội thành có)
    express_fee  BIGINT,
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------- orders
CREATE TABLE orders (
    id                 BIGSERIAL PRIMARY KEY,
    code               VARCHAR(20)  NOT NULL,
    user_id            BIGINT REFERENCES users (id) ON DELETE SET NULL,
    sender_name        VARCHAR(100) NOT NULL,
    sender_phone       VARCHAR(20)  NOT NULL,
    sender_email       VARCHAR(255),
    receiver_name      VARCHAR(100) NOT NULL,
    receiver_phone     VARCHAR(20)  NOT NULL,
    delivery_address   VARCHAR(500) NOT NULL,
    delivery_zone_id   BIGINT       NOT NULL REFERENCES delivery_zones (id),
    delivery_date      DATE         NOT NULL,
    delivery_slot      VARCHAR(20)  NOT NULL,
    card_message       VARCHAR(300),
    hide_sender        BOOLEAN      NOT NULL DEFAULT FALSE,
    note               VARCHAR(500),
    subtotal           BIGINT       NOT NULL,
    shipping_fee       BIGINT       NOT NULL,
    discount           BIGINT       NOT NULL DEFAULT 0,
    total              BIGINT       NOT NULL,
    coupon_id          BIGINT REFERENCES coupons (id),
    coupon_code        VARCHAR(50),
    payment_method     VARCHAR(20)  NOT NULL,
    payment_status     VARCHAR(20)  NOT NULL DEFAULT 'UNPAID',
    paid_amount        BIGINT       NOT NULL DEFAULT 0,
    paid_at            TIMESTAMPTZ,
    status             VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    delivery_photo_url VARCHAR(500),
    idempotency_key    VARCHAR(100),
    version            BIGINT       NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_orders_code UNIQUE (code),
    CONSTRAINT uq_orders_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT ck_orders_status CHECK (status IN ('PENDING', 'CONFIRMED', 'ARRANGING', 'DELIVERING', 'DELIVERED', 'CANCELLED')),
    CONSTRAINT ck_orders_payment_method CHECK (payment_method IN ('COD', 'SEPAY')),
    CONSTRAINT ck_orders_payment_status CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED'))
);
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX idx_orders_delivery ON orders (delivery_date, delivery_slot);
-- Job hủy đơn SePay quá hạn thanh toán
CREATE INDEX idx_orders_unpaid_online ON orders (created_at)
    WHERE payment_method = 'SEPAY' AND payment_status = 'UNPAID' AND status = 'PENDING';

-- Số thứ tự đơn trong ngày (FS + yyMMdd + 4 số)
CREATE TABLE order_daily_counters (
    day   DATE PRIMARY KEY,
    value INT NOT NULL
);

CREATE TABLE order_items (
    id           BIGSERIAL PRIMARY KEY,
    order_id     BIGINT       NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    variant_id   BIGINT       NOT NULL REFERENCES product_variants (id),
    product_id   BIGINT       NOT NULL REFERENCES products (id),
    product_name VARCHAR(200) NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    unit_price   BIGINT       NOT NULL,
    quantity     INT          NOT NULL,
    line_total   BIGINT       NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON order_items (order_id);

CREATE TABLE order_status_history (
    id          BIGSERIAL PRIMARY KEY,
    order_id    BIGINT       NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    from_status VARCHAR(20),
    to_status   VARCHAR(20)  NOT NULL,
    changed_by  VARCHAR(255) NOT NULL,
    reason      VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_status_history_order ON order_status_history (order_id);

-- ---------------------------------------------------------- payment (SePay)
CREATE TABLE payment_transactions (
    id               BIGSERIAL PRIMARY KEY,
    provider         VARCHAR(20)  NOT NULL,
    provider_txn_id  VARCHAR(64)  NOT NULL,
    gateway          VARCHAR(100),
    account_number   VARCHAR(50),
    sub_account      VARCHAR(50),
    transfer_type    VARCHAR(10)  NOT NULL,
    amount           BIGINT       NOT NULL,
    content          VARCHAR(1000),
    reference_code   VARCHAR(100),
    transaction_date TIMESTAMPTZ,
    order_id         BIGINT REFERENCES orders (id) ON DELETE SET NULL,
    order_code       VARCHAR(20),
    status           VARCHAR(20)  NOT NULL,
    note             VARCHAR(500),
    raw_payload      TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- SePay có thể gửi lại webhook nhiều lần: chống ghi nhận trùng
    CONSTRAINT uq_payment_transactions_provider_txn UNIQUE (provider, provider_txn_id),
    CONSTRAINT ck_payment_transactions_status CHECK (status IN ('MATCHED', 'PARTIAL', 'UNMATCHED', 'NEEDS_REFUND', 'IGNORED'))
);
CREATE INDEX idx_payment_transactions_status ON payment_transactions (status, created_at DESC);
CREATE INDEX idx_payment_transactions_order ON payment_transactions (order_id);

-- ---------------------------------------------------------- reviews
CREATE TABLE reviews (
    id         BIGSERIAL PRIMARY KEY,
    product_id BIGINT      NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    order_id   BIGINT      NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    rating     INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content    VARCHAR(2000),
    status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_reviews_order_product UNIQUE (order_id, product_id),
    CONSTRAINT ck_reviews_status CHECK (status IN ('PENDING', 'APPROVED', 'HIDDEN'))
);
CREATE INDEX idx_reviews_product_status ON reviews (product_id, status);
