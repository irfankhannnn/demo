# Attribution Event Taxonomy (Phase 3 — EP-2)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/posthog-event-map.md`.

Every trackable event from **impression → expansion**, as canonical `MKT_EVENT` rows. This is the **complete taxonomy**; the entity/keys are in `data-model.md` + `../../implementation/database-requirements.md` §2 (do not fork). Each event lists: channel(s), when fired, dedupe key, JSON schema, and which dashboard/score it feeds.

> **Contract:** all events POST to `/api/marketing/events` (JWT) or arrive via `/api/webhooks/*` (HMAC) → `marketingEventsService.js` normalizes → conditional put on `dedupeKey` → enqueue SQS. `occurredAt` = **provider time** (drives ordering); `ingestedAt` = receipt. `contentRef`=`OPP-*` and `campaignId` carried wherever known. PII-minimized `payload`. Multi-tenant `TENANT#`.

---

## 1. Canonical envelope (every event)

```json
{
  "tenantId": "TENANT#acme",
  "eventId": "uuid",
  "type": "dm",
  "channel": "instagram",
  "leadRef": "LEAD#123",            // null until identity-resolved
  "anonId": "fbclid_abc",           // pre-phone, optional
  "contentRef": "OPP-204",          // OPP-* / post id, optional
  "campaignId": "CAMPAIGN#reels-q3",// optional
  "utm": {"source":"instagram","medium":"reel","campaign":"reels-q3","content":"OPP-204"},
  "occurredAt": "2026-06-18T09:00:00Z",
  "ingestedAt": "2026-06-18T09:00:01Z",
  "dedupeKey": "instagram:msg_88912",
  "payload": { /* type-specific, PII-minimized */ },
  "ttl": 1781000000                 // epoch sec, only on high-volume low-value
}
```
**Dedupe key convention:** `{provider}:{providerEventId}` (e.g. `meta:lead_0099`, `whatsapp:wamid.X`, `billing:inv_77`). Idempotent: re-delivery = no-op conditional put.

---

## 2. Event catalog (impression → expansion)

| # | `type` | Stage | Channel(s) | Fired when | Dedupe key | Feeds (dashboard / score) |
|---|---|---|---|---|---|---|
| 1 | `content_published` | content | ig/fb/li/yt | Blotato publish webhook / scheduler | `blotato:{postId}` | reach baseline; content-attribution denominator |
| 2 | `impression` | content | ig/fb/li/yt | insights pull (batched, TTL'd) | `{platform}:imp:{postId}:{day}` | hook rate; reach (`growth-dashboard.md` §3) |
| 3 | `engagement` | engagement | ig/fb/li/yt | save/share/comment/follow (insights) | `{platform}:eng:{postId}:{kind}:{day}` | saves/shares/reach; content engagement-only signal |
| 4 | `comment` | engagement | instagram/fb/yt | comment webhook | `{platform}:cmt:{commentId}` | comments/reach; lead-score engagement depth |
| 5 | `dm` | conversation | instagram/whatsapp/li | inbound DM webhook | `{platform}:msg:{messageId}` | DM rate; **north-star** funnel; lead-score intent |
| 6 | `lead_magnet_download` | conversation | web/whatsapp | form submit / file send | `web:lm:{submissionId}` | lead source quality (+18 score) |
| 7 | `demo_requested` | demo | web/whatsapp/ig | "DEMO"/form/calendar intent | `{src}:dreq:{id}` | demo-request rate; lead-score +25 |
| 8 | `demo_booked` | demo | web/ai_call | slot confirmed (calendar) | `cal:{bookingId}` | **NORTH-STAR** (qualified demos/wk); attribution |
| 9 | `demo_completed` | demo | web/ai_call | demo marked done | `cal:done:{bookingId}` | no-show rate; demo→trial |
| 10 | `trial_started` | trial | web/app | account → trial | `app:trial:{userId}` | trials started; activation denominator |
| 11 | `milestone_hit` | activation | app/ai_call | wk-1 milestone (login/data/AIcall/day3) | `app:ms:{userId}:{milestone}` | **activationScore**; week-1 milestone rate |
| 12 | `customer_activated` | activation | app | 3/4 core milestones reached | `app:act:{userId}` | activation rate (`growth-dashboard.md` §7) |
| 13 | `trial_inactive` | activation | app | no login 48h (scoring scan) | `app:inact:{userId}:{day}` | win-back trigger; healthScore decay |
| 14 | `paid` | paid | billing | first successful charge | `billing:{invoiceId}` | new customers/mo; CAC/LTV; **path revenue** |
| 15 | `expansion` | expansion | billing | upsell/seat add/plan up | `billing:exp:{invoiceId}` | NRR/expansion; content→expansion ROI |
| 16 | `churned` | expansion | billing | cancellation/non-renewal | `billing:churn:{subId}` | churn; cohort retention |
| 17 | `referral_sent` | referral | whatsapp/web | referral code issued/shared | `ref:sent:{code}:{ts}` | referral % sent; referral channel |
| 18 | `referral_converted` | referral | web/billing | referee reaches `paid` | `ref:conv:{code}` | referral % of new customers |
| 19 | `ai_call_outcome` | conversation | ai_call | `ai-calling-service` result | `aicall:{callId}` | lead-score; speed-to-lead; auto-qualify |

---

## 3. Selected JSON schemas (type-specific `payload`)

**`dm` (Instagram/WhatsApp) — conversation, drives auto-qualify**
```json
{ "type":"dm","channel":"instagram","contentRef":"OPP-204",
  "payload":{ "handle":"@agent_raj","keyword":"PRICE","intent":"high",
              "messagePreview":"price kya hai","optInWhatsapp":false } }
```
Fires: inbound DM webhook. Feeds: DM rate; lead-score *explicit intent keyword* (+20 if PRICE/DEMO/BUY/"kitna"); triggers `ai-calling-service` auto-qualify (`technical-design.md` §3.4).

**`demo_booked` — north-star event**
```json
{ "type":"demo_booked","channel":"web","leadRef":"LEAD#123","contentRef":"OPP-204",
  "campaignId":"CAMPAIGN#reels-q3",
  "payload":{ "bookingId":"bk_77","slotAt":"2026-06-20T05:30:00Z","source":"whatsapp" } }
```
Feeds: north-star `count(demo_booked AND leadScore≥40)/wk`; attribution-by-source/content; `ATTRIBUTION_PATH.outcome=demo`.

**`paid` — revenue anchor for all attribution**
```json
{ "type":"paid","channel":"web","leadRef":"LEAD#123",
  "payload":{ "invoiceId":"inv_77","plan":"growth","mrr":2999,"currency":"INR","ltvEst":35988 } }
```
Feeds: CAC/LTV/payback (`growth-dashboard.md` §5); writes `revenue` into `ATTRIBUTION_PATH`; closes content→customer loop (`content-attribution.md`). Money in ₹ only (business-memory §7).

**`milestone_hit` — activation**
```json
{ "type":"milestone_hit","channel":"app","leadRef":"LEAD#123",
  "payload":{ "milestone":"first_ai_call","weekIndex":1 } }
```
`milestone` ∈ `login_24h | data_added | profile_complete | first_ai_call | day3_return`. Feeds activationScore weights (`technical-design.md` §4.2).

**`referral_converted`**
```json
{ "type":"referral_converted","channel":"billing",
  "payload":{ "code":"RAJ50","referrerId":"CUST#9","refereeLeadId":"LEAD#456" } }
```
Feeds referral % of new; updates `REFERRAL.status=converted`; credits referrer in `ATTRIBUTION_PATH`.

---

## 4. Event → score / dashboard map

| Event(s) | leadScore | activationScore | healthScore | Dashboard panel |
|---|---|---|---|---|
| `dm`,`comment`,`demo_requested` | engagement depth + intent + recency | — | — | Funnel, Attribution-by-source |
| `lead_magnet_download` | source quality +18 | — | — | Attribution-by-content |
| `demo_booked`/`completed` | — | — | — | North-star, Funnel |
| `trial_started` | — | denominator | — | Funnel, Cohorts |
| `milestone_hit`,`customer_activated` | — | +20..25/milestone | seeds health | Activation, Retention |
| `trial_inactive`,`churned` | — | — | decay / churn | Retention, This-week ops |
| `paid`,`expansion` | — | — | — | Efficiency (CAC/LTV), Content ROI |
| `referral_sent/converted` | source quality (referral=+25) | — | — | Referral panel |
| `ai_call_outcome` | hot/warm delta | — | usage trend | This-week ops, Funnel |

---

## 5. Firing rules & guarantees

- **Provider-time ordering:** rollups use `occurredAt`, so out-of-order/redelivered events still roll up correctly.
- **TTL:** `impression`,`engagement`,`content_published`,`comment` get `ttl≈180d`; funnel-critical (`demo_booked`,`trial_started`,`paid`,`customer_activated`,`expansion`,`churned`) **no TTL** (cohort history) — `database-requirements.md` §6.
- **Consent gate:** events never trigger WhatsApp/email touches unless `LEAD.consent.{channel}=true`.
- **Identity:** events fire even while anonymous (`anonId`); back-merged to `leadRef` on phone capture (`data-model.md` §7).
- Every event is one row; the resolver derives `TOUCHPOINT` + `ATTRIBUTION_PATH` from them — events are the only write source of truth.
