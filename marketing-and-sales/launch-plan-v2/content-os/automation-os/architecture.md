# Automation OS — Architecture

How marketing/sales automation integrates with the existing RealEstateFlow stack — additively, no rewrite. Grounded in the actual codebase.

## Current stack (verified in repo)
- **Frontend:** React + TS + Vite (`real-estate-crm-app/`).
- **Backend:** Node/Express on **AWS Lambda** (`server/lambda-handler.js`, `server/server.js`) behind API Gateway.
- **DB:** **DynamoDB single-table** — `PK`/`SK`, GSIs, `EntityType`, `TENANT#` prefix; multi-tenant via `server/tenantMiddleware.js` / `extractTenantId`. Services: `crmDynamodbService.js`, `notificationDynamodbService.js`, `enquiryDynamodbService.js`, etc.
- **Notifications:** `notificationDynamodbService.js` already supports notifications + **scheduled notifications** (`EntityType: SCHEDULED_NOTIFICATION`, typed events: RENT_EXPIRY_SOON, MEETING_REMINDER_15M, KHATA_REMINDER…). → the natural base for automation triggers + sequences.
- **AI Calling:** separate Lambda microservice (`ai-calling-service/`) — Exotel + ElevenLabs.
- **Auth/RBAC:** JWT + `validateToken`; `real-estate-crm-app/src/utils/rbac.ts` (Admin full CRUD, Member no-delete).
- **Gap (verified):** `server/routes/leads.js` leads carry status/priority/leadType/assignedTo but **no leadSource/UTM/campaign/attribution/score** — this is the core thing to add.
- **Marketing MCPs:** higgsfield, meta-ads, blotato (`.mcp.json`).

## Target architecture (additive)
```
External: IG/FB/WhatsApp/LinkedIn · Meta Lead Ads · Web signup
        │  webhooks / MCP (meta-ads, blotato)
        ▼
[Marketing Event Ingest]  POST /api/marketing/events  (Lambda; JWT/HMAC + extractTenantId)
        │  normalize → write MKT_EVENT (TENANT#)
        ▼
[SQS queue] ──► [Automation Engine] (event→rule router; extends SCHEDULED_NOTIFICATION worker)
        │            ├──► crmDynamodbService  (create/update Lead + leadSource/attribution/score)
        │            ├──► notificationService (in-app / WhatsApp / email; sequences)
        │            ├──► ai-calling-service   (auto-qualify call on new qualified lead)
        │            └──► scoringService       (lead / activation / health)
        ▼
[Marketing Dashboard API + UI]  (new CRM screen: funnel, attribution, scores)
```

## Key sequence flows (ASCII)
**A) Inbound IG DM → attributed lead → auto-qualify**
```
IG webhook → /api/marketing/events(type=dm, contentRef=OPP-x)
  → MKT_EVENT → engine: upsert Lead(source=instagram_dm, contentRef)
  → keyword auto-reply (notificationService/IG API)
  → if qualified signal → ai-calling-service.placeCall(lead)
  → notify SDR (notification)
```
**B) Trial inactive → win-back**
```
EventBridge nightly → scoringService scans logins
  → if no login 48h → enroll SEQUENCE_ENROLLMENT(winback)
  → due-sequence worker (SCHEDULED_NOTIFICATION) sends WhatsApp/email touches
  → on login/reply → cancel enrollment
```
**C) Attribution rollup**
```
Dashboard API → query GSI-EventType by type+time-range
  → join MKT_EVENT.contentRef → OPP-* ROI (reach→DM→demo→paid)
```

## Reuse vs new
| Need | Reuse | New |
|---|---|---|
| Multi-tenant | `tenantMiddleware` | — |
| Scheduled sends | `SCHEDULED_NOTIFICATION` engine | sequence orchestration layer |
| Auto-qualify calls | `ai-calling-service` | trigger hook |
| Auth | JWT `validateToken` | webhook HMAC verify |
| — | — | MKT_EVENT, SCORE, REFERRAL, CAMPAIGN entities; ingest route; dashboard |

## Design principles
Additive · multi-tenant (`TENANT#`) · event-sourced (every funnel action = `MKT_EVENT`) · workspace/content-aware (`contentRef = OPP-*`) · consent/PII-safe (WhatsApp opt-in, minimal PII) · idempotent (dedupe by event id) · independently shippable phases.

Details: `workflow-map.md`, `integrations.md`, `implementation-plan.md`, `../implementation/technical-design.md`.
