# EPIC-5 COMPLETION — PR-E: Analytics Layer (ZEE-003 / P10)

**Branch:** `cursor/pr-2e-analytics-layer-8e67`
**Story:** ZEE-003 (Analytics Events Layer)

## Implemented Features
- **CRM analytics module** (`src/lib/analytics.ts`): `initAnalytics()` (PostHog init, consent-gated session recording, `cookieConsentChanged` listener), `identifyUser()` (PostHog identify + Sentry setUser), `trackEvent()` (PostHog capture), `resetAnalytics()` (PostHog reset + Sentry clear).
- **Type definitions** (`src/types/analytics.ts`): `AnalyticsEvent` union (26 canonical events from §3.4) + `UserTraits` interface.
- **Sentry init** (`main.tsx`): `@sentry/react` with `VITE_SENTRY_DSN`, `tracesSampleRate: 0.1`.
- **identifyUser wiring** (`App.tsx` initAuth): after `/auth/me` success, calls `identifyUser(userId, {tenantId, role, plan, agencyName, utm_source, utm_campaign})`.
- **Page instrumentation**: `signup_started` (PhoneLogin), `onboarding_role_selected` (RoleSelection), `agency_registered` (RegisterAdmin), `buyer_added` first-use (BuyerDetails), `resetAnalytics()` on logout (CRMDashboard).
- **Server PostHog** (`agency-app/api/lib/posthog.js`): PostHog Node SDK wrapper — `serverTrack(distinctId, event, properties)` + `shutdownPostHog()`.
- **LP analytics snippet** (`head-analytics.hbs`): consent-gated vanilla JS — PostHog (always), GA4 (analytics), Meta Pixel (marketing), LinkedIn Insight (marketing), Hotjar (functional). CTA click tracking via `data-cta-id`.

## APIs Added
None (analytics is client + server lib, not routes).

## Database Changes
None.

## Infrastructure Changes
- `posthog-js` + `@sentry/react` added to CRM `package.json`.
- `posthog-node` added to server `package.json`.

## Security Enhancements
- No PII in `trackEvent` properties — email/phone only in `identifyUser` traits.
- Sentry user context: only userId + tenantId (no PII).
- LP snippet only loads trackers when matching consent category is true.

## Testing Performed
- `vite build` passes clean (1882 modules, no errors).
- `tsc --noEmit`: zero new errors from PR-E files (pre-existing errors in other files unchanged).
- Playwright tests (ZEE-003-T7) left unchecked — deferred to ZEE-012 analytics final audit.

## Known Constraints
- grievance.js PostHog stub replacement deferred: file lives on PR-B branch, not yet merged to integration. When Batch 1 merges, the real `serverTrack` import should replace the stub.
- Server Lambda Sentry init (`agency-app/api/lambda-handler.js`) out of PR-E scope.
- Remaining event instrumentation: `trial_paywall_shown` (PR-J), `subscription_started` (PR-F), `seat_limit_hit` (PR-H).

## Rollback Notes
- Remove `src/lib/analytics.ts`, `src/types/analytics.ts`, `agency-app/api/lib/posthog.js`.
- Revert `main.tsx`, `App.tsx`, `PhoneLogin.tsx`, `RoleSelection.tsx`, `RegisterAdmin.tsx`, `BuyerDetails.tsx`, `CRMDashboard.tsx` edits.
- Revert `head-analytics.hbs` to stub.
- `npm uninstall posthog-js @sentry/react` (CRM) and `npm uninstall posthog-node` (server).
