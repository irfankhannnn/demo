# Agent Prompt — PR-C: Cookie Consent Banner (DPDP-Compliant)

**Branch to create:** `cursor/pr-1c-cookie-consent-8e67`
**Base branch:** `main`
**Batch:** 1 (Day 1) — runs in parallel with PR-A, PR-B, PR-D

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md` (§5 Analytics, §6 Cookie Consent)
2. `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md` (§3.5 CookieConsent interface)
3. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P17-cookie-consent-banner.md`
4. `agency-app/web/src/App.tsx`

---

## Architecture Rule (Non-Negotiable)

There are TWO banner variants:
1. **LP banner** (`creative/landing-pages/_partials/cookie-banner.html`) — vanilla JS, 4 toggles, gates all 5 trackers
2. **CRM banner** (`src/components/CookieConsentBanner.tsx`) — React, 2 toggles, gates PostHog session recording ONLY

Both use the same `localStorage` key and schema.

---

## What to Build

### 1. `creative/landing-pages/_partials/cookie-banner.html`

Plain HTML + inline JS + inline CSS. This file is injected at end of `<body>` in every LP page.

**Copy behavior:**
- First visit (no consent stored): fixed bottom bar appears
- 3 buttons: "Accept all" (primary green `#22C55E`), "Reject non-essential" (outline), "Customize" (text link)
- "Customize": opens a full-screen overlay modal with 4 toggles:
  - **Essential** (locked ON): "Required for the site to work — auth, preferences, security."
  - **Functional** (toggle): "Hotjar session recording — helps us improve UX."
  - **Analytics** (toggle): "PostHog + Google Analytics — how we measure funnel performance."
  - **Marketing** (toggle): "Meta Pixel + LinkedIn — measures which ads brought you here."
- Accept all → all 4 set to true → save → dispatch `cookie-consent-done` custom event → hide banner
- Reject → all non-essential false → save → dispatch same event → hide banner
- Customize → save per-toggle state → dispatch event → hide banner
- Re-prompts only if `localStorage.cookieConsent.version !== 1`

**Storage schema (from 01-SHARED-CONTRACTS.md §3.5):**
```js
const consent = {
  essential: true,
  analytics: bool,
  marketing: bool,
  functional: bool,
  version: 1,
  timestamp: new Date().toISOString()
};
localStorage.setItem('cookieConsent', JSON.stringify(consent));
```

**Dispatch pattern (for head-analytics.hbs to listen to):**
```js
window.dispatchEvent(new CustomEvent('cookie-consent-done', { detail: consent }));
```

**Styling:** inline CSS only — no external stylesheet dependencies. Use brand colors. Bottom-fixed, z-index 9999. Mobile bottom-sheet (full-width, stacked buttons on mobile). Dark background (`#07111E`) white text.

**ARIA:** `role="dialog"`, `aria-label="Cookie consent"`. Keyboard: Tab navigates buttons; Enter/Space activates; Esc closes Customize modal.

**Footer link:** The partial must also expose a `window.openCookiePreferences = function()` for the footer "Cookie preferences" link to call.

### 2. `agency-app/web/src/components/CookieConsentBanner.tsx`

React component — **different from the LP banner — only 2 meaningful toggles**.

```typescript
// Returns null if consent already stored and version matches
// Shows banner on first visit or version change

// Customize modal toggles:
// 1. Essential (locked ON): "Required for the site to work."
// 2. Analytics (toggle): "We measure product usage via PostHog to improve the app. No ads, no retargeting."
// NO Marketing toggle — GA4/Pixel/LinkedIn are not loaded in the CRM

// On Accept all: saves {essential: true, analytics: true, version: 1, timestamp}
// On Reject: saves {essential: true, analytics: false, version: 1, timestamp}
// Dispatches 'cookieConsentChanged' custom event (analytics.ts listens to this)

// Cookie preferences link in footer: expose via context or window.openCRMCookiePreferences
```

**Visual:** Bottom-fixed Tailwind banner. Same brand colors. Same 3 buttons. Mobile-responsive. Dark mode support (`dark:` classes).

**Interaction with analytics.ts (PR-E):** This banner dispatches `window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: consent }))`. `analytics.ts` (from PR-E) listens to this and adjusts PostHog session recording mode. You don't need to implement that listener — just dispatch the event.

### 3. `tests/cookie-consent.spec.ts`

Playwright tests (two test groups):

**LP tests** (test the vanilla HTML banner in a static page):
```
- Clear localStorage → load LP homepage → assert banner visible
- Click "Accept all" → reload → assert banner NOT visible
- Click "Accept all" → assert cookie-consent-done event fired + localStorage.cookieConsent.analytics === true
- Click "Reject non-essential" → assert localStorage.cookieConsent.analytics === false + .marketing === false
- Click "Customize" → toggle Analytics off, Marketing on → save → assert correct localStorage state
```

**CRM tests** (test the React banner):
```
- Clear localStorage → load CRM (mock unauthenticated) → assert CRM banner visible
- "Accept all" → reload → assert banner NOT visible
- "Reject" → assert localStorage.cookieConsent.analytics === false
- Assert NO "Marketing" toggle exists in CRM banner customize modal
```

---

## App.tsx Modification

Find `{/* === [LAUNCH LAYOUT COMPONENTS] === */}` block and add:
```tsx
{/* PR-C */}
<CookieConsentBanner />
```

Add import at top of App.tsx:
```tsx
import CookieConsentBanner from './components/CookieConsentBanner';
```

**Only these 2 additions. Do not touch anything else in App.tsx.**

---

## What NOT to Touch

- `agency-app/api/server.js` — no server changes needed
- `creative/landing-pages/_partials/head-analytics.hbs` — created by PR-E
- Any LP HTML files — they'll inject the cookie-banner.html partial (PR-I's job)
- `src/lib/analytics.ts` — created by PR-E

---

## Acceptance Criteria

- [ ] LP banner: first visit shows; Accept → hidden on reload; Reject → non-essential trackers NOT loaded
- [ ] LP banner: Customize shows 4 toggles with correct labels
- [ ] CRM banner: only 2 toggles (Essential + Analytics — NO Marketing toggle)
- [ ] Both share same `localStorage.cookieConsent` key + version schema
- [ ] No dark patterns: "Reject non-essential" same visual size as "Accept all"
- [ ] Playwright tests 100% pass

---

## PR Description Template

```
PR-C: Cookie consent banner (DPDP-compliant) — LP variant + CRM variant

Batch 1 | Day 1 | Parallel with PR-A, PR-B, PR-D

Files created:
- creative/landing-pages/_partials/cookie-banner.html — LP vanilla JS banner (4 toggles, gates 5 trackers)
- agency-app/web/src/components/CookieConsentBanner.tsx — CRM React banner (2 toggles, gates PostHog only)
- tests/cookie-consent.spec.ts — Playwright tests for both variants

Files modified:
- agency-app/web/src/App.tsx — added CookieConsentBanner to LAUNCH LAYOUT COMPONENTS block

Architecture: LP banner (5 tracker toggles) ≠ CRM banner (PostHog-only toggle)
Both store to same localStorage.cookieConsent key with same schema version 1.

Source task: ZEE-006 (pre-launch-prep/P17-cookie-consent-banner.md)
```
