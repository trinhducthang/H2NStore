import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { ApiError, errorMessage } from '../api/client';

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  /** HTTP status của lỗi (0 = lỗi mạng), null nếu không lỗi */
  errorStatus: number | null;
  loading: boolean;
}

/**
 * Gọi API khi deps đổi, bỏ kết quả của lần gọi cũ (tránh race khi đổi bộ lọc nhanh).
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, errorStatus: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null, errorStatus: null }));
    loader()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, errorStatus: null, loading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState((s) => ({
          data: s.data,
          error: errorMessage(err),
          errorStatus: err instanceof ApiError ? err.status : null,
          loading: false,
        }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((data: T) => setState((s) => ({ ...s, data })), []);

  return { ...state, reload, setData };
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
