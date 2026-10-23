/** page bắt đầu từ 0 như backend */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: (number | 'gap')[] = [];
  const window = 1;
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= window) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'gap') {
      pages.push('gap');
    }
  }
  return (
    <nav className="pagination" aria-label="Phân trang">
      <button type="button" className="page-btn" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        ‹
      </button>
      {pages.map((p, idx) =>
        p === 'gap' ? (
          <span key={`gap-${idx}`} className="page-gap">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`page-btn ${p === page ? 'active' : ''}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
          >
            {p + 1}
          </button>
        ),
      )}
      <button
        type="button"
        className="page-btn"
        disabled={page >= totalPages - 1}
        onClick={() => onChange(page + 1)}
      >
        ›
      </button>
    </nav>
  );
}
