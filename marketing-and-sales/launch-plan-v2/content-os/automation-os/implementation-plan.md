# Automation OS — Implementation Plan

Phased rollout (detailed epics/stories/tasks in `../implementation/`). Principle: **Measure → Convert → Optimize → Scale.** Never build scoring/dashboards before attribution exists.

## Phase A — Measure (Weeks 1–3) — highest leverage
**Scope:** Lead attribution fields (`leadSource`, `utm*`, `campaignId`, `contentRef`) + capture on create; `MKT_EVENT` entity + service; `/api/marketing/events` ingest; IG/FB webhook receiver (comments/DMs) → attributed leads; Meta Lead Ads ingest; minimal dashboard (sources + funnel counts).
**Deliverables:** every new lead attributed; funnel visible.
**Acceptance:** 100% new leads have `leadSource`; dashboard shows reach→DM→demo counts by source; webhook signatures verified.
**Dependencies:** none (foundation). **Risks:** Meta app review time → start IG/WhatsApp app submissions Day 1.

## Phase B — Convert (Weeks 4–6)
**Scope:** keyword auto-reply (DM/comment); nurture + onboarding sequences on scheduled engine; demo scheduling + reminders; WhatsApp Business API (opt-in, templates); AI-calling auto-qualify on inbound.
**Deliverables:** speed-to-lead <5 min; fewer no-shows; week-1 onboarding drip live.
**Acceptance:** inbound DM gets auto-reply <1 min; trial users enrolled in onboarding; demo reminders fire T-24h/T-1h.
**Dependencies:** Phase A events + leads. **Risks:** WhatsApp template approval → submit early; consent store required before sends.

## Phase C — Optimize (Weeks 7–10)
**Scope:** lead/activation/health scoring + nightly job; trial-inactive win-back + churn alerts; referral entity + tracking + rewards; full dashboard (CAC, LTV, attribution by `OPP-*`, cohort retention).
**Deliverables:** predictable demo engine; data-driven content decisions; referral loop measured.
**Acceptance:** every lead/customer scored; dashboard shows CAC/LTV + content-`OPP-*` ROI; referrals attributed.
**Dependencies:** Phases A+B. **Risks:** score signal quality → start with simple weighted rules, iterate.

## Phase D — Scale (Weeks 11+)
**Scope:** A/B infra hooks (→ ab-optimizer); multi-touch attribution; CAPI optimization; automated weekly founder report.
**Acceptance:** experiments tracked; automated reporting live.

## Owners
Backend (entities/routes/scoring), Frontend (dashboard/attribution capture), Integrations (Meta/WhatsApp/SES), Infra (Lambda/SQS/secrets/GSIs). See `../implementation/engineering-tasks.md` + `backlog.md`.
