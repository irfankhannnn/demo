# Growth Platform — User Stories

Stories per epic in `As a… / I want… / so that…` form with **acceptance criteria**. IDs `US-{epic}.{n}`. Roles map to verified RBAC (`rbac.ts`: ADMIN=Owner/Manager, MEMBER=Agent) + AI agents + external systems. Tie to `M-*` metrics and real files.

---

## EP-1 — Attribution

**US-1.1** As an **Agency Owner**, I want every lead to record where it came from, so that I can see which channel makes customers.
- AC: lead create persists `leadSource,utmSource,utmMedium,utmCampaign,utmContent,campaignId,contentRef,consent`; invalid `leadSource`→`400`; legacy leads backfilled `unknown`; `leadSource` chip shows on `LeadList.tsx`. (M-AT1)

**US-1.2** As the **system**, I want duplicate inbound leads to merge on phone, so that one person isn't double-counted.
- AC: upsert keyed on `dedupeHash=sha1(tenant+normPhone)`; `firstTouchAt` immutable (`if_not_exists`), `lastTouchAt` advances; re-delivery is a no-op.

## EP-2 — Events & engine

**US-2.1** As the **system**, I want every funnel action stored as a `MKT_EVENT`, so that the funnel and attribution are computable.
- AC: `POST /api/marketing/events` writes `MKT_EVENT` (GSI4 projected); dedupe by `dedupeKey` returns `200 {deduped:true}`; PII-minimized `payload`.

**US-2.2** As the **system**, I want events routed to actions in <1s, so that automations feel instant.
- AC: ingest→SQS→`automationEngine` p95 <1s (M-O2); idempotent; failures→DLQ.

## EP-3 — Inbound capture

**US-3.1** As an **Agent**, I want IG DMs to auto-become attributed leads with an instant reply, so that no lead is missed.
- AC: IG webhook (HMAC verified) → `MKT_EVENT(dm, contentRef)` → upsert Lead(`instagram_dm`) → keyword auto-reply; speed-to-lead <5 min (M-O1).

**US-3.2** As an **Agent**, I want hot inbound leads auto-called, so that I reach them while warm.
- AC: intent keyword present + consent/phone → `ai-calling-service` invoked async, idempotent by `leadId+day`; outcome event updates `leadScore`, notifies SDR if Hot.

## EP-4 — Sequences

**US-4.1** As a **Sales Manager**, I want inactive trials auto-nudged, so that activation rises without manual chasing.
- AC: no-login 48h → enroll `winback`; due-scan worker sends WhatsApp (consent-gated) steps T0/T+2d/T+4d; reply/login/convert cancels; opt-out honored ≤1 cycle. (M-A1)

**US-4.2** As a **lead**, I want to stop messages anytime, so that my consent is respected.
- AC: opt-out keyword → `sequenceService.cancel(reason=opt_out)`, removes future `SCHEDULED_NOTIFICATION`, sets `consent.whatsapp=false`. (EP-14)

## EP-5 — Scoring

**US-5.1** As an **SDR**, I want my queue sorted hottest-first, so that I call the highest-intent lead now.
- AC: GSI7 query `STAGE#{status}` SK=padded `leadScore` `ScanIndexForward=false`; bands Hot≥70/Warm/Cold; `signals` explain the score. (M-S1)

## EP-6 — Referral

**US-6.1** As a **happy customer**, I want a shareable code that rewards me on conversion, so that I refer peers.
- AC: `POST /api/referrals`→code; `/convert` attributes `refereeLeadId`, issues reward, idempotent on `code+refereeLeadId`; GSI8 pipeline. (M-F8)

## EP-7 — Dashboard

**US-7.1** As an **Owner**, I want a live funnel + content-`OPP-*` ROI, so that I know what to make/spend more of.
- AC: `/dashboard/funnel` + `…/attribution?groupBy=content` return per-stage counts + per-`OPP-*` lead→demo→paid; winners exportable to oracle. (M-CR6)

## EP-8 — Activation

**US-8.1** As a **Product owner**, I want to see which wk-1 milestone trials drop at, so that I fix the right onboarding step.
- AC: `milestone_hit` emitted for login/data/AI-call/day3; `/dashboard/activation` shows per-milestone funnel + M-A1 rate; `customer_activated` at ≥3/4. (M-A1, M-A2)

## EP-9 — Health & expansion

**US-9.1** As **CS**, I want at-risk accounts flagged before they churn, so that I can intervene.
- AC: nightly M-S3; Critical<40 → in-app alert + win-back enroll; CS dashboard at-risk list with `signals`. (M-S3, M-A5)

**US-9.2** As **CS**, I want expansion-ready accounts surfaced, so that I upsell at the right moment.
- AC: M-S4≥70 (usage vs plan limit) lists account + suggested tier (`01-business-memory §5`). (M-R4)

## EP-10 — Campaigns

**US-10.1** As a **media-buyer**, I want ad spend synced per campaign, so that CAC and effective-CAC are real.
- AC: meta-ads MCP writes `CAMPAIGN.spend`; `/dashboard/efficiency` computes CAC=spend÷paid, eff-CAC=CPL÷trial→paid per channel. (M-EF2/EF3)

## EP-11 — AI agents

**US-11.1** As the **Founder**, I want a weekly growth brief that tells each agent what to do, so that the engine self-operates.
- AC: `growth-strategist` reads read-models, writes brief with leverage finding + per-agent actions (media-buyer/landing-page-builder/experiment-designer). (M-NS1)

## EP-12 — Dashboard suite

**US-12.1** As an **Agent (MEMBER)**, I want a Sales view scoped to only my leads, so that I focus and data stays safe.
- AC: MEMBER sales read-model filters `assignedTo=me` **server-side**; financial panels hidden (`403`); ADMIN sees all. (RBAC)

## EP-13 / EP-14 — Runtime & consent

**US-13.1** As **Ops**, I want alarms on DLQ depth and routing latency, so that I catch breakage fast.
- AC: CloudWatch metrics on ingest/route/send/DLQ; alarm DLQ>0 (M-O4), routing p95>1s (M-O2).

**US-14.1** As a **Tenant admin**, I want guaranteed isolation, so that no other agency sees my data.
- AC: every key `TENANT#`-prefixed; no query path accepts client tenant when JWT present (`extractTenantId` wins); isolation test in QA suite.

Cross-refs: `../features/features.md`, `../technical-designs/technical-designs.md`, `../coding-backlog/coding-backlog.md`, `../../analytics/metric-dictionary.md`.
