/**
 * Auth token and user profile storage utilities.
 * All auth data is stored in localStorage for persistence across tabs/refreshes.
 */

// --- Token keys ---
const ID_TOKEN_KEY = 'auth_id_token';
const ACCESS_TOKEN_KEY = 'auth_access_token';
// Refresh token is stored in httpOnly cookie (server-side) — NEVER in localStorage
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';
const USER_PROFILE_KEY = 'auth_user_profile';
const PROFILE_TIMESTAMP_KEY = 'auth_profile_timestamp';
const ONBOARDING_SESSION_KEY = 'auth_onboarding_session';

// --- Legacy key (to clean up) ---
const LEGACY_ADMIN_TOKEN_KEY = 'admin_token';

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string; // kept for type compat; always undefined now
  expiresIn: number; // seconds
}

function notifyAuthChanged(): void {
  window.dispatchEvent(new Event('auth-changed'));
}

export interface UserProfile {
  userId: string;
  cognitoSub: string;
  email?: string;
  phoneNumber?: string;
  role: 'ADMIN' | 'MEMBER' | 'FOUNDER' | 'OWNER' | 'MANAGER';
  tenantId: string;
  displayName: string;
  status: string;
  createdAt?: string;
  lastLoginAt?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  pendingEmail?: string;
  pendingPhoneNumber?: string;
  agency?: {
    agencyName: string;
    address?: string;
    city?: string;
    status: string;
    notificationSettings?: {
      rentedExpiryThresholdDays: number;
      meetingReminderMinutes: number;
      enableRentExpiryNotifications: boolean;
      enableMeetingReminders: boolean;
      enableKhataReminders: boolean;
    };
  } | null;
}

export function setOnboardingSession(active: boolean, notify = true): void {
  if (active) {
    localStorage.setItem(ONBOARDING_SESSION_KEY, 'true');
  } else {
    localStorage.removeItem(ONBOARDING_SESSION_KEY);
  }

  if (notify) {
    notifyAuthChanged();
  }
}

export function hasOnboardingSession(): boolean {
  return localStorage.getItem(ONBOARDING_SESSION_KEY) === 'true';
}

// --- JWT helpers ---

function base64UrlDecode(str: string): string {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return atob(base64);
}

function decodeJwtExp(idToken: string): number | null {
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(base64UrlDecode(payload));
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

// --- Token operations ---

export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(ID_TOKEN_KEY, tokens.idToken);
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  // Refresh token is stored in httpOnly cookie by the server — do NOT store in localStorage
  const jwtExp = decodeJwtExp(tokens.idToken);
  const expiresInMs =
    typeof tokens.expiresIn === 'number' && !Number.isNaN(tokens.expiresIn)
      ? tokens.expiresIn * 1000
      : 3600 * 1000;
  const expiryTime = jwtExp ?? (Date.now() + expiresInMs);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());

  // Clean up legacy tokens (including any old refresh tokens)
  localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
  localStorage.removeItem('auth_refresh_token');

  notifyAuthChanged();
}

export function getIdToken(): string | null {
  return localStorage.getItem(ID_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  // Refresh token lives in httpOnly cookie (server-managed)
  return null;
}

export function isTokenExpired(): boolean {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  return Date.now() > Number(expiry) - 60000; // Treat as expired 60s before actual expiry
}

export function isAuthenticated(): boolean {
  const token = getIdToken();
  if (!token) return false;
  return !isTokenExpired();
}

// --- User profile operations ---

export function setUserProfile(profile: UserProfile): void {
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(PROFILE_TIMESTAMP_KEY, Date.now().toString());

  notifyAuthChanged();
}

export function getUserProfile(): UserProfile | null {
  const raw = localStorage.getItem(USER_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function isProfileFresh(maxAgeSeconds = 60): boolean {
  const timestamp = localStorage.getItem(PROFILE_TIMESTAMP_KEY);
  if (!timestamp) return false;
  const age = (Date.now() - Number(timestamp)) / 1000;
  return age < maxAgeSeconds;
}

// --- Clear all auth data ---

export function clearAuthSilently(): void {
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
  localStorage.removeItem(PROFILE_TIMESTAMP_KEY);
  localStorage.removeItem(ONBOARDING_SESSION_KEY);
  localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
  localStorage.removeItem(PROFILE_TIMESTAMP_KEY);
  localStorage.removeItem(ONBOARDING_SESSION_KEY);
  localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);

  notifyAuthChanged();
}
