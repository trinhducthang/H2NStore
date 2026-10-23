import { useEffect, useState, type FormEvent } from 'react';
import { accountApi } from '../../api/account';
import { ApiError, errorMessage } from '../../api/client';
import { FieldError } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDate, ROLE_LABEL } from '../../utils/format';
import { cleanPhone, isValidPhone, PHONE_MESSAGE } from '../../utils/validation';

function ProfileForm() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setPhone(user?.phone ?? '');
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Vui lòng nhập họ tên';
    if (phone.trim() && !isValidPhone(phone)) errs.phone = PHONE_MESSAGE;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const updated = await accountApi.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() ? cleanPhone(phone) : null,
      });
      updateUser(updated);
      toast.success('Đã lưu hồ sơ');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <h2 className="card-title">Hồ sơ</h2>
      <p className="muted small">
        {user?.email} · {user && ROLE_LABEL[user.role]} · tham gia {formatDate(user?.createdAt)}
      </p>
      <label className="field">
        <span className="field-label">Họ tên</span>
        <input value={fullName} maxLength={100} onChange={(e) => setFullName(e.target.value)} />
        <FieldError message={errors.fullName} />
      </label>
      <label className="field">
        <span className="field-label">Số điện thoại</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <FieldError message={errors.phone} />
      </label>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!current) return setError('Vui lòng nhập mật khẩu hiện tại');
    if (next.length < 8 || next.length > 72) return setError('Mật khẩu mới từ 8 đến 72 ký tự');
    if (next !== confirm) return setError('Mật khẩu nhập lại không khớp');
    setBusy(true);
    setError(null);
    try {
      await accountApi.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Đã đổi mật khẩu');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <h2 className="card-title">Đổi mật khẩu</h2>
      <label className="field">
        <span className="field-label">Mật khẩu hiện tại</span>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Mật khẩu mới</span>
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Nhập lại mật khẩu mới</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Đang lưu...' : 'Đổi mật khẩu'}
        </button>
      </div>
    </form>
  );
}

export function ProfilePage() {
  return (
    <div className="two-col">
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}
