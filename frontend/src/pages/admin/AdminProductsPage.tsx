import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { errorMessage } from '../../api/client';
import type { AdminProductSummary, ProductStatus } from '../../api/types';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { Pagination } from '../../components/Pagination';
import { ProductThumb } from '../../components/ProductThumb';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { formatDateTime, formatVnd, PRODUCT_STATUS_LABEL } from '../../utils/format';

const STATUSES = Object.keys(PRODUCT_STATUS_LABEL) as ProductStatus[];

export function AdminProductsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = (params.get('status') ?? '') as ProductStatus | '';
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  const [qInput, setQInput] = useState(q);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => setQInput(q), [q]);

  const products = useAsync(() => adminApi.products({ q, status, page, size: 20 }), [q, status, page]);

  const update = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, String(v));
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const changeStatus = async (p: AdminProductSummary, next: ProductStatus) => {
    setBusyId(p.id);
    try {
      await adminApi.updateProductStatus(p.id, next);
      if (products.data) {
        products.setData({
          ...products.data,
          content: products.data.content.map((x) => (x.id === p.id ? { ...x, status: next } : x)),
        });
      }
      toast.success(`“${p.name}”: ${PRODUCT_STATUS_LABEL[next]}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p: AdminProductSummary) => {
    if (!window.confirm(`Xóa sản phẩm “${p.name}”? Đơn hàng cũ vẫn giữ thông tin sản phẩm.`)) return;
    setBusyId(p.id);
    try {
      await adminApi.deleteProduct(p.id);
      toast.success('Đã xóa sản phẩm');
      products.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1>Sản phẩm</h1>
        <Link to="/admin/products/new" className="btn btn-primary">
          + Thêm sản phẩm
        </Link>
      </div>

      <div className="filter-bar">
        <form
          className="input-group"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            update({ q: qInput.trim() });
          }}
        >
          <input type="search" value={qInput} placeholder="Tên, slug hoặc SKU" onChange={(e) => setQInput(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-sm">
            Tìm
          </button>
        </form>
        <select value={status} aria-label="Trạng thái" onChange={(e) => update({ status: e.target.value })}>
          <option value="">Mọi trạng thái</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {PRODUCT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {products.loading && !products.data && <Loading />}
      {products.error && <ErrorBox message={products.error} onRetry={products.reload} />}
      {products.data && products.data.content.length === 0 && (
        <EmptyState icon="💐" title="Chưa có sản phẩm" action={{ to: '/admin/products/new', label: 'Thêm sản phẩm' }} />
      )}
      {products.data && products.data.content.length > 0 && (
        <div className={products.loading ? 'is-refreshing' : ''}>
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Sản phẩm</th>
                  <th className="num">Giá từ</th>
                  <th className="num">Tồn kho</th>
                  <th className="num">Đã bán</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.data.content.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <ProductThumb url={p.thumbnailUrl} alt={p.name} className="table-thumb" />
                    </td>
                    <td>
                      <Link to={`/admin/products/${p.id}`} className="strong-link">
                        {p.name}
                      </Link>
                      <div className="muted small">
                        /{p.slug} · {p.variantCount} biến thể
                      </div>
                    </td>
                    <td className="num nowrap">{formatVnd(p.minPrice)}</td>
                    <td className={`num ${p.totalStock === 0 ? 'danger-text' : ''}`}>{p.totalStock}</td>
                    <td className="num">{p.soldCount}</td>
                    <td>
                      <select
                        value={p.status}
                        disabled={busyId === p.id}
                        aria-label={`Trạng thái ${p.name}`}
                        onChange={(e) => changeStatus(p, e.target.value as ProductStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {PRODUCT_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="small nowrap">{formatDateTime(p.updatedAt)}</td>
                    <td>
                      <div className="row-actions">
                        <Link to={`/admin/products/${p.id}`} className="btn btn-sm btn-outline">
                          Sửa
                        </Link>
                        <Link to={`/products/${p.slug}`} className="btn btn-sm btn-ghost" target="_blank">
                          Xem
                        </Link>
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-outline"
                            disabled={busyId === p.id}
                            onClick={() => remove(p)}
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={products.data.page}
            totalPages={products.data.totalPages}
            onChange={(pg) => update({ page: pg })}
          />
        </div>
      )}
    </>
  );
}
