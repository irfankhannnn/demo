/**
 * Where to send the user after sign-in.
 *
 * Apps mounted beside the CRM on the same origin (the Instagram console at
 * /insta) send a signed-out visitor to `/login?next=<url>`. The Google sign-in
 * leaves the page for Cognito and Google, so the path is kept in sessionStorage
 * for the round trip and consumed once on /auth/callback.
 *
 * Only same-origin paths are accepted, so `next` can never become an open
 * redirect to another site.
 */

const RETURN_PATH_KEY = 'auth_return_to';

/** Paths served by other apps on this origin, outside the CRM's router. */
const EXTERNAL_APP_PREFIXES = ['/insta'];

/** Never return to a page that would start the sign-in again. */
const AUTH_PATHS = ['/login', '/signup', '/phone-login', '/auth/'];

/** Returns a same-origin `path?query#hash`, or null when `raw` is not safe. */
export function sanitizeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || typeof window === 'undefined') return null;
  let url: URL;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (AUTH_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p))) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function rememberReturnPath(raw: string | null | undefined): void {
  const path = sanitizeReturnPath(raw);
  try {
    if (path) sessionStorage.setItem(RETURN_PATH_KEY, path);
    else sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch {
    // Storage blocked: the user lands on the default page instead.
  }
}

/** Reads and clears the remembered path. */
export function takeReturnPath(): string | null {
  try {
    const stored = sessionStorage.getItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(RETURN_PATH_KEY);
    return sanitizeReturnPath(stored);
  } catch {
    return null;
  }
}

/**
 * Goes to `path`. Other apps on this origin need a full page load because the
 * CRM router would otherwise send the unknown path to /crm.
 */
export function goToReturnPath(path: string, navigate: (to: string, opts?: { replace?: boolean }) => void): void {
  if (EXTERNAL_APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))) {
    window.location.replace(path);
    return;
  }
  navigate(path, { replace: true });
}
