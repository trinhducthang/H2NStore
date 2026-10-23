import { useState, type FormEvent } from 'react';
import { adminApi } from '../../api/admin';
import { ApiError, errorMessage } from '../../api/client';
import type { Coupon, CouponRequest, CouponType } from '../../api/types';
import { Badge } from '../../components/Badge';
import { EmptyState, ErrorBox, FieldError, Loading } from '../../components/Feedback';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import {
  COUPON_TYPE_LABEL,
  formatDateTime,
  formatVnd,
  fromDateTimeLocalVN,
  toDateTimeLocalVN,
} from '../../utils/format';

function describe(c: Coupon): string {
  if (c.type === 'PERCENT') {
    return `Giảm ${c.value}%${c.maxDiscount ? `, tối đa ${formatVnd(c.maxDiscount)}` : ''}`;
  }
  return `Giảm ${formatVnd(c.value)}`;
}

function couponState(c: Coupon): { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' } {
  const now = Date.now();
  if (!c.active) return { label: 'Đã tắt', tone: 'neutral' };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { label: 'Hết hạn', tone: 'danger' };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: 'Chưa bắt đầu', tone: 'warning' };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { label: 'Hết lượt', tone: 'danger' };
  return { label: 'Đang áp dụng', tone: 'success' };
}

function CouponForm({ initial, onClose, onSaved }: { initial: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    type: initial?.type ?? ('PERCENT' as CouponType),
    value: initial ? String(initial.value) : '',
    maxDiscount: initial?.maxDiscount != null ? String(initial.maxDiscount) : '',
    minOrder: initial ? String(initial.minOrder) : '0',
    usageLimit: initial?.usageLimit != null ? String(initial.usageLimit) : '',
    startsAt: toDateTimeLocalVN(initial?.startsAt),
    endsAt: toDateTimeLocalVN(initial?.endsAt),
    active: initial?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^[A-Za-z0-9_-]+$/.test(form.code.trim())) errs.code = 'Mã chỉ gồm chữ, số, _ và -';
    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) errs.value = 'Giá trị phải lớn hơn 0';
    else if (form.type === 'PERCENT' && value > 100) errs.value = 'Giảm theo % từ 1 đến 100';
    if (form.startsAt && form.endsAt && form.endsAt <= form.startsAt) errs.endsAt = 'Phải sau thời gian bắt đầu';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: CouponRequest = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value,
      maxDiscount: form.type === 'PERCENT' && form.maxDiscount ? Number(form.maxDiscount) : null,
      minOrder: form.minOrder ? Number(form.minOrder) : 0,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      startsAt: fromDateTimeLocalVN(form.startsAt),
      endsAt: fromDateTimeLocalVN(form.endsAt),
      active: form.active,
    };
    setBusy(true);
    try {
      if (initial) await adminApi.updateCoupon(initial.id, body);
      else await adminApi.createCoupon(body);
      toast.success('Đã lưu mã giảm giá');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? `Sửa mã ${initial.code}` : 'Thêm mã giảm giá'} onClose={onClose} wide>
      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Mã</span>
            <input value={form.code} maxLength={50} onChange={(e) => set('code', e.target.value.toUpperCase())} />
            <FieldError message={errors.code} />
          </label>
          <label className="field">
            <span className="field-label">Loại</span>
            <select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="PERCENT">{COUPON_TYPE_LABEL.PERCENT}</option>
              <option value="FIXED">{COUPON_TYPE_LABEL.FIXED}</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">{form.type === 'PERCENT' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (đ)'}</span>
            <input type="number" min={1} value={form.value} onChange={(e) => set('value', e.target.value)} />
            <FieldError message={errors.value} />
          </label>
          {form.type === 'PERCENT' && (
            <label className="field">
              <span className="field-label">Giảm tối đa (đ, để trống = không giới hạn)</span>
              <input type="number" min={0} value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} />
            </label>
          )}
          <label className="field">
            <span className="field-label">Đơn tối thiểu (đ)</span>
            <input type="number" min={0} value={form.minOrder} onChange={(e) => set('minOrder', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Số lượt (để trống = không giới hạn)</span>
            <input type="number" min={1} value={form.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Bắt đầu (giờ VN)</span>
            <input type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Kết thúc (giờ VN)</span>
            <input type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
            <FieldError message={errors.endsAt} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          <span>Kích hoạt</span>
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminCouponsPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const coupons = useAsync(() => adminApi.coupons({ q: query, page, size: 20 }), [query, page]);

  const remove = async (c: Coupon) => {
    const msg =
      c.usedCount > 0
        ? `Mã ${c.code} đã được dùng ${c.usedCount} lần nên sẽ chỉ bị tắt. Tiếp tục?`
        : `Xóa mã ${c.code}?`;
    if (!window.confirm(msg)) return;
    try {
      await adminApi.deleteCoupon(c.id);
      toast.success(c.usedCount > 0 ? 'Đã tắt mã giảm giá' : 'Đã xóa mã giảm giá');
      coupons.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1>Mã giảm giá</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + Thêm mã
        </button>
      </div>
      <div className="filter-bar">
        <form
          className="input-group"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
            setPage(0);
          }}
        >
          <input type="search" value={q} placeholder="Tìm mã" onChange={(e) => setQ(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-sm">
            Tìm
          </button>
        </form>
      </div>
      {coupons.loading && !coupons.data && <Loading />}
      {coupons.error && <ErrorBox message={coupons.error} onRetry={coupons.reload} />}
      {coupons.data && coupons.data.content.length === 0 && <EmptyState icon="🏷️" title="Chưa có mã giảm giá" />}
      {coupons.data && coupons.data.content.length > 0 && (
        <>
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Ưu đãi</th>
                  <th className="num">Đơn tối thiểu</th>
                  <th className="num">Đã dùng</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {coupons.data.content.map((c) => {
                  const st = couponState(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.code}</strong>
                      </td>
                      <td>{describe(c)}</td>
                      <td className="num">{formatVnd(c.minOrder)}</td>
                      <td className="num">
                        {c.usedCount}
                        {c.usageLimit != null && ` / ${c.usageLimit}`}
                      </td>
                      <td className="small">
                        {c.startsAt ? formatDateTime(c.startsAt) : 'Không giới hạn'}
                        <br />→ {c.endsAt ? formatDateTime(c.endsAt) : 'Không giới hạn'}
                      </td>
                      <td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(c)}>
                            Sửa
                          </button>
                          <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => remove(c)}>
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={coupons.data.page} totalPages={coupons.data.totalPages} onChange={setPage} />
        </>
      )}
      {editing && (
        <CouponForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            coupons.reload();
          }}
        />
      )}
    </>
  );
}
