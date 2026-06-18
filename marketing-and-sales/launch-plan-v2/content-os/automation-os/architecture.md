# Automation OS — Architecture

How marketing/sales automation integrates with the existing RealEstateFlow stack. Grounded in the actual codebase.

## Current stack (verified)
- **Frontend:** React + TS + Vite (`real-estate-crm-app/`).
- **Backend:** Node/Express on **AWS Lambda** (`server/lambda-handler.js`, `server/server.js`), API Gateway.
- **DB:** **DynamoDB single-table** design — `PK`/`SK`, GSIs, `EntityType`, `TENANT#` prefix (multi-tenant via `tenantMiddleware.js` / `extractTenantId`). Services: `crmDynamodbService.js`, `notificationDynamodbService.js`, etc.
- **AI Calling:** separate Lambda microservice (`ai-calling-service/`) — Exotel + ElevenLabs.
- **Notifications:** `notificationDynamodbService.js` already supports notifications + **scheduled notifications** (`EntityType: SCHEDULED_NOTIFICATION`) and typed events (RENT_EXPIRY_SOON, MEETING_REMINDER_15M, KHATA_REMINDER…). This is the natural hook for automation triggers.
- **Marketing MCPs:** higgsfield, meta-ads, blotato (`.mcp.json`).

## Target automation architecture (additive, no rewrite)
```
External (IG/FB/WhatsApp/LinkedIn, Meta Lead Ads, web)
        │  webhooks / MCP
        ▼
[Marketing Event Ingest]  (new Lambda route: /api/marketing/events)
        │  normalize → write Event entity (EntityType: MKT_EVENT, TENANT#)
        ▼
[Automation Engine]  (event router + rules; reuse SCHEDULED_NOTIFICATION patterns)
        │           ├──► CRM (create/update Lead, set leadSource/attribution)
        │           ├──► Notifications (existing service) → in-app/WhatsApp/email
        │           ├──► AI Calling service (trigger qualifying call)
        │           └──► Scoring service (lead/activation/health)
        ▼
[Marketing Dashboard]  (new UI under CRM: funnel, attribution, scores)
```

## Design principles
- **Additive & multi-tenant:** every new entity carries `TENANT#`; reuse single-table + GSIs.
- **Event-sourced:** all marketing/funnel actions become `MKT_EVENT` records → enables attribution + dashboards.
- **Reuse, don't rebuild:** extend the notification/scheduled-notification engine for sequences; reuse AI-calling Lambda for auto-qualify.
- **Workspace-aware:** attribution model maps content `OPP-*`/source so Content OS ROI is measurable.
- **Privacy/consent:** WhatsApp opt-in, PII handling per policy.

## New components (summary)
1. Marketing Event Ingest route + `MKT_EVENT` entity.
2. Automation/rules engine (extends scheduled-notification worker).
3. Attribution fields on Lead (`leadSource`, `utm*`, `campaignId`, `contentRef`).
4. Scoring service (lead score, activation score, health score) — see implementation/.
5. Marketing dashboard UI + API.
6. Referral entity + tracking.

Details: `workflow-map.md`, `integrations.md`, `implementation-plan.md`, and `../implementation/`.
