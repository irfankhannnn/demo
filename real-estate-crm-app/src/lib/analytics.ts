/**
 * CRM analytics module — PostHog ONLY.
 *
 * Architecture rule: zero GA4 / fbq / lintrk / Hotjar in this file.
 * Those trackers live in the LP head-analytics.hbs snippet (PR-E).
 */
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';
import type { AnalyticsEvent, UserTraits } from '../types/analytics';
import { isNativeApp } from './platform';

/** Call from main.tsx once on app load. */
export function initAnalytics(): void {
  const consent = JSON.parse(localStorage.getItem('cookieConsent') || 'null');
  const analyticsAllowed = consent?.analytics === true;

  if (!analyticsAllowed) {
    return;
  }

  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  if (!posthogKey) {
    console.warn('PostHog key not configured. Analytics disabled.');
    return;
  }

  try {
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
      capture_pageview: false,
      // Session replay is off in the mobile builds. In a CRM it captures lead
      // names, phone numbers, khata financials, Aadhaar and PAN fields and
      // uploaded documents, and every category recorded has to be declared on
      // both the Apple privacy manifest and the Play Data Safety form. Not worth
      // the disclosure surface for the mobile release.
      disable_session_recording: isNativeApp(),
      persistence: 'memory',
    });
  } catch (err) {
    console.error('Failed to initialize PostHog:', err);
  }
}

/** Call after login — stitches LP anonymous session to CRM user. */
export function identifyUser(userId: string, traits: UserTraits): void {
  try {
    posthog.identify(userId, traits);
  } catch (err) {
    console.warn('Failed to identify user in PostHog:', err);
  }
  Sentry.setUser({ id: userId, tenantId: traits.tenantId } as Record<string, string>);
}

/** Fire on every key user action. Never put PII in properties. */
export function trackEvent(name: AnalyticsEvent, properties?: Record<string, unknown>): void {
  try {
    posthog.capture(name, properties);
  } catch (err) {
    console.warn('Failed to track event in PostHog:', err);
  }
}

/** Call on logout. */
export function resetAnalytics(): void {
  try {
    posthog.reset();
  } catch (err) {
    console.warn('Failed to reset PostHog:', err);
  }
  Sentry.setUser(null);
}
