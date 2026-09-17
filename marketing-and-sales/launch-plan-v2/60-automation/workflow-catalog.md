# Workflow catalog

The twelve end-to-end workflows the June 2026 design specified, each answered with one question: **does it exist?**

Three states are used:

- **Built** — running in the product today, for tenants. Repo path given.
- **Partly built** — some of it exists, usually in a different shape.
- **Design only** — nothing exists. Not scheduled. Indexed in [`../50-measurement/design-only-backlog.md`](../50-measurement/design-only-backlog.md).

The original catalog assumed a per-tenant `RULE` engine with `MKT_EVENT` triggers. That engine does not exist, so "built" below never means "built the way this document specified" — it means the outcome is achieved by shipped code. Trimmed from `archive/content-os/growth-platform/automations/workflow-catalog.md`; the older nine-workflow map is at `archive/content-os/automation-os/workflow-map.md`.

---

## WF-01 — New content published

**Design only.** Nothing logs a publish. Blotato is configured as an MCP in `.mcp.json` but there is no Blotato webhook and no `content_published` event anywhere in the code. This is the missing denominator for all content attribution — see [`../50-measurement/attribution-today.md`](../50-measurement/attribution-today.md) §3, which handles it with a one-line publish log.

> Open decision D22 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

## WF-02 — Comment received → auto-DM

**Built, for tenants.** Keyword rules are created per account and matched against incoming comments; a comment is claimed once so two rules cannot both answer it.
`apps/instagram/backend_insta_sol_ms/routes/rules.js`, `services/ruleMatcher.js`, `routes/comments.js`.

Limits that bind this, and belong in any copy about it: one private reply per comment, within 7 days (Meta). Not available for RealEstateFlow's own account until App Review passes.

## WF-03 — DM received → lead → scored → AI call

**Built, for tenants.** Meta webhook → `leadAnalyst` (rules plus Gemini, very_hot/hot/cold) → `crmBridge` → `POST /api/internal/adapters/leads` → `ingestLead()` → EventBridge `lead.created` → `lead-qualifier-handler` → `lead.qualified` → `lead-router-handler`. A follow-up call is requested from `services/followup-agent-service` when the lead asked for one.

Limit: free-form DM replies only inside Meta's 24-hour window.

## WF-04 — Lead magnet or web form captured

**Partly built.** Property-page enquiries and site-visit bookings create CRM leads and meetings (`apps/property-pages-ms`, `apps/crm/server/siteVisitBooking.js`), and ManyChat has a webhook into the CRM (`apps/crm/server/routes/webhooks.js`). What does not exist: a marketing lead-magnet route, consent capture on it, or UTM on the resulting lead. The lead-leakage calculator referred to in older content is a placeholder (`apps/landing-pages/agency-owners/index.html`).

## WF-05 — Demo requested → booked → reminded

**Partly built, and split across two worlds.** In-product meetings, reminders (an EventBridge rule every 5 minutes) and site-visit booking exist for tenants. **Our own** demo booking runs on Cal.com with no integration — the founder's calendar is the system of record.

## WF-06 — Demo completed → branch

**Design only for our own sales.** For tenants, `services/followup-agent-service` runs a post-visit feedback call two hours after a completed site visit, with escalation — which is the same shape, built for a different purpose. Our own post-demo follow-up is the scripts in [`../40-sales-and-conversion/`](../40-sales-and-conversion/), run by the founder.

## WF-07 — Trial started → onboarding sequence

**Partly built.** A trial email drip is deployed as a scheduled Lambda: day 10, day 12, day 14, plus a post-expiry reactivation offer (`apps/crm/server/scripts/trial-reminder-cron.js`, `TrialReminderRule` in `apps/crm/server/infra/cfn-backend.yaml`). It goes out through Brevo.

What is missing is the early half — nothing happens on days 1-3, which is when a trial is won or lost. **Extend this cron.** Do not build a second drip beside it.

The design's "day 2 AI call as the aha" does not match the product: onboarding asks the user to connect WhatsApp, and AI calls consume credits.

> Open decision D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

## WF-08 — Trial inactive → win-back

**Partly built.** The post-expiry reactivation offer in the trial cron is the email half. There is no inactivity detection (no login event, no activity scan), so "no login for 48 hours" cannot currently trigger anything.

## WF-09 — Customer activated → celebrate, ask for referral

**Design only.** No activation event is fired ([`../50-measurement/posthog-event-map.md`](../50-measurement/posthog-event-map.md) §4), and the referral programme is manual ([`../50-measurement/referral-program.md`](../50-measurement/referral-program.md)). At M1 volume this is a founder message, and it should stay one.

## WF-10 — Customer at risk → save flow

**Design only.** No health score. The signals that exist — failed payments, cancellations, seat and paywall events, NPS free text, escalations — are listed in [`../50-measurement/customer-health.md`](../50-measurement/customer-health.md) and read by hand each week.

Partly built adjacent: failed payments raise `razorpay_payment_failed` and the billing route has grace-period logic. Note that `apps/crm/server/scripts/grace-period-expiry-cron.js` exists but is **not registered as a scheduled rule** in the CFN template, so grace expiry does not currently run on its own.

## WF-11 — Referral generated → rewarded

**Design only.** Nothing exists: no code generation, no `?ref=` capture, no redemption route, no ledger. The manual programme is in [`../50-measurement/referral-program.md`](../50-measurement/referral-program.md).

> Open decision D29b — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

## WF-12 — Customer expanded

**Partly built as signals, design only as a workflow.** `paywall_seat_limit_hit`, `seat_added`, `seat_removed` and `ai_employee_provisioned` all fire to PostHog. Nothing acts on them automatically. The June version gated expansion on plan tiers and lead caps that do not exist — the real ceilings are seats (`apps/crm/server/subscriptionService.js`) and AI credits (`apps/crm/server/creditConfig.js`).

---

## Summary

| State | Workflows |
|---|---|
| Built (tenant product) | WF-02, WF-03 |
| Partly built | WF-04, WF-05, WF-07, WF-08, WF-12 |
| Design only | WF-01, WF-06, WF-09, WF-10, WF-11 |

Two of the three "built" outcomes exist only for tenants, which means RealEstateFlow could have them for its own funnel by connecting its own Instagram account as a tenant after Meta App Review — a configuration step rather than a build. That is the single highest-leverage automation item in this layer.
