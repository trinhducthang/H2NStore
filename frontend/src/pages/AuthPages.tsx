import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { ApiError, errorMessage } from '../api/client';
import { FieldError } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cleanPhone, EMAIL_REGEX, isValidPhone, PHONE_MESSAGE } from '../utils/validation';

/** Chỉ chấp nhận đường dẫn nội bộ để tránh open redirect */
function safeRedirect(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="container section">
      <div className="card auth-card">
        <div className="auth-head">
          <span className="brand-icon" aria-hidden="true">
            🌸
          </span>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email.trim()) || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);
      const redirect = safeRedirect(params.get('redirect'));
      navigate(redirect ?? (user.role === 'CUSTOMER' ? '/' : '/admin'), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Đăng nhập" subtitle="Chào mừng bạn quay lại">
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Mật khẩu</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        <div className="auth-links">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
          <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect')!)}` : ''}`}>
            Tạo tài khoản mới
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = 'Vui lòng nhập họ tên';
    if (!EMAIL_REGEX.test(form.email.trim())) errs.email = 'Email không hợp lệ';
    if (form.phone.trim() && !isValidPhone(form.phone)) errs.phone = PHONE_MESSAGE;
    if (form.password.length < 8 || form.password.length > 72) errs.password = 'Mật khẩu từ 8 đến 72 ký tự';
    if (form.confirm !== form.password) errs.confirm = 'Mật khẩu nhập lại không khớp';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() ? cleanPhone(form.phone) : null,
        password: form.password,
      });
      toast.success('Tạo tài khoản thành công');
      navigate(safeRedirect(params.get('redirect')) ?? '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Tạo tài khoản" subtitle="Lưu giỏ hàng, sổ địa chỉ và theo dõi đơn dễ dàng">
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">Họ tên</span>
          <input autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          <FieldError message={errors.fullName} />
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <FieldError message={errors.email} />
        </label>
        <label className="field">
          <span className="field-label">Số điện thoại (không bắt buộc)</span>
          <input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <FieldError message={errors.phone} />
        </label>
        <label className="field">
          <span className="field-label">Mật khẩu</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
          <FieldError message={errors.password} />
        </label>
        <label className="field">
          <span className="field-label">Nhập lại mật khẩu</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => set('confirm', e.target.value)}
          />
          <FieldError message={errors.confirm} />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Đang tạo...' : 'Đăng ký'}
        </button>
        <div className="auth-links">
          <span className="muted">Đã có tài khoản?</span>
          <Link to="/login">Đăng nhập</Link>
        </div>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Email không hợp lệ');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Quên mật khẩu" subtitle="Nhập email để nhận liên kết đặt lại mật khẩu">
      {sent ? (
        <div className="form">
          <div className="alert alert-success">
            Nếu email <strong>{email}</strong> đã đăng ký, chúng tôi đã gửi liên kết đặt lại mật khẩu (hiệu lực 30
            phút). Vui lòng kiểm tra hộp thư, kể cả mục Spam.
          </div>
          <Link to="/login" className="btn btn-outline btn-block">
            Quay lại đăng nhập
          </Link>
        </div>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          <label className="field">
            <span className="field-label">Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Đang gửi...' : 'Gửi liên kết'}
          </button>
          <div className="auth-links">
            <Link to="/login">Quay lại đăng nhập</Link>
          </div>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || password.length > 72) {
      setError('Mật khẩu từ 8 đến 72 ký tự');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Liên kết không hợp lệ">
        <div className="form">
          <p className="muted">Liên kết đặt lại mật khẩu thiếu mã xác thực hoặc đã hỏng.</p>
          <Link to="/forgot-password" className="btn btn-primary btn-block">
            Gửi lại liên kết
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Đặt lại mật khẩu">
      {done ? (
        <div className="form">
          <div className="alert alert-success">Đổi mật khẩu thành công. Vui lòng đăng nhập lại.</div>
          <Link to="/login" className="btn btn-primary btn-block">
            Đăng nhập
          </Link>
        </div>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          <label className="field">
            <span className="field-label">Mật khẩu mới</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Nhập lại mật khẩu mới</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
