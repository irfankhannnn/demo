# Implementation — API Requirements

All under existing auth (`validateToken`) + `extractTenantId`, error shape `{ error, details? }`, REST `/api/...`.

## New endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/marketing/events` | Ingest normalized marketing event (also webhook target; signature-verified) |
| GET | `/api/marketing/events` | Query events (type, channel, range) — dashboard |
| GET | `/api/marketing/dashboard/funnel` | Funnel counts reach→DM→demo→trial→paid→referral |
| GET | `/api/marketing/dashboard/attribution` | Leads/demos/paid by source + `contentRef (OPP-*)` |
| GET | `/api/marketing/dashboard/cohorts` | Trial→paid + retention cohorts |
| POST | `/api/marketing/sequences/enroll` | Enroll lead in a sequence |
| POST | `/api/marketing/sequences/cancel` | Cancel enrollment (on reply/convert/opt-out) |
| GET/POST | `/api/referrals` | List / create referral codes |
| POST | `/api/referrals/convert` | Attribute + reward on conversion |
| GET | `/api/leads/:id/score` | Lead/activation/health scores |
| POST | `/api/webhooks/instagram` `/api/webhooks/whatsapp` `/api/webhooks/meta-leadads` `/api/webhooks/blotato` | Channel webhooks |

## Changed endpoints
| Path | Change |
|---|---|
| `POST /api/crm/leads` (create) | Accept + persist `leadSource, utmSource/Medium/Campaign/Content, campaignId, contentRef, consent` |
| `GET /api/leads` | Filter by `leadSource`, `minScore`, `stage`; return score + source |
| Lead read | Include attribution + scores |

## Webhook contract
`{ tenantId, type, channel, occurredAt, leadRef?, contentRef?, payload }` → normalized to `MKT_EVENT`. Verify provider signature; idempotency-key dedupe.
