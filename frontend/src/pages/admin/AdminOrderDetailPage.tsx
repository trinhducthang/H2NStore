import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { ApiError, errorMessage } from '../../api/client';
import type { Order, OrderStatus, PaymentStatus } from '../../api/types';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { PromptModal } from '../../components/Modal';
import { OrderDetailView } from '../../components/OrderDetailView';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '../../utils/format';

interface StatusAction {
  to: OrderStatus;
  label: string;
  danger?: boolean;
}

const NEXT_ACTIONS: Record<OrderStatus, StatusAction[]> = {
  PENDING: [
    { to: 'CONFIRMED', label: 'Xác nhận đơn' },
    { to: 'CANCELLED', label: 'Hủy đơn', danger: true },
  ],
  CONFIRMED: [
    { to: 'ARRANGING', label: 'Bắt đầu chuẩn bị hàng' },
    { to: 'CANCELLED', label: 'Hủy đơn', danger: true },
  ],
  ARRANGING: [{ to: 'DELIVERING', label: 'Bắt đầu giao' }],
  DELIVERING: [{ to: 'DELIVERED', label: 'Đã giao thành công' }],
  DELIVERED: [],
  CANCELLED: [],
};

type Pending =
  | { kind: 'status'; action: StatusAction }
  | { kind: 'payment'; to: PaymentStatus; label: string };

export function AdminOrderDetailPage() {
  const { code = '' } = useParams();
  const toast = useToast();
  const order = useAsync(() => adminApi.order(code), [code]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (order.loading && !order.data) return <Loading />;
  if (order.errorStatus === 404) {
    return <EmptyState icon="🔎" title={`Không tìm thấy đơn ${code}`} action={{ to: '/admin/orders', label: 'Về danh sách' }} />;
  }
  if (order.error || !order.data) return <ErrorBox message={order.error ?? 'Không tải được đơn'} onRetry={order.reload} />;

  const o: Order = order.data;
  const awaitingOnlinePayment = o.paymentMethod === 'SEPAY' && o.paymentStatus !== 'PAID';

  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'CONFLICT') {
      toast.error('Đơn vừa được người khác cập nhật. Đã tải lại dữ liệu mới nhất.');
      order.reload();
      setPending(null);
      return;
    }
    throw err instanceof Error ? err : new Error(errorMessage(err));
  };

  const runStatus = async (to: OrderStatus, reason: string) => {
    try {
      const updated = await adminApi.changeStatus(o.code, to, reason || null, o.version);
      order.setData(updated);
      setPending(null);
      toast.success(`Đã chuyển đơn sang “${ORDER_STATUS_LABEL[to]}”`);
    } catch (err) {
      handleError(err);
    }
  };

  const runPayment = async (to: PaymentStatus, note: string) => {
    try {
      const updated = await adminApi.updatePayment(o.code, to, note || null, o.version);
      order.setData(updated);
      setPending(null);
      toast.success(`Đã cập nhật thanh toán: ${PAYMENT_STATUS_LABEL[to]}`);
    } catch (err) {
      handleError(err);
    }
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      order.setData(await adminApi.uploadOrderPhoto(o.code, file));
      toast.success('Đã tải ảnh thực tế');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const actions = (
    <>
      {NEXT_ACTIONS[o.status].map((a) => {
        const blocked = a.to === 'CONFIRMED' && awaitingOnlinePayment;
        return (
          <button
            key={a.to}
            type="button"
            className={`btn ${a.danger ? 'btn-danger-outline' : 'btn-primary'}`}
            disabled={blocked}
            title={blocked ? 'Đơn SePay phải được thanh toán trước khi xác nhận' : undefined}
            onClick={() => setPending({ kind: 'status', action: a })}
          >
            {a.label}
          </button>
        );
      })}
      {o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED' && (
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setPending({ kind: 'payment', to: 'PAID', label: 'Đánh dấu đã thanh toán' })}
        >
          Đánh dấu đã thanh toán
        </button>
      )}
      {o.paymentStatus === 'PAID' && (
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setPending({ kind: 'payment', to: 'REFUNDED', label: 'Đánh dấu đã hoàn tiền' })}
          >
            Đã hoàn tiền
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPending({ kind: 'payment', to: 'UNPAID', label: 'Hoàn tác về chưa thanh toán' })}
          >
            Hoàn tác thanh toán
          </button>
        </>
      )}
      {o.status !== 'CANCELLED' && (
        <>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? 'Đang tải ảnh...' : o.deliveryPhotoUrl ? '📷 Đổi ảnh thực tế' : '📷 Tải ảnh thực tế'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => uploadPhoto(e.target.files?.[0])}
          />
        </>
      )}
    </>
  );

  return (
    <>
      <div className="admin-head">
        <Link to="/admin/orders" className="link-more">
          ← Danh sách đơn
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => order.reload()}>
          ↻ Làm mới
        </button>
      </div>

      {awaitingOnlinePayment && o.status === 'PENDING' && (
        <div className="alert alert-info">
          Đơn thanh toán qua SePay: hệ thống tự chuyển sang “Đã thanh toán” khi nhận được tiền. Nếu khách đã chuyển
          nhưng ghi sai nội dung, vào <Link to="/admin/payments?status=UNMATCHED">Đối soát SePay</Link> để gán giao dịch
          vào đơn.
        </div>
      )}

      <OrderDetailView order={o} actions={actions} productLinks />

      {pending?.kind === 'status' && (
        <PromptModal
          title={`${pending.action.label} – ${o.code}`}
          label={pending.action.to === 'CANCELLED' ? 'Lý do hủy' : 'Ghi chú (không bắt buộc)'}
          required={pending.action.to === 'CANCELLED'}
          multiline
          danger={pending.action.danger}
          confirmText={pending.action.label}
          description={
            pending.action.to === 'CANCELLED'
              ? 'Hủy đơn sẽ hoàn lại tồn kho và lượt dùng mã giảm giá.' +
                (o.paymentStatus === 'PAID' ? ' Đơn đã thanh toán: nhớ hoàn tiền cho khách rồi đánh dấu “Đã hoàn tiền”.' : '')
              : pending.action.to === 'DELIVERED' && o.paymentMethod === 'COD'
                ? 'Đơn COD sẽ tự chuyển sang “Đã thanh toán”.'
                : undefined
          }
          onCancel={() => setPending(null)}
          onSubmit={(reason) => runStatus(pending.action.to, reason)}
        />
      )}
      {pending?.kind === 'payment' && (
        <PromptModal
          title={`${pending.label} – ${o.code}`}
          label="Ghi chú (VD: mã giao dịch ngân hàng)"
          multiline
          confirmText="Cập nhật"
          onCancel={() => setPending(null)}
          onSubmit={(note) => runPayment(pending.to, note)}
        />
      )}
    </>
  );
}
