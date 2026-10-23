import { useState, type FormEvent } from 'react';
import { adminApi } from '../../api/admin';
import { ApiError, errorMessage } from '../../api/client';
import type { Category, CategoryRequest, CategoryType } from '../../api/types';
import { Badge } from '../../components/Badge';
import { EmptyState, ErrorBox, FieldError, Loading } from '../../components/Feedback';
import { Modal } from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { CATEGORY_TYPE_LABEL, CATEGORY_TYPES } from '../../utils/format';

function CategoryForm({
  initial,
  roots,
  onClose,
  onSaved,
}: {
  initial: Category | null;
  roots: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    type: initial?.type ?? ('DEPARTMENT' as CategoryType),
    parentId: initial?.parentId ? String(initial.parentId) : '',
    sortOrder: String(initial?.sortOrder ?? 0),
    active: initial?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Danh mục cha: cùng loại, cấp 1, không phải chính nó
  const parents = roots.filter((r) => r.type === form.type && r.id !== initial?.id);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: 'Vui lòng nhập tên danh mục' });
      return;
    }
    const body: CategoryRequest = {
      name: form.name.trim(),
      slug: form.slug.trim() || null,
      type: form.type,
      parentId: form.parentId ? Number(form.parentId) : null,
      sortOrder: Number(form.sortOrder) || 0,
      active: form.active,
    };
    setBusy(true);
    try {
      if (initial) await adminApi.updateCategory(initial.id, body);
      else await adminApi.createCategory(body);
      toast.success('Đã lưu danh mục');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? 'Sửa danh mục' : 'Thêm danh mục'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">Tên</span>
          <input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <FieldError message={errors.name} />
        </label>
        <label className="field">
          <span className="field-label">Slug (để trống = tự tạo)</span>
          <input
            value={form.slug}
            maxLength={120}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
          />
          <FieldError message={errors.slug} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Loại</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as CategoryType, parentId: '' })}
            >
              {CATEGORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CATEGORY_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Danh mục cha</span>
            <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              <option value="">— Không có (cấp 1) —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Thứ tự</span>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <span>Hiển thị</span>
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

export function AdminCategoriesPage() {
  const toast = useToast();
  const categories = useAsync(() => adminApi.categories(), []);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  const remove = async (c: Category) => {
    if (!window.confirm(`Xóa danh mục “${c.name}”? Sản phẩm sẽ được gỡ khỏi danh mục này.`)) return;
    try {
      await adminApi.deleteCategory(c.id);
      toast.success('Đã xóa danh mục');
      categories.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const roots = categories.data ?? [];

  const row = (c: Category, child = false) => (
    <tr key={c.id} className={c.active ? '' : 'row-muted'}>
      <td className={child ? 'indent' : ''}>
        {child && '↳ '}
        <strong>{c.name}</strong>
        <div className="muted small">/{c.slug}</div>
      </td>
      <td>{CATEGORY_TYPE_LABEL[c.type]}</td>
      <td className="num">{c.sortOrder}</td>
      <td>{c.active ? <Badge tone="success">Hiển thị</Badge> : <Badge>Ẩn</Badge>}</td>
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

  return (
    <>
      <div className="admin-head">
        <h1>Danh mục</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + Thêm danh mục
        </button>
      </div>
      {categories.loading && !categories.data && <Loading />}
      {categories.error && <ErrorBox message={categories.error} onRetry={categories.reload} />}
      {categories.data && categories.data.length === 0 && <EmptyState icon="🗂️" title="Chưa có danh mục" />}
      {categories.data && categories.data.length > 0 && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Loại</th>
                <th className="num">Thứ tự</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>{roots.flatMap((c) => [row(c), ...(c.children ?? []).map((ch) => row(ch, true))])}</tbody>
          </table>
        </div>
      )}
      {editing && (
        <CategoryForm
          initial={editing === 'new' ? null : editing}
          roots={roots}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            categories.reload();
          }}
        />
      )}
    </>
  );
}
