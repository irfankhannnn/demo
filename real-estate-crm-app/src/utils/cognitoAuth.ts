/**
 * Cognito Hosted UI helpers — builds authorize/logout URLs and exchanges auth codes for tokens.
 */

import {
  generateCodeVerifier,
  generateCodeChallenge,
  storeCodeVerifier,
  getStoredCodeVerifier,
  clearCodeVerifier,
} from './pkce';
import { type AuthTokens } from './authStorage';

// --- Env-driven config ---

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN as string;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_AUTH_REDIRECT_URI as string;
const LOGOUT_URI = import.meta.env.VITE_AUTH_LOGOUT_URI as string;
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string;

// --- Public helpers ---

/**
 * Redirect the browser to the Cognito Hosted UI authorize endpoint (Authorization Code + PKCE).
 */
export async function redirectToLogin(): Promise<void> {
  const verifier = generateCodeVerifier();
  storeCodeVerifier(verifier);
  const challenge = await generateCodeChallenge(verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile phone',
    code_challenge_method: 'S256',
    code_challenge: challenge,
    identity_provider: 'Google',
  });

  const authorizeUrl = `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
  window.location.href = authorizeUrl;
}

/**
 * Exchange an authorization code for tokens via the auth microservice.
 * This keeps the client secret secure on the backend.
 */
export async function exchangeCodeForTokens(code: string): Promise<AuthTokens> {
  const codeVerifier = getStoredCodeVerifier();
  if (!codeVerifier) {
    throw new Error('PKCE code verifier not found. Please try logging in again.');
  }

  const tokenUrl = `${AUTH_API_URL}/auth/token`;
  const body = {
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI,
  };

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  clearCodeVerifier();

  const tokens: AuthTokens = {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };

  return tokens;
}

/**
 * Call POST /auth/bootstrap on the auth microservice.
 * Returns user status + registration hints.
 */
export async function callBootstrap(idToken: string) {
  const url = `${AUTH_API_URL}/auth/bootstrap`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Bootstrap failed' }));
    // Check for NOT_ONBOARDED error - propagate with code for caller to handle
    if (err.code === 'NOT_ONBOARDED') {
      const notOnboardedError = new Error(err.error || 'You are not onboarded. Please contact the administrator.');
      (notOnboardedError as Error & { code: string }).code = 'NOT_ONBOARDED';
      throw notOnboardedError;
    }
    throw new Error(err.error || `Bootstrap returned ${response.status}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Call GET /auth/me on the auth microservice.
 * Returns the current user's profile + agency info.
 */
export async function callMe(idToken: string) {
  const url = `${AUTH_API_URL}/auth/me`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to get user profile' }));
    throw new Error(err.error || `GET /auth/me returned ${response.status}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Call GET /auth/check-invite on the auth microservice.
 */
export async function callCheckInvite(idToken: string) {
  const url = `${AUTH_API_URL}/auth/check-invite`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to check invites' }));
    throw new Error(err.error || `GET /auth/check-invite returned ${response.status}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Call POST /auth/accept-invite on the auth microservice.
 */
export async function callAcceptInvite(idToken: string, inviteCode: string, displayName?: string) {
  const url = `${AUTH_API_URL}/auth/accept-invite`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ inviteCode, displayName }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to accept invite' }));
    throw new Error(err.error || `POST /auth/accept-invite returned ${response.status}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Call POST /auth/register-admin on the auth microservice.
 */
export async function callRegisterAdmin(
  idToken: string,
  agencyName: string,
  displayName: string,
) {
  const url = `${AUTH_API_URL}/auth/register-admin`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ agencyName, displayName }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to register admin' }));
    throw new Error(err.error || `POST /auth/register-admin returned ${response.status}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Redirect the browser to the Cognito Hosted UI logout endpoint, then back to login page.
 */
export function redirectToLogout(): void {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: LOGOUT_URI,
  });

  const logoutUrl = `${COGNITO_DOMAIN}/logout?${params.toString()}`;
  window.location.replace(logoutUrl);
}
