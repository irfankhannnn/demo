# Implementation — Engineering Tasks

## Backend (BE)
- BE-1 Add Lead attribution fields + validation in `crmDynamodbService.js` / leads create path (`leadSource`, `utmSource/Medium/Campaign/Content`, `campaignId`, `contentRef`, `consent`).
- BE-2 New `MKT_EVENT` entity (single-table, `TENANT#`) + write/query in a new `marketingEventsService.js`.
- BE-3 `/api/marketing/events` ingest route (auth, tenant, webhook signature verify, normalize).
- BE-4 Automation rules engine: extend scheduled-notification worker to evaluate event→action rules (idempotent, cancellable).
- BE-5 Sequence orchestration (enroll/advance/cancel) reusing `SCHEDULED_NOTIFICATION`.
- BE-6 AI-calling auto-qualify trigger → call `ai-calling-service` for new qualified leads.
- BE-7 Scoring service `scoringService.js` (lead/activation/health) + nightly recompute job.
- BE-8 Referral entity + code generation + conversion attribution + reward ledger.
- BE-9 Dashboard read-model/query API (funnel rollups, attribution, cohorts) via GSIs.

## Frontend (FE)
- FE-1 Capture UTM/source on web signup + pass to lead create.
- FE-2 Lead detail: show source + content + score badges (extend `LeadDetails.tsx`).
- FE-3 Marketing Dashboard page under CRM (`pages/crm/MarketingDashboard.tsx`) — funnel, sources, content ROI, CAC/LTV.
- FE-4 Referral UI (customer-facing link + admin referral list).
- FE-5 Sequence/automation admin view (rules, enrollments) — admin-only (RBAC).
- FE-6 Demo scheduling UI hook into Calendar.

## Integrations (INT)
- INT-1 Instagram Graph API app + webhooks (comments/DMs) + auto-reply.
- INT-2 WhatsApp Business API (provider) + template approval + opt-in store.
- INT-3 Meta Lead Ads ingest → events (via meta-ads MCP / webhook) + CAPI.
- INT-4 Blotato publish webhook → `content_published` event.
- INT-5 SES email sequences.
- INT-6 Calendar (Cal.com/Google) for demo booking.

## Infra (INF)
- INF-1 New Lambda(s) for ingest + scheduled worker (or extend existing handler).
- INF-2 Event queue (SQS) for reliable async routing.
- INF-3 Per-tenant secrets (Meta/WhatsApp tokens) in SSM/Secrets Manager.
- INF-4 GSIs for event/attribution/scoring queries.
- INF-5 Webhook signature verification + rate limiting + DLQ.
- INF-6 Observability (CloudWatch metrics/alarms for funnel + automation failures).

## QA
- Multi-tenant isolation tests, consent/opt-out tests, idempotency tests, attribution accuracy tests.
