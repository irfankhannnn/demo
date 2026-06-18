# Automation OS — Implementation Plan

Phased rollout. Detailed epics/stories/tasks/requirements in `../implementation/`.

## Phase A — Measure (Weeks 1–3) — *highest leverage first*
Goal: see the funnel. No attribution = blind.
- Add Lead attribution fields (`leadSource`, `utmSource/Medium/Campaign/Content`, `campaignId`, `contentRef`) + capture on create.
- Marketing Event ingest route + `MKT_EVENT` entity.
- IG/FB webhook receiver (comments/DMs) → create attributed leads.
- Meta Lead Ads ingest → leads.
- Basic marketing dashboard (sources, funnel counts).
**Outcome:** every lead has a source + content; funnel visible.

## Phase B — Convert (Weeks 4–6)
Goal: automate response + nurture.
- Keyword auto-reply (DM/comment).
- Nurture/onboarding sequences on scheduled-notification engine.
- Demo scheduling + reminder automation.
- WhatsApp Business API integration (opt-in, templates).
- AI-calling auto-qualify on inbound leads.
**Outcome:** speed-to-lead < 5 min; fewer no-shows; week-1 onboarding drip.

## Phase C — Optimize (Weeks 7–10)
Goal: scoring + dashboards + retention.
- Lead scoring, activation scoring, customer health scoring.
- Trial-inactive win-back + churn alerts.
- Referral entity + tracking + rewards.
- Full marketing dashboard (CAC, LTV, attribution by content `OPP-*`, cohort retention).
**Outcome:** predictable demo engine; data-driven content decisions.

## Phase D — Scale (Weeks 11+)
- A/B infra hooks (tie to ab-optimizer), advanced attribution (multi-touch), CAPI optimization, automated reporting to founder.

## Sequencing rule
Measure → Convert → Optimize → Scale. Don't build scoring before attribution exists. Each phase ships independently and is multi-tenant + consent-safe.

## Effort/owners
Backend (DynamoDB entities, routes, scoring), Frontend (dashboard, attribution capture), Integrations (Meta/WhatsApp webhooks), Infra (Lambda, secrets, scheduled worker). See `../implementation/engineering-tasks.md`.
