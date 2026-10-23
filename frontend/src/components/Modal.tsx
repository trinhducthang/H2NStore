import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/** Hộp thoại nhập một dòng văn bản (lý do hủy, mã đơn, ghi chú...) */
export function PromptModal({
  title,
  label,
  placeholder,
  required = false,
  multiline = false,
  confirmText = 'Xác nhận',
  danger = false,
  initialValue = '',
  description,
  onCancel,
  onSubmit,
}: {
  title: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  confirmText?: string;
  danger?: boolean;
  initialValue?: string;
  description?: ReactNode;
  onCancel: () => void;
  onSubmit: (value: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (required && !value.trim()) {
      setError('Vui lòng nhập ' + label.toLowerCase());
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onCancel}>
      <form onSubmit={submit} className="form">
        {description && <div className="muted">{description}</div>}
        <label className="field">
          <span className="field-label">
            {label}
            {required && <span className="required">*</span>}
          </span>
          {multiline ? (
            <textarea
              rows={3}
              value={value}
              placeholder={placeholder}
              maxLength={500}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
            />
          ) : (
            <input value={value} placeholder={placeholder} autoFocus onChange={(e) => setValue(e.target.value)} />
          )}
        </label>
        {error && <p className="field-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Đóng
          </button>
          <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
            {busy ? 'Đang xử lý...' : confirmText}
          </button>
        </div>
      </form>
    </Modal>
  );
}
