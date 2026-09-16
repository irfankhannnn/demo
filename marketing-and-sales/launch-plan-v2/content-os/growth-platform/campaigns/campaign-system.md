# Campaign System (paid + organic)

Closes the gap-analysis P2 gap *"no campaign system (paid/organic structure + UTM)"*. Unifies **paid** (Meta Lead Ads via `meta-ads` MCP + CAPI) and **organic** (IG/FB/LinkedIn/YouTube/WhatsApp, published via `blotato`, content = `OPP-*`) under one `CAMPAIGN` entity, one UTM taxonomy, and one path **campaign → lead → revenue**. Grounded in the real stack: `CAMPAIGN` entity (`technical-design.md §2.6`, `database-requirements.md §2`), `MKT_EVENT` spine, `crmDynamodbService.js`, `tenantMiddleware`. Pricing/personas: `01-business-memory.md`.

Cross-refs: entity → `database-requirements.md §2` · attribution → `attribution/` · integrations + canonical UTM → `integrations/integrations.md` · referral campaigns → `referrals/` · metrics → `analytics/`.

---

## 1. CAMPAIGN entity (extended)

```
PK = TENANT#{tenantId}#CAMPAIGN#{campaignId}    SK = CAMPAIGN#{campaignId}    EntityType = CAMPAIGN
GSI4-style rollups via MKT_EVENT.campaignId; GSI-CampaignChannel: GSIcPK=TENANT#{t}#CAMPCH#{channel} GSIcSK={createdAt}
```
| Attr | Type | Notes |
|---|---|---|
| `campaignId` | S | slug = naming convention §3 |
| `name` | S | human label |
| `type` | S enum | `paid \| organic \| referral \| founder` |
| `channel` | S enum | `meta_ads \| instagram_organic \| facebook_organic \| linkedin \| youtube \| whatsapp \| referral \| founder` |
| `objective` | S enum | `lead_gen \| awareness \| demo_booked \| trial \| activation` |
| `status` | S enum | `draft \| active \| paused \| ended` |
| `spend` | N | ₹; synced from `meta-ads` MCP (paid); 0 for organic |
| `budgetDaily`/`budgetTotal` | N? | paid only; guarded by `validate-ad-budget.sh` |
| `utm` | M | canonical `{source,medium,campaign,content}` |
| `contentRefs` | SS? | `OPP-*` recipe ids powering the campaign (organic ROI link) |
| `metaCampaignId`/`metaAdsetId` | S? | external ids for spend/lead sync + CAPI |
| `startAt`/`endAt`/`createdAt` | S ISO | |

Organic campaigns are first-class: an `OPP-*` content push (e.g. a 5-reel khata series) is a `CAMPAIGN(type=organic, channel=instagram_organic, contentRefs=[OPP-014,...])`.

---

## 2. UTM taxonomy (canonical lives in `integrations/integrations.md`)

```
utm_source   = channel origin   ∈ {instagram, facebook, linkedin, youtube, whatsapp, referral, founder, web}
utm_medium   = format/intent    ∈ {reel, story, post, cpc, paid_social, lead_ad, organic, dm, broadcast, bio_link, video}
utm_campaign = {channel}-{objective}-{theme}-{yymm}   e.g. ig-leadgen-khata-2606
utm_content  = creative/variant ∈ OPP-* | adset-variant | post-id   (the content-ROI key)
```
Every inbound link/ad/bio-link/`/r/{code}` carries the tuple → captured on LEAD (`utmSource/Medium/Campaign/Content`, `contentRef`, `campaignId`) per `database-requirements.md §1`. `utm_content = OPP-*` is what ties spend/clicks to a specific Content-OS recipe.

## 3. Naming conventions

| Object | Pattern | Example |
|---|---|---|
| campaignId / utm_campaign | `{ch}-{obj}-{theme}-{yymm}` | `meta-leadgen-aicalling-2606` |
| Meta campaign | `[{tenant}] {Channel} {Objective} {Theme} {YYMM}` | `[RF] Meta LeadGen AICalling 2606` |
| Ad set | `{persona}-{city}-{audience}` | `broker-mumbai-lookalike1` |
| Ad / creative | `{OPP}-{angle}-v{n}` | `OPP-014-painfollowup-v2` |
| Organic post | `{OPP}-{platform}-{yymmdd}` | `OPP-022-ig-260618` |

Consistent slugs make `utm_campaign` ↔ `campaignId` ↔ Meta object joinable in the dashboard with no fuzzy matching.

---

## 4. Meta Lead Ads + CAPI flow (via `meta-ads` MCP)

```
media-buyer → meta-ads MCP: create CAMPAIGN/adset/ad (naming §3, budget guarded)
        │  store metaCampaignId/metaAdsetId on CAMPAIGN entity
        ▼
User submits Lead Ad form on IG/FB
        ▼
Meta Lead-Ad webhook ─► /api/webhooks/meta-leadads (HMAC verify + extractTenantId)
        ▼
marketingEventsService: normalize → MKT_EVENT(type=demo_requested|lead_magnet, channel=facebook,
        campaignId, utm, contentRef) → dedupe → SQS
        ▼
automationEngine → crmDynamodb upsert LEAD (leadSource=facebook_ads, campaignId, utm) → score → (auto-call if hot)
        ▼
On demo_booked / trial / paid downstream events:
        meta-ads CAPI ◄── send conversion (event, value ₹, fbclid/lead match) for optimization
```
CAPI sends downstream conversions (`demo_booked`, `paid`) back to Meta so the algorithm optimizes for *revenue*, not just form-fills. Spend syncs daily from MCP → `CAMPAIGN.spend` → CAC. Reuses existing meta-ads MCP + webhook contract in `automation-os/integrations.md`.

---

## 5. Linking campaign → lead → revenue

```
CAMPAIGN ──campaignId──► LEAD (utm+campaignId+contentRef) ──MKT_EVENT(paid, value₹)──► REVENUE
   spend ₹                        leadScore / stage                 plan MRR (₹999/2999/5999)
```
| Derived metric | Formula |
|---|---|
| Leads | count LEAD by `campaignId` (GSI6/filter) |
| CPL | `spend / leads` |
| Trial→paid | paid / trials per campaign |
| **CAC** | `spend / new_paid_customers` |
| **Effective CAC** | `CPL / trial→paid rate` (per `channel-cac-analysis`) |
| Revenue | Σ plan MRR of paid leads w/ `campaignId` |
| **ROAS** | `revenue / spend` |
| Payback (months) | `CAC / plan MRR` |

Organic campaigns have `spend=0` → tracked on **content-ROI** (leads/demos/paid per `OPP-*` via `contentRefs`), not ROAS. This is how a reel (`OPP-*`) is traced to revenue (gap-analysis §8 success definition).

---

## 6. Organic campaign tracking (content `OPP-*` as campaigns)

| Step | Mechanism |
|---|---|
| Publish | `blotato` MCP → `content_published` MKT_EVENT (channel, `contentRef=OPP-*`, `campaignId`) |
| Engage | IG/LinkedIn webhooks → `comment`/`dm` events tagged `contentRef` |
| Convert | bio-link/DM CTA carries `utm_content=OPP-*` → LEAD.contentRef |
| Roll up | attribution by `contentRef` → leads/demos/paid per recipe |

So "make more of what works" is data-driven: top `OPP-*` by paid-conversion get scaled (more variants, paid-amplified into a `meta_ads` campaign reusing the winning creative).

---

## 7. Campaign dashboard metrics (→ `analytics/`)

| Tile | Metric | Source |
|---|---|---|
| Spend & budget pacing | spend vs budget, daily burn | CAMPAIGN + MCP sync |
| Funnel by campaign | leads→demo→trial→paid | MKT_EVENT GSI4 + LEAD.campaignId |
| CAC / Effective CAC / ROAS | §5 formulas | derived |
| Content-ROI (organic) | paid per `OPP-*` | contentRef rollup |
| Channel mix | leads & revenue by channel | GSI-CampaignChannel |
| Top creatives | conversion by `utm_content` | MKT_EVENT |

Canonical metric defs live in `analytics/` metric dictionary; this dashboard references them (no forked definitions — gap-analysis §3 rule).

---

## 8. Engineering requirements

| ID | Story | Lane | Acceptance |
|---|---|---|---|
| **EP-C1** | CAMPAIGN CRUD + GSI-CampaignChannel | BE/INF | create/update; spend sync; tenant-scoped; sparse channel GSI |
| **EP-C2** | UTM capture on lead-create paths | BE | all signup/webhook/bio-link paths persist utm tuple + campaignId + contentRef |
| **EP-C3** | Meta spend + lead sync (MCP) | INT | daily `meta-ads` pull → CAMPAIGN.spend; lead-ad webhook → MKT_EVENT |
| **EP-C4** | CAPI downstream conversions | INT | send `demo_booked`/`paid` w/ ₹ value to Meta; idempotent dedupe |
| **EP-C5** | Campaign → revenue read model | BE | `GET /api/marketing/dashboard/campaigns` returns CAC/ROAS/content-ROI |
| **EP-C6** | Organic publish tracking (blotato) | INT | `content_published` event w/ contentRef; engagement events tagged |
| **EP-C7** | Budget guardrail | INF | `validate-ad-budget.sh` blocks over-budget MCP calls |
| **EP-C8** | Dashboard UI (MarketingDashboard.tsx) | FE | campaign tiles §7, mobile-first, RBAC Admin/Manager |

All additive, multi-tenant, idempotent (MKT_EVENT `dedupeKey`), consent-safe. Ties EP-C* to the master `implementation/backlog.md`.
