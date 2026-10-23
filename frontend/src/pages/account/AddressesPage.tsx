import { useState, type FormEvent } from 'react';
import { accountApi, formatAddress, isDefaultAddress } from '../../api/account';
import { ApiError, errorMessage } from '../../api/client';
import type { Address, AddressRequest } from '../../api/types';
import { Badge } from '../../components/Badge';
import { EmptyState, ErrorBox, FieldError, Loading } from '../../components/Feedback';
import { Modal } from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { cleanPhone, isValidPhone, PHONE_MESSAGE } from '../../utils/validation';

const EMPTY: AddressRequest = {
  receiverName: '',
  receiverPhone: '',
  addressLine: '',
  ward: '',
  district: '',
  city: 'Hà Nội',
  isDefault: false,
};

function AddressForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Address | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<AddressRequest>(
    initial
      ? {
          receiverName: initial.receiverName,
          receiverPhone: initial.receiverPhone,
          addressLine: initial.addressLine,
          ward: initial.ward ?? '',
          district: initial.district ?? '',
          city: initial.city ?? '',
          isDefault: isDefaultAddress(initial),
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof AddressRequest>(key: K, value: AddressRequest[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.receiverName.trim()) errs.receiverName = 'Vui lòng nhập tên người nhận';
    if (!isValidPhone(form.receiverPhone)) errs.receiverPhone = PHONE_MESSAGE;
    if (!form.addressLine.trim()) errs.addressLine = 'Vui lòng nhập địa chỉ';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: AddressRequest = {
      receiverName: form.receiverName.trim(),
      receiverPhone: cleanPhone(form.receiverPhone),
      addressLine: form.addressLine.trim(),
      ward: form.ward?.trim() || null,
      district: form.district?.trim() || null,
      city: form.city?.trim() || null,
      isDefault: form.isDefault,
    };
    setBusy(true);
    try {
      if (initial) await accountApi.updateAddress(initial.id, body);
      else await accountApi.createAddress(body);
      toast.success('Đã lưu địa chỉ');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? 'Sửa địa chỉ' : 'Thêm địa chỉ'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Tên người nhận</span>
            <input value={form.receiverName} maxLength={100} onChange={(e) => set('receiverName', e.target.value)} />
            <FieldError message={errors.receiverName} />
          </label>
          <label className="field">
            <span className="field-label">Số điện thoại</span>
            <input type="tel" value={form.receiverPhone} onChange={(e) => set('receiverPhone', e.target.value)} />
            <FieldError message={errors.receiverPhone} />
          </label>
          <label className="field field-full">
            <span className="field-label">Số nhà, đường</span>
            <input value={form.addressLine} maxLength={255} onChange={(e) => set('addressLine', e.target.value)} />
            <FieldError message={errors.addressLine} />
          </label>
          <label className="field">
            <span className="field-label">Phường/Xã</span>
            <input value={form.ward ?? ''} maxLength={100} onChange={(e) => set('ward', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Quận/Huyện</span>
            <input value={form.district ?? ''} maxLength={100} onChange={(e) => set('district', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Tỉnh/Thành phố</span>
            <input value={form.city ?? ''} maxLength={100} onChange={(e) => set('city', e.target.value)} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
          <span>Đặt làm địa chỉ mặc định</span>
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

export function AddressesPage() {
  const toast = useToast();
  const addresses = useAsync(() => accountApi.addresses(), []);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);

  const remove = async (a: Address) => {
    if (!window.confirm(`Xóa địa chỉ của ${a.receiverName}?`)) return;
    try {
      await accountApi.deleteAddress(a.id);
      toast.success('Đã xóa địa chỉ');
      addresses.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + Thêm địa chỉ
        </button>
      </div>
      {addresses.loading && !addresses.data && <Loading />}
      {addresses.error && <ErrorBox message={addresses.error} onRetry={addresses.reload} />}
      {addresses.data && addresses.data.length === 0 && (
        <EmptyState icon="🏠" title="Chưa có địa chỉ nào">
          Lưu địa chỉ người nhận thường xuyên để đặt hàng nhanh hơn.
        </EmptyState>
      )}
      <div className="address-list">
        {addresses.data?.map((a) => (
          <div key={a.id} className="card address-card">
            <div>
              <strong>{a.receiverName}</strong> · {a.receiverPhone}
              {isDefaultAddress(a) && (
                <span className="ml">
                  <Badge tone="primary">Mặc định</Badge>
                </span>
              )}
              <p className="muted">{formatAddress(a)}</p>
            </div>
            <div className="row-actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(a)}>
                Sửa
              </button>
              <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => remove(a)}>
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <AddressForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            addresses.reload();
          }}
        />
      )}
    </>
  );
}
