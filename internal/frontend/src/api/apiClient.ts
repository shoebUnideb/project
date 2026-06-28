export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  constructor(status: number, data: unknown, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ── Cookie helpers (shared across localhost ports for SSO) ────────────

const _MAX_AGE = 30 * 24 * 3600;

function _setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax; max-age=${_MAX_AGE}`;
}
function _getCookie(name: string): string {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function _delCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

// ── Token storage helpers ────────────────────────────────────────────

export const tokens = {
  getAccess:  (): string => _getCookie('gile_access'),
  getRefresh: (): string => _getCookie('gile_refresh'),
  setAccess:  (t: string) => _setCookie('gile_access', t),
  set: (a: string, r: string) => {
    _setCookie('gile_access', a);
    _setCookie('gile_refresh', r);
  },
  clear: () => {
    _delCookie('gile_access');
    _delCookie('gile_refresh');
  },
  isExpired: (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now() + 30_000; // 30s buffer
    } catch { return true; }
  },
  decode: (token: string): Record<string, unknown> | null => {
    try { return JSON.parse(atob(token.split('.')[1])); }
    catch { return null; }
  },
};

// ── Token refresh (de-duplicated) ────────────────────────────────────

let _refreshPromise: Promise<string> | null = null;

async function _doRefresh(): Promise<string> {
  const refresh = tokens.getRefresh();
  if (!refresh) throw new Error('No refresh token');
  const res = await fetch('/api/auth/token/refresh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    tokens.clear();
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  const data = await res.json();
  if (data.refresh) tokens.set(data.access, data.refresh);
  else tokens.setAccess(data.access);
  return data.access;
}

export function refreshAccessToken(): Promise<string> {
  if (!_refreshPromise) {
    _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
}

// ── Core request function ────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  let accessToken = tokens.getAccess();

  // Proactively refresh when close to expiry
  if (accessToken && tokens.isExpired(accessToken)) {
    try { accessToken = await refreshAccessToken(); }
    catch { /* redirect already handled in _doRefresh */ }
  }

  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let init: RequestInit = { method, headers };

  if (body instanceof FormData) {
    init = { ...init, body };
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init = { ...init, body: JSON.stringify(body) };
  }

  let res = await fetch(path, init);

  // 401 mid-flight → try one refresh then retry
  if (res.status === 401 && tokens.getRefresh()) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(path, { ...init, headers });
    } catch {
      throw new ApiError(401, null, 'Session expired');
    }
  }

  if (res.status === 204) return undefined as unknown as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

// ── Public API ───────────────────────────────────────────────────────

const apiClient = {
  get:      <T>(path: string)                => request<T>('GET', path),
  post:     <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch:    <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete:   <T = void>(path: string)         => request<T>('DELETE', path),
  postForm: <T>(path: string, fd: FormData)  => request<T>('POST', path, fd),
  patchForm:<T>(path: string, fd: FormData)  => request<T>('PATCH', path, fd),

  // No-op — kept so existing call sites don't need changes.
  // CSRF is no longer needed; JWT Bearer replaces cookie auth.
  async initCsrf() {},
};

export default apiClient;
