# EPIC-3 COMPLETION — PR-C: Cookie Consent Banner (ZEE-006 / P17)

**Branch:** `cursor/pr-1c-cookie-consent-8e67` (base: `cursor/launch-plan-v2-architecture-updates-8e67`)
**Story:** ZEE-006 — DPDP-compliant cookie consent (two banner variants)

## Implemented Features
- **LP banner** (`marketing-and-sales/creative/landing-pages/_partials/cookie-banner.html`) — vanilla HTML + inline CSS + inline JS. Bottom-fixed bar with 3 equal-weight buttons (Accept all / Reject non-essential / Customize). Customize opens a modal with **4 categories**: Essential (locked-on), Functional (Hotjar), Analytics (PostHog + GA4), Marketing (Meta Pixel + LinkedIn). Dispatches `cookie-consent-done` CustomEvent on save. ARIA `role="dialog"`, Esc-to-close, mobile bottom-sheet via `@media`. Exposes `window.openCookiePreferences()` for the future footer link.
- **CRM banner** (`agency-app/web/src/components/CookieConsentBanner.tsx`) — React + Tailwind, bottom-fixed. Same 3 buttons. Customize modal exposes **only 2 toggles** (Essential locked + Analytics) — **no Marketing toggle** (CRM loads PostHog only). Dispatches `cookieConsentChanged` CustomEvent on save. Returns `null` once consent of the current `version` is stored. Exposes `window.openCRMCookiePreferences()`.
- Both variants share the **same `localStorage.cookieConsent` key + schema** (01-SHARED-CONTRACTS §3.5), re-prompting only when `version !== 1`.
- Mounted `<CookieConsentBanner />` in `App.tsx` via the tagged `[LAUNCH LAYOUT COMPONENTS]` block (renders on every route).

## APIs Added
- None (client-side only; no server changes).

## Database Changes
- None.

## Infrastructure Changes
- None. Only new files + one tagged mount in `App.tsx`.

## Security / Privacy
- `localStorage.cookieConsent` holds non-sensitive boolean preferences only; no PII.
- No auth required (LP is public; CRM banner renders pre-auth on the login screen).
- **No dark patterns:** "Reject non-essential" has identical visual weight to "Accept all" (per DPDP guidance) — verified in browser.
- Marketing/analytics toggles default OFF in the Customize modal (opt-in, not pre-checked).

## Testing Performed
- `tests/cookie-consent.spec.ts` — **7/7 Playwright tests pass** (4 LP + 3 CRM):
  - LP: first visit shows → Accept hides on reload; `cookie-consent-done` fires with `analytics/marketing/functional/essential` correct; Reject sets analytics/marketing=false; Customize shows 4 categories (3 checkboxes) and per-toggle save persists.
  - CRM: first visit shows → Accept hides on reload; Reject sets analytics=false; Customize modal has **no Marketing toggle**, Analytics checkbox present.
  - LP tests are self-contained (partial served on a real origin via route-fulfill); CRM tests drive the dev server and auto-skip if it is unreachable.
- `npm run build` (vite) — passes, zero errors from PR-C files.
- `tsc --noEmit` — zero errors in PR-C files (pre-existing `TenantList.tsx` errors are unrelated and present on the base branch).

## Known Constraints / Out of Scope (documented)
- **Path mapping:** docs reference `creative/landing-pages/...`; the actual repo path is `marketing-and-sales/creative/landing-pages/...` (where all existing LP pages live). The partial was created there.
- **Tracker loading/gating** (PostHog/GA4/Pixel/LinkedIn/Hotjar init on Accept, `disable_session_recording` on Reject) lives in `head-analytics.hbs` + `analytics.ts` — **created in PR-E**. PR-C only dispatches the consent events; tracker-load network assertions are deferred to PR-E.
- **ZEE-006-T3** (injecting the partial into the 12 LP pages) and the LP/app footer "Cookie preferences" links are handled by the LP rewrite (**PR-I**). `window.openCookiePreferences()` / `window.openCRMCookiePreferences()` are exposed and ready for that wiring.
- `/legal/cookies` page is P1/P15 scope.

## Rollback Notes
- Delete `marketing-and-sales/creative/landing-pages/_partials/cookie-banner.html`, `agency-app/web/src/components/CookieConsentBanner.tsx`, `tests/cookie-consent.spec.ts`.
- Revert the `[LAUNCH COMPONENT IMPORTS]` + `[LAUNCH LAYOUT COMPONENTS]` additions in `agency-app/web/src/App.tsx`.
- No infra/DB/server changes to undo.
