/**
 * Native OAuth plumbing: system browser + custom-scheme deep link return.
 *
 * On web, Cognito redirects the page to /auth/callback and React Router renders
 * AuthCallback. There is no page to redirect on native — sign-in happens in a
 * separate browser process, and the app is brought back by the OS opening
 * `in.realestateflow.app://auth/callback?code=...`.
 *
 * This module turns that OS event back into the same in-app navigation the web
 * flow produces, so AuthCallback stays the single place that exchanges the code.
 */
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { hasNativeRuntime } from './platform';

/** Where to send the app when a deep link arrives. Set by registerDeepLinkHandler. */
type Navigate = (path: string) => void;

let listenersRegistered = false;

/**
 * Open a URL in the system browser.
 *
 * Uses SFSafariViewController on iOS and Chrome Custom Tabs on Android. Both are
 * real browsers rather than embedded WebViews, which is what Google's OAuth
 * policy requires — an embedded WebView is rejected with `disallowed_useragent`.
 */
export async function openAuthBrowser(url: string): Promise<void> {
  if (!hasNativeRuntime()) {
    window.location.href = url;
    return;
  }
  await Browser.open({ url, presentationStyle: 'popover' });
}

/**
 * Open an arbitrary external URL for the user.
 *
 * Prefer this over window.open and target="_blank". In a WebView those open a
 * blank in-app frame with no address bar, no share action and no reliable way
 * back to the app. The system browser gives the user all three.
 *
 * Fire-and-forget: opening a link should never reject into a click handler.
 */
export function openExternal(url: string): void {
  if (!hasNativeRuntime()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Browser.open({ url }).catch((err) => console.warn('Failed to open URL:', err));
}

/** Dismiss the auth browser. Safe to call when nothing is open. */
export async function closeAuthBrowser(): Promise<void> {
  if (!hasNativeRuntime()) return;
  try {
    await Browser.close();
  } catch {
    // Already closed, or the platform dismissed it when the deep link fired.
  }
}

/**
 * Convert a deep link into an in-app path.
 *
 * `in.realestateflow.app://auth/callback?code=xyz&state=abc`
 *   -> `/auth/callback?code=xyz&state=abc`
 *
 * Returns null for anything unrecognised so a malformed or hostile link cannot
 * push the user to an arbitrary route.
 */
export function deepLinkToPath(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // For a custom scheme, the "host" is the first path segment: auth/callback
  // parses to host="auth", pathname="/callback".
  const path = `/${parsed.host}${parsed.pathname}`.replace(/\/+$/, '') || '/';

  // Allowlist. Anything else is ignored rather than navigated to.
  const ALLOWED = ['/auth/callback', '/auth/logout'];
  if (!ALLOWED.includes(path)) return null;

  return `${path}${parsed.search}`;
}

/**
 * Wire up the OS deep-link event. Call once, from the app root.
 *
 * `navigate` should be React Router's navigate so the app transitions in place
 * rather than reloading — a full page load would drop React state and, in the
 * native shell, has no server to reload from.
 */
export function registerDeepLinkHandler(navigate: Navigate): () => void {
  if (!hasNativeRuntime() || listenersRegistered) return () => {};
  listenersRegistered = true;

  const handle = App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
    const path = deepLinkToPath(event.url);
    if (!path) return;

    // The browser overlay stays on screen after the redirect fires; close it
    // before navigating so the user lands on the app, not on a blank tab.
    await closeAuthBrowser();
    navigate(path);
  });

  return () => {
    listenersRegistered = false;
    handle.then((h) => h.remove()).catch(() => {});
  };
}

/**
 * Run a callback whenever the app returns to the foreground.
 *
 * The token refresh heartbeat in App.tsx is a setInterval, and iOS suspends
 * timers for backgrounded apps. Without this, an app resumed after more than an
 * hour holds an expired token and the first API call fails before the timer ever
 * gets a chance to run.
 */
export function registerResumeHandler(onResume: () => void): () => void {
  if (!hasNativeRuntime()) return () => {};

  const handle = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) onResume();
  });

  return () => {
    handle.then((h) => h.remove()).catch(() => {});
  };
}
