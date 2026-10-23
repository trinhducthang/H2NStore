import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { catalogApi } from '../../api/catalog';
import { ApiError, errorMessage } from '../../api/client';
import type { Category, CategoryRef, ProductDetail, ProductImage, ProductStatus, ProductUpsertRequest } from '../../api/types';
import { EmptyState, ErrorBox, FieldError, Loading } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { CATEGORY_TYPE_LABEL, CATEGORY_TYPES, formatVnd, PRODUCT_STATUS_LABEL } from '../../utils/format';

interface VariantForm {
  key: string;
  id?: number;
  name: string;
  sku: string;
  price: string;
  salePrice: string;
  stock: string;
  active: boolean;
}

interface ProductForm {
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  categoryIds: number[];
  variants: VariantForm[];
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let keySeq = 0;
const newKey = () => `v${++keySeq}`;

function emptyVariant(): VariantForm {
  return { key: newKey(), name: 'Tiêu chuẩn', sku: '', price: '', salePrice: '', stock: '10', active: true };
}

function toForm(p: ProductDetail): ProductForm {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description ?? '',
    status: p.status,
    categoryIds: p.categories.map((c) => c.id),
    variants: p.variants.map((v) => ({
      key: newKey(),
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: String(v.price),
      salePrice: v.salePrice != null ? String(v.salePrice) : '',
      stock: String(v.stock),
      active: v.active,
    })),
  };
}

function flatten(categories: Category[]): CategoryRef[] {
  const out: CategoryRef[] = [];
  for (const c of categories) {
    out.push({ id: c.id, name: c.name, slug: c.slug, type: c.type });
    for (const ch of c.children ?? []) out.push({ id: ch.id, name: `${c.name} › ${ch.name}`, slug: ch.slug, type: ch.type });
  }
  return out;
}

function validate(form: ProductForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!form.name.trim()) e.name = 'Vui lòng nhập tên sản phẩm';
  if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
    e.slug = 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang';
  }
  if (form.variants.length === 0) e.variants = 'Cần ít nhất 1 biến thể';
  const skus = new Set<string>();
  form.variants.forEach((v, i) => {
    if (!v.name.trim()) e[`variants[${i}].name`] = 'Nhập tên';
    if (!v.sku.trim()) e[`variants[${i}].sku`] = 'Nhập SKU';
    else if (skus.has(v.sku.trim().toUpperCase())) e[`variants[${i}].sku`] = 'SKU bị trùng';
    skus.add(v.sku.trim().toUpperCase());
    const price = Number(v.price);
    if (v.price === '' || !Number.isFinite(price) || price < 0) e[`variants[${i}].price`] = 'Giá không hợp lệ';
    if (v.salePrice !== '') {
      const sale = Number(v.salePrice);
      if (!Number.isFinite(sale) || sale < 0) e[`variants[${i}].salePrice`] = 'Giá KM không hợp lệ';
      else if (sale > price) e[`variants[${i}].salePrice`] = 'Giá KM phải ≤ giá gốc';
    }
    const stock = Number(v.stock);
    if (v.stock === '' || !Number.isInteger(stock) || stock < 0) e[`variants[${i}].stock`] = 'Tồn kho không hợp lệ';
  });
  return e;
}

function ImageManager({
  productId,
  images,
  onChange,
}: {
  productId: number;
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const invalid = list.find((f) => !ACCEPTED_TYPES.includes(f.type) || f.size > MAX_IMAGE_BYTES);
    if (invalid) {
      toast.error(`Ảnh “${invalid.name}” không hợp lệ (chỉ jpg/png/webp, tối đa 5MB)`);
      return;
    }
    setBusy(true);
    try {
      onChange(await adminApi.uploadImages(productId, list));
      toast.success(`Đã tải lên ${list.length} ảnh`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const setThumbnail = async (img: ProductImage) => {
    setBusy(true);
    try {
      await adminApi.updateImage(img.id, { thumbnail: true });
      onChange(images.map((i) => ({ ...i, thumbnail: i.id === img.id })));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (img: ProductImage) => {
    if (!window.confirm('Xóa ảnh này?')) return;
    setBusy(true);
    try {
      await adminApi.deleteImage(img.id);
      const rest = images.filter((i) => i.id !== img.id);
      // Backend tự chọn ảnh đầu tiên làm đại diện nếu xóa ảnh đại diện
      if (img.thumbnail && rest.length > 0 && !rest.some((i) => i.thumbnail)) rest[0] = { ...rest[0], thumbnail: true };
      onChange(rest);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">Ảnh sản phẩm ({images.length}/10)</h2>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={busy || images.length >= 10}
          onClick={() => input.current?.click()}
        >
          {busy ? 'Đang xử lý...' : '+ Tải ảnh'}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => upload(e.target.files)}
        />
      </div>
      <p className="muted small">jpg/png/webp, tối đa 5MB mỗi ảnh. Ảnh đại diện hiển thị ở danh sách sản phẩm.</p>
      {images.length === 0 ? (
        <p className="muted">Chưa có ảnh.</p>
      ) : (
        <div className="image-grid">
          {images.map((img) => (
            <figure key={img.id} className={`image-tile ${img.thumbnail ? 'is-thumb' : ''}`}>
              <img src={img.url} alt="" loading="lazy" />
              <figcaption>
                {img.thumbnail ? (
                  <span className="badge badge-primary">Ảnh đại diện</span>
                ) : (
                  <button type="button" className="link-btn" disabled={busy} onClick={() => setThumbnail(img)}>
                    Đặt đại diện
                  </button>
                )}
                <button type="button" className="link-btn danger" disabled={busy} onClick={() => remove(img)}>
                  Xóa
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminProductEditPage() {
  const { id } = useParams();
  const productId = id && id !== 'new' ? Number(id) : null;
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const product = useAsync(
    () => (productId ? adminApi.product(productId) : Promise.resolve(null)),
    [productId],
  );
  const categories = useAsync(() => (isAdmin ? adminApi.categories() : catalogApi.categories()), [isAdmin]);

  const [form, setForm] = useState<ProductForm>({
    name: '',
    slug: '',
    description: '',
    status: 'ACTIVE',
    categoryIds: [],
    variants: [emptyVariant()],
  });
  const [images, setImages] = useState<ProductImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Ảnh tách riêng khỏi form để tải/xóa ảnh không làm mất phần đang sửa dở
  useEffect(() => {
    if (!product.data) return;
    setForm(toForm(product.data));
    setImages(product.data.images);
  }, [product.data]);

  const categoryOptions = useMemo(() => {
    const options = flatten(categories.data ?? []);
    // Giữ cả danh mục hiện tại của sản phẩm (VD danh mục đã tắt) để lưu không bị mất
    for (const c of product.data?.categories ?? []) {
      if (!options.some((o) => o.id === c.id)) options.push(c);
    }
    return options;
  }, [categories.data, product.data]);

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVariant = (key: string, patch: Partial<VariantForm>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));

  const toggleCategory = (catId: number) =>
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(catId) ? f.categoryIds.filter((x) => x !== catId) : [...f.categoryIds, catId],
    }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setSaveError(null);
    if (Object.keys(errs).length) {
      setSaveError('Vui lòng kiểm tra lại các trường được đánh dấu');
      return;
    }
    const body: ProductUpsertRequest = {
      name: form.name.trim(),
      slug: form.slug.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
      categoryIds: form.categoryIds,
      variants: form.variants.map((v) => ({
        id: v.id ?? null,
        name: v.name.trim(),
        sku: v.sku.trim().toUpperCase(),
        price: Number(v.price),
        salePrice: v.salePrice === '' ? null : Number(v.salePrice),
        stock: Number(v.stock),
        active: v.active,
      })),
    };
    setSaving(true);
    try {
      if (productId) {
        const updated = await adminApi.updateProduct(productId, body);
        product.setData(updated);
        toast.success('Đã lưu sản phẩm');
      } else {
        const created = await adminApi.createProduct(body);
        toast.success('Đã tạo sản phẩm. Hãy tải ảnh cho sản phẩm.');
        navigate(`/admin/products/${created.id}`, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!productId || !window.confirm('Xóa sản phẩm này? (xóa mềm, đơn cũ vẫn giữ thông tin)')) return;
    try {
      await adminApi.deleteProduct(productId);
      toast.success('Đã xóa sản phẩm');
      navigate('/admin/products', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (productId && product.loading && !product.data) return <Loading />;
  if (productId && product.errorStatus === 404) {
    return <EmptyState icon="🔎" title="Không tìm thấy sản phẩm" action={{ to: '/admin/products', label: 'Về danh sách' }} />;
  }
  if (productId && product.error && !product.data) return <ErrorBox message={product.error} onRetry={product.reload} />;

  return (
    <>
      <div className="admin-head">
        <div>
          <Link to="/admin/products" className="link-more">
            ← Danh sách sản phẩm
          </Link>
          <h1>{productId ? `Sửa: ${product.data?.name ?? ''}` : 'Thêm sản phẩm'}</h1>
        </div>
        <div className="row-actions">
          {product.data && (
            <Link to={`/products/${product.data.slug}`} target="_blank" className="btn btn-ghost btn-sm">
              Xem trên web ↗
            </Link>
          )}
          {productId && isAdmin && (
            <button type="button" className="btn btn-danger-outline btn-sm" onClick={remove}>
              Xóa sản phẩm
            </button>
          )}
        </div>
      </div>

      <form className="form admin-form" onSubmit={save} noValidate>
        <section className="card">
          <h2 className="card-title">Thông tin</h2>
          <div className="form-grid">
            <label className="field field-full">
              <span className="field-label">
                Tên sản phẩm <span className="required">*</span>
              </span>
              <input value={form.name} maxLength={200} onChange={(e) => set('name', e.target.value)} />
              <FieldError message={errors.name} />
            </label>
            <label className="field">
              <span className="field-label">Slug (để trống = tự tạo từ tên)</span>
              <input
                value={form.slug}
                maxLength={220}
                placeholder="bo-hoa-hong-do"
                onChange={(e) => set('slug', e.target.value.toLowerCase())}
              />
              <FieldError message={errors.slug} />
            </label>
            <label className="field">
              <span className="field-label">Trạng thái</span>
              <select value={form.status} onChange={(e) => set('status', e.target.value as ProductStatus)}>
                {(Object.keys(PRODUCT_STATUS_LABEL) as ProductStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {PRODUCT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-full">
              <span className="field-label">Mô tả</span>
              <textarea
                rows={5}
                maxLength={10000}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Danh mục</h2>
          {categories.loading && !categories.data && <Loading />}
          {categories.error && <ErrorBox message={categories.error} onRetry={categories.reload} />}
          {CATEGORY_TYPES.map((type) => {
            const items = categoryOptions.filter((c) => c.type === type);
            if (!items.length) return null;
            return (
              <div key={type} className="category-check-group">
                <p className="filter-group-title">{CATEGORY_TYPE_LABEL[type]}</p>
                <div className="check-grid">
                  {items.map((c) => (
                    <label key={c.id} className="check">
                      <input
                        type="checkbox"
                        checked={form.categoryIds.includes(c.id)}
                        onChange={() => toggleCategory(c.id)}
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">Biến thể & giá</h2>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={form.variants.length >= 10}
              onClick={() => set('variants', [...form.variants, { ...emptyVariant(), name: '' }])}
            >
              + Thêm biến thể
            </button>
          </div>
          <p className="muted small">
            Ví dụ: Tiêu chuẩn / Cao cấp. Giá KM để trống nếu không giảm. Biến thể bị bỏ khỏi danh sách sẽ được tắt (không
            xóa) để giữ lịch sử đơn.
          </p>
          <FieldError message={errors.variants} />
          <div className="table-wrap">
            <table className="table variant-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>SKU</th>
                  <th>Giá (đ)</th>
                  <th>Giá KM (đ)</th>
                  <th>Tồn kho</th>
                  <th>Bán</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.variants.map((v, i) => (
                  <tr key={v.key} className={v.active ? '' : 'row-muted'}>
                    <td>
                      <input value={v.name} maxLength={100} onChange={(e) => setVariant(v.key, { name: e.target.value })} />
                      <FieldError message={errors[`variants[${i}].name`]} />
                    </td>
                    <td>
                      <input
                        value={v.sku}
                        maxLength={64}
                        onChange={(e) => setVariant(v.key, { sku: e.target.value.toUpperCase() })}
                      />
                      <FieldError message={errors[`variants[${i}].sku`]} />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={v.price}
                        onChange={(e) => setVariant(v.key, { price: e.target.value })}
                      />
                      {v.price !== '' && <span className="muted small">{formatVnd(Number(v.price))}</span>}
                      <FieldError message={errors[`variants[${i}].price`]} />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={v.salePrice}
                        onChange={(e) => setVariant(v.key, { salePrice: e.target.value })}
                      />
                      <FieldError message={errors[`variants[${i}].salePrice`]} />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={v.stock}
                        onChange={(e) => setVariant(v.key, { stock: e.target.value })}
                      />
                      <FieldError message={errors[`variants[${i}].stock`]} />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={v.active}
                        aria-label="Đang bán"
                        onChange={(e) => setVariant(v.key, { active: e.target.checked })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Bỏ biến thể"
                        disabled={form.variants.length <= 1}
                        onClick={() => set('variants', form.variants.filter((x) => x.key !== v.key))}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {saveError && <div className="alert alert-error">{saveError}</div>}
        <div className="form-actions sticky-actions">
          <Link to="/admin/products" className="btn btn-ghost">
            Hủy
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Đang lưu...' : productId ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
          </button>
        </div>
      </form>

      {product.data ? (
        <ImageManager productId={product.data.id} images={images} onChange={setImages} />
      ) : (
        <p className="muted">Lưu sản phẩm trước, sau đó tải ảnh lên.</p>
      )}
    </>
  );
}
