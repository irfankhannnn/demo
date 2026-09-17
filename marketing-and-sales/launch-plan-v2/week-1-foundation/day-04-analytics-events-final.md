# Day 04 — Analytics Events Final Wire-up + Playwright Assertion

> **Type:** 🤖 AUTO
> **Phase:** Week 1
> **Skill(s):** `analytics-tracking` + `funnel-analysis`
> **Estimated time:** 1h founder + 6h AI

## Objective
Lock down the analytics events from P10 — confirm every event in the catalogue fires correctly across all 5 LPs + the CRM SPA + the server, save the canonical funnel + insights in PostHog, configure conversion events in GA4 + Meta Pixel + LinkedIn, and run the Playwright assertion test as a CI gate so any future PR that breaks an event fails CI.

## Why This Matters for RealEstateFlow
Day 21 metrics review depends on all events landing in PostHog with correct properties. Day 22 CRO depends on funnel drop-points being measurable. Without working analytics, decisions are made on vibes.

## User Story
As founder reading PostHog Live Events on Day 4 evening, I want every event in the P10 catalogue firing correctly with full identity tracking + cookie consent gating, so Days 17-30 metrics decisions are data-driven.

## Acceptance Criteria
- [ ] PostHog Live Events feed shows every event from P10 catalogue at least once during a single test session
- [ ] PostHog funnel "Mumbai launch funnel" saved with 8 ordered steps
- [ ] PostHog cohorts saved: "Mumbai trial users", "AI Employee adopters", "Activated users"
- [ ] PostHog dashboard saved with: weekly trial signups, activation rate, LP page-view → form-submit conversion, paywall_shown → subscription_started conversion
- [ ] GA4 conversion events configured: `signup_completed`, `subscription_started`
- [ ] Meta Pixel conversion events: `Lead`, `Subscribe`, `Purchase`
- [ ] LinkedIn Insight Tag conversion events: `signup_completed`, `subscription_started`
- [ ] Sentry SPA + server projects receiving events; 0 unresolved errors at end of day
- [ ] Cookie consent gating verified: with consent rejected, GA4/Pixel/LinkedIn snippets do NOT load (network tab confirms)
- [ ] Playwright `tests/analytics.spec.ts` 100% pass; added to CI as required check
- [ ] No PII leaked in event properties (verify via PostHog event inspector)

## Manual Steps (🧍 — small)

1. Confirm P10 PRs merged + deployed.
2. Run AI Prompt below to verify + fix any gaps.
3. PostHog: save the funnel + dashboard manually using the saved-views config from `pre-launch/10-analytics/posthog-dashboard.md`.
4. GA4: Admin → Events → mark `signup_completed` + `subscription_started` as conversions.
5. Meta Pixel: Events Manager → mark events as conversions in the right account.
6. LinkedIn Campaign Manager: configure conversion tracking with the same event names.
7. Verify cookie consent gating manually (incognito + reject all → check network tab).
8. Run `npx playwright test tests/analytics.spec.ts` → 100% pass.
9. Add the test to GitHub Actions / CI as required check on PRs.
10. Daily standup `daily-log/day04.md`.
11. Tick ACs.

## AI Prompt (🤖)

```
Read inputs:
- `marketing-and-sales/launch-plan-v2/pre-launch-prep/P10-analytics-events.md` (event catalogue)
- `marketing-and-sales/launch-implement/pre-launch/10-analytics/analytics-spec.md` (P10 output)
- `agency-app/web/src/lib/analytics.ts` (P10 SDK wrapper)
- `agency-app/web/src/components/CookieConsentBanner.tsx`
- `agency-app/api/lib/posthog.js`
- `agency-app/api/routes/billing.js` (P11 webhook events)
- `agency-app/api/routes/grievance.js` (P9 grievance event)
- `tests/analytics.spec.ts` (P10 test)

Verification tasks:

## 1. Event coverage audit
For each event in the catalogue, locate its `trackEvent(...)` call in the codebase. Produce `marketing-and-sales/launch-implement/week-1/day-04-event-coverage.csv` with columns: event, file:line, properties_match (Y/N), missing_properties.

If any event is missing or misnamed, generate a fix-PR diff for that file.

## 2. Cookie consent verification
Walk the consent flow in code: trace from CookieConsentBanner → analytics.ts → trackEvent.
Confirm that when localStorage `cookieConsent.analytics === false`:
- PostHog runs only in `disable_session_recording: true` mode (or fully disabled)
- GA4 gtag.js is NOT loaded
- Meta Pixel _fbq is NOT loaded
- LinkedIn Insight Tag is NOT loaded
- Hotjar is NOT loaded

If any tracker leaks past consent gate, produce fix-PR diff.

## 3. PII safety scan
Scan all `trackEvent(...)` calls for properties containing email, phone, gstin, or full names. Standard events should NOT contain raw PII (use `posthog.identify()` once for traits, not on every event). Produce list of violations + fix-PR diffs.

## 4. Playwright run
Output instructions for the founder to run the suite + interpret failures. If any spec fails, produce a fix-PR diff for the test file or the underlying code.

## 5. Funnel + dashboard config
Output `marketing-and-sales/launch-implement/week-1/day-04-posthog-config.md` with the exact PostHog UI clicks to save the 8-step funnel + dashboard + cohorts. Use Insights URLs and copy-pasteable filter JSON where PostHog supports.

## 6. Final verification report
Save `marketing-and-sales/launch-implement/week-1/day-04-analytics-verification.md` with: events covered (X/Y), tests passing (X/Y), known gaps, fix-by-day for any P1.

Stop. Do not deploy fixes; produce diffs only.
```

## Inputs
- P10 outputs
- Live PostHog + GA4 + Meta + LinkedIn + Sentry projects
- Deployed SPA + server (Day 3)

## Outputs
- `marketing-and-sales/launch-implement/week-1/day-04-event-coverage.csv`
- `.../day-04-posthog-config.md`
- `.../day-04-analytics-verification.md`
- Saved PostHog funnel + dashboard + cohorts
- Configured GA4 / Meta / LinkedIn conversions
- Playwright test in CI

## Success Criterion
Every event in catalogue fires; cookie consent gating works; Playwright green; PostHog funnel saved.

## Fallback / Plan B
If a tracker (GA4/Pixel/LinkedIn) is mis-configured, ship without it on Day 4 and add by Day 7. PostHog is the primary funnel; others are secondary.

## Risks
| Risk | Mitigation |
|---|---|
| Event missing in production | Coverage CSV catches gaps; fix Day 4 |
| Cookie consent leak | PII scan + cookie verification subtask |
| PII in events | Scan + fix; PostHog data-deletion request if leaked |
| Playwright flaky | Run 3 times; investigate flakes Day 5 |

## India / Mumbai-Specific Notes
- DPDP requires consent before non-essential tracking — verify cookie gate works for Indian users
- PostHog EU region disclosed in P1 Privacy
- All event property names ASCII; no Devanagari in event names (engine-compat)

## Dependencies
- **Blocks:** Day 21 metrics, Day 22 CRO, Day 28 NPS, Day 29 revenue audit
- **Depends on:** P10, Day 3 deploy

## Connected Skills
- `analytics-tracking` — primary
- `funnel-analysis` — verifies funnel composition
- `pr-review` — review fixes
