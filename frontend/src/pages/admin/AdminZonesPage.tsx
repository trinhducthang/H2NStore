import { useState, type FormEvent } from 'react';
import { adminApi } from '../../api/admin';
import { ApiError, errorMessage } from '../../api/client';
import type { DeliveryZone, ZoneRequest } from '../../api/types';
import { Badge } from '../../components/Badge';
import { EmptyState, ErrorBox, FieldError, Loading } from '../../components/Feedback';
import { Modal } from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { formatVnd } from '../../utils/format';

function ZoneForm({ initial, onClose, onSaved }: { initial: DeliveryZone | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    districts: initial?.districts ?? '',
    shippingFee: initial ? String(initial.shippingFee) : '',
    expressFee: initial?.expressFee != null ? String(initial.expressFee) : '',
    active: initial?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Vui lòng nhập tên khu vực';
    const fee = Number(form.shippingFee);
    if (form.shippingFee === '' || !Number.isFinite(fee) || fee < 0) errs.shippingFee = 'Phí ship không hợp lệ';
    if (form.expressFee !== '' && (!Number.isFinite(Number(form.expressFee)) || Number(form.expressFee) < 0)) {
      errs.expressFee = 'Phí giao nhanh không hợp lệ';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: ZoneRequest = {
      name: form.name.trim(),
      districts: form.districts.trim() || null,
      shippingFee: fee,
      expressFee: form.expressFee === '' ? null : Number(form.expressFee),
      active: form.active,
    };
    setBusy(true);
    try {
      if (initial) await adminApi.updateZone(initial.id, body);
      else await adminApi.createZone(body);
      toast.success('Đã lưu khu vực giao');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? 'Sửa khu vực' : 'Thêm khu vực giao'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">Tên khu vực</span>
          <input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <FieldError message={errors.name} />
        </label>
        <label className="field">
          <span className="field-label">Quận/huyện (phân tách bằng dấu phẩy)</span>
          <textarea
            rows={2}
            value={form.districts}
            maxLength={2000}
            onChange={(e) => setForm({ ...form, districts: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Phí ship (đ)</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={form.shippingFee}
              onChange={(e) => setForm({ ...form, shippingFee: e.target.value })}
            />
            <FieldError message={errors.shippingFee} />
          </label>
          <label className="field">
            <span className="field-label">Phí giao nhanh (để trống = không hỗ trợ)</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={form.expressFee}
              onChange={(e) => setForm({ ...form, expressFee: e.target.value })}
            />
            <FieldError message={errors.expressFee} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <span>Đang nhận giao</span>
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

export function AdminZonesPage() {
  const toast = useToast();
  const zones = useAsync(() => adminApi.zones(), []);
  const [editing, setEditing] = useState<DeliveryZone | 'new' | null>(null);

  const deactivate = async (z: DeliveryZone) => {
    if (!window.confirm(`Ngừng nhận giao khu vực “${z.name}”?`)) return;
    try {
      await adminApi.deactivateZone(z.id);
      toast.success('Đã tắt khu vực');
      zones.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1>Khu vực giao hàng</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + Thêm khu vực
        </button>
      </div>
      {zones.loading && !zones.data && <Loading />}
      {zones.error && <ErrorBox message={zones.error} onRetry={zones.reload} />}
      {zones.data && zones.data.length === 0 && <EmptyState icon="🗺️" title="Chưa có khu vực giao" />}
      {zones.data && zones.data.length > 0 && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Khu vực</th>
                <th className="num">Phí ship</th>
                <th className="num">Giao nhanh</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zones.data.map((z) => (
                <tr key={z.id} className={z.active ? '' : 'row-muted'}>
                  <td>
                    <strong>{z.name}</strong>
                    {z.districts && <div className="muted small">{z.districts}</div>}
                  </td>
                  <td className="num">{formatVnd(z.shippingFee)}</td>
                  <td className="num">{z.expressFee != null ? formatVnd(z.expressFee) : '—'}</td>
                  <td>{z.active ? <Badge tone="success">Đang giao</Badge> : <Badge>Đã tắt</Badge>}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(z)}>
                        Sửa
                      </button>
                      {z.active && (
                        <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => deactivate(z)}>
                          Tắt
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ZoneForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            zones.reload();
          }}
        />
      )}
    </>
  );
}
