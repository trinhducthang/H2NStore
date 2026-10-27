import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ordersApi } from '../api/orders';
import type { Order } from '../api/types';
import { EmptyState, ErrorBox, FieldError, Loading } from '../components/Feedback';
import { OrderDetailView } from '../components/OrderDetailView';
import { useAsync } from '../hooks/useAsync';
import { isValidPhone, PHONE_MESSAGE } from '../utils/validation';

export function TrackOrderPage() {
  const [params, setParams] = useSearchParams();
  const code = (params.get('code') ?? '').trim().toUpperCase();
  const phone = (params.get('phone') ?? '').trim();
  const [codeInput, setCodeInput] = useState(code);
  const [phoneInput, setPhoneInput] = useState(phone);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCodeInput(code);
    setPhoneInput(phone);
  }, [code, phone]);

  const result = useAsync<Order | null>(
    () => (code && phone ? ordersApi.track(code, phone) : Promise.resolve(null)),
    [code, phone],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) {
      setFormError('Vui lòng nhập mã đơn');
      return;
    }
    if (!isValidPhone(phoneInput)) {
      setFormError(PHONE_MESSAGE);
      return;
    }
    setFormError(null);
    setParams({ code: codeInput.trim().toUpperCase(), phone: phoneInput.trim() });
  };

  const order = result.data;
  const canPay = order && order.paymentMethod === 'SEPAY' && order.paymentStatus === 'UNPAID' && order.status === 'PENDING';

  return (
    <div className="container section">
      <div className="page-head">
        <h1>Tra cứu đơn hàng</h1>
        <p className="muted">Nhập mã đơn (VD: FS2610230001) và số điện thoại đặt hàng hoặc người nhận.</p>
      </div>

      <form className="card track-form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Mã đơn</span>
          <input value={codeInput} placeholder="FS..." onChange={(e) => setCodeInput(e.target.value.toUpperCase())} />
        </label>
        <label className="field">
          <span className="field-label">Số điện thoại</span>
          <input type="tel" value={phoneInput} placeholder="0912345678" onChange={(e) => setPhoneInput(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary">
          Tra cứu
        </button>
        <FieldError message={formError} />
      </form>

      {code && phone && result.loading && <Loading />}
      {result.errorStatus === 404 && (
        <EmptyState icon="🔎" title="Không tìm thấy đơn hàng">
          Mã đơn hoặc số điện thoại chưa đúng. Hãy kiểm tra lại tin nhắn/email xác nhận.
        </EmptyState>
      )}
      {result.error && result.errorStatus !== 404 && <ErrorBox message={result.error} onRetry={result.reload} />}
      {order && !result.error && (
        <OrderDetailView
          order={order}
          actions={
            canPay ? (
              <Link to={`/payment/${order.code}?phone=${encodeURIComponent(phone)}`} className="btn btn-primary">
                Thanh toán chuyển khoản ngay
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
