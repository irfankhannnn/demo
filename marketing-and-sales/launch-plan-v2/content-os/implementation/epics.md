# Implementation — Epics

| ID | Epic | Goal | Success metric | Phase |
|---|---|---|---|---|
| **EP-1** | **Lead Attribution & Source Tracking** | Every lead carries source, UTM, campaign, content (`OPP-*`) | 100% new leads attributed | A |
| **EP-2** | **Marketing Event Ingest & Automation Engine** | Ingest IG/FB/WhatsApp/web events → route to rules | events ingested, <1s routing | A→B |
| **EP-3** | **Inbound Capture & Auto-Response** | DMs/comments/lead-ads → attributed leads + keyword auto-reply + AI auto-qualify | speed-to-lead <5 min | B |
| **EP-4** | **Lifecycle Sequences** | Nurture/onboarding/win-back/demo-reminders on scheduled engine | week-1 activation +X% | B |
| **EP-5** | **Scoring** (lead, activation, health) | Prioritise leads; predict activation/churn | scores on every lead/customer | C |
| **EP-6** | **Referral System** | Track referral codes, attribution, rewards | referral % of new customers | C |
| **EP-7** | **Marketing/Growth Dashboard** | Funnel, attribution, CAC/LTV, cohorts, content ROI | live funnel + OPP-* ROI | A→C |

## Dependency order
EP-1 → EP-2 → (EP-3, EP-4) → (EP-5, EP-6) → EP-7 (dashboard grows across all).

## Epic detail
- **EP-1** — schema + capture; foundation for everything. Backfill legacy leads `unknown`.
- **EP-2** — `MKT_EVENT` + ingest route + rules engine (extends SCHEDULED_NOTIFICATION worker) + SQS.
- **EP-3** — IG Graph API + Meta Lead Ads + keyword auto-reply + `ai-calling-service` auto-qualify.
- **EP-4** — sequence orchestration (enroll/advance/cancel) reusing scheduled notifications; WhatsApp Business API + consent.
- **EP-5** — `scoringService` + nightly recompute; signals defined in `technical-design.md`.
- **EP-6** — `REFERRAL` entity, codes, conversion attribution, reward ledger.
- **EP-7** — read-model/query API + React dashboard; CAC/LTV/cohorts/content-`OPP-*` ROI.
