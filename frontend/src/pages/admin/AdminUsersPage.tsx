import { useState, type FormEvent } from 'react';
import { adminApi } from '../../api/admin';
import { ApiError, errorMessage } from '../../api/client';
import type { Role, User } from '../../api/types';
import { Badge } from '../../components/Badge';
import { EmptyState, ErrorBox, FieldError, Loading } from '../../components/Feedback';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, ROLE_LABEL } from '../../utils/format';
import { cleanPhone, EMAIL_REGEX, isValidPhone, PHONE_MESSAGE } from '../../utils/validation';

const ROLES = Object.keys(ROLE_LABEL) as Role[];

function CreateUserForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '', role: 'STAFF' as Role });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!EMAIL_REGEX.test(form.email.trim())) errs.email = 'Email không hợp lệ';
    if (form.password.length < 8 || form.password.length > 72) errs.password = 'Mật khẩu từ 8 đến 72 ký tự';
    if (!form.fullName.trim()) errs.fullName = 'Vui lòng nhập họ tên';
    if (form.phone.trim() && !isValidPhone(form.phone)) errs.phone = PHONE_MESSAGE;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await adminApi.createUser({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim() ? cleanPhone(form.phone) : null,
        role: form.role,
      });
      toast.success('Đã tạo tài khoản');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Tạo tài khoản nhân viên" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">Họ tên</span>
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <FieldError message={errors.fullName} />
        </label>
        <label className="field">
          <span className="field-label">Email đăng nhập</span>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FieldError message={errors.email} />
        </label>
        <label className="field">
          <span className="field-label">Mật khẩu tạm</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <FieldError message={errors.password} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Số điện thoại</span>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <FieldError message={errors.phone} />
          </label>
          <label className="field">
            <span className="field-label">Vai trò</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Đang tạo...' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const users = useAsync(() => adminApi.users({ q, role, page, size: 20 }), [q, role, page]);

  const replace = (updated: User) => {
    if (!users.data) return;
    users.setData({ ...users.data, content: users.data.content.map((u) => (u.id === updated.id ? updated : u)) });
  };

  const run = async (u: User, action: () => Promise<User>, message: string) => {
    setBusyId(u.id);
    try {
      replace(await action());
      toast.success(message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1>Người dùng</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + Tạo nhân viên
        </button>
      </div>
      <div className="filter-bar">
        <form
          className="input-group"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(qInput.trim());
            setPage(0);
          }}
        >
          <input type="search" value={qInput} placeholder="Email, tên, SĐT" onChange={(e) => setQInput(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-sm">
            Tìm
          </button>
        </form>
        <select
          value={role}
          aria-label="Vai trò"
          onChange={(e) => {
            setRole(e.target.value as Role | '');
            setPage(0);
          }}
        >
          <option value="">Mọi vai trò</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      {users.loading && !users.data && <Loading />}
      {users.error && <ErrorBox message={users.error} onRetry={users.reload} />}
      {users.data && users.data.content.length === 0 && <EmptyState icon="👥" title="Không có người dùng phù hợp" />}
      {users.data && users.data.content.length > 0 && (
        <>
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>SĐT</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Tham gia</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.data.content.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <tr key={u.id} className={u.enabled ? '' : 'row-muted'}>
                      <td>
                        <strong>{u.fullName}</strong>
                        {self && <span className="muted small"> (bạn)</span>}
                        <div className="muted small">{u.email}</div>
                      </td>
                      <td>{u.phone ?? '—'}</td>
                      <td>
                        <select
                          value={u.role}
                          disabled={self || busyId === u.id}
                          aria-label={`Vai trò của ${u.email}`}
                          onChange={(e) =>
                            run(
                              u,
                              () => adminApi.setUserRole(u.id, e.target.value as Role),
                              `Đã đổi vai trò ${u.email}`,
                            )
                          }
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{u.enabled ? <Badge tone="success">Hoạt động</Badge> : <Badge tone="danger">Đã khóa</Badge>}</td>
                      <td className="small">{formatDate(u.createdAt)}</td>
                      <td>
                        {!self && (
                          <button
                            type="button"
                            className={`btn btn-sm ${u.enabled ? 'btn-danger-outline' : 'btn-outline'}`}
                            disabled={busyId === u.id}
                            onClick={() =>
                              run(
                                u,
                                () => adminApi.setUserEnabled(u.id, !u.enabled),
                                u.enabled ? `Đã khóa ${u.email}` : `Đã mở khóa ${u.email}`,
                              )
                            }
                          >
                            {u.enabled ? 'Khóa' : 'Mở khóa'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={users.data.page} totalPages={users.data.totalPages} onChange={setPage} />
        </>
      )}
      {creating && (
        <CreateUserForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            users.reload();
          }}
        />
      )}
    </>
  );
}
