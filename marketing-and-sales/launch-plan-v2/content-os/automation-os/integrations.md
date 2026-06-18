# Automation OS — Integrations

External + internal integrations the automation layer needs. Marks what exists vs. what's new.

## Channel integrations
| Integration | Purpose | Status |
|---|---|---|
| **Blotato MCP** | Publish + (webhooks) detect new posts | exists (.mcp.json) |
| **Meta Ads MCP** | FB/IG campaigns, **Lead Ads** ingest, CAPI | exists |
| **Higgsfield MCP** | Content asset generation | exists |
| **Instagram Graph API** | Comments/DMs webhooks, auto-reply, broadcast | **new** (Meta app + permissions) |
| **WhatsApp Business API** (or provider e.g. Gupshup/Twilio) | Lead nurture, broadcast, templates (opt-in) | **new** |
| **Email (SES)** | Sequences, receipts | **new/extend** |
| **Exotel + ElevenLabs** | AI calling (auto-qualify) | exists (`ai-calling-service/`) |
| **Calendar** (Cal.com/Google) | Demo scheduling | **new/extend** (Calendar.tsx exists) |

## Internal integrations
| Component | Role |
|---|---|
| `notificationDynamodbService.js` | trigger engine base (notifications + scheduled) |
| `crmDynamodbService.js` | Lead/contact create+update with new attribution fields |
| `ai-calling-service/` | auto-call qualified leads |
| New **Marketing Event** service | ingest + route events (`MKT_EVENT`) |
| New **Scoring** service | lead/activation/health scores |
| New **Attribution** module | source + content (`OPP-*`) + UTM rollups |

## Data flow contract
External webhook → `/api/marketing/events` (auth + tenant) → normalize → `MKT_EVENT` → automation rules → CRM/Notifications/AI/Scoring → Dashboard read models.

## Security/compliance
Webhook signature verification (Meta/WhatsApp); per-tenant secrets; WhatsApp opt-in + template approval; PII minimization; rate limits. Reuse JWT + `tenantMiddleware`.

## UTM / source taxonomy (standardize)
`leadSource ∈ {instagram_dm, instagram_comment, instagram_bio, facebook_ads, facebook_group, whatsapp, linkedin, youtube, referral, founder, lead_magnet, web}`; UTM: `utmSource/Medium/Campaign/Content`; `contentRef = OPP-*` / reel id.
