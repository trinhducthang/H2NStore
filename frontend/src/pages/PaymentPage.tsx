import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, errorMessage } from '../api/client';
import { ordersApi } from '../api/orders';
import type { BankTransferInfo, PaymentStatusResponse } from '../api/types';
import { CopyButton } from '../components/CopyButton';
import { EmptyState, ErrorBox, Loading } from '../components/Feedback';
import { SHOP_HOTLINE } from '../config';
import { formatDateTime, formatVnd } from '../utils/format';

const POLL_INTERVAL_MS = 3000;

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function PhoneForm({ onSubmit }: { onSubmit: (phone: string) => void }) {
  const [phone, setPhone] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (phone.trim()) onSubmit(phone.trim());
  };
  return (
    <form className="card narrow form" onSubmit={submit}>
      <h2 className="card-title">Nhập số điện thoại người gửi</h2>
      <p className="muted">Để xem thông tin thanh toán, vui lòng nhập số điện thoại đã dùng khi đặt hàng.</p>
      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912345678" />
      <button type="submit" className="btn btn-primary">
        Xem thanh toán
      </button>
    </form>
  );
}

function TransferRow({ label, value, copy, highlight = false }: { label: string; value: string; copy?: string; highlight?: boolean }) {
  return (
    <div className={`transfer-row ${highlight ? 'highlight' : ''}`}>
      <div>
        <p className="muted small">{label}</p>
        <p className="transfer-value">{value}</p>
      </div>
      {copy !== undefined && <CopyButton text={copy} />}
    </div>
  );
}

export function PaymentPage() {
  const { code = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const phone = params.get('phone') ?? '';

  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [transfer, setTransfer] = useState<BankTransferInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [expired, setExpired] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const finishedRef = useRef(false);

  // ------------------------------------------------------------------ hỏi trạng thái mỗi 3 giây
  useEffect(() => {
    if (!code || !phone) return;
    let stopped = false;
    let timer: number | undefined;
    finishedRef.current = false;

    const tick = async () => {
      try {
        const res = await ordersApi.paymentStatus(code, phone);
        if (stopped) return;
        setStatus(res);
        setError(null);
        if (res.bankTransferInfo) setTransfer(res.bankTransferInfo);
        const done = res.paymentMethod !== 'SEPAY' || res.paymentStatus !== 'UNPAID' || res.status === 'CANCELLED';
        if (done) {
          finishedRef.current = true;
          return;
        }
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          finishedRef.current = true;
          return;
        }
        // Lỗi mạng tạm thời: báo nhưng vẫn tiếp tục hỏi
        setError(errorMessage(err));
      }
      if (!stopped && !finishedRef.current) timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [code, phone]);

  // ------------------------------------------------------------------ đếm ngược
  const waiting = !!transfer && !expired && status?.paymentStatus === 'UNPAID' && status.status !== 'CANCELLED';
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [waiting]);

  const remainingMs = transfer ? new Date(transfer.expiresAt).getTime() - now : 0;

  useEffect(() => {
    if (!transfer || expired || finishedRef.current || remainingMs > 0) return;
    // Hết giờ: hỏi lần cuối phòng khi tiền vừa về sát giờ
    finishedRef.current = true;
    ordersApi
      .paymentStatus(code, phone)
      .then((res) => {
        setStatus(res);
        if (res.paymentStatus === 'UNPAID') setExpired(true);
      })
      .catch(() => setExpired(true));
  }, [remainingMs, transfer, expired, code, phone]);

  // ------------------------------------------------------------------ render
  if (!phone) {
    return (
      <div className="container section">
        <PhoneForm onSubmit={(p) => setParams({ phone: p })} />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="container section">
        <EmptyState icon="🔎" title="Không tìm thấy đơn hàng" action={{ to: '/track', label: 'Tra cứu đơn' }}>
          Kiểm tra lại mã đơn và số điện thoại người gửi.
        </EmptyState>
      </div>
    );
  }
  if (!status) {
    return error ? (
      <div className="container section">
        <ErrorBox message={error} />
      </div>
    ) : (
      <Loading text="Đang tải thông tin thanh toán..." />
    );
  }

  const trackLink = `/track?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`;

  if (status.paymentStatus === 'PAID') {
    return (
      <div className="container section">
        <div className="card result-card success">
          <div className="result-icon" aria-hidden="true">
            ✅
          </div>
          <h1>Thanh toán thành công!</h1>
          <p>
            Shop đã nhận <strong>{formatVnd(status.paidAmount)}</strong> cho đơn <strong>{status.code}</strong>
            {status.paidAt && <> lúc {formatDateTime(status.paidAt)}</>}.
          </p>
          <p className="muted">Shop sẽ xác nhận và chuẩn bị đơn cho bạn. Cảm ơn bạn đã mua hàng!</p>
          <div className="result-actions">
            <Link to={trackLink} className="btn btn-primary">
              Theo dõi đơn hàng
            </Link>
            <Link to="/products" className="btn btn-outline">
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status.paymentMethod !== 'SEPAY') {
    return (
      <div className="container section">
        <div className="card result-card">
          <h1>Đơn {status.code}</h1>
          <p>Đơn này thanh toán khi nhận hàng (COD), không cần chuyển khoản.</p>
          <Link to={trackLink} className="btn btn-primary">
            Xem đơn hàng
          </Link>
        </div>
      </div>
    );
  }

  if (status.status === 'CANCELLED' || expired || status.paymentStatus === 'REFUNDED') {
    return (
      <div className="container section">
        <div className="card result-card warning">
          <div className="result-icon" aria-hidden="true">
            ⌛
          </div>
          <h1>Đơn đã hết hạn thanh toán</h1>
          <p>
            Đơn <strong>{status.code}</strong> chưa nhận được thanh toán trong thời gian quy định nên đã bị hủy để giữ
            hàng cho khách khác.
          </p>
          <p className="muted">
            Nếu bạn đã chuyển khoản, đừng lo — hãy gọi hotline <strong>{SHOP_HOTLINE}</strong> để shop kiểm tra và hỗ
            trợ.
          </p>
          <div className="result-actions">
            <Link to="/products" className="btn btn-primary">
              Đặt lại đơn mới
            </Link>
            <Link to={trackLink} className="btn btn-outline">
              Xem chi tiết đơn
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="page-head center">
        <h1>Thanh toán đơn {status.code}</h1>
        <p className="muted">Quét mã QR bằng ứng dụng ngân hàng hoặc chuyển khoản theo thông tin bên dưới.</p>
      </div>

      {error && <ErrorBox message={`Mất kết nối tạm thời: ${error}. Đang thử lại...`} />}

      {transfer ? (
        <div className="payment-layout">
          <div className="card qr-card">
            <img className="qr-image" src={transfer.qrUrl} alt={`Mã VietQR thanh toán đơn ${status.code}`} />
            <div className={`countdown ${remainingMs < 5 * 60 * 1000 ? 'urgent' : ''}`}>
              <span className="muted small">Thời gian còn lại</span>
              <strong>{formatCountdown(remainingMs)}</strong>
            </div>
            <div className="waiting">
              <span className="spinner" aria-hidden="true" />
              <span>Đang chờ thanh toán... trang sẽ tự cập nhật khi nhận được tiền.</span>
            </div>
          </div>

          <div className="card transfer-card">
            <h2 className="card-title">Thông tin chuyển khoản</h2>
            {status.paidAmount > 0 && (
              <div className="alert alert-warning">
                Đã nhận {formatVnd(status.paidAmount)} / {formatVnd(status.total)}. Vui lòng chuyển thêm số tiền còn
                thiếu bên dưới.
              </div>
            )}
            <TransferRow label="Ngân hàng" value={transfer.bankCode} />
            <TransferRow label="Số tài khoản" value={transfer.accountNumber} copy={transfer.accountNumber} />
            <TransferRow label="Chủ tài khoản" value={transfer.accountName} />
            <TransferRow label="Số tiền" value={formatVnd(transfer.amount)} copy={String(transfer.amount)} highlight />
            <TransferRow label="Nội dung chuyển khoản" value={transfer.content} copy={transfer.content} highlight />
            <div className="alert alert-info">
              <strong>Quan trọng:</strong> nhập <strong>chính xác</strong> nội dung <code>{transfer.content}</code> và
              đúng số tiền để hệ thống tự động xác nhận đơn. Nếu ghi sai nội dung, shop sẽ phải đối soát thủ công và đơn
              có thể bị chậm.
            </div>
            <p className="muted small">
              Hạn thanh toán: {formatDateTime(transfer.expiresAt)}. Quá hạn, đơn sẽ tự hủy.
            </p>
            <Link to={trackLink} className="link-more">
              Xem chi tiết đơn hàng →
            </Link>
          </div>
        </div>
      ) : (
        <Loading text="Đang tạo mã QR..." />
      )}
    </div>
  );
}
