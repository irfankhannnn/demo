/**
 * marketplace-authentication client (API contract §3).
 * Cookie-bearing endpoints (confirm/token/refresh/logout) use credentials: 'include'
 * so the httpOnly `mp_refresh` cookie is set and sent cross-origin.
 */
import { authHttp } from './api';
import type { AuthUser, GoogleUrlResponse, PhoneStartResponse, RefreshResponse, TokenResponse } from '@/types/api';

export const authService = {
  phoneStart(phone: string) {
    return authHttp.post<PhoneStartResponse>('/auth/phone/start', { phone });
  },

  phoneConfirm(phone: string, otp: string, session: string) {
    return authHttp.post<TokenResponse>('/auth/phone/confirm', { phone, otp, session }, { credentials: 'include' });
  },

  googleUrl(redirectUri: string) {
    return authHttp.get<GoogleUrlResponse>('/auth/google/url', { query: { redirectUri } });
  },

  exchangeCode(code: string, codeVerifier: string, redirectUri: string) {
    return authHttp.post<TokenResponse>('/auth/token', { code, codeVerifier, redirectUri }, { credentials: 'include' });
  },

  refresh() {
    return authHttp.post<RefreshResponse>('/auth/refresh', {}, { credentials: 'include' });
  },

  logout() {
    return authHttp.post<{ ok: boolean }>('/auth/logout', {}, { credentials: 'include', auth: 'optional' });
  },

  me() {
    return authHttp.get<{ user: AuthUser }>('/auth/me', { auth: 'required' });
  },

  updateProfile(patch: { name?: string; email?: string }) {
    return authHttp.patch<{ user: AuthUser }>('/auth/profile', patch, { auth: 'required' });
  },

  deleteAccount() {
    return authHttp.del<{ ok: boolean }>('/auth/me', { auth: 'required', credentials: 'include' });
  },
};

const GOOGLE_PKCE_KEY = 'mp.google.pkce';

export interface GooglePkceState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  /** where to send the user after the callback completes */
  returnTo: string;
}

export function storeGooglePkce(s: GooglePkceState) {
  sessionStorage.setItem(GOOGLE_PKCE_KEY, JSON.stringify(s));
}

export function readGooglePkce(): GooglePkceState | null {
  try {
    const raw = sessionStorage.getItem(GOOGLE_PKCE_KEY);
    return raw ? (JSON.parse(raw) as GooglePkceState) : null;
  } catch {
    return null;
  }
}

export function clearGooglePkce() {
  sessionStorage.removeItem(GOOGLE_PKCE_KEY);
}
