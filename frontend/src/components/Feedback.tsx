import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Loading({ text = 'Đang tải...' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = '🌷',
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  action?: { to: string; label: string };
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
      {action && (
        <Link to={action.to} className="btn btn-primary">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** Hiển thị lỗi của 1 field (từ ApiError.errors hoặc kiểm tra phía client) */
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}
