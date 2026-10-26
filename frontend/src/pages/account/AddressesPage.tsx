import { useState, type FormEvent } from 'react';
import { accountApi, formatAddress, isDefaultAddress } from '../../api/account';
import { ApiError, errorMessage } from '../../api/client';
import type { Address, AddressRequest } from '../../api/types';
import { Badge } from '../../components/Badge';
import { EmptyState, ErrorBox, FieldError, Loading } from '../../components/Feedback';
import { Modal } from '../../components/Modal';
import { SuggestInput } from '../../components/SuggestInput';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { cleanPhone, isValidPhone, PHONE_MESSAGE } from '../../utils/validation';
import { loadProvinces } from '../../utils/vnAddress';

// Từ 01/07/2025 địa chỉ chỉ còn Tỉnh/Thành -> Phường/Xã; cột district chỉ còn giữ cho địa chỉ cũ
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
  // Không tải được danh sách thì vẫn nhập tay như cũ
  const provinces = useAsync(() => loadProvinces(), []);
  const set = <K extends keyof AddressRequest>(key: K, value: AddressRequest[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const provinceNames = provinces.data?.map((p) => p.name) ?? [];
  // Địa chỉ cũ có tên tỉnh không nằm trong danh sách mới: vẫn giữ làm một lựa chọn để không mất
  if (form.city && provinces.data && !provinceNames.includes(form.city)) provinceNames.unshift(form.city);
  const wardOptions = provinces.data?.find((p) => p.name === form.city)?.wards ?? [];
  const oldDistrict = initial?.district && form.ward === (initial.ward ?? '') ? initial.district : null;

  const changeCity = (city: string) => {
    const wards = provinces.data?.find((p) => p.name === city)?.wards ?? [];
    setForm((f) => ({ ...f, city, ward: f.ward && wards.includes(f.ward) ? f.ward : '' }));
  };

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
      // Đổi sang phường/xã mới thì bỏ quận/huyện cũ; không đổi thì giữ nguyên
      district: oldDistrict,
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
          <label className="field">
            <span className="field-label">Tỉnh/Thành phố</span>
            {provinces.data ? (
              <select value={form.city ?? ''} onChange={(e) => changeCity(e.target.value)}>
                <option value="">-- Chọn tỉnh/thành --</option>
                {provinceNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input value={form.city ?? ''} maxLength={100} onChange={(e) => set('city', e.target.value)} />
            )}
          </label>
          <label className="field">
            <span className="field-label">Phường/Xã</span>
            <SuggestInput
              value={form.ward ?? ''}
              options={wardOptions}
              maxLength={100}
              placeholder={provinces.loading ? 'Đang tải danh sách...' : 'Gõ để tìm, VD: ba dinh'}
              onChange={(ward) => set('ward', ward)}
            />
            {oldDistrict && (
              <span className="muted small">
                Địa chỉ cũ thuộc {oldDistrict}. Chọn lại phường/xã mới (sau sáp nhập 01/07/2025) để cập nhật.
              </span>
            )}
          </label>
          <label className="field field-full">
            <span className="field-label">Số nhà, đường</span>
            <input value={form.addressLine} maxLength={255} onChange={(e) => set('addressLine', e.target.value)} />
            <FieldError message={errors.addressLine} />
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
