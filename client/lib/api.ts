import type { ApiEnvelope } from '@/types';

/**
 * Empty by default: the browser calls this same origin and the Next server
 * proxies /api/v1 and /admin/api/v1 to API_INTERNAL_URL (app/api, app/admin/api).
 * Set NEXT_PUBLIC_API_URL only to bypass the proxy and call the API directly.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

/** Student-facing API: the `client` sub-app, mounted at the site root. */
export const API_PREFIX = '/api/v1';

/** Back-office API: the `admin` sub-app, mounted under /admin. */
export const ADMIN_PREFIX = '/admin/api/v1';

const TOKEN_KEY = 'stoudent.access_token';

/**
 * The access token lives in memory first and in localStorage as a fallback for
 * a page reload. The *refresh* token is an httpOnly cookie set by the backend
 * and is never readable here - which is the point: a XSS can at worst replay a
 * short-lived access token, not mint new ones forever.
 */
let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === 'undefined') return null;
  memoryToken = window.localStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

/**
 * "This browser has signed in before" - not a credential, just a hint so a
 * visitor who never had an account does not fire a doomed /auth/refresh (and
 * a 401 in the console) on every page load.
 */
const SESSION_HINT_KEY = 'stoudent.has_session';

export function setToken(token: string | null) {
  memoryToken = token;
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(SESSION_HINT_KEY, '1');
  } else window.localStorage.removeItem(TOKEN_KEY);
}

export function mayHaveSession(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SESSION_HINT_KEY) === '1';
}

/** Explicit logout, or a refresh cookie the API refused: forget the hint. */
export function forgetSession() {
  setToken(null);
  if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_HINT_KEY);
}

export class ApiError extends Error {
  status: number;
  code: number;
  traceId?: string;

  constructor(message: string, status: number, code: number, traceId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Set to false for the auth endpoints, which must not trigger a refresh loop. */
  retryOnExpiry?: boolean;
  /** Which sub-app to call. Defaults to the student-facing one. */
  prefix?: string;
};

let refreshing: Promise<boolean> | null = null;

/**
 * Trade the httpOnly refresh cookie for a new access token. Concurrent callers
 * share one request: the API rotates the refresh token on use, so a second
 * parallel refresh would present an already-burnt cookie and sign the user out.
 */
export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function doRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      // The cookie is gone or revoked: stop trying on every page load.
      if (response.status === 401) forgetSession();
      return false;
    }
    const payload = (await response.json()) as ApiEnvelope<{ access_token: string }>;
    if (payload?.data?.access_token) {
      setToken(payload.data.access_token);
      return true;
    }
  } catch {
    // Network failure: fall through to a normal 401.
  }
  return false;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, retryOnExpiry = true, headers, prefix = API_PREFIX, ...rest } = options;

  const send = async (): Promise<Response> => {
    const token = getToken();
    return fetch(`${API_URL}${prefix}${path}`, {
      ...rest,
      // The refresh cookie must ride along, so every call is credentialed.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await send();

  // A single silent refresh, then give up: retrying twice on a genuinely
  // expired session just delays the redirect to /login.
  if (response.status === 401 && retryOnExpiry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send();
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || (payload && payload.code >= 400)) {
    if (response.status === 401) setToken(null);
    throw new ApiError(
      payload?.msg ?? `Request failed (${response.status})`,
      response.status,
      payload?.code ?? response.status,
      payload?.trace_id,
    );
  }

  return (payload?.data ?? null) as T;
}

/**
 * Multipart upload (a photo). Same auth and single-refresh rule as apiFetch,
 * but the browser sets the multipart Content-Type and boundary itself.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const send = () => {
    const token = getToken();
    return fetch(`${API_URL}${API_PREFIX}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  };
  let response = await send();
  if (response.status === 401 && (await refreshAccessToken())) response = await send();
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || (payload && payload.code >= 400)) {
    throw new ApiError(payload?.msg ?? `Envoi impossible (${response.status})`, response.status, payload?.code ?? response.status);
  }
  return payload?.data as T;
}

function makeClient(prefix: string) {
  return {
    get: <T>(path: string, options?: RequestOptions) =>
      apiFetch<T>(path, { ...options, prefix, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      apiFetch<T>(path, { ...options, prefix, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      apiFetch<T>(path, { ...options, prefix, method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      apiFetch<T>(path, { ...options, prefix, method: 'PATCH', body }),
    delete: <T>(path: string, options?: RequestOptions) =>
      apiFetch<T>(path, { ...options, prefix, method: 'DELETE' }),
  };
}

export const api = makeClient(API_PREFIX);

/**
 * Back-office client. The bearer token is the same one - the separation is
 * enforced server-side by the admin role guard, never by which base URL the
 * browser happens to call.
 */
export const adminApi = makeClient(ADMIN_PREFIX);
