# Agent Prompt — PR-E: Analytics Layer (PostHog CRM + LP Snippet + Server)

**Branch to create:** `cursor/pr-2e-analytics-layer-8e67`
**Base branch:** `main` (after Batch 1 is merged)
**Batch:** 2 (Day 2) — runs in parallel with PR-F, PR-G
**Hard dependency:** PR-C must be merged first (CookieConsentBanner.tsx must exist)

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md` (§5 Analytics Architecture — read this twice)
2. `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md` (§3.4 EventName types, §3.5 CookieConsent)
3. `apps/crm/real-estate-crm-app/src/components/CookieConsentBanner.tsx` (created by PR-C — understand how consent state is stored)
4. `apps/crm/real-estate-crm-app/src/App.tsx` (initAuth logic — where identifyUser will be called)
5. `apps/crm/real-estate-crm-app/src/main.tsx`
6. `apps/crm/server/routes/grievance.js` (PostHog stub created by PR-B — you replace the stub)
7. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P10-analytics-events.md`

---

## Architecture Rule (Non-Negotiable)

```
LP analytics  = head-analytics.hbs (vanilla JS) — PostHog + GA4 + Pixel + LinkedIn + Hotjar
CRM analytics = analytics.ts (TypeScript)       — PostHog ONLY. Zero GA4/Pixel/LinkedIn in this file.
Server        = posthog.js (Node)               — PostHog Node SDK
Sentry        = main.tsx + lambda-handler.js     — Error tracking only
```

---

## What to Build

### 1. `apps/crm/real-estate-crm-app/src/lib/analytics.ts`

**PostHog ONLY in this file — no GA4, no fbq, no lintrk.**

```typescript
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';
import type { AnalyticsEvent, UserTraits } from '../types/analytics';

// Call from main.tsx once on app load
export function initAnalytics(): void {
  // Read consent
  const consent = JSON.parse(localStorage.getItem('cookieConsent') || 'null');
  const analyticsAllowed = consent?.analytics ?? false;

  // Init PostHog (always init — session recording gated by consent)
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
    capture_pageview: false,  // manual control
    disable_session_recording: !analyticsAllowed,
    persistence: 'localStorage',
  });

  // Listen for consent changes from CookieConsentBanner
  window.addEventListener('cookieConsentChanged', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    posthog.set_config({ disable_session_recording: !detail.analytics });
  });
}

// Call after login (post-Cognito auth confirmed) — stitches LP anonymous session to CRM user
export function identifyUser(userId: string, traits: UserTraits): void {
  posthog.identify(userId, traits);
  Sentry.setUser({ id: userId, tenantId: traits.tenantId });
}

// Call on every key user action
export function trackEvent(name: AnalyticsEvent, properties?: Record<string, unknown>): void {
  // Never put email/phone/gstin in properties — those go in identifyUser traits only
  posthog.capture(name, properties);
}

// Call on logout
export function resetAnalytics(): void {
  posthog.reset();
  Sentry.setUser(null);
}
```

Create matching types file `src/types/analytics.ts` with `AnalyticsEvent` union type and `UserTraits` interface from `01-SHARED-CONTRACTS.md §3.4`.

### 2. `apps/crm/real-estate-crm-app/src/main.tsx` modifications

Add at top of the file:
```typescript
import { initAnalytics } from './lib/analytics';
import * as Sentry from '@sentry/react';

// Init Sentry (error tracking — not gated by consent)
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
  });
}

// Init analytics (PostHog — session recording gated by cookie consent)
initAnalytics();
```

**IMPORTANT:** Do not add GA4 gtag, Meta Pixel fbq, LinkedIn lintrk, or Hotjar to this file. These are LP-only.

### 3. `App.tsx` modification — add identifyUser call

Find the `initAuth` function in `App.tsx`. After `setAuthState('authenticated')` and the user profile is set, add:
```typescript
import { identifyUser } from './lib/analytics';

// Inside initAuth, after setUserProfile(...) call:
identifyUser(meData.user.userId, {
  tenantId: meData.user.tenantId,
  role: meData.user.role,
  plan: meData.agency?.plan || 'free',
  agencyName: meData.agency?.name,
  utm_source: sessionStorage.getItem('utm_source') || undefined,
  utm_campaign: sessionStorage.getItem('utm_campaign') || undefined,
});
```

Also in App.tsx — import and call `trackEvent` for `resetAnalytics` on logout:
```typescript
import { resetAnalytics } from './lib/analytics';
// In the logout handler: resetAnalytics();
```

### 4. CRM Page Instrumentation

Add `trackEvent()` calls to these pages. Use the `feature_first_use` pattern: check a localStorage flag before firing — only fire on the true first use.

```typescript
// Pattern for first-use events:
const FIRST_USE_KEY = `feature_first_use_${featureName}_${tenantId}`;
if (!localStorage.getItem(FIRST_USE_KEY)) {
  trackEvent('feature_first_use', { feature_name: featureName });
  localStorage.setItem(FIRST_USE_KEY, '1');
}
```

Pages to instrument (add trackEvent calls, don't restructure the components):
- `src/pages/PhoneLogin.tsx` — on mount with UTM: `trackEvent('signup_started', { utm_source: sessionStorage.getItem('utm_source') })`
- `src/pages/RoleSelection.tsx` — on submit: `trackEvent('onboarding_role_selected', { role })`
- `src/pages/RegisterAdmin.tsx` — on success: `trackEvent('agency_registered', { plan_intent: selectedPlan })`
- `src/pages/crm/BuyerList.tsx` (or AddBuyer page — find where buyer is created) — first-use: `trackEvent('buyer_added', { source: 'form' })`

**Do not instrument pages that don't exist yet** (PaywallModal, NpsModal — those PRs add their own tracking).

### 5. `apps/crm/server/lib/posthog.js`

Replaces the stub created by PR-B:
```js
import { PostHog } from 'posthog-node';

let client = null;

function getPostHogClient() {
  if (!client && process.env.POSTHOG_KEY_SERVER) {
    client = new PostHog(process.env.POSTHOG_KEY_SERVER, {
      host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

// Call from any server route with a known user ID
export async function serverTrack(distinctId, event, properties = {}) {
  const ph = getPostHogClient();
  if (!ph) return;
  try {
    await ph.capture({ distinctId, event, properties });
  } catch (err) {
    console.error('[PostHog server]', err.message);
  }
}

export async function shutdownPostHog() {
  if (client) await client.shutdownAsync();
}
```

Also update `apps/crm/server/routes/grievance.js` (created by PR-B) to replace its stub with the real import:
```js
// Replace: async function serverTrack(...) { console.log(...) }
// With:
import { serverTrack } from '../lib/posthog.js';
```

### 6. `creative/landing-pages/_partials/head-analytics.hbs`

Vanilla JS snippet for ALL LP pages. Injected into `<head>` via the build pipeline (PR-D's `head.hbs` will include this file).

Structure:
```html
<!-- Analytics (all consent-gated) — IDs injected at build time from .env -->
<script>
(function() {
  const CONSENT_VERSION = 1;
  const consent = JSON.parse(localStorage.getItem('cookieConsent') || 'null');

  // Always init PostHog (restricted if no consent)
  function initPostHog() {
    !function(t,e){...posthog snippet...}
    posthog.init('{{POSTHOG_KEY}}', {
      api_host: 'https://eu.i.posthog.com',
      disable_session_recording: !consent?.analytics,
    });
    // LP page_view event
    posthog.capture('page_view', {
      page: window.location.pathname,
      referrer: document.referrer,
      utm_source: new URLSearchParams(window.location.search).get('utm_source'),
    });
  }

  function initGA4() {
    // Only if analytics consent given
    if (!consent?.analytics) return;
    // Inject GA4 script tag with id {{GA4_ID}}
  }

  function initPixel() {
    // Only if marketing consent given
    if (!consent?.marketing) return;
    // Inject Meta Pixel with id {{META_PIXEL_ID}}
    fbq('track', 'PageView');
  }

  function initLinkedIn() {
    if (!consent?.marketing) return;
    // Inject LinkedIn Insight Tag with partner id {{LINKEDIN_PARTNER_ID}}
  }

  function initHotjar() {
    if (!consent?.functional) return;
    // Inject Hotjar snippet with hjid {{HOTJAR_ID}} hjsv {{HOTJAR_SV}}
  }

  // Always init PostHog
  initPostHog();

  // If consent already stored, init gated trackers immediately
  if (consent && consent.version === CONSENT_VERSION) {
    initGA4(); initPixel(); initLinkedIn(); initHotjar();
  }

  // Otherwise wait for cookie-consent-done event from cookie-banner.html (PR-C)
  window.addEventListener('cookie-consent-done', function(e) {
    initGA4(); initPixel(); initLinkedIn(); initHotjar();
  });

  // CTA click tracking — fire on any button/link with data-cta-id attribute
  document.addEventListener('click', function(e) {
    const el = e.target.closest('[data-cta-id]');
    if (el) {
      posthog.capture('cta_click', {
        cta_id: el.getAttribute('data-cta-id'),
        cta_label: el.textContent.trim(),
        page: window.location.pathname,
      });
      if (typeof gtag !== 'undefined') gtag('event', 'cta_click', { cta_id: el.getAttribute('data-cta-id') });
    }
  });
})();
</script>
```

**Build-time placeholders:** `{{POSTHOG_KEY}}`, `{{GA4_ID}}`, `{{META_PIXEL_ID}}`, `{{LINKEDIN_PARTNER_ID}}`, `{{HOTJAR_ID}}`, `{{HOTJAR_SV}}` — these are replaced by the Vite build from `.env` values.

### 7. `tests/analytics.spec.ts`

Playwright tests (two groups):

**LP tests:**
- Visit LP homepage → `Accept all` → assert PostHog + GA4 + Pixel + LinkedIn + Hotjar scripts loaded (network intercept)
- Reject → assert only PostHog loaded; assert GA4/Pixel/LinkedIn/Hotjar scripts NOT present
- Click a primary CTA (`data-cta-id="hero-primary"`) → assert PostHog `cta_click` event captured

**CRM tests:**
- Sign up test user → assert `signup_started` + `agency_registered` PostHog events fire in network tab
- Assert ZERO `gtag` or `fbq` or `lintrk` calls in network tab during CRM session
- `trackEvent('buyer_added')` → fires once; second buyer does NOT re-fire

---

## What NOT to Touch

- `apps/crm/server/server.js` — no route mounts (posthog.js is a lib, not a route)
- Any GA4/Pixel/LinkedIn code in CRM — strictly forbidden
- Any LP HTML files (those are PR-I)

---

## PR Description Template

```
PR-E: Analytics layer — PostHog CRM module + LP snippet + server PostHog SDK

Batch 2 | Day 2 | Parallel with PR-F, PR-G
Depends on: PR-C merged (CookieConsentBanner.tsx must exist)

Files created:
- apps/crm/real-estate-crm-app/src/lib/analytics.ts — PostHog-only CRM analytics module
- apps/crm/real-estate-crm-app/src/types/analytics.ts — EventName + UserTraits types
- creative/landing-pages/_partials/head-analytics.hbs — LP analytics snippet (5 trackers, all consent-gated)
- apps/crm/server/lib/posthog.js — PostHog Node SDK wrapper (replaces stub from PR-B)

Files modified:
- apps/crm/real-estate-crm-app/src/main.tsx — PostHog init + Sentry init
- apps/crm/real-estate-crm-app/src/App.tsx — identifyUser after auth + resetAnalytics on logout
- apps/crm/real-estate-crm-app/src/pages/PhoneLogin.tsx — UTM capture + signup_started event
- apps/crm/real-estate-crm-app/src/pages/RoleSelection.tsx — onboarding_role_selected event
- apps/crm/real-estate-crm-app/src/pages/RegisterAdmin.tsx — agency_registered event
- apps/crm/server/routes/grievance.js — replace PostHog stub with real import
- tests/analytics.spec.ts — full Playwright test suite

Architecture enforced: CRM has PostHog ONLY; LP snippet has all 5 trackers.

Source task: ZEE-003 (pre-launch-prep/P10-analytics-events.md)
```
