import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { accountApi, formatAddress, isDefaultAddress } from '../api/account';
import { catalogApi } from '../api/catalog';
import { ApiError, errorMessage } from '../api/client';
import { ordersApi } from '../api/orders';
import type { Address, DeliverySlot, PaymentMethod, PreviewOrderResponse } from '../api/types';
import { EmptyState, ErrorBox, FieldError, Loading } from '../components/Feedback';
import { ProductThumb } from '../components/ProductThumb';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useAsync, useDebouncedValue } from '../hooks/useAsync';
import { addDays, formatVnd, todayVN } from '../utils/format';
import { cleanPhone, EMAIL_REGEX, isValidPhone, PHONE_MESSAGE, uuid } from '../utils/validation';

interface CheckoutForm {
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  receiverName: string;
  receiverPhone: string;
  deliveryAddress: string;
  deliveryZoneId: number | null;
  deliveryDate: string;
  deliverySlot: DeliverySlot | null;
  cardMessage: string;
  hideSender: boolean;
  note: string;
  paymentMethod: PaymentMethod;
}

type Errors = Record<string, string>;

const MAX_DAYS_AHEAD = 30;

/** Tên field trong form -> tên field lỗi backend trả về (VD "sender.phone") */
const ERROR_KEYS: Partial<Record<keyof CheckoutForm, string>> = {
  senderName: 'sender.name',
  senderPhone: 'sender.phone',
  senderEmail: 'sender.email',
  receiverName: 'receiver.name',
  receiverPhone: 'receiver.phone',
};

function withoutKeys(errors: Errors, keys: string[]): Errors {
  if (!keys.some((k) => k in errors)) return errors;
  const next = { ...errors };
  keys.forEach((k) => delete next[k]);
  return next;
}

function validate(form: CheckoutForm): Errors {
  const e: Errors = {};
  if (!form.senderName.trim()) e['sender.name'] = 'Vui lòng nhập tên người gửi';
  if (!isValidPhone(form.senderPhone)) e['sender.phone'] = PHONE_MESSAGE;
  if (form.senderEmail.trim() && !EMAIL_REGEX.test(form.senderEmail.trim())) e['sender.email'] = 'Email không hợp lệ';
  if (!form.receiverName.trim()) e['receiver.name'] = 'Vui lòng nhập tên người nhận';
  if (!isValidPhone(form.receiverPhone)) e['receiver.phone'] = PHONE_MESSAGE;
  if (!form.deliveryAddress.trim()) e.deliveryAddress = 'Vui lòng nhập địa chỉ giao hàng';
  if (!form.deliveryZoneId) e.deliveryZoneId = 'Vui lòng chọn khu vực giao';
  if (!form.deliveryDate) e.deliveryDate = 'Vui lòng chọn ngày giao';
  if (!form.deliverySlot) e.deliverySlot = 'Vui lòng chọn khung giờ giao';
  if (form.cardMessage.length > 300) e.cardMessage = 'Lời nhắn tối đa 300 ký tự';
  if (form.note.length > 500) e.note = 'Ghi chú tối đa 500 ký tự';
  return e;
}

export function CheckoutPage() {
  const { user, ready } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const today = todayVN();

  const [form, setForm] = useState<CheckoutForm>({
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    receiverName: '',
    receiverPhone: '',
    deliveryAddress: '',
    deliveryZoneId: null,
    deliveryDate: today,
    deliverySlot: null,
    cardMessage: '',
    hideSender: false,
    note: '',
    paymentMethod: 'COD',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewOrderResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | ''>('');

  // Sửa field nào thì ẩn lỗi của field đó
  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => withoutKeys(e, [ERROR_KEYS[key] ?? key]));
  };

  // ------------------------------------------------------------------ giỏ hàng -> items
  const lines = useMemo(() => cart.lines.filter((l) => l.available), [cart.lines]);
  const excludedCount = cart.lines.length - lines.length;
  const items = useMemo(() => lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), [lines]);
  const itemsKey = JSON.stringify(items);

  // Idempotency-Key: giữ nguyên khi bấm đặt lại (VD mạng chập chờn), chỉ đổi khi giỏ hàng thay đổi
  const idempotencyKey = useRef<string>(uuid());
  useEffect(() => {
    idempotencyKey.current = uuid();
  }, [itemsKey]);

  // ------------------------------------------------------------------ dữ liệu tham chiếu
  const zones = useAsync(() => catalogApi.zones(), []);
  const slots = useAsync(
    () => (form.deliveryDate ? catalogApi.slots(form.deliveryDate, form.deliveryZoneId) : Promise.resolve([])),
    [form.deliveryDate, form.deliveryZoneId],
  );
  const addresses = useAsync<Address[]>(
    () => (user ? accountApi.addresses() : Promise.resolve([])),
    [user?.id],
  );

  // Điền sẵn người gửi từ tài khoản
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      senderName: f.senderName || user.fullName,
      senderPhone: f.senderPhone || user.phone || '',
      senderEmail: f.senderEmail || user.email,
    }));
  }, [user]);

  const applyAddress = (a: Address) => {
    setSelectedAddressId(a.id);
    setForm((f) => ({
      ...f,
      receiverName: a.receiverName,
      receiverPhone: a.receiverPhone,
      deliveryAddress: formatAddress(a),
    }));
    setErrors((e) => withoutKeys(e, ['receiver.name', 'receiver.phone', 'deliveryAddress']));
  };

  // Điền sẵn địa chỉ mặc định (một lần, và chỉ khi người dùng chưa tự nhập)
  const addressPrefilled = useRef(false);
  useEffect(() => {
    const list = addresses.data;
    if (!list || list.length === 0 || addressPrefilled.current) return;
    addressPrefilled.current = true;
    if (form.receiverName || form.deliveryAddress) return;
    applyAddress(list.find(isDefaultAddress) ?? list[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.data]);

  // Khung giờ đã chọn không còn hợp lệ khi đổi ngày/khu vực -> bỏ chọn
  useEffect(() => {
    if (!slots.data || !form.deliverySlot) return;
    const current = slots.data.find((s) => s.slot === form.deliverySlot);
    if (!current || !current.available) set('deliverySlot', null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.data]);

  // ------------------------------------------------------------------ tính tiền ở server (preview)
  const previewInput = useDebouncedValue(
    JSON.stringify({
      items,
      deliveryZoneId: form.deliveryZoneId,
      deliverySlot: form.deliverySlot,
      couponCode: appliedCoupon,
    }),
    300,
  );

  useEffect(() => {
    const input = JSON.parse(previewInput) as {
      items: { variantId: number; quantity: number }[];
      deliveryZoneId: number | null;
      deliverySlot: DeliverySlot | null;
      couponCode: string | null;
    };
    if (input.items.length === 0) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    setPreviewLoading(true);
    ordersApi
      .preview(input, controller.signal)
      .then((res) => {
        setPreview(res);
        setPreviewError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setPreviewError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });
    return () => controller.abort();
  }, [previewInput]);

  // ------------------------------------------------------------------ đặt hàng
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) {
      setSubmitError('Vui lòng kiểm tra lại các thông tin được đánh dấu');
      document.querySelector('.field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (items.length === 0) return;
    const couponValid = appliedCoupon && preview && !preview.couponError ? appliedCoupon : null;
    setSubmitting(true);
    try {
      const res = await ordersApi.create(
        {
          items,
          sender: {
            name: form.senderName.trim(),
            phone: cleanPhone(form.senderPhone),
            email: form.senderEmail.trim() || null,
          },
          receiver: { name: form.receiverName.trim(), phone: cleanPhone(form.receiverPhone) },
          deliveryAddress: form.deliveryAddress.trim(),
          deliveryZoneId: form.deliveryZoneId!,
          deliveryDate: form.deliveryDate,
          deliverySlot: form.deliverySlot!,
          cardMessage: form.cardMessage.trim() || null,
          hideSender: form.hideSender,
          couponCode: couponValid,
          paymentMethod: form.paymentMethod,
          note: form.note.trim() || null,
        },
        idempotencyKey.current,
      );
      idempotencyKey.current = uuid();
      const phone = encodeURIComponent(cleanPhone(form.senderPhone));
      const target =
        res.paymentMethod === 'SEPAY' && res.paymentStatus === 'UNPAID'
          ? `/payment/${res.code}?phone=${phone}`
          : `/order-success/${res.code}?phone=${phone}`;
      navigate(target, { replace: true });
      void cart.clearOrdered();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors());
        setSubmitError(err.message);
        if (err.code === 'SLOT_FULL' || err.code === 'INVALID_DELIVERY_TIME') slots.reload();
        if (err.code === 'OUT_OF_STOCK') void cart.reload();
      } else {
        setSubmitError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------ render
  if (!ready || (cart.loading && cart.lines.length === 0)) return <Loading />;

  if (lines.length === 0) {
    return (
      <div className="container section">
        <EmptyState icon="🛒" title="Chưa có sản phẩm để đặt hàng" action={{ to: '/products', label: 'Mua sắm ngay' }} />
      </div>
    );
  }

  const selectedZone = zones.data?.find((z) => z.id === form.deliveryZoneId);

  return (
    <div className="container section">
      <div className="page-head">
        <h1>Đặt hàng</h1>
        {!user && (
          <p className="muted">
            Đã có tài khoản? <Link to="/login?redirect=%2Fcheckout">Đăng nhập</Link> để dùng sổ địa chỉ.
          </p>
        )}
      </div>

      <form className="checkout-layout" onSubmit={submit} noValidate>
        <div className="checkout-main">
          {/* ---------------------------------------------------- người gửi */}
          <section className="card">
            <h2 className="card-title">1. Người gửi</h2>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">
                  Họ tên <span className="required">*</span>
                </span>
                <input
                  value={form.senderName}
                  maxLength={100}
                  autoComplete="name"
                  onChange={(e) => set('senderName', e.target.value)}
                />
                <FieldError message={errors['sender.name']} />
              </label>
              <label className="field">
                <span className="field-label">
                  Số điện thoại <span className="required">*</span>
                </span>
                <input
                  type="tel"
                  value={form.senderPhone}
                  autoComplete="tel"
                  placeholder="0912345678"
                  onChange={(e) => set('senderPhone', e.target.value)}
                />
                <FieldError message={errors['sender.phone']} />
              </label>
              <label className="field field-full">
                <span className="field-label">Email (nhận xác nhận đơn)</span>
                <input
                  type="email"
                  value={form.senderEmail}
                  autoComplete="email"
                  onChange={(e) => set('senderEmail', e.target.value)}
                />
                <FieldError message={errors['sender.email']} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={form.hideSender} onChange={(e) => set('hideSender', e.target.checked)} />
              <span>Giấu tên người gửi với người nhận</span>
            </label>
          </section>

          {/* ---------------------------------------------------- người nhận */}
          <section className="card">
            <h2 className="card-title">2. Người nhận & địa chỉ</h2>
            {addresses.data && addresses.data.length > 0 && (
              <label className="field">
                <span className="field-label">Chọn từ sổ địa chỉ</span>
                <select
                  value={selectedAddressId}
                  onChange={(e) => {
                    const a = addresses.data?.find((x) => x.id === Number(e.target.value));
                    if (a) applyAddress(a);
                    else setSelectedAddressId('');
                  }}
                >
                  <option value="">— Nhập địa chỉ mới —</option>
                  {addresses.data.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.receiverName} · {formatAddress(a)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="form-grid">
              <label className="field">
                <span className="field-label">
                  Tên người nhận <span className="required">*</span>
                </span>
                <input
                  value={form.receiverName}
                  maxLength={100}
                  onChange={(e) => set('receiverName', e.target.value)}
                />
                <FieldError message={errors['receiver.name']} />
              </label>
              <label className="field">
                <span className="field-label">
                  SĐT người nhận <span className="required">*</span>
                </span>
                <input
                  type="tel"
                  value={form.receiverPhone}
                  onChange={(e) => set('receiverPhone', e.target.value)}
                />
                <FieldError message={errors['receiver.phone']} />
              </label>
              <label className="field field-full">
                <span className="field-label">
                  Địa chỉ giao <span className="required">*</span>
                </span>
                <input
                  value={form.deliveryAddress}
                  maxLength={500}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện"
                  onChange={(e) => set('deliveryAddress', e.target.value)}
                />
                <FieldError message={errors.deliveryAddress} />
              </label>
            </div>

            <p className="field-label">
              Khu vực giao <span className="required">*</span>
            </p>
            {zones.loading && !zones.data && <Loading />}
            {zones.error && <ErrorBox message={zones.error} onRetry={zones.reload} />}
            <div className="option-cards">
              {zones.data?.map((z) => (
                <label key={z.id} className={`option-card ${form.deliveryZoneId === z.id ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="zone"
                    checked={form.deliveryZoneId === z.id}
                    onChange={() => set('deliveryZoneId', z.id)}
                  />
                  <div>
                    <div className="option-head">
                      <strong>{z.name}</strong>
                      <span className="option-price">{formatVnd(z.shippingFee)}</span>
                    </div>
                    {z.districts && <p className="muted small">{z.districts}</p>}
                    {z.expressAvailable && (
                      <p className="small accent">Có giao nhanh 2-3 giờ: {formatVnd(z.expressFee)}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <FieldError message={errors.deliveryZoneId} />
          </section>

          {/* ---------------------------------------------------- thời gian giao */}
          <section className="card">
            <h2 className="card-title">3. Thời gian giao</h2>
            <label className="field field-narrow">
              <span className="field-label">
                Ngày giao <span className="required">*</span>
              </span>
              <input
                type="date"
                value={form.deliveryDate}
                min={today}
                max={addDays(today, MAX_DAYS_AHEAD)}
                onChange={(e) => set('deliveryDate', e.target.value)}
              />
              <FieldError message={errors.deliveryDate} />
            </label>
            <p className="field-label">
              Khung giờ <span className="required">*</span>
            </p>
            {!form.deliveryZoneId && <p className="muted small">Chọn khu vực giao để biết có giao nhanh hay không.</p>}
            {slots.loading && !slots.data && <Loading text="Đang tải khung giờ..." />}
            {slots.error && <ErrorBox message={slots.error} onRetry={slots.reload} />}
            <div className="slot-grid">
              {slots.data?.map((s) => (
                <label
                  key={s.slot}
                  className={`slot ${form.deliverySlot === s.slot ? 'selected' : ''} ${s.available ? '' : 'disabled'}`}
                  title={s.reason ?? undefined}
                >
                  <input
                    type="radio"
                    name="slot"
                    disabled={!s.available}
                    checked={form.deliverySlot === s.slot}
                    onChange={() => set('deliverySlot', s.slot)}
                  />
                  <strong>{s.label}</strong>
                  <span className="small muted">
                    {s.available ? (s.remaining <= 3 ? `Còn ${s.remaining} chỗ` : 'Còn nhận') : s.reason}
                  </span>
                </label>
              ))}
            </div>
            <FieldError message={errors.deliverySlot} />
            {selectedZone && form.deliverySlot === 'EXPRESS' && (
              <p className="small muted">Phí giao nhanh: {formatVnd(selectedZone.expressFee)}</p>
            )}
          </section>

          {/* ---------------------------------------------------- thiệp, ghi chú */}
          <section className="card">
            <h2 className="card-title">4. Thiệp & ghi chú</h2>
            <label className="field">
              <span className="field-label">Lời nhắn trên thiệp</span>
              <textarea
                rows={3}
                maxLength={300}
                value={form.cardMessage}
                placeholder="VD: Chúc mừng sinh nhật! Mãi yêu ❤"
                onChange={(e) => set('cardMessage', e.target.value)}
              />
              <span className="char-count">{form.cardMessage.length}/300</span>
              <FieldError message={errors.cardMessage} />
            </label>
            <label className="field">
              <span className="field-label">Ghi chú cho shop</span>
              <textarea
                rows={2}
                maxLength={500}
                value={form.note}
                placeholder="VD: Gọi trước khi giao"
                onChange={(e) => set('note', e.target.value)}
              />
              <FieldError message={errors.note} />
            </label>
          </section>

          {/* ---------------------------------------------------- thanh toán */}
          <section className="card">
            <h2 className="card-title">5. Thanh toán</h2>
            <div className="option-cards">
              <label className={`option-card ${form.paymentMethod === 'COD' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={form.paymentMethod === 'COD'}
                  onChange={() => set('paymentMethod', 'COD')}
                />
                <div>
                  <strong>💵 COD – thanh toán khi nhận hàng</strong>
                  <p className="muted small">Trả tiền mặt cho nhân viên giao hàng.</p>
                </div>
              </label>
              <label className={`option-card ${form.paymentMethod === 'SEPAY' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={form.paymentMethod === 'SEPAY'}
                  onChange={() => set('paymentMethod', 'SEPAY')}
                />
                <div>
                  <strong>📱 SEPAY – chuyển khoản QR (tự xác nhận)</strong>
                  <p className="muted small">
                    Quét mã VietQR bằng app ngân hàng. Hệ thống nhận tiền qua SePay và xác nhận đơn tự động trong vài
                    giây.
                  </p>
                </div>
              </label>
            </div>
            <FieldError message={errors.paymentMethod} />
          </section>
        </div>

        {/* ---------------------------------------------------- tóm tắt */}
        <aside className="checkout-summary">
          <div className="card summary-card sticky">
            <h2 className="card-title">Đơn hàng ({lines.length})</h2>
            {excludedCount > 0 && (
              <p className="alert alert-warning small">
                {excludedCount} sản phẩm hết hàng đã được bỏ qua. <Link to="/cart">Xem giỏ</Link>
              </p>
            )}
            <ul className="summary-lines">
              {lines.map((l) => (
                <li key={l.variantId}>
                  <ProductThumb url={l.thumbnailUrl} alt={l.productName} className="summary-thumb" />
                  <div>
                    <p>{l.productName}</p>
                    <p className="muted small">
                      {l.variantName} × {l.quantity}
                    </p>
                  </div>
                  <span>{formatVnd(preview?.items.find((i) => i.variantId === l.variantId)?.lineTotal ?? l.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="coupon-box">
              {appliedCoupon ? (
                <div className="coupon-applied">
                  <span>
                    Mã <strong>{appliedCoupon}</strong>
                    {preview?.couponError ? '' : ` · giảm ${formatVnd(preview?.discount ?? 0)}`}
                  </span>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponInput('');
                    }}
                  >
                    Bỏ mã
                  </button>
                </div>
              ) : (
                <div className="input-group">
                  <input
                    value={couponInput}
                    placeholder="Mã giảm giá"
                    maxLength={50}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (couponInput.trim()) setAppliedCoupon(couponInput.trim());
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={!couponInput.trim()}
                    onClick={() => setAppliedCoupon(couponInput.trim())}
                  >
                    Áp dụng
                  </button>
                </div>
              )}
              {preview?.couponError && <p className="field-error">{preview.couponError}</p>}
              <FieldError message={errors.couponCode} />
            </div>

            {previewError && <p className="field-error">{previewError}</p>}
            <dl className={`totals ${previewLoading ? 'is-refreshing' : ''}`}>
              <dt>Tạm tính</dt>
              <dd>{formatVnd(preview?.subtotal ?? cart.subtotal)}</dd>
              <dt>Phí giao hàng</dt>
              <dd>{form.deliveryZoneId ? formatVnd(preview?.shippingFee ?? 0) : <span className="muted">Chọn khu vực</span>}</dd>
              {(preview?.discount ?? 0) > 0 && (
                <>
                  <dt>Giảm giá</dt>
                  <dd className="accent">-{formatVnd(preview?.discount)}</dd>
                </>
              )}
              <dt className="total-label">Tổng thanh toán</dt>
              <dd className="total-value">{formatVnd(preview?.total ?? cart.subtotal)}</dd>
            </dl>

            {submitError && <div className="alert alert-error">{submitError}</div>}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting}>
              {submitting
                ? 'Đang đặt hàng...'
                : form.paymentMethod === 'SEPAY'
                  ? 'Đặt hàng & lấy mã QR'
                  : 'Đặt hàng'}
            </button>
            <p className="muted small center">Giá được tính lại ở máy chủ khi đặt hàng.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
