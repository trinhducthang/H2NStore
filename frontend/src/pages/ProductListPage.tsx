import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { catalogApi, type ProductSort } from '../api/catalog';
import type { Category } from '../api/types';
import { EmptyState, ErrorBox, Loading } from '../components/Feedback';
import { Pagination } from '../components/Pagination';
import { ProductGrid } from '../components/ProductCard';
import { useAsync } from '../hooks/useAsync';
import { CATEGORY_TYPE_LABEL, CATEGORY_TYPES } from '../utils/format';

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'bestseller', label: 'Bán chạy' },
  { value: 'price,asc', label: 'Giá tăng dần' },
  { value: 'price,desc', label: 'Giá giảm dần' },
];

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Dưới 500.000đ', max: 500_000 },
  { label: '500.000đ - 1 triệu', min: 500_000, max: 1_000_000 },
  { label: '1 - 2 triệu', min: 1_000_000, max: 2_000_000 },
  { label: 'Trên 2 triệu', min: 2_000_000 },
];

const PAGE_SIZE = 12;

function toNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function findCategory(categories: Category[], slug: string): Category | undefined {
  for (const c of categories) {
    if (c.slug === slug) return c;
    const child = c.children?.find((ch) => ch.slug === slug);
    if (child) return child;
  }
  return undefined;
}

export function ProductListPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const categorySlug = params.get('categorySlug') ?? '';
  const minPrice = toNumber(params.get('minPrice'));
  const maxPrice = toNumber(params.get('maxPrice'));
  const onSale = params.get('onSale') === 'true';
  const sortParam = params.get('sort');
  const sort: ProductSort = SORTS.some((s) => s.value === sortParam) ? (sortParam as ProductSort) : 'newest';
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minInput, setMinInput] = useState(minPrice?.toString() ?? '');
  const [maxInput, setMaxInput] = useState(maxPrice?.toString() ?? '');
  const [qInput, setQInput] = useState(q);

  useEffect(() => {
    setMinInput(minPrice?.toString() ?? '');
    setMaxInput(maxPrice?.toString() ?? '');
    setQInput(q);
  }, [minPrice, maxPrice, q]);

  const categories = useAsync(() => catalogApi.categories(), []);
  const products = useAsync(
    () =>
      catalogApi.products({
        q: q || undefined,
        categorySlug: categorySlug || undefined,
        minPrice,
        maxPrice,
        onSale: onSale || undefined,
        sort,
        page,
        size: PAGE_SIZE,
      }),
    [q, categorySlug, minPrice, maxPrice, onSale, sort, page],
  );

  const update = (changes: Record<string, string | number | undefined | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const applyPrice = (e: FormEvent) => {
    e.preventDefault();
    update({ minPrice: toNumber(minInput), maxPrice: toNumber(maxInput) });
    setFiltersOpen(false);
  };

  const activeCategory = categories.data && categorySlug ? findCategory(categories.data, categorySlug) : undefined;
  const title = q
    ? `Kết quả cho “${q}”`
    : (activeCategory?.name ?? (onSale ? 'Đang giảm giá' : 'Tất cả sản phẩm'));

  return (
    <div className="container section">
      <div className="page-head">
        <h1>{title}</h1>
        {products.data && <p className="muted">{products.data.totalElements} sản phẩm</p>}
      </div>

      <div className="listing">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`}>
          <form
            className="filter-block"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: qInput.trim() });
            }}
          >
            <h3>Tìm kiếm</h3>
            <div className="input-group">
              <input
                type="search"
                value={qInput}
                placeholder="Tên sản phẩm..."
                onChange={(e) => setQInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Tìm
              </button>
            </div>
          </form>

          <div className="filter-block">
            <h3>Danh mục</h3>
            <button
              type="button"
              className={`filter-link ${!categorySlug ? 'active' : ''}`}
              onClick={() => update({ categorySlug: undefined })}
            >
              Tất cả
            </button>
            {categories.data &&
              CATEGORY_TYPES.map((type) => {
                const items = categories.data!.filter((c) => c.type === type);
                if (!items.length) return null;
                return (
                  <div key={type} className="filter-group">
                    <p className="filter-group-title">{CATEGORY_TYPE_LABEL[type]}</p>
                    {items.map((c) => (
                      <div key={c.id}>
                        <button
                          type="button"
                          className={`filter-link ${categorySlug === c.slug ? 'active' : ''}`}
                          onClick={() => {
                            update({ categorySlug: c.slug });
                            setFiltersOpen(false);
                          }}
                        >
                          {c.name}
                        </button>
                        {c.children?.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            className={`filter-link child ${categorySlug === ch.slug ? 'active' : ''}`}
                            onClick={() => {
                              update({ categorySlug: ch.slug });
                              setFiltersOpen(false);
                            }}
                          >
                            {ch.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>

          <div className="filter-block">
            <h3>Khuyến mãi</h3>
            <button
              type="button"
              className={`filter-link ${onSale ? 'active' : ''}`}
              onClick={() => {
                update({ onSale: onSale ? undefined : 'true' });
                setFiltersOpen(false);
              }}
            >
              Đang giảm giá
            </button>
          </div>

          <div className="filter-block">
            <h3>Khoảng giá</h3>
            {PRICE_PRESETS.map((p) => {
              const active = minPrice === p.min && maxPrice === p.max;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`filter-link ${active ? 'active' : ''}`}
                  onClick={() => {
                    update(active ? { minPrice: undefined, maxPrice: undefined } : { minPrice: p.min, maxPrice: p.max });
                    setFiltersOpen(false);
                  }}
                >
                  {p.label}
                </button>
              );
            })}
            <form className="price-form" onSubmit={applyPrice}>
              <input
                type="number"
                min={0}
                step={10000}
                placeholder="Từ"
                value={minInput}
                aria-label="Giá từ"
                onChange={(e) => setMinInput(e.target.value)}
              />
              <span>-</span>
              <input
                type="number"
                min={0}
                step={10000}
                placeholder="Đến"
                value={maxInput}
                aria-label="Giá đến"
                onChange={(e) => setMaxInput(e.target.value)}
              />
              <button type="submit" className="btn btn-outline btn-sm">
                Áp dụng
              </button>
            </form>
          </div>

          {(q || categorySlug || minPrice !== undefined || maxPrice !== undefined) && (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setParams(new URLSearchParams())}>
              Xóa bộ lọc
            </button>
          )}
        </aside>

        <div className="listing-main">
          <div className="listing-toolbar">
            <button type="button" className="btn btn-outline btn-sm mobile-only" onClick={() => setFiltersOpen((o) => !o)}>
              {filtersOpen ? 'Ẩn bộ lọc' : 'Bộ lọc'}
            </button>
            <label className="sort-select">
              <span className="muted small">Sắp xếp</span>
              <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {products.loading && !products.data && <Loading />}
          {products.error && <ErrorBox message={products.error} onRetry={products.reload} />}
          {products.data && products.data.content.length === 0 && (
            <EmptyState icon="🔎" title="Không tìm thấy sản phẩm phù hợp">
              Thử bỏ bớt bộ lọc hoặc tìm với từ khóa khác (có thể gõ không dấu, ví dụ “noi chien”).
            </EmptyState>
          )}
          {products.data && products.data.content.length > 0 && (
            <div className={products.loading ? 'is-refreshing' : ''}>
              <ProductGrid products={products.data.content} />
              <Pagination
                page={products.data.page}
                totalPages={products.data.totalPages}
                onChange={(p) => update({ page: p })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
