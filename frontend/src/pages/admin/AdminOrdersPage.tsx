import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import type { OrderStatus, PaymentStatus } from '../../api/types';
import { OrderStatusBadge, PaymentStatusBadge } from '../../components/Badge';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { Pagination } from '../../components/Pagination';
import { useAsync } from '../../hooks/useAsync';
import {
  formatDate,
  formatDateTime,
  formatVnd,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  SLOT_LABEL,
  todayVN,
} from '../../utils/format';

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[];

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as OrderStatus | '';
  const paymentStatus = (params.get('paymentStatus') ?? '') as PaymentStatus | '';
  const deliveryDate = params.get('deliveryDate') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  const [qInput, setQInput] = useState(q);

  useEffect(() => setQInput(q), [q]);

  const orders = useAsync(
    () => adminApi.orders({ status, paymentStatus, deliveryDate, q, page, size: 20 }),
    [status, paymentStatus, deliveryDate, q, page],
  );

  // Tự làm mới mỗi 60 giây để thấy đơn mới / đơn vừa thanh toán
  useEffect(() => {
    const t = window.setInterval(() => orders.reload(), 60_000);
    return () => window.clearInterval(t);
  }, [orders.reload]);

  const update = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, String(v));
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    update({ q: qInput.trim() });
  };

  return (
    <>
      <div className="admin-head">
        <h1>Đơn hàng</h1>
        <div className="row-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => update({ deliveryDate: todayVN() })}>
            Giao hôm nay
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => update({ status: 'PENDING' })}>
            Chờ xác nhận
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => orders.reload()}>
            ↻ Làm mới
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <form onSubmit={search} className="input-group">
          <input
            type="search"
            value={qInput}
            placeholder="Mã đơn hoặc SĐT"
            onChange={(e) => setQInput(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Tìm
          </button>
        </form>
        <select value={status} onChange={(e) => update({ status: e.target.value })} aria-label="Trạng thái đơn">
          <option value="">Mọi trạng thái</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => update({ paymentStatus: e.target.value })}
          aria-label="Trạng thái thanh toán"
        >
          <option value="">Mọi thanh toán</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={deliveryDate}
          aria-label="Ngày giao"
          onChange={(e) => update({ deliveryDate: e.target.value })}
        />
        {(status || paymentStatus || deliveryDate || q) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams(new URLSearchParams())}>
            Xóa lọc
          </button>
        )}
      </div>

      {orders.loading && !orders.data && <Loading />}
      {orders.error && <ErrorBox message={orders.error} onRetry={orders.reload} />}
      {orders.data && orders.data.content.length === 0 && <EmptyState icon="📭" title="Không có đơn phù hợp" />}
      {orders.data && orders.data.content.length > 0 && (
        <div className={orders.loading ? 'is-refreshing' : ''}>
          <p className="muted small">{orders.data.totalElements} đơn</p>
          <div className="table-wrap card">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Giao</th>
                  <th>Người nhận</th>
                  <th>Người đặt</th>
                  <th>Sản phẩm</th>
                  <th className="num">Tổng</th>
                  <th>Trạng thái</th>
                  <th>Thanh toán</th>
                  <th>Đặt lúc</th>
                </tr>
              </thead>
              <tbody>
                {orders.data.content.map((o) => (
                  <tr key={o.code}>
                    <td>
                      <Link to={`/admin/orders/${o.code}`} className="strong-link">
                        {o.code}
                      </Link>
                    </td>
                    <td className="nowrap">
                      {formatDate(o.deliveryDate)}
                      <div className="muted small">{SLOT_LABEL[o.deliverySlot]}</div>
                    </td>
                    <td>
                      {o.receiverName}
                      <div className="muted small">{o.receiverPhone}</div>
                    </td>
                    <td>
                      {o.senderName}
                      <div className="muted small">{o.senderPhone}</div>
                    </td>
                    <td>
                      {o.firstItemName}
                      {o.itemCount > 1 && <div className="muted small">tổng {o.itemCount} sản phẩm</div>}
                    </td>
                    <td className="num nowrap">{formatVnd(o.total)}</td>
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td>
                      <PaymentStatusBadge status={o.paymentStatus} />
                      <div className="muted small">{o.paymentMethod}</div>
                    </td>
                    <td className="nowrap small">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={orders.data.page} totalPages={orders.data.totalPages} onChange={(p) => update({ page: p })} />
        </div>
      )}
    </>
  );
}
