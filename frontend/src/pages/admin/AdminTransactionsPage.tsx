import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import type { PaymentTransaction, TransactionStatus } from '../../api/types';
import { TransactionStatusBadge } from '../../components/Badge';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { PromptModal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { formatDateTime, formatVnd, TRANSACTION_STATUS_LABEL } from '../../utils/format';

const STATUSES = Object.keys(TRANSACTION_STATUS_LABEL) as TransactionStatus[];

type Pending = { kind: 'assign' | 'resolve'; txn: PaymentTransaction };

export function AdminTransactionsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as TransactionStatus | '';
  const q = params.get('q') ?? '';
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  const [qInput, setQInput] = useState(q);
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => setQInput(q), [q]);

  const txns = useAsync(() => adminApi.transactions({ status, q, page, size: 20 }), [status, q, page]);

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

  const replaceRow = (updated: PaymentTransaction) => {
    if (!txns.data) return;
    txns.setData({ ...txns.data, content: txns.data.content.map((t) => (t.id === updated.id ? updated : t)) });
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Đối soát SePay</h1>
          <p className="muted small">
            Giao dịch ngân hàng SePay gửi về qua webhook. Giao dịch khớp mã đơn được ghi nhận tự động; các giao dịch
            còn lại cần xử lý tay.
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => txns.reload()}>
          ↻ Làm mới
        </button>
      </div>

      <div className="filter-bar">
        <div className="chip-row">
          <button type="button" className={`chip ${!status ? 'chip-active' : ''}`} onClick={() => update({ status: '' })}>
            Tất cả
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${status === s ? 'chip-active' : ''}`}
              onClick={() => update({ status: s })}
            >
              {TRANSACTION_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <form onSubmit={search} className="input-group">
          <input
            type="search"
            value={qInput}
            placeholder="Nội dung CK, mã đơn, mã tham chiếu"
            onChange={(e) => setQInput(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Tìm
          </button>
        </form>
      </div>

      {txns.loading && !txns.data && <Loading />}
      {txns.error && <ErrorBox message={txns.error} onRetry={txns.reload} />}
      {txns.data && txns.data.content.length === 0 && <EmptyState icon="💳" title="Không có giao dịch phù hợp" />}
      {txns.data && txns.data.content.length > 0 && (
        <div className={txns.loading ? 'is-refreshing' : ''}>
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th className="num">Số tiền</th>
                  <th>Nội dung chuyển khoản</th>
                  <th>Đơn</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {txns.data.content.map((t) => (
                  <tr key={t.id}>
                    <td className="nowrap small">
                      {formatDateTime(t.transactionDate ?? t.createdAt)}
                      <div className="muted">
                        {t.gateway} · #{t.providerTxnId}
                      </div>
                    </td>
                    <td className={`num nowrap ${t.transferType === 'out' ? 'muted' : 'strong'}`}>
                      {t.transferType === 'out' ? '-' : '+'}
                      {formatVnd(t.amount)}
                    </td>
                    <td className="break">
                      {t.content || <span className="muted">(trống)</span>}
                      {t.referenceCode && <div className="muted small">Ref: {t.referenceCode}</div>}
                    </td>
                    <td className="nowrap">
                      {t.orderCode ? <Link to={`/admin/orders/${t.orderCode}`}>{t.orderCode}</Link> : '—'}
                    </td>
                    <td>
                      <TransactionStatusBadge status={t.status} />
                    </td>
                    <td className="small break">{t.note}</td>
                    <td>
                      <div className="row-actions">
                        {t.status === 'UNMATCHED' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => setPending({ kind: 'assign', txn: t })}
                          >
                            Gán đơn
                          </button>
                        )}
                        {(t.status === 'UNMATCHED' || t.status === 'NEEDS_REFUND' || t.status === 'PARTIAL') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setPending({ kind: 'resolve', txn: t })}
                          >
                            Đã xử lý
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={txns.data.page} totalPages={txns.data.totalPages} onChange={(p) => update({ page: p })} />
        </div>
      )}

      {pending?.kind === 'assign' && (
        <PromptModal
          title="Gán giao dịch vào đơn"
          label="Mã đơn"
          placeholder="FS2610230001"
          required
          confirmText="Gán vào đơn"
          description={
            <>
              Giao dịch <strong>{formatVnd(pending.txn.amount)}</strong> – nội dung “{pending.txn.content}”. Số tiền sẽ
              được cộng vào đơn; đủ tiền thì đơn tự chuyển sang “Đã thanh toán”.
            </>
          }
          onCancel={() => setPending(null)}
          onSubmit={async (orderCode) => {
            const updated = await adminApi.assignTransaction(pending.txn.id, orderCode.toUpperCase());
            replaceRow(updated);
            setPending(null);
            toast.success(`Đã gán giao dịch vào đơn ${updated.orderCode ?? orderCode.toUpperCase()}`);
          }}
        />
      )}
      {pending?.kind === 'resolve' && (
        <PromptModal
          title="Đánh dấu đã xử lý"
          label="Ghi chú xử lý"
          placeholder="VD: Đã hoàn tiền cho khách qua MB lúc 10:30"
          required
          multiline
          confirmText="Lưu"
          description={
            <>
              Giao dịch <strong>{formatVnd(pending.txn.amount)}</strong> sẽ chuyển sang “Bỏ qua / đã xử lý”.
            </>
          }
          onCancel={() => setPending(null)}
          onSubmit={async (note) => {
            replaceRow(await adminApi.resolveTransaction(pending.txn.id, note));
            setPending(null);
            toast.success('Đã cập nhật giao dịch');
          }}
        />
      )}
    </>
  );
}
