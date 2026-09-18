/**
 * Fetch wrapper for marketplace-api and marketplace-authentication.
 *
 * - Base URLs from env (VITE_MARKETPLACE_API_URL / VITE_MARKETPLACE_AUTH_URL)
 * - Bearer injection from an in-memory token provider (AuthContext registers it)
 * - 401 → refresh once (POST /auth/refresh, cookie) → retry once → give up
 * - Errors normalised to ApiError { status, error, details }
 */
import { env } from '@/config/env';
import type { ApiError as ApiErrorShape } from '@/types/api';

export class ApiError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(status: number, error: string, details?: string) {
    super(error);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  get isNotFound() {
    return this.status === 404;
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  get isRateLimited() {
    return this.status === 429;
  }
}

export interface TokenProvider {
  getAccessToken(): string | null;
  /** Try to mint a new access token via the refresh cookie. Resolves null on failure. */
  refresh(): Promise<string | null>;
  /** Called when a refresh failed after a 401 — the session is gone. */
  onSessionLost(): void;
}

let provider: TokenProvider | null = null;

export function registerTokenProvider(p: TokenProvider | null) {
  provider = p;
}

export type AuthMode = 'none' | 'optional' | 'required';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** none: never send a token. optional: send if present. required: fail fast if absent. */
  auth?: AuthMode;
  /** include cookies (auth service refresh/logout/confirm endpoints) */
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

function buildUrl(base: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function doFetch(url: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: opts.credentials ?? 'omit',
    signal: opts.signal,
  });
}

async function request<T>(base: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth ?? 'none';
  let token = auth === 'none' ? null : provider?.getAccessToken() ?? null;

  if (auth === 'required' && !token && provider) {
    // No token in memory yet (fresh tab) — try the refresh cookie before failing.
    token = await provider.refresh();
  }
  if (auth === 'required' && !token) {
    throw new ApiError(401, 'Login required');
  }

  const url = buildUrl(base, path, opts.query);
  let res = await doFetch(url, opts, token);

  if (res.status === 401 && auth !== 'none' && provider && token) {
    const fresh = await provider.refresh();
    if (fresh) {
      res = await doFetch(url, opts, fresh);
    } else {
      provider.onSessionLost();
    }
  }

  if (!res.ok) {
    const body = (await parseBody(res)) as Partial<ApiErrorShape> | null;
    throw new ApiError(res.status, body?.error || res.statusText || 'Request failed', body?.details);
  }

  if (res.status === 204) return undefined as T;
  return (await parseBody(res)) as T;
}

function bind(base: string) {
  return {
    get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(base, path, { ...opts, method: 'GET' }),
    post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(base, path, { ...opts, method: 'POST', body: body ?? {} }),
    put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(base, path, { ...opts, method: 'PUT', body: body ?? {} }),
    patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(base, path, { ...opts, method: 'PATCH', body: body ?? {} }),
    del: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(base, path, { ...opts, method: 'DELETE' }),
  };
}

/** marketplace-api */
export const api = bind(env.apiUrl);
/** marketplace-authentication */
export const authHttp = bind(env.authUrl);

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Human message for toasts. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Try again?'): string {
  if (isApiError(e)) {
    if (e.isRateLimited) return 'Thoda slow — too many requests. Try again in a minute.';
    return e.details ? `${e.message} (${e.details})` : e.message || fallback;
  }
  if (e instanceof Error && e.name === 'AbortError') return '';
  if (e instanceof TypeError) return 'Network issue — check your connection and retry.';
  return fallback;
}
