# Lead Scoring Engine (Phase 7 · EP-5)

The model that turns the central gap — **leads have no score today** (`gap-analysis.md` §1, §2 P0) — into a 0–100 number on every lead, sortable hottest-first, recomputed on event + nightly. This file is the **single source of truth for the lead-scoring model**; engineering lands it in `scoringService.js` per `implementation/technical-design.md` §4.1, persisted as the `SCORE` entity (§2.4) and denormalized onto `LEAD.leadScore` (§2.1). It operationalizes the human qualification matrix in `sales-os/qualification.md` §2 (Pain/Authority/Volume/Trigger) into an automatable score, and feeds the dashboard north-star: `demo_booked AND lead.score ≥ 40` (`growth-dashboard.md` §1).

> **Principle (from qualification.md):** brokers don't fill forms, they have conversations. Most signal is **inferred** from `MKT_EVENT`s + enrichment + keywords, not asked. The score must degrade gracefully when fields are missing (sparse-data tenants), and stay explainable — every score persists its `signals` map for audit.

---

## 1. The four scoring dimensions (100 pts)

`leadScore = FIT + SOURCE + INTENT + ENGAGEMENT`, clamped 0–100. Weights are tenant-overridable defaults (`SCORE.version` pins the model). This refines `technical-design.md` §4.1 by splitting its six signals into four named, qualification-aligned dimensions.

| Dim | Max | What it answers | Maps to |
|---|---|---|---|
| **FIT / qualification** | 30 | Are they our ICP + can they buy? | qualification.md §2 Authority/Volume; persona §3 |
| **SOURCE** | 20 | How warm is the channel they came from? | qualification.md §4 source matrix |
| **INTENT** | 30 | Did they signal buying intent explicitly? | qualification.md §1 Q4/Q5; market-research §6 |
| **ENGAGEMENT / behavioral** | 20 | How much + how recently did they interact? | growth-dashboard funnel events |

### 1.1 FIT / qualification (30) — aligns to qualification.md §2

| Signal | Pts | Source |
|---|---|---|
| Team size: 8+ agents | 8 | enrichment / Q1 "team kitni badi" → maps Volume axis |
| Team size: 2–7 | 5 | " |
| Solo | 2 | " |
| RERA-registered (verified) | 5 | enrichment (RERA non-negotiable in RE, business-memory §6) |
| Authority: owner/decision-maker (ADMIN persona) | 8 | persona detect (Rajesh Bhai §3) |
| Authority: manager/champion | 4 | persona (Priya §3) |
| Current tool = portal/ad-spend (has budget) | 5 | Q2 "leads kaise sambhalte" → MagicBricks/Ads = budget-aware |
| Current tool = Excel/WhatsApp only | 2 | Q2 → pain present, budget unproven |
| City in primary market (Mumbai/Pune/NCR/Blr) | 4 | enrichment vs business-memory §2 |

FIT clamps at 30. Missing all → FIT=0 (cold-start lead still scoreable on SOURCE+INTENT).

### 1.2 SOURCE weighting (20) — per-channel, qualification.md §4

| `leadSource` | Pts | Why (research §5) |
|---|---|---|
| `referral` | 20 | Highest trust + fast (§5.7, 20–30% leads, best quality) |
| `demo_requested` / `founder` | 20 | Self-selected high intent |
| `whatsapp` (inbound) | 16 | Warm, fast speed-to-lead |
| `instagram_dm` | 14 | Self-aware of pain (our content drove it) |
| `lead_magnet` | 12 | Calculator/checklist = active researcher |
| `facebook_ads` / Google | 11 | Has spend, ROI-minded, but mixed quality (§5.5–5.6) |
| `web` (UTM signup) | 10 | Medium |
| `instagram_comment` / `instagram_bio` | 7 | Low-commitment touch |
| `linkedin` / `youtube` | 6 | Adjacent intent |
| `unknown` | 0 | No attribution = fix EP-1 first |

### 1.3 INTENT (30) — explicit buying signal

| Signal | Pts | Detection |
|---|---|---|
| `demo_requested`/`demo_booked` event | 30 | Hard intent; the strongest single signal |
| Buying keyword in DM/comment (PRICE, DEMO, BUY, "kitna", "kitne ka") | 22 | keyword match (technical-design §3.4) |
| Pricing page / plan viewed (`MKT_EVENT` page) | 18 | product/web event |
| Buying-trigger detected (lost deal / agent left / dispute, Q5) | 20 | NLP on DM text vs qualification.md §5 checklist |
| Soft intent ("batao", "interested", reel reply) | 10 | keyword (soft tier) |
| `lead_magnet_download` (ROI/leak calculator) | 12 | high-intent magnet |

INTENT takes the **max applicable tier** (not additive across the keyword tiers) + buying-trigger bonus (additive, since a trigger is orthogonal to a keyword), clamped 30. A lost-deal trigger ("haath se nikal gaya") is the emotional fuel — it alone pushes Warm→Hot, mirroring qualification.md §5 "each ticked box → move to Hot."

### 1.4 ENGAGEMENT / behavioral (20)

| Signal | Pts | Detection |
|---|---|---|
| Recency: event in <24h | 10 | latest `lastTouchAt` |
| Recency: <72h | 6 | " |
| Recency: <7d | 3 | " |
| Depth: ≥5 `MKT_EVENT`s tied to lead | 6 | count events by `leadRef` |
| Depth: 3–4 events | 4 | " |
| Depth: 1–2 events | 2 | " |
| Reply speed <5 min to outreach | 2 | event delta |
| Repeat landing-page / multi-content touch (2+ `OPP-*`) | 2 | distinct `contentRef` |

Recency tiers are mutually exclusive (take highest); depth tiers mutually exclusive; speed + multi-content additive. Clamps 20.

---

## 2. Decay / recency

Engagement is perishable — a hot lead goes cold in days (research §5.6: Google leads cold in 24–48h). Two decay mechanisms:

1. **Recency sub-score (§1.4)** already encodes freshness directly.
2. **Global time-decay multiplier** on FIT+SOURCE+INTENT (which are otherwise "sticky"):
   `decayedScore = (FIT+SOURCE+INTENT) × D + ENGAGEMENT`
   where `D = 0.5 ^ (daysSinceLastTouch / 14)` (14-day half-life), floored at 0.6 so a genuinely-qualified lead never decays below 60% of its merit (a RERA owner who lost a deal is still a real buyer next quarter — qualification.md §6 "today's no is next quarter's yes").

Nightly recompute applies decay; on-event recompute resets `lastTouchAt` and lifts the multiplier back toward 1.0.

---

## 3. Score bands + routing actions

| Band | Score | Meaning | Routing action (the ACTION) | Maps to |
|---|---|---|---|---|
| 🔥 **Hot** | **≥ 70** | ICP + intent + fresh | Priority **demo in 24h** + ROI/leak math; AI-qualify call (`ai-calling-service`) + SDR notify | qualification.md "Hot 6–8 → demo 24h" |
| 🟧 **Warm** | **40–69** | Real pain, needs nudge | Demo or guided trial; enroll `nurture` sequence; counts toward north-star (`≥40`) | "Warm 3–5 → demo/trial+nurture" |
| 🟦 **Cool** | **20–39** | Curious, low commitment | Self-serve **Free/Starter trial** + light WhatsApp nurture (consent-gated) | "Cool 1–2 → self-serve" |
| ⬜ **Cold** | **< 20** | No fit/intent | Broadcast/community nurture; no human effort | "Cold 0 → community" |

Routing fires via the Automation Engine (`automationEngine.js`) on score-band **transition** events (not every recompute) — idempotent per `leadId + band + day`. Band crossing up → action; crossing down (decay) Hot→Warm after 14d inactivity → re-nurture, not re-demo.

---

## 4. Worked examples (ground the formula)

**A — Rajesh Bhai, WhatsApp referral, lost a Bandra deal (qualification.md §7):**
FIT = 8(team6=2–7) +0 +8(owner) +2(WA/Excel) +4(Mumbai) = 22 · SOURCE = 20(referral) · INTENT = 22(keyword "kitne agents") +... take trigger 20 (lost deal) → but keyword+trigger additive = 22+... capped → use demo path; here demo not yet booked, so 22 (soft keyword tier 10) + 20 trigger = 30 (clamp) · ENGAGEMENT = 10(<24h)+4(3 events) = 14. **Total = 22+20+30+14 = 86 → HOT.** → demo in 24h. Matches qualification.md hand-score of 8/8.

**B — Solo, Excel, "kitne ka hai?" DM, no trigger:**
FIT = 2(solo)+2(Excel) = 4 · SOURCE = 14(ig_dm) · INTENT = 22(price keyword) · ENGAGEMENT = 10(<24h)+2(1 event) = 12. **Total = 52 → WARM** (the keyword lifts a solo above Cool). Route: guided trial + nurture. (Pure curiosity with no keyword would be ~30 → Cool self-serve, matching qualification.md §7 cool example.)

---

## 5. How it's computed (event-driven + nightly)

```
EVENT-DRIVEN (real-time, <1s p95 per technical-design §7)
  MKT_EVENT lands (dm / demo_requested / pricing_view / lead_magnet)
     → SQS → automationEngine → scoringService.recompute(leadId, delta=true)
     → writes SCORE + updates LEAD.leadScore + LEAD.lastTouchAt
     → if band changed → emit score_band_changed → routing action

NIGHTLY (EventBridge cron, per technical-design §3.2 pattern)
  scoringService.recompute(tenant, all=true)
     → applies time-decay (§2), re-evaluates depth/recency
     → demotes stale Hot→Warm; surfaces newly-Cold for cleanup
     → writes daily SCORE snapshot (for cohort/trend in dashboard EP-7 §7)
```

Idempotent: recompute is pure over current signals; writing same score is a no-op. `signals` map persisted every time for explainability ("why is this lead 86?").

---

## 6. Data model (extends technical-design.md §2.4)

`SCORE` item, `TENANT#`-scoped. We add lead-specific attributes + a sort GSI.

```jsonc
// SCORE entity (lead variant)
{
  "PK": "TENANT#t_123#SCORE#lead_789",
  "SK": "SCORE#LEAD",
  "EntityType": "SCORE",
  "tenantId": "t_123",
  "leadScore": 86,
  "band": "HOT",                      // HOT|WARM|COOL|COLD
  "dimensions": { "fit": 22, "source": 20, "intent": 30, "engagement": 14 },
  "decayMultiplier": 1.0,
  "signals": {                        // explainability / audit
    "leadSource": "referral", "teamSize": 6, "authority": "owner",
    "rera": false, "buyingKeyword": "kitne agents", "trigger": "lost_deal",
    "lastTouchAt": "2026-06-18T09:12:00Z", "eventCount": 4
  },
  "contentRef": "OPP-142",            // content that drove the lead (Content-OS ROI)
  "computedAt": "2026-06-18T09:12:03Z",
  "version": "lead-v1.0",
  "createdAt": "...", "updatedAt": "..."
}
```

`LEAD.leadScore` + `LEAD.band` denormalized (technical-design §2.1) for list rendering without a join.

### 6.1 GSI — hottest-first (the access pattern that didn't exist)

```
GSI-LeadScore (sort hottest-first within stage):
  GSI7PK = TENANT#{tenantId}#STAGE#{status}     // e.g. STAGE#qualified
  GSI7SK = SCORE#{zeroPad(1000 - leadScore)}#{leadId}   // ascending key → descending score
```

Padding `1000 - score` makes a numeric-ascending GSI return **highest score first**. Query `GSI7PK = TENANT#t_123#STAGE#qualified, Limit=50` → today's 50 hottest qualified leads, no scan. A second projection `GSI-LeadSource` (technical-design §2.1) serves source-band reports.

**Access patterns served:** (1) hottest-first per stage (GSI7), (2) all leads in a band (`begins_with` on band via filter or band-GSI), (3) score history for a lead (SK range on daily snapshots), (4) source × band rollup (GSI-LeadSource + band attr) for the dashboard.

---

## 7. Engineering requirements (EP-5 tasks)

| # | Task | Component | Ties to |
|---|---|---|---|
| LS-1 | `scoringService.computeLeadScore(signals)` — pure fn, §1 weights, §2 decay | `scoringService.js` (new) | technical-design §4.1 |
| LS-2 | On-event recompute hook in Automation Engine (delta path) | `automationEngine.js` | §5 |
| LS-3 | Nightly recompute job (decay + snapshot) | EventBridge cron + `scoringService` | §5, dashboard §7 |
| LS-4 | `SCORE` writes + `LEAD.leadScore/band` denormalization | `crmDynamodbService.js` (extend) | §6 |
| LS-5 | Provision **GSI-LeadScore (GSI7)**, hottest-first | `database-requirements.md` | §6.1 |
| LS-6 | API `GET /api/leads?sort=score&stage=&band=` → query GSI7, paginated | `routes/leads.js` (extend) | §6.1 |
| LS-7 | API `GET /api/leads/:id/score` → score + `signals` (explainability panel) | `routes/leads.js` | §6 |
| LS-8 | FE score **badge** (🔥/🟧/🟦/⬜ + number) on `LeadList.tsx` + `LeadDetails.tsx`; sort-by-score toggle | `LeadList.tsx`, `LeadDrawer.tsx` | business-memory §3.1 |
| LS-9 | Routing rules: `score_band_changed` → demo/trial/nurture/community | `automationEngine.js` rules | §3 |
| LS-10 | Tenant-override of weights (config item) + `version` bump on change | config + `scoringService` | §1 |

**Reuse (don't rebuild):** auto-qualify call → `ai-calling-service/`; SDR notify → `notificationDynamodbService.js` (`GSI1PK=TENANT#{t}#UNREAD`); nurture enroll → `sequenceService.js` + `SCHEDULED_NOTIFICATION`; multi-tenancy → `tenantMiddleware.js`; RBAC (admin-gated score views) → `rbac.ts` / `PermissionGuard.tsx`.

---

## 8. Reporting + tie-ins

- **Dashboard (EP-7):** score feeds north-star filter (`demo_booked AND score≥40`, `growth-dashboard.md` §1), funnel quality, and "this-week ops → at-risk / hottest leads" panel (§8). Score × `leadSource` and score × `contentRef` (`OPP-*`) tables tell the Content OS which content drives **high-scoring** leads, not just volume (§6 Content-ROI loop).
- **Sales OS:** automates `qualification.md` §8 handoff contract — a Warm+ score auto-creates the lead record with source/segment/persona/trigger/score/stage, so "output is a lead record, not a vibe."
- **Activation hand-off:** once trial starts, `leadScore` gives way to `activationScore` (technical-design §4.2) then `healthScore` (`customer-scoring/customer-health-system.md`) — one continuous 0–100 journey from reel → referral.
- **Cross-refs:** `gap-analysis.md` (P0 scoring gap), `sales-os/qualification.md` (human matrix this automates), `implementation/technical-design.md` §2.4/§4.1 (entity + algo), `implementation/epics.md` EP-5, `growth-dashboard.md` §1/§7.

**Build order note (gap-analysis §7):** never compute scores before **EP-1 attribution + EP-2 events** exist — `leadSource`, `contentRef`, and `MKT_EVENT` counts are the inputs. Until then, score manually using §1 weights in a sheet so definitions never drift.
