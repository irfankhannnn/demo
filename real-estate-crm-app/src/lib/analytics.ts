/**
 * CRM analytics module — PostHog ONLY.
 *
 * Architecture rule: zero GA4 / fbq / lintrk / Hotjar in this file.
 * Those trackers live in the LP head-analytics.hbs snippet (PR-E).
 */
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';
import type { AnalyticsEvent, UserTraits } from '../types/analytics';

/** Call from main.tsx once on app load. */
export function initAnalytics(): void {
  const consent = JSON.parse(localStorage.getItem('cookieConsent') || 'null');
  const analyticsAllowed = consent?.analytics ?? false;

  // Always init PostHog — session recording is gated by consent.
  posthog.init(import.meta.env.VITE_POSTHOG_KEY || '', {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
    capture_pageview: false,
    disable_session_recording: !analyticsAllowed,
    persistence: 'localStorage',
  });

  // Re-evaluate when the cookie banner emits a consent change.
  window.addEventListener('cookieConsentChanged', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    posthog.set_config({ disable_session_recording: !detail.analytics });
  });
}

/** Call after login — stitches LP anonymous session to CRM user. */
export function identifyUser(userId: string, traits: UserTraits): void {
  posthog.identify(userId, traits);
  Sentry.setUser({ id: userId, tenantId: traits.tenantId } as Record<string, string>);
}

/** Fire on every key user action. Never put PII in properties. */
export function trackEvent(name: AnalyticsEvent, properties?: Record<string, unknown>): void {
  posthog.capture(name, properties);
}

/** Call on logout. */
export function resetAnalytics(): void {
  posthog.reset();
  Sentry.setUser(null);
}
