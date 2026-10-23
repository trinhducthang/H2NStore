import type { ApiErrorBody, ApiFieldError, AuthResponse } from './types';

/**
 * HTTP client dùng chung.
 * - Access token chỉ giữ trong bộ nhớ (biến module), không lưu localStorage.
 * - Refresh token nằm trong cookie HttpOnly (path /api/auth) do backend set.
 * - Gặp 401 thì gọi /api/auth/refresh một lần rồi gửi lại request.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: ApiFieldError[];
  readonly traceId?: string | null;

  constructor(status: number, body: Partial<ApiErrorBody> | null, fallbackMessage: string) {
    super(body?.message || fallbackMessage);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code || (status === 0 ? 'NETWORK_ERROR' : `HTTP_${status}`);
    this.errors = body?.errors ?? [];
    this.traceId = body?.traceId;
  }

  /** Lỗi theo field, dạng { "receiver.phone": "Số điện thoại không hợp lệ" } */
  fieldErrors(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const e of this.errors) {
      if (!map[e.field]) map[e.field] = e.message;
    }
    return map;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Có lỗi xảy ra, vui lòng thử lại';
}

const FALLBACK_MESSAGES: Record<number, string> = {
  0: 'Không kết nối được máy chủ, vui lòng kiểm tra mạng và thử lại',
  400: 'Yêu cầu không hợp lệ',
  401: 'Vui lòng đăng nhập để tiếp tục',
  403: 'Bạn không có quyền thực hiện thao tác này',
  404: 'Không tìm thấy dữ liệu',
  409: 'Dữ liệu đã thay đổi, vui lòng tải lại',
  413: 'Tệp quá lớn',
  429: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút',
};

function fallbackMessage(status: number): string {
  return FALLBACK_MESSAGES[status] ?? (status >= 500 ? 'Máy chủ đang gặp sự cố, vui lòng thử lại sau' : 'Có lỗi xảy ra');
}

// ------------------------------------------------------------------ token & phiên đăng nhập

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
let initialSession: Promise<AuthResponse | null> | null = null;
type AuthListener = (auth: AuthResponse | null) => void;
let authListener: AuthListener | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/** AuthContext đăng ký để biết khi refresh thành công/thất bại. */
export function setAuthListener(listener: AuthListener | null) {
  authListener = listener;
}

/**
 * Đổi refresh token (cookie) lấy access token mới. Các lời gọi đồng thời dùng chung một request,
 * vì backend xoay vòng refresh token: gửi 2 lần cùng token cũ sẽ bị coi là dùng lại và thu hồi phiên.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          accessToken = null;
          authListener?.(null);
          return null;
        }
        const data = (await res.json()) as AuthResponse;
        accessToken = data.accessToken;
        authListener?.(data);
        return data;
      } catch {
        // Lỗi mạng: không xóa phiên, chỉ báo là chưa làm mới được
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/** Khôi phục phiên khi mở app (chỉ chạy 1 lần kể cả khi React StrictMode gọi effect 2 lần). */
export function restoreSessionOnce(): Promise<AuthResponse | null> {
  if (!initialSession) initialSession = refreshSession();
  return initialSession;
}

// ------------------------------------------------------------------ request

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body; // để trình duyệt tự đặt Content-Type multipart + boundary
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, null, fallbackMessage(0));
  }
}

async function sendWithRefresh(path: string, opts: RequestOptions): Promise<Response> {
  let res = await send(path, opts);
  // Không tự refresh với chính các API /api/auth/* (VD: đăng nhập sai cũng trả 401)
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) res = await send(path, opts);
  }
  return res;
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  const type = res.headers.get('Content-Type') ?? '';
  if (type.includes('json')) {
    try {
      body = (await res.json()) as Partial<ApiErrorBody>;
    } catch {
      body = null;
    }
  }
  return new ApiError(res.status, body, fallbackMessage(res.status));
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await sendWithRefresh(path, opts);
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('Content-Type') ?? '';
  if (!type.includes('json')) return undefined as T;
  return (await res.json()) as T;
}

/** Tải file (VD: xuất Excel) kèm Bearer token. */
export async function requestBlob(
  path: string,
  query?: Record<string, QueryValue>,
): Promise<{ blob: Blob; filename: string | null }> {
  const res = await sendWithRefresh(path, { query, headers: { Accept: '*/*' } });
  if (!res.ok) throw await toApiError(res);
  const disposition = res.headers.get('Content-Disposition') ?? '';
  let filename: string | null = null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  if (star) filename = decodeURIComponent(star[1]);
  else if (plain) filename = plain[1];
  return { blob: await res.blob(), filename };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
