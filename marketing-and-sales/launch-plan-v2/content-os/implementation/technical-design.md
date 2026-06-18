# Implementation — Technical Design

## Architecture diagram
```
                ┌────────────────────────────────────────────┐
 IG/FB/WA/Web   │  Webhooks / MCP (meta-ads, blotato)         │
 Meta Lead Ads ─┼──────────────► /api/marketing/events (Lambda)│
                │                 (JWT + tenantMiddleware +     │
                │                  webhook sig verify)          │
                └───────────────┬────────────────────────────-─┘
                                ▼
                       ┌──────────────────┐     ┌─────────────┐
                       │ marketingEvents  │────►│   SQS queue │
                       │ Service (MKT_EVENT)│   └──────┬──────┘
                       └──────────────────┘           ▼
                                             ┌───────────────────┐
                                             │ Automation Engine │ (extends
                                             │  event→rule router │  scheduled-
                                             └───┬───┬───┬───┬────┘  notification)
                       ┌─────────────────────────┘   │   │   └─────────────────┐
                       ▼                              ▼   ▼                     ▼
              crmDynamodbService            notification  ai-calling-service   scoringService
              (Lead + attribution)          (in-app/WA/email seq)  (auto-qualify) (lead/health)
                       │                              │                     │
                       └──────────────► DynamoDB single-table (TENANT#) ◄───┘
                                                │
                                                ▼
                                   Marketing Dashboard API + UI
```

## Data model (single-table, all `TENANT#`-scoped)
| Entity | PK | SK | Key attrs | GSI |
|---|---|---|---|---|
| Lead (extended) | TENANT#<t> | LEAD#<id> | leadSource, utm*, campaignId, contentRef, leadScore, stage, consent | GSI: source/stage/score |
| MKT_EVENT | TENANT#<t> | EVENT#<ts>#<id> | type, channel, leadRef, contentRef, payload | GSI: type+ts (funnel rollups) |
| SEQUENCE_ENROLLMENT | TENANT#<t> | SEQ#<leadId>#<seq> | seqId, step, nextAt, status | reuse SCHEDULED_NOTIFICATION |
| SCORE | TENANT#<t> | SCORE#<entityId> | leadScore, activationScore, healthScore, computedAt | — |
| REFERRAL | TENANT#<t> | REF#<code> | referrerId, refereeLeadId, status, reward | GSI: status |
| CAMPAIGN | TENANT#<t> | CAMPAIGN#<id> | channel, name, spend, utm | — |

## Key flows
- **Inbound DM:** webhook → event → upsert Lead(source=instagram_dm, contentRef) → keyword auto-reply → if qualified → AI call → SDR notify.
- **Trial inactive:** nightly scoring → if no login 48h → enroll win-back sequence → escalate at threshold.
- **Attribution rollup:** dashboard queries MKT_EVENT GSI by type+time → funnel + content `OPP-*` ROI.

## Reuse map
Scheduled sequences ← `notificationDynamodbService` (`SCHEDULED_NOTIFICATION`). Auto-qualify ← `ai-calling-service`. Multi-tenant ← `tenantMiddleware`. Auth ← existing JWT.

## Non-functional
Idempotent event handling (dedupe by event id), at-least-once via SQS + DLQ, per-tenant rate limits, consent gating for WhatsApp/email, PII minimization, audit via MKT_EVENT.
