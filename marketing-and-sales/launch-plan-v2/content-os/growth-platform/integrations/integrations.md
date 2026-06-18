# Growth Platform — Integration Registry

The growth-platform integration registry. **Extends `automation-os/integrations.md`** (channel + internal integrations, data-flow contract, security) — that file remains the base; this one **adds the referral / campaign / analytics integrations** and a **consolidated matrix**, plus the canonical webhook contracts and the canonical UTM/source taxonomy. Do not duplicate the base channel rows — reference them.

> **Base (see `automation-os/integrations.md`):** Blotato MCP, Meta Ads MCP (Lead Ads + CAPI), Higgsfield MCP, Instagram Graph API, WhatsApp Business API, Email (SES), Exotel+ElevenLabs, Calendar; internal `marketingEventsService`/`scoringService`/attribution; data-flow contract; HMAC security.

Stack anchors: Express+Lambda, DynamoDB single-table (`TENANT#`), `crmDynamodbService.js`, `notificationDynamodbService.js` (SCHEDULED_NOTIFICATION), `tenantMiddleware`/`validateToken`, MCPs in `.mcp.json`.

---

## 1. New integrations (referral / campaign / analytics)

| Integration | Purpose | Exists/New | Auth | Key events | Failure handling |
|---|---|---|---|---|---|
| **Referral redirect `/r/{code}`** | Click capture + attribution entry | **new** (BE) | none (public) + rate-limit/WAF | `referral_clicked` → signup `?ref=` | expired/invalid → fallback page; dedupe `{code}:{session}` |
| **Billing / Invoicing** | Apply reward credits, detect `paid`, clawback on refund | **new/extend** | internal IAM | `paid`, `refund` → MKT_EVENT; credit `applied` | idempotent on invoiceId; clawback = compensating ledger entry |
| **`rewardService` ↔ `REWARD_LEDGER`** | Issue/track double-sided rewards | **new** (internal) | — | reward `pending/issued/applied/clawed_back` | append-only; reconcile liability nightly |
| **`referralService`** | Code gen, attribution, leaderboard | **new** (internal) | — | `referral_sent/_signup/_converted` | conditional puts; collision retry |
| **Meta Ads MCP — spend/CAPI (campaign use)** | Sync `CAMPAIGN.spend`; CAPI downstream conversions | **exists (extend)** | FB Business OAuth | daily spend pull; CAPI `demo_booked`/`paid` (₹) | DLQ; reconcile daily; budget guard `validate-ad-budget.sh` |
| **Blotato MCP — organic campaigns** | `content_published` w/ `contentRef=OPP-*`, engagement | **exists (extend)** | API key | `content_published`; comment/dm tagged contentRef | retry; manual log fallback |
| **Analytics read-model API** | Funnel/attribution/campaign/referral dashboards | **new** | JWT + `extractTenantId` | reads GSI4/6/7/8/9 | eventual-consistency tolerant |
| **CloudWatch / EventBridge** | Metrics, alarms, nightly scoring + liability cron | **new (INF)** | IAM | cron triggers; metric emits | alarm on DLQ depth / liability > cap |
| **SQS (+DLQ)** | Decouple ingest→processing | **new (INF)** | IAM | event enqueue/consume | at-least-once; DLQ after N retries |

---

## 2. Consolidated integration matrix (base + new)

| System | Purpose | Exists/New | Auth | Events | Failure handling |
|---|---|---|---|---|---|
| Blotato MCP | Publish; detect posts; organic campaigns | exists | API key | `content_published` | retry; manual log |
| Meta Ads MCP | Campaigns, Lead Ads ingest, CAPI, spend sync | exists/extend | FB Business OAuth | `lead_magnet`/`demo_requested`; CAPI conversions; spend | DLQ; daily reconcile; budget guard |
| Higgsfield MCP | Asset generation | exists | OAuth | image/video gen | per Higgsfield guide |
| Instagram Graph API | Comment/DM webhooks, auto-reply | new | Meta app perms | `comment`, `dm` | sig verify; rate-limit |
| WhatsApp Business API | Nurture, referral asks, reward confirms, templates | new | provider key + opt-in | send template; inbound | opt-in gate; 24h window; template approval |
| Email (SES) | Sequences, receipts | new/extend | IAM | send; bounce/complaint | suppress on bounce |
| Exotel + ElevenLabs | AI auto-qualify call | exists | per `ai-calling-service` | placeCall; transcript | retry; manual fallback |
| Calendar (Cal.com/Google) | Demo scheduling | new/extend | OAuth | create/cancel | IST tz; conflict check |
| Referral redirect `/r/{code}` | Click capture/attribution | new | public + WAF | `referral_clicked` | fallback page; dedupe |
| Billing/Invoicing | Reward credits, `paid`/refund | new/extend | IAM | `paid`, `refund` | idempotent; clawback entry |
| Analytics read-model API | Dashboards | new | JWT | GSI reads | EC-tolerant |
| SQS+DLQ / EventBridge / CloudWatch | Decouple, schedule, observe | new INF | IAM | enqueue; cron; metrics | DLQ; alarms |

---

## 3. Webhook contracts (canonical)

**Normalized event envelope** (all webhooks normalize to this before `MKT_EVENT`):
```json
{ "tenantId":"...", "type":"dm|comment|lead_magnet|demo_requested|paid|referral_signup|...",
  "channel":"instagram|facebook|whatsapp|linkedin|youtube|web|ai_call|email",
  "occurredAt":"2026-06-18T21:14:00+05:30",
  "leadRef":"LEAD#...", "contentRef":"OPP-014", "campaignId":"meta-leadgen-aicalling-2606",
  "utm":{"source":"instagram","medium":"reel","campaign":"ig-leadgen-khata-2606","content":"OPP-014"},
  "idempotencyKey":"{provider}:{providerEventId}",
  "payload":{ "...PII-minimized normalized fields..." } }
```

**Meta Lead Ad** → `POST /api/webhooks/meta-leadads` (HMAC `X-Hub-Signature-256`) → `type=demo_requested|lead_magnet`, `channel=facebook`, `campaignId` from ad, `utm` from form.
**Referral signup** → internal `POST /api/marketing/events` (JWT) → `type=referral_signup`, `payload.referralCode`, sets `LEAD.referredBy`.
**Billing paid** → internal event → `type=paid`, `payload.value` (₹ plan MRR), `payload.invoiceId` → unlocks reward issuance.
**Blotato published** → `POST /api/webhooks/blotato` → `type=content_published`, `contentRef=OPP-*`, `campaignId`.

All public webhooks: HMAC verify (per-tenant secret in SSM/Secrets Manager) → `extractTenantId` → normalize → conditional `PutItem` on `idempotencyKey` (duplicate = no-op) → SQS. Rate-limited + WAF.

---

## 4. Canonical UTM / source taxonomy (single source of truth)

```
leadSource ∈ { instagram_dm, instagram_comment, instagram_bio, facebook_ads, facebook_group,
               whatsapp, linkedin, youtube, referral, founder, lead_magnet, web, unknown }

utm_source   ∈ { instagram, facebook, linkedin, youtube, whatsapp, referral, founder, web }
utm_medium   ∈ { reel, story, post, cpc, paid_social, lead_ad, organic, dm, broadcast, bio_link, video }
utm_campaign = {channel}-{objective}-{theme}-{yymm}        e.g. ig-leadgen-khata-2606
utm_content  = OPP-* | {adset}-{variant} | {post-id}        (content-ROI key)
campaignId   → CAMPAIGN#{id}     contentRef = OPP-* or platform asset id
referralCode → REFERRAL_CODE#{code}   referredBy = referrerId (first-touch immutable)
```
This supersedes scattered UTM definitions (`automation-os/integrations.md §UTM`, `campaigns/campaign-system.md §2` reference *this*). Any new source must be added here first.

---

## 5. Security / compliance / failure (inherited + extended)

- HMAC on all public webhooks; per-tenant secrets in SSM/Secrets Manager; reuse JWT + `tenantMiddleware`.
- WhatsApp: opt-in + 24h window + approved templates (referral asks/reward confirms are templated, consent-gated).
- **Referral anti-abuse** (`referrals/referral-engine.md §3`): self-referral, velocity, same-instrument, reattribution lock — enforced before reward issuance.
- PII minimization in event payloads; raw provider bodies TTL'd; rewards append-only/auditable.
- Idempotency everywhere: webhook `idempotencyKey`, lead `dedupeHash`, reward keyed on `referralId`, SQS consumers idempotent; DLQ + daily reconcile.
- Observability: CloudWatch on ingest/routing/sends/DLQ depth/reward liability; alarm on anomalies.

Cross-refs: `automation-os/integrations.md` (base), `referrals/` (referral integrations), `campaigns/campaign-system.md` (Meta/CAPI/organic), `attribution/` (rollups), `implementation/technical-design.md` (data-flow + entities).
