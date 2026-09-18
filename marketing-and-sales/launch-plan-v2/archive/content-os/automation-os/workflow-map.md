> **SUPERSEDED →** The canonical, production catalog is now `marketing-and-sales/launch-plan-v2/60-automation/workflow-catalog.md` (12 workflows, WF-*), running on `../growth-platform/automations/automation-architecture.md`. This file is kept as the original 9-workflow sketch for history; do not fork definitions from it.

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/60-automation/workflow-catalog.md`.

# Automation OS — Workflow Map (Marketing Automations)

GTM Phase 9 marketing automation workflows. Each is fully specified: **Trigger → Workflow → Actions (service/entity) → Data written → Channels → Guardrails → Outcome/KPI.** Built on the event-router (architecture.md). Channels: in-app notifications (existing), WhatsApp (provider + opt-in), email (SES), AI calling.

## Triggers catalog
| Event type | Source | Carries |
|---|---|---|
| `content_published` | Blotato webhook / manual | OPP-*, asset id, platform |
| `comment` | IG/FB webhook | text, user, contentRef |
| `dm` | IG webhook | text, user, contentRef |
| `lead_magnet_download` | web/form | asset, contact |
| `demo_requested` | DM/web/calendar | contact, pain |
| `trial_started` | product | userId, plan |
| `trial_inactive` | nightly scoring | userId, lastLogin |
| `customer_activated` | product milestones | userId, milestones |
| `referral` | referral entity | referrerId, code |

## The 9 workflows
**1. New Reel Published** — Trigger `content_published` → log asset + open attribution window → Actions: write `MKT_EVENT(content_published, OPP-*)`; notify team; begin attributing DMs/comments to this asset. Guardrails: dedupe by asset id. **Outcome/KPI:** content-ROI baseline; reach→DM by OPP-*.

**2. Comment Received** — Trigger `comment` → detect intent keyword → Actions: if keyword match → auto-DM (content-to-conversation); write `MKT_EVENT(comment)`; flag buying-intent for SDR. Guardrails: rate-limit auto-DM; skip spam. **KPI:** comment→DM rate.

**3. DM Received** — Trigger `dm` → qualify + capture → Actions: keyword auto-reply; **upsert Lead** (`source=instagram_dm`, `contentRef=OPP-*`) via crmDynamodbService; push to `sales-os/qualification`. Guardrails: consent for follow-up; dedupe by user. **KPI:** DM→lead, speed-to-first-reply <5 min.

**4. Lead Magnet Downloaded** — Trigger `lead_magnet_download` → deliver + nurture → Actions: send asset; create Lead (`source=lead_magnet`); enroll in nurture `SEQUENCE_ENROLLMENT`. Guardrails: opt-in checkbox. **KPI:** download→demo.

**5. Demo Requested** — Trigger `demo_requested` → schedule + prep → Actions: create demo event (Calendar); reminder sequence T-24h/T-1h (SCHEDULED_NOTIFICATION); notify SDR; attach qualification brief. Guardrails: timezone IST; no double-book. **KPI:** demo no-show rate <25%.

**6. Trial Started** — Trigger `trial_started` → onboarding drip → Actions: enroll 7-day onboarding (`onboarding-script`); Day-2 AI-calling nudge; start activation tracking (SCORE). Guardrails: stop on activation. **KPI:** week-1 activation (3/4 milestones).

**7. Trial Inactive** — Trigger `trial_inactive` (no login 48h/7d) → win-back → Actions: personal WhatsApp nudge; offer setup call; escalate to founder/nurture-bot; write `MKT_EVENT(at_risk)`. Guardrails: cap touches; cancel on login. **KPI:** reactivation rate.

**8. Customer Activated** — Trigger `customer_activated` → celebrate + expand → Actions: congrats message; schedule usage review; trigger referral ask + case-study request. Guardrails: only after genuine value. **KPI:** activation→referral, NPS.

**9. Referral Requested/Sent** — Trigger `referral` → track + reward → Actions: create REFERRAL + code; attribute referee on signup; issue rewards on conversion. Guardrails: anti-abuse; reward on paid only. **KPI:** referral % of new customers.

## Rules engine spec
- Rule = `{ tenantId, on: <eventType>, if: <conditions>, do: [<actions>], guardrails }`.
- Stored per-tenant; evaluated by the engine on each `MKT_EVENT` (extends scheduled-notification worker).
- Actions are idempotent + cancellable; every action emits a follow-up `MKT_EVENT` for the audit trail + dashboard.

## Agent mapping (existing teams)
nurture-bot (4,6,7) · sdr (2,3,5) · pipeline-manager (all → pipeline) · oracle/ab-optimizer (1 → content ROI) · media-buyer (Meta Lead Ads → 4).
