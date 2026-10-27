// Kiểu dữ liệu khớp với các DTO record của backend (com.flowershop.**.dto).
// Backend bật default-property-inclusion=non_null nên trường null sẽ bị bỏ khỏi JSON -> khai báo optional.

// ------------------------------------------------------------------ chung

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  errors?: ApiFieldError[] | null;
  traceId?: string | null;
  timestamp?: string | null;
}

// ------------------------------------------------------------------ user / auth

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  role: Role;
  enabled: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
}

export interface UpdateProfileRequest {
  fullName: string;
  phone?: string | null;
}

export interface Address {
  id: number;
  receiverName: string;
  receiverPhone: string;
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  isDefault?: boolean;
}

export interface AddressRequest {
  receiverName: string;
  receiverPhone: string;
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  isDefault: boolean;
}

export interface AdminCreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  role: Role;
}

// ------------------------------------------------------------------ catalog

export type CategoryType = 'DEPARTMENT' | 'OCCASION' | 'FLOWER_TYPE' | 'STYLE';
export type ProductStatus = 'ACTIVE' | 'HIDDEN' | 'OUT_OF_STOCK';

export interface Category {
  id: number;
  name: string;
  slug: string;
  type: CategoryType;
  parentId?: number | null;
  sortOrder: number;
  active: boolean;
  children?: Category[] | null;
}

export interface CategoryRef {
  id: number;
  name: string;
  slug: string;
  type: CategoryType;
}

export interface ProductSummary {
  id: number;
  name: string;
  slug: string;
  status: ProductStatus;
  soldCount: number;
  thumbnailUrl?: string | null;
  /** Giá bán thấp nhất */
  price?: number | null;
  /** Giá gốc nếu đang giảm giá */
  compareAtPrice?: number | null;
}

export interface Variant {
  id: number;
  name: string;
  sku: string;
  price: number;
  salePrice?: number | null;
  effectivePrice: number;
  stock: number;
  active: boolean;
}

export interface ProductImage {
  id: number;
  url: string;
  sortOrder: number;
  thumbnail: boolean;
}

export interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  status: ProductStatus;
  soldCount: number;
  categories: CategoryRef[];
  variants: Variant[];
  images: ProductImage[];
  ratingAvg?: number | null;
  ratingCount?: number | null;
}

export interface AdminProductSummary {
  id: number;
  name: string;
  slug: string;
  status: ProductStatus;
  soldCount: number;
  thumbnailUrl?: string | null;
  minPrice?: number | null;
  totalStock: number;
  variantCount: number;
  updatedAt: string;
}

export interface VariantRequest {
  id?: number | null;
  name: string;
  sku: string;
  price: number;
  salePrice?: number | null;
  stock: number;
  active: boolean;
}

export interface ProductUpsertRequest {
  name: string;
  slug?: string | null;
  description?: string | null;
  status: ProductStatus;
  categoryIds: number[];
  variants: VariantRequest[];
}

export interface CategoryRequest {
  name: string;
  slug?: string | null;
  type: CategoryType;
  parentId?: number | null;
  sortOrder?: number | null;
  active: boolean;
}

// ------------------------------------------------------------------ reviews

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'HIDDEN';

export type ReviewMediaType = 'IMAGE' | 'VIDEO';

export interface ReviewMedia {
  id: number;
  type: ReviewMediaType;
  url: string;
}

export interface Review {
  id: number;
  productId: number;
  /** product*, orderCode: chỉ có ở trang của khách và admin */
  productName?: string | null;
  /** null nếu sản phẩm đã ẩn/xóa */
  productSlug?: string | null;
  productThumbnail?: string | null;
  /** Phân loại đã mua, VD "Tiêu chuẩn" */
  variantName?: string | null;
  authorName: string;
  rating: number;
  content?: string | null;
  media?: ReviewMedia[];
  reply?: string | null;
  repliedAt?: string | null;
  status: ReviewStatus;
  edited: boolean;
  /** Chỉ có ở trang của khách: còn được sửa (1 lần) không, và hạn sửa */
  editable?: boolean;
  editableUntil?: string | null;
  orderCode?: string | null;
  createdAt: string;
}

/** Sản phẩm đã giao, chưa đánh giá, còn hạn */
export interface PendingReview {
  orderCode: string;
  productId: number;
  productName: string;
  productSlug?: string | null;
  thumbnailUrl?: string | null;
  variantName?: string | null;
  deliveredAt: string;
  deadline: string;
}

export interface CreateReviewRequest {
  orderCode: string;
  productId: number;
  rating: number;
  content?: string | null;
}

export interface UpdateReviewRequest {
  rating: number;
  content?: string | null;
  /** Ảnh/video cũ giữ lại */
  keepMediaIds: number[];
}

/** distribution: số sao ("1".."5") -> số đánh giá; withMedia: số đánh giá có ảnh/video */
export interface RatingBreakdown {
  average?: number | null;
  count: number;
  distribution: Record<string, number>;
  withMedia: number;
}

// ------------------------------------------------------------------ delivery

export type DeliverySlot = 'SLOT_08_10' | 'SLOT_10_12' | 'SLOT_14_16' | 'SLOT_16_18' | 'SLOT_18_20' | 'EXPRESS';

export interface DeliveryZone {
  id: number;
  name: string;
  districts?: string | null;
  shippingFee: number;
  expressFee?: number | null;
  expressAvailable: boolean;
  active: boolean;
}

export interface ZoneRequest {
  name: string;
  districts?: string | null;
  shippingFee: number;
  expressFee?: number | null;
  active: boolean;
}

export interface SlotAvailability {
  slot: DeliverySlot;
  label: string;
  startHour?: number | null;
  endHour?: number | null;
  available: boolean;
  remaining: number;
  reason?: string | null;
}

/** Địa chỉ tại tọa độ GPS, cùng dạng với sổ địa chỉ (district chỉ có ở vùng bản đồ chưa theo ĐVHC mới) */
export interface LocationAddress extends Partial<Pick<Address, 'addressLine' | 'ward' | 'district' | 'city'>> {
  lat: number;
  lng: number;
}

// ------------------------------------------------------------------ coupons

export type CouponType = 'PERCENT' | 'FIXED';

export interface ValidateCouponResponse {
  code: string;
  type: CouponType;
  value: number;
  discount: number;
}

export interface Coupon {
  id: number;
  code: string;
  type: CouponType;
  value: number;
  maxDiscount?: number | null;
  minOrder: number;
  usageLimit?: number | null;
  usedCount: number;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
  createdAt: string;
}

export interface CouponRequest {
  code: string;
  type: CouponType;
  value: number;
  maxDiscount?: number | null;
  minOrder?: number | null;
  usageLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
}

// ------------------------------------------------------------------ cart

export interface CartItem {
  id: number;
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  variantName: string;
  thumbnailUrl?: string | null;
  unitPrice: number;
  originalPrice?: number | null;
  quantity: number;
  lineTotal: number;
  stock: number;
  available: boolean;
}

export interface CartResponse {
  items: CartItem[];
  subtotal: number;
  totalQuantity: number;
}

export interface CartItemInput {
  variantId: number;
  quantity: number;
}

// ------------------------------------------------------------------ orders

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'ARRANGING' | 'DELIVERING' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'COD' | 'SEPAY';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export interface OrderItemInput {
  variantId: number;
  quantity: number;
}

export interface CreateOrderRequest {
  items: OrderItemInput[];
  sender: { name: string; phone: string; email?: string | null };
  receiver: { name: string; phone: string };
  deliveryAddress: string;
  deliveryZoneId: number;
  deliveryDate: string;
  deliverySlot: DeliverySlot;
  cardMessage?: string | null;
  hideSender: boolean;
  couponCode?: string | null;
  paymentMethod: PaymentMethod;
  note?: string | null;
}

export interface PreviewOrderRequest {
  items: OrderItemInput[];
  deliveryZoneId?: number | null;
  deliveryDate?: string | null;
  deliverySlot?: DeliverySlot | null;
  couponCode?: string | null;
}

export interface OrderLine {
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface PreviewOrderResponse {
  items: OrderLine[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode?: string | null;
  couponError?: string | null;
}

/** Thông tin chuyển khoản SePay (VietQR) */
export interface BankTransferInfo {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  content: string;
  qrUrl: string;
  expiresAt: string;
}

export interface OrderCreatedResponse {
  code: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  bankTransferInfo?: BankTransferInfo | null;
}

export interface Party {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface OrderHistory {
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string;
  reason?: string | null;
  createdAt: string;
}

export interface Order {
  code: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  paidAt?: string | null;
  sender: Party;
  receiver: Party;
  hideSender: boolean;
  deliveryAddress: string;
  deliveryZone: { id: number; name: string };
  deliveryDate: string;
  deliverySlot: DeliverySlot;
  deliverySlotLabel?: string | null;
  cardMessage?: string | null;
  note?: string | null;
  items: OrderLine[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode?: string | null;
  deliveryPhotoUrl?: string | null;
  cancellable: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  history?: OrderHistory[] | null;
  bankTransferInfo?: BankTransferInfo | null;
}

export interface OrderSummary {
  code: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  deliveryDate: string;
  deliverySlot: DeliverySlot;
  total: number;
  itemCount: number;
  firstItemName?: string | null;
  createdAt: string;
}

export interface PaymentStatusResponse {
  code: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  paidAmount: number;
  paidAt?: string | null;
  bankTransferInfo?: BankTransferInfo | null;
}

// ------------------------------------------------------------------ payment (SePay) admin

export type TransactionStatus = 'MATCHED' | 'PARTIAL' | 'UNMATCHED' | 'NEEDS_REFUND' | 'IGNORED';

export interface PaymentTransaction {
  id: number;
  provider: string;
  providerTxnId: string;
  gateway?: string | null;
  accountNumber?: string | null;
  subAccount?: string | null;
  transferType: string;
  amount: number;
  content?: string | null;
  referenceCode?: string | null;
  transactionDate?: string | null;
  orderCode?: string | null;
  status: TransactionStatus;
  note?: string | null;
  createdAt: string;
}

// ------------------------------------------------------------------ banner trang chủ

/** Banner đang hiển thị (API công khai). */
export interface PublicBanner {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  buttonText?: string | null;
  linkUrl?: string | null;
  imageUrl: string;
  /** Phần ảnh hiển thị khi khung cắt bớt ảnh (object-position %), 50/50 = giữa ảnh */
  imagePositionX: number;
  imagePositionY: number;
}

export type BannerDisplayStatus = 'SHOWING' | 'INACTIVE' | 'NO_IMAGE' | 'SCHEDULED' | 'EXPIRED';

export interface Banner {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  buttonText?: string | null;
  linkUrl?: string | null;
  imageUrl?: string | null;
  imagePositionX: number;
  imagePositionY: number;
  sortOrder: number;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  displayStatus: BannerDisplayStatus;
  updatedAt: string;
}

export interface BannerRequest {
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  imagePositionX: number;
  imagePositionY: number;
  sortOrder: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

// ------------------------------------------------------------------ reports

export interface ReportSummary {
  from: string;
  to: string;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  revenue: number;
  paidRevenue: number;
  averageOrderValue: number;
  byStatus: Partial<Record<OrderStatus, number>>;
  byDay: { date: string; orders: number; revenue: number }[];
  topProducts: { productId: number; productName: string; quantity: number; revenue: number }[];
}
