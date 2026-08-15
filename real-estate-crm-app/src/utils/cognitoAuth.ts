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
import { isNativeApp, hasNativeRuntime } from '../lib/platform';
import {
  setSecret,
  getSecret,
  removeSecret,
  SECURE_KEY_REFRESH_TOKEN,
} from '../lib/secureStore';
import { openAuthBrowser, closeAuthBrowser } from '../lib/nativeAuth';

/**
 * Marks a request as coming from the native app.
 *
 * The auth service only honours this when the request Origin is also a native
 * origin, which a browser cannot forge — so an XSS on the web app cannot set
 * this header to have a refresh token returned in the response body.
 */
function nativeClientHeaders(): Record<string, string> {
  return isNativeApp() ? { 'X-Client-Platform': 'native' } : {};
}

// --- Env-driven config ---

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN as string;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_AUTH_REDIRECT_URI as string;
const LOGOUT_URI = import.meta.env.VITE_AUTH_LOGOUT_URI as string;
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string;

// --- Public helpers ---

/**
 * Start the Cognito Hosted UI authorize flow (Authorization Code + PKCE).
 *
 * Web navigates the page. Native opens a real system browser instead —
 * SFSafariViewController on iOS, Chrome Custom Tabs on Android — because Google
 * has refused OAuth inside embedded WebViews since July 2023, returning
 * `disallowed_useragent` (403). Navigating the Capacitor WebView here would make
 * sign-in impossible. Both of those are browsers rather than embedded WebViews,
 * which is exactly what Google's policy requires, and the flow returns to the app
 * through the custom-scheme redirect handled in lib/nativeAuth.ts.
 */
export async function redirectToLogin(): Promise<void> {
  const verifier = generateCodeVerifier();
  await storeCodeVerifier(verifier);
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

  if (hasNativeRuntime()) {
    await openAuthBrowser(authorizeUrl);
    return;
  }

  window.location.href = authorizeUrl;
}

/**
 * Exchange an authorization code for tokens via the auth microservice.
 * This keeps the client secret secure on the backend.
 */
export async function exchangeCodeForTokens(code: string): Promise<AuthTokens> {
  const codeVerifier = await getStoredCodeVerifier();
  if (!codeVerifier) {
    throw new Error('PKCE code verifier not found. Please try logging in again.');
  }

  const tokenUrl = `${AUTH_API_URL}/auth/token`;
  const body = {
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI,
  };

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...nativeClientHeaders() },
      credentials: 'include',  // Required to store httpOnly refresh_token cookie
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    await clearCodeVerifier();

    // Native clients receive the refresh token in the body and keep it in the
    // keystore. The httpOnly cookie the web app relies on cannot work here: the
    // WebView origin (capacitor://localhost) is not a trustworthy origin for a
    // Secure cookie, and WKWebView's tracking prevention blocks it as a
    // third-party cookie against the auth domain regardless. Without this the
    // 1-hour tokens simply expire and every mobile user is logged out hourly.
    if (isNativeApp() && data.refresh_token) {
      await setSecret(SECURE_KEY_REFRESH_TOKEN, data.refresh_token);
    }

    const tokens: AuthTokens = {
      idToken: data.id_token,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };

    return tokens;
  } catch (error) {
    // Handle network errors (Failed to fetch)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Unable to reach the authentication service at ${tokenUrl}. ` +
        'The API appears to be unreachable. Please check your network connection and ensure the auth API is running and accessible. ' +
        'If the problem persists, contact your system administrator.'
      );
    }

    // Re-throw other errors with context
    if (error instanceof Error) {
      throw error;
    }

    // Fallback for unknown error types
    throw new Error('Token exchange failed due to an unknown error');
  }
}

/**
 * Call POST /auth/bootstrap on the auth microservice.
 * Returns user status + registration hints.
 */
export async function callBootstrap(idToken: string) {
  const url = `${AUTH_API_URL}/auth/bootstrap`;

  try {
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
  } catch (error) {
    // Handle network errors (Failed to fetch)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Unable to reach the authentication service at ${url}. ` +
        'The API appears to be unreachable. Please check your network connection and ensure the auth API is running and accessible. ' +
        'If the problem persists, contact your system administrator.'
      );
    }

    // Re-throw other errors with context
    if (error instanceof Error) {
      throw error;
    }

    // Fallback for unknown error types
    throw new Error('Bootstrap call failed due to an unknown error');
  }
}

/**
 * Call GET /auth/me on the auth microservice.
 * Returns the current user's profile + agency info.
 */
export async function callMe(idToken: string) {
  const url = `${AUTH_API_URL}/auth/me`;

  try {
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
  } catch (error) {
    // Handle network errors (Failed to fetch)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Unable to reach the authentication service at ${url}. ` +
        'The API appears to be unreachable. Please check your network connection and ensure the auth API is running and accessible. ' +
        'If the problem persists, contact your system administrator.'
      );
    }

    // Re-throw other errors with context
    if (error instanceof Error) {
      throw error;
    }

    // Fallback for unknown error types
    throw new Error('Failed to fetch user profile due to an unknown error');
  }
}

/**
 * Call GET /auth/check-invite on the auth microservice.
 */
export async function callCheckInvite(idToken: string) {
  const url = `${AUTH_API_URL}/auth/check-invite`;

  try {
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
  } catch (error) {
    // Handle network errors (Failed to fetch)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Unable to reach the authentication service at ${url}. ` +
        'The API appears to be unreachable. Please check your network connection and ensure the auth API is running and accessible. ' +
        'If the problem persists, contact your system administrator.'
      );
    }

    // Re-throw other errors with context
    if (error instanceof Error) {
      throw error;
    }

    // Fallback for unknown error types
    throw new Error('Failed to check invites due to an unknown error');
  }
}

/**
 * Call POST /auth/accept-invite on the auth microservice.
 */
export async function callAcceptInvite(idToken: string, inviteCode: string, displayName?: string) {
  const url = `${AUTH_API_URL}/auth/accept-invite`;

  try {
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
  } catch (error) {
    // Handle network errors (Failed to fetch)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Unable to reach the authentication service at ${url}. ` +
        'The API appears to be unreachable. Please check your network connection and ensure the auth API is running and accessible. ' +
        'If the problem persists, contact your system administrator.'
      );
    }

    // Re-throw other errors with context
    if (error instanceof Error) {
      throw error;
    }

    // Fallback for unknown error types
    throw new Error('Failed to accept invite due to an unknown error');
  }
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

  try {
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
  } catch (error) {
    // Handle network errors (Failed to fetch)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Unable to reach the authentication service at ${url}. ` +
        'The API appears to be unreachable. Please check your network connection and ensure the auth API is running and accessible. ' +
        'If the problem persists, contact your system administrator.'
      );
    }

    // Re-throw other errors with context
    if (error instanceof Error) {
      throw error;
    }

    // Fallback for unknown error types
    throw new Error('Failed to register admin due to an unknown error');
  }
}

/**
 * Refresh tokens using the refresh token via the auth microservice.
 * Includes improved error handling for network issues and missing configuration.
 */
export async function refreshTokens(): Promise<AuthTokens> {
  // Ensure AUTH_API_URL is configured
  if (!AUTH_API_URL) {
    throw new Error(
      'AUTH_API_URL is not configured. Please set VITE_AUTH_API_URL in your environment variables.'
    );
  }

  const tokenUrl = `${AUTH_API_URL}/auth/refresh`;

  try {
    // Web relies on the httpOnly cookie being sent automatically. Native sends
    // the token from the keystore explicitly, because that cookie never arrives
    // in a WebView (see exchangeCodeForTokens for why).
    const storedRefreshToken = isNativeApp()
      ? await getSecret(SECURE_KEY_REFRESH_TOKEN)
      : null;

    if (isNativeApp() && !storedRefreshToken) {
      throw new Error('No stored refresh token. Please sign in again.');
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...nativeClientHeaders() },
      credentials: 'include',
      body: storedRefreshToken
        ? JSON.stringify({ refresh_token: storedRefreshToken })
        : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();

    // Cognito rotates refresh tokens. Persist the new one or the next refresh
    // after rotation fails and the user is silently signed out.
    if (isNativeApp() && data.refresh_token) {
      await setSecret(SECURE_KEY_REFRESH_TOKEN, data.refresh_token);
    }

    const tokens: AuthTokens = {
      idToken: data.id_token,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };

    return tokens;
  } catch (error) {
    // Check if it's a network error (Failed to fetch)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Unable to reach the authentication service at ${tokenUrl}. ` +
        'Please check your network connection and ensure the auth API is running and accessible. ' +
        'If the problem persists, contact your system administrator.'
      );
    }

    // Re-throw other errors with additional context
    if (error instanceof Error) {
      throw new Error(`Token refresh error: ${error.message}`);
    }

    // Fallback for unknown error types
    throw new Error('Token refresh failed due to an unknown error');
  }
}

/**
 * Sign out of the Cognito Hosted UI session, then return to the login page.
 *
 * On native the stored refresh token is destroyed first. It is the long-lived
 * credential (30 days) and it lives on the device, so leaving it behind would
 * mean "logout" did not actually end the session — the next launch could refresh
 * straight back in. The keystore wipe happens before the browser call so that a
 * failure to open the browser still leaves the user signed out locally.
 */
export async function redirectToLogout(): Promise<void> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
  });

  const logoutUrl = `${COGNITO_DOMAIN}/logout?${params.toString()}&logout_uri=${encodeURIComponent(LOGOUT_URI)}`;

  if (hasNativeRuntime()) {
    await removeSecret(SECURE_KEY_REFRESH_TOKEN);
    await closeAuthBrowser();
    await openAuthBrowser(logoutUrl);
    return;
  }

  window.location.href = logoutUrl;
}
