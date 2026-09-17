# 50 · Measurement

How we know whether the launch is working, using only tools that are already wired up.

> **Decision D3 (17 Sep 2026):** we measure on **PostHog + Razorpay + the NPS table + one weekly sheet**. We are not building a marketing data platform. The June 2026 "Growth Platform" designed 42 documents' worth of custom event store, scoring services and React dashboards; none of it exists in the code, and nothing in it is needed to pass the M1 PMF gate. Those designs are archived under `marketing-and-sales/launch-plan-v2/archive/content-os/` and indexed, with a build trigger each, in [`design-only-backlog.md`](./design-only-backlog.md).

Anything in this layer that describes something not in the code carries a **design only — not built** marker. If a section has no marker, you can go and look at the instrumentation today.

---

## 1. What is instrumented today

| Signal | Where it comes from | Repo evidence |
|---|---|---|
| Product + funnel events | PostHog, client-side, from the CRM SPA | `agency-app/web/src/types/analytics.ts`, `src/lib/analytics.ts` |
| Server-side events (signup, billing, seats, escalation) | PostHog Node SDK | `agency-app/api/lib/posthog.js`; callers in `routes/auth.js`, `routes/billing.js`, `routes/subscriptions.js`, `scripts/escalation-cron.js` |
| Landing-page traffic | PostHog `page_view`, plus GA4 / Meta Pixel / LinkedIn / Hotjar behind cookie consent | `agency-app/landing-pages/_partials/head-analytics.hbs` |
| UTM on signup | captured into PostHog user traits | `agency-app/web/src/pages/PhoneLogin.tsx`, `RegisterAdmin.tsx`; `types/analytics.ts` (`UserTraits`) |
| Revenue, failed payments, refunds, cancellations | Razorpay webhooks, mirrored into PostHog | `agency-app/api/routes/billing.js` |
| NPS | in-app modal → API → `NPSResponses` table | `src/components/NpsModal.tsx`, `agency-app/api/routes/feedback.js` |
| Tenant lead source and temperature | every lead carries `source`, `sourceAdapter`, `externalRef`, `reelRef`, `score` | `agency-app/api/leadIngestion.js`, `agency-app/api/utils/leadRubric.js`, `agency-app/web/src/types/crm.ts` |
| Per-reel enquiry counts (tenant feature) | Instagram service | `agency-app/instagram-api/routes/media.js`, `routes/insights.js` |

Full event vocabulary: [`posthog-event-map.md`](./posthog-event-map.md). Every metric name and formula: [`metric-dictionary.md`](./metric-dictionary.md).

## 2. What is not instrumented

- No custom marketing event store. `MKT_EVENT`, `POST /api/marketing/events`, `marketingEventsService`, `scoringService`, `MarketingDashboard.tsx` return zero hits across `apps/` and `services/`.
- No content-to-revenue join. There is no map from an `OPP-*` content row to an Instagram `mediaId` to a paying customer, so "which reel produced revenue" cannot be answered automatically. See [`attribution-today.md`](./attribution-today.md) §4.
- No activation or health scoring in code. Both are defined here as manual/PostHog-derived measures.
- No referral code, route or UI. See [`referral-program.md`](./referral-program.md) — the claim elsewhere in the repo that a referral route and a ReferFriend page are live is wrong, and is corrected there.
- RealEstateFlow's own Instagram account is not connected to our own Instagram service (Meta App Review pending, `docs/pending-items/instagram-service-status.md`), so our own funnel is not measured by the tenant tooling.

## 3. Who looks at what, and when

Salvaged from the June `dashboard-strategy.md`, cut from six role dashboards to what a solo founder actually does.

| Cadence | What | Where | Time |
|---|---|---|---|
| Daily (end of day) | trials started, demos booked, replies received, anything broken | PostHog live events + the day's standup file | 5 min |
| Weekly (Monday) | the scorecard: signups → activation → paying → NPS, against the PMF gate | [`weekly-scorecard.md`](./weekly-scorecard.md) | 20 min |
| Weekly (Monday) | which content produced conversations last week, logged by hand | [`attribution-today.md`](./attribution-today.md) §3 | 10 min |
| Monthly | PMF gate check and the Month-2 go/no-go on paid spend | `00-PLAN-OVERVIEW.md` §4, `month-2-plus/README.md` | 45 min |

There is no analyst and no `growth-strategist` agent — that agent does not exist in `tools/claude-skills/agents/`. The founder reads these, with `oracle` and `pipeline-manager` available for summarising.

## 4. Rules for this layer

1. **Targets are targets.** Every number in this layer that is not read out of a live system is a target or a threshold, and is labelled as one. We are pre-launch with zero customers, so no metric in this folder describes a result. See [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md) before any of these numbers goes into public copy — mostly, they may not.
2. **One definition per metric.** [`metric-dictionary.md`](./metric-dictionary.md) owns every definition. No other file restates a formula; they reference the `M-*` id.
3. **Prices come from `pricing.json`.** Never copy a price into a measurement doc. The pricing model is also being re-planned — see `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md` (proposed, awaiting approval).
4. **Mark the unbuilt.** A section describing something that does not exist gets the design-only marker and an entry in [`design-only-backlog.md`](./design-only-backlog.md) with the condition that would justify building it.

## 5. Files in this layer

| File | What it answers |
|---|---|
| [`metric-dictionary.md`](./metric-dictionary.md) | What does this metric mean, and where does the number come from? |
| [`posthog-event-map.md`](./posthog-event-map.md) | What events exist, what are they called, and who fires them? |
| [`weekly-scorecard.md`](./weekly-scorecard.md) | The one table the founder fills every Monday. |
| [`activation-definition.md`](./activation-definition.md) | What counts as an activated trial? (open decision D27) |
| [`attribution-today.md`](./attribution-today.md) | What can we actually trace from content to customer? |
| [`customer-health.md`](./customer-health.md) | Which paying customers are at risk, and how would we know? |
| [`prospect-lead-scoring.md`](./prospect-lead-scoring.md) | How do we rank our own B2B prospects (brokers), by hand? |
| [`referral-program.md`](./referral-program.md) | How referrals work at launch, manually. (open decision D29b) |
| [`design-only-backlog.md`](./design-only-backlog.md) | Everything archived, and what would trigger building it. |

## 6. The open decisions this layer waits on

> Open decision D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md — the activation definition. Two definitions are on the table and both are written down in [`activation-definition.md`](./activation-definition.md). The scorecard's activation row stays parameterised until it is settled.

> Open decision D29 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md — the analytics backbone (D29a), the referral programme (D29b) and which WhatsApp number talks to prospects (D29c). This layer assumes nothing beyond what is already wired, which is the conservative reading of all three.
