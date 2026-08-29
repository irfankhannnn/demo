import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { hasNativeRuntime } from '../lib/platform';

/**
 * Routes where pressing back should exit the app rather than navigate.
 *
 * These are the tops of their stacks — the dashboard, and any unauthenticated
 * entry point. Going "back" from the login screen into a stale authed screen
 * would be wrong, so those exit too.
 */
const ROOT_ROUTES = new Set([
  '/crm',
  '/login',
  '/phone-login',
  '/member/no-access',
]);

/**
 * Wire the Android hardware back button to React Router.
 *
 * Capacitor's default handling closes the app from any screen, because nothing
 * ever registered a listener — @capacitor/app was installed but never imported.
 * That means a user three levels into a lead record who presses back loses
 * their place entirely, which is jarring enough that reviewers flag it.
 *
 * Behaviour:
 *   - not at a root route -> go back one entry
 *   - at a root route with history -> go back (handles deep-link arrivals)
 *   - at a root route with no history -> minimise, which is what Android users
 *     expect from the launcher screen. Never exitApp(), since a killed process
 *     loses the session and forces a cold start.
 */
export function useAndroidBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!hasNativeRuntime()) return;

    const handle = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const atRoot = ROOT_ROUTES.has(location.pathname);

      if (!atRoot) {
        navigate(-1);
        return;
      }

      if (canGoBack) {
        navigate(-1);
        return;
      }

      CapacitorApp.minimizeApp().catch(() => {});
    });

    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, [navigate, location.pathname]);
}
