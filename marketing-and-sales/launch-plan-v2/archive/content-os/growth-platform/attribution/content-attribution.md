# Content Attribution — Content → Customer (Phase 8)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/attribution-today.md`.

Closes the **P1 "No content-attribution engine" gap** (`../gap-analysis.md` §2): connect **content → engagement → conversation → demo → trial → activation → paid customer**, then answer the only question that matters for the Content OS — **which content creates CUSTOMERS, which creates engagement only, and which contributes to ACTIVATION** — and feed that back so the factory makes more of what converts.

> Builds on `attribution-architecture.md` (chain/models), `data-model.md` (TOUCHPOINT, ATTRIBUTION_PATH, GSI9/GSI10), `events.md` (event taxonomy). Content IDs from the Content OS: **OPP-\*** (scored recipe), **CT-\*** (character), **FW-\*** (framework), **CH-\*** / **HK-\*** (hook), **CTA-\*** (call-to-action). Loop owner: `oracle` + `ab-optimizer` (`../../growth-dashboard.md` §6).

---

## 1. The content→customer chain (instrumented)

```
OPP-204 reel ─► reach/saves ─► DM "PRICE" ─► WhatsApp demo ─► trial ─► activated ─► PAID  ─► referral
(content_     (impression/   (dm,         (demo_booked/   (trial_  (customer_   (paid,   (referral_
 published)    engagement)    contentRef)   completed)      started) activated)   revenue) converted)
     │              │              │             │             │          │           │
     └──────────────┴──────────────┴─────────────┴── all carry contentRef=OPP-204 ────┴──► ATTRIBUTION_PATH
                                                                                            credit per touch
```
Each touch is a `MKT_EVENT` with `contentRef` (`events.md`); the resolver writes a `TOUCHPOINT` (GSI9 by content) and updates `ATTRIBUTION_PATH` (credit + `revenue` on `paid`). Content ROI = roll up credited revenue/paid **per `OPP-*` and per FW/CT/HK/CTA dimension**.

---

## 2. Content-ROI data model (reuses attribution entities — no new write path)

No new entity beyond `data-model.md`. Content ROI is a **read model** keyed on `contentRef`:

| Source | Key | Yields |
|---|---|---|
| TOUCHPOINT | GSI9 `TENANT#{t}#CONTENT#{contentRef}` | every touch a piece generated (reach→engagement→dm→demo) |
| ATTRIBUTION_PATH | GSI10 `TENANT#{t}#OUTCOME#paid` | which paid paths a piece appears in + `creditMulti` + `revenue` |
| CAMPAIGN | `spend` (if boosted) | content-level CAC for paid posts |

**Content dimension map** (denormalized on `MKT_EVENT.payload.contentMeta` at publish, so rollup needs no Content-OS join):
```json
"contentMeta": { "oppId":"OPP-204","frameworkId":"FW-07","characterId":"CT-03",
                 "hookId":"HK-118","ctaId":"CTA-22","series":"khata-pain","format":"reel" }
```
Rollup grain: `OPP-*` (primary) → FW-* / CT-* / HK-* / CTA-* / series / format (aggregations). Stored as a nightly materialized `CONTENT_ROI` projection (optional cache) `PK=TENANT#{t}#CROI#{dim}#{id}` for fast dashboard reads.

---

## 3. Content-ROI event model

Reuses the taxonomy in `events.md`; the content-relevant subset and what each proves:

| Event | Proves | Content metric |
|---|---|---|
| `content_published` | piece exists | ROI denominator |
| `impression` / `engagement` | attention created | reach, saves/reach, engagement rate |
| `comment` / `dm` | **content → conversation** | DM rate per `OPP-*` (the key conversion event) |
| `lead_magnet_download` | content → captured lead | lead yield per piece |
| `demo_booked` | content → demo | demos per `OPP-*` |
| `trial_started` | content → trial | trials per piece |
| `milestone_hit` / `customer_activated` | content → **activation** | activation-contribution score |
| `paid` (+`revenue`) | content → **CUSTOMER** | attributed customers + revenue per piece |
| `expansion` | content → expansion | NRR contribution (rare but high-value) |

All carry `contentRef` + `contentMeta`. Multi-touch credit (default **U-shaped**, `attribution-architecture.md` §3) ensures the discovering reel gets credit even when WhatsApp closes.

---

## 4. Classification: customer-maker vs engagement-only vs activation-contributor

Per `OPP-*`, computed nightly from the read model:

| Class | Rule | Action |
|---|---|---|
| **Customer-maker** | `attributedPaid ≥ threshold` AND appears in ≥X paid paths (first or last touch) | **Make more** — scale framework/character/hook (`oracle`/`ab-optimizer`) |
| **Activation-contributor** | low direct paid, but high presence in paths of leads who `customer_activated` (assist credit on milestone events) | Keep for nurture/onboarding sequences; pair with a customer-maker |
| **Engagement-only** | high reach/saves/shares, low DM rate, ~0 paid credit | **Demote/repurpose** — viral but doesn't sell; test new CTA/hook before retiring |
| **Dud** | low reach AND low conversion | Retire |

**Scoring signals (per `OPP-*`):**
```
contentConversionScore = w1·(paidCredit)        // 40
                       + w2·(demoCredit)         // 25
                       + w3·(dmRate)             // 20
                       + w4·(activationAssist)   // 15   (clamped 0–100)
```
Class boundaries are tenant-overridable; `signals` persisted for explainability (mirrors lead-scoring pattern, `../../implementation/technical-design.md` §4).

---

## 5. Reporting model (per OPP-* / FW / CT / HK / CTA)

`GET /api/marketing/dashboard/attribution?groupBy=content&dim=opp|framework|character|hook|cta` → renders D2 (`dashboards.md` §3).

| Dimension | Reveals | Feeds back to |
|---|---|---|
| `OPP-*` | the single best recipes | Content factory: reproduce |
| FW-* framework | which structures convert (e.g. problem→agitate→AI-call demo) | framework library weighting |
| CT-* character | which persona sells (e.g. "Brokerage Boss") | character selection |
| HK-* / CH-* hook | which first-3-seconds drive DMs that become paid | hook bank ranking |
| CTA-* | which ask converts (demo vs WhatsApp vs free trial) | CTA bank ranking |
| series / format | reel vs story vs carousel ROI | format mix |

Output row per piece: `reach, engRate, dmRate, demos, trials, activationAssist, paid, attributedRevenue, class`. Money in ₹ (business-memory §7).

---

## 6. Feedback loop into the Content OS (make more of what converts)

```
ATTRIBUTION_PATH + TOUCHPOINT (by contentRef)
        │  nightly content-ROI rollup + classify
        ▼
CONTENT_ROI projection (per OPP-*/FW/CT/HK/CTA)  ──► D2 dashboard (weekly review)
        │                                                  │
        │  "customer-maker" winners + losers               │ human/oracle review
        ▼                                                  ▼
oracle / ab-optimizer  ─────────────────────────►  Content OS factory
  (prioritize winning FW/CT/HK/CTA;                  (generate more OPP-* from
   deprioritize engagement-only)                      winning framework×character×hook)
        ▲                                                  │
        └────────────── new OPP-* published, re-measured ◄─┘   (closed loop)
```
This is **the single most important loop in the platform** (`gap-analysis.md` §8, `growth-dashboard.md` §6): a published reel (`OPP-*`) is traceable to a paid customer, and that signal automatically biases what gets made next. Cadence: **weekly** content-ROI review (`growth-dashboard.md` §9).

---

## 7. Implementation roadmap (Phase 8)

| Step | Work | File/service | Acceptance |
|---|---|---|---|
| 1 | Stamp `contentMeta` (OPP/FW/CT/HK/CTA) on publish events | `marketingEventsService.js` + Blotato webhook | 100% `content_published` carry contentMeta |
| 2 | Carry `contentRef` through dm→demo→paid | ingest normalizers + identity stitch | paid events resolve to originating `OPP-*` ≥80% |
| 3 | Build content-ROI rollup (GSI9/GSI10) | `attributionResolver` nightly | per-`OPP-*` reach→paid table renders |
| 4 | Classifier (customer-maker/engagement/activation/dud) | `contentRoiService.js` | every `OPP-*` classified + `signals` stored |
| 5 | D2 dashboard + dim toggle (FW/CT/HK/CTA) | `MarketingDashboard.tsx` | weekly review uses it live |
| 6 | Feedback hook to oracle/ab-optimizer | export winners list | winners auto-listed for factory |

Depends on EP-1/EP-2 (attribution+events) + the resolver. Sequenced in `implementation-plan.md`. Every recommendation here ties to a metric (content-ROI per `OPP-*`) and an engineering task (above).
