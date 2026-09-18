# Automation OS — Integrations

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/60-automation/tooling-stack.md`.

External + internal integrations the automation layer needs. Per-integration spec; marks exists vs new.

## Channel integrations
| Integration | Purpose | Status | Auth | Key events/endpoints | Failure handling |
|---|---|---|---|---|---|
| **Blotato MCP** | Publish + detect new posts | exists | API key | publish; (webhook) `content_published` | retry; manual log fallback |
| **Meta Ads MCP** | FB/IG campaigns, **Lead Ads** ingest, CAPI | exists | FB Business OAuth | lead-ad webhook → `lead_magnet`/`demo_requested`; CAPI conversions | DLQ; reconcile daily |
| **Higgsfield MCP** | Content asset generation | exists | OAuth | image/video gen | per Higgsfield guide |
| **Instagram Graph API** | Comments/DMs webhooks, auto-reply, broadcast | **new** | Meta app + permissions (`instagram_manage_messages`, `_comments`) | webhook `comment`/`dm`; send message | signature verify; rate-limit |
| **WhatsApp Business API** (Gupshup/Twilio/Meta) | Nurture, broadcast, templates | **new** | provider key + opt-in | send template; inbound webhook | opt-in gate; template pre-approval |
| **Email (SES)** | Sequences, receipts | new/extend | IAM | send; bounce/complaint | suppress on bounce |
| **Exotel + ElevenLabs** | AI calling (auto-qualify) | exists | per `ai-calling-service` | placeCall; callback transcript | retry; fallback to manual |
| **Calendar** (Cal.com/Google) | Demo scheduling | new/extend (`Calendar.tsx`) | OAuth | create/cancel event | IST tz; conflict check |

## Internal integrations
| Component | Role |
|---|---|
| `notificationDynamodbService.js` | trigger engine base (notifications + SCHEDULED_NOTIFICATION) |
| `crmDynamodbService.js` | Lead/contact create+update with new attribution + score fields |
| `agency-app/ai-calling/` | auto-call qualified inbound leads |
| **marketingEventsService** (new) | ingest + route `MKT_EVENT` |
| **scoringService** (new) | lead/activation/health scores |
| **attribution module** (new) | source + content (`OPP-*`) + UTM rollups for dashboard |

## Data-flow contract
External webhook → `POST /api/marketing/events` (JWT or HMAC + `extractTenantId`) → normalize → `MKT_EVENT` (TENANT#) → SQS → automation rules → CRM / Notifications / AI / Scoring → Dashboard read models.

## Webhook payload (normalized)
```json
{ "tenantId":"...", "type":"dm", "channel":"instagram",
  "occurredAt":"2026-06-18T21:14:00+05:30",
  "leadRef":"LEAD#...", "contentRef":"OPP-014",
  "idempotencyKey":"ig_msg_98231",
  "payload":{ "from":"@user", "text":"price?", "mediaId":"reel_123" } }
```

## UTM / source taxonomy (standardize)
`leadSource ∈ {instagram_dm, instagram_comment, instagram_bio, facebook_ads, facebook_group, whatsapp, linkedin, youtube, referral, founder, lead_magnet, web, unknown}`.
UTM: `utmSource / utmMedium / utmCampaign / utmContent`. `contentRef = OPP-*` or platform asset id. `campaignId → CAMPAIGN` entity.

## Security / compliance
HMAC signature verification on all public webhooks (Meta/WhatsApp); per-tenant secrets in SSM/Secrets Manager; WhatsApp opt-in + 24h window + approved templates; PII minimization in event payloads; rate limits + WAF on webhook routes; reuse JWT + `tenantMiddleware`.
