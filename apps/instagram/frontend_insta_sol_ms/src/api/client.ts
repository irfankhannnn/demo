/**
 * HTTP client for the Instagram microservice.
 *
 * Auth mirrors apps/crm/real-estate-crm-app/src/services/api.ts exactly: the JWT lives in
 * localStorage under `auth_id_token` and rides on `Authorization: Bearer`. The
 * two apps are served from the same CloudFront distribution and therefore the
 * same origin, so the CRM's stored token is already readable here — the
 * `?token=` hand-off below only exists for the first load after a redirect from
 * a differently-originned CRM (local dev, or a staging split).
 */

import type { ApiErrorBody } from './types';
import { CRM_URL, INSTA_API_BASE_URL, INSTA_API_CONFIG_ERROR } from '../config';

export { CRM_URL };

/** The exact key apps/crm/real-estate-crm-app/src/services/api.ts reads and writes. */
export const TOKEN_STORAGE_KEY = 'auth_id_token';

/** `https://<domain>/<base path>/api/insta` — the app prefix lives in code, not in env. */
export const API_ROOT = `${INSTA_API_BASE_URL}/api/insta`;

/** Thrown for any non-2xx response. `status` lets callers special-case 401/403. */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/* ------------------------------------------------------------------ */
/* Token plumbing                                                      */
/* ------------------------------------------------------------------ */

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Private-mode Safari and locked-down enterprise profiles both throw here.
    return null;
  }
}

export function getToken(): string | null {
  return safeLocalStorage()?.getItem(TOKEN_STORAGE_KEY) ?? null;
}

export function setToken(token: string): void {
  safeLocalStorage()?.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  safeLocalStorage()?.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Second way the token arrives: the CRM redirects to `/insta/?token=<jwt>`.
 *
 * Store it, then scrub it out of the address bar with `history.replaceState` so
 * a copied URL, a bookmark, the Referer header and the browser history never
 * carry a live credential. Called once from main.tsx before React mounts.
 */
export function captureTokenFromUrl(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');
  if (!token) return;

  setToken(token);
  url.searchParams.delete('token');

  const cleaned = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', cleaned);
}

/** Where an unauthenticated visitor gets sent, carrying a return path. */
export function crmLoginUrl(): string {
  const base = CRM_URL || '/';
  const returnTo = typeof window === 'undefined' ? '/insta/' : window.location.href;
  return `${base}/login?next=${encodeURIComponent(returnTo)}`;
}

let redirecting = false;

/**
 * A 401 means the CRM session is gone; there is no refresh path on this side
 * (the CRM owns Cognito refresh), so hand the user back to the CRM login.
 * Guarded so a page firing three parallel requests redirects once.
 */
function redirectToLogin(): void {
  if (redirecting || typeof window === 'undefined') return;
  redirecting = true;
  clearToken();
  window.location.assign(crmLoginUrl());
}

/* ------------------------------------------------------------------ */
/* Request                                                             */
/* ------------------------------------------------------------------ */

export type QueryValue = string | number | boolean | null | undefined;

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_ROOT}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, signal } = options;

  if (INSTA_API_CONFIG_ERROR) {
    throw new ApiError(
      0,
      INSTA_API_CONFIG_ERROR,
      'Copy .env.sample to .env and set VITE_INSTA_API_DOMAIN_NAME / VITE_INSTA_API_BASE_PATH before starting the app.',
    );
  }

  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new ApiError(401, 'Not signed in', 'Redirecting to the CRM login.');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'Could not reach the Instagram service',
      'Check your connection and try again.',
    );
  }

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError(401, 'Session expired', 'Redirecting to the CRM login.');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorBody = (payload ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(
      response.status,
      errorBody.error || `Request failed (HTTP ${response.status})`,
      errorBody.details,
    );
  }

  return (payload ?? {}) as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, QueryValue>, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),

  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal }),

  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PATCH', body, signal }),

  delete: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'DELETE', signal }),
};
