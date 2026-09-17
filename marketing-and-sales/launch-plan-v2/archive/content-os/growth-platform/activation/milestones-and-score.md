# Activation Milestones & Score — RealEstateFlow

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/activation-definition.md`.

Concrete, measurable activation milestones; the **activation score** formula (weighted milestones + recency + breadth); thresholds; the `SCORE` entity data model; and how it is computed. Extends `technical-design.md` §2.4 (SCORE entity) + §4.2 (activation weights). Milestones map to real features (`01-business-memory.md` §3). Each milestone = a fired `MKT_EVENT` (`events.md`). Drives `workflows.md` triggers + the dashboard (`implementation.md`).

---

## 1. Activation milestones (each = a measurable event + weight)

| ID | Milestone | Real feature (business-memory §) | Event `type` | Weight | Segment |
|---|---|---|---|---|---|
| **M1** | 10+ leads imported (pipeline exists) | Lead Mgmt §3.1 | `leads_imported` (count≥10) | 18 | both |
| **M2** | First follow-up reminder set | Follow-ups/Calendar §3.4 | `followup_set` | 12 | both |
| **M3** | **First AI call fired (AHA)** | AI Calling §3.6 | `first_ai_call` | **25** | both |
| **M4** | Team invited + RBAC role set | Team/Hierarchy §3.7, RBAC §3.9 | `team_invited` | 15 | agency |
| **M4′** | Buyer matched to a property | Property §3.2 + Buyers §3.3 | `buyer_matched` | 15 | solo |
| **M5** | Khata / first settlement entry | Khata Book §3.5 | `khata_setup` | 8 | both |
| **M6** | Dashboard / analytics viewed | Dashboards §3.8 | `dashboard_viewed` | 6 | both |
| **M7** | First login post-trial | Auth §3.10 | `login` (first) | 6 | both |

Core-4 (defines `activated`): **M1, M2, M3, and (M4 agency / M4′ solo)**. M5–M7 add breadth/score but are not required for the activation flag. Weights sum so core-4 alone reaches the threshold band.

---

## 2. Activation score formula

`activationScore` ∈ [0,100], clamped. Three components: weighted milestones (breadth of *what* they did), recency (are they *still* here), and feature breadth (depth across modules).

```
activationScore = clamp( MILESTONES + RECENCY + BREADTH , 0, 100 )

MILESTONES = Σ (weight_i × hit_i)            # i ∈ {M1..M7}, hit ∈ {0,1}; segment selects M4 vs M4'
             capped at 78

RECENCY   = 14  if last login < 24h
            10  if < 72h
             4  if < 7d
             0  otherwise

BREADTH   = 8   if distinct modules used ≥ 4   (lead, ai_call, followup, khata, property, team, dashboard)
            5   if 3
            2   if 2
            0   otherwise
```

Max: 78 + 14 + 8 = 100. Segment weighting: agency uses M4 (`team_invited`); solo uses M4′ (`buyer_matched`) — only one counts toward MILESTONES.

**Worked example (agency, Day 7):** M1✓18 + M2✓12 + M3✓25 + M4✓15 = 70; login 6h ago → RECENCY 14; used 4 modules → BREADTH 8 → **score 92, activated=true (core-4 met)**.

---

## 3. Thresholds & bands

| Band | activationScore | Milestone rule | Meaning | Triggers |
|---|---|---|---|---|
| **Activated** | ≥ 70 | core-4 met | aha + habit forming | aha-celebration `WF-ACT-05`; eligible for referral ask post-win |
| **Partial** | 40–69 | 2 of core-4 | progressing, at-risk | milestone-nudge `WF-ACT-02` for the missing core milestone |
| **At-risk** | < 40 OR no login 48h | <2 of core-4 | stalling | stuck-recovery `WF-ACT-03` / aha-recovery `WF-ACT-04`; escalate if multi-red |
| **Stuck** (overlay) | any, but stalled >48h at one step | — | specific blocker | step-specific recovery (see `workflows.md`) |

`activated = (milestoneCount_core4 ≥ 3) AND (activationScore ≥ 70)`. The flag is sticky-up (once true within trial, stays true) but `band` recomputes for retention/health handoff.

---

## 4. SCORE entity data model (multi-tenant)

Reuses `technical-design.md` §2.4 — additive attributes only.

```
PK   = TENANT#{tenantId}#SCORE#{entityId}     # entityId = leadId (trial) or customerId
SK   = SCORE#LEAD                              # or SCORE#CUSTOMER (health handoff)
EntityType = SCORE
GSI-ScoreBand:  GSI7PK = TENANT#{tenantId}#ABAND#{band}   GSI7SK = {activationScore}#{entityId}
```

| Attribute | Type | Notes |
|---|---|---|
| `activationScore` | number 0–100 | computed (§2) |
| `band` | enum | `activated\|partial\|at_risk\|stuck` |
| `activated` | bool | core-4 met + score≥70 (sticky-up) |
| `milestones` | map | `{ M1:{hit,at}, M2:{hit,at}, ... }` — per-milestone hit + timestamp (explainability) |
| `milestoneCountCore4` | number | 0–4 |
| `segment` | enum | `solo\|agency` (selects M4/M4′) |
| `signals` | map | raw inputs: `lastLoginAt, distinctLoginDays, modulesUsed[], leadCount` |
| `stuckAtStep` | string? | `setup\|aha\|habit` if stalled >48h |
| `computedAt` | ISO | last recompute |
| `version` | string | scoring model version (e.g. `act-v1`) |

`GSI-ScoreBand` powers "show all at-risk trials, hottest-first" for the dashboard + CS queue. Solo/agency segment read from tenant config at compute time.

---

## 5. How it's computed (nightly + event-driven)

| Mode | Trigger | What runs | Latency |
|---|---|---|---|
| **Event-driven (delta)** | any milestone `MKT_EVENT` lands (via SQS consumer → `automationEngine`) | recompute the affected entity's score; flip `band`/`activated`; emit `milestone_hit` + (if crossed) `customer_activated` | < 5 s p95 |
| **Nightly (full)** | EventBridge cron (`scoringService.recompute(tenant)`, `technical-design.md` §3.2) | recompute RECENCY decay + BREADTH + stuck detection for all trial entities; correct drift; emit `trial_inactive` for 48h-no-login | batch, off-peak |

- **Idempotency:** recompute is pure over current events; `milestones.{Mx}.at` set with `if_not_exists` so first-hit time is immutable (mirrors `technical-design.md` §5 first-touch pattern).
- **Stuck detection (nightly):** if `now − lastEventAt(stage) > 48h` and stage incomplete → set `stuckAtStep`, emit event that arms the matching recovery workflow.
- **Recency decay** is why a one-and-done trial slides Activated→Partial without new logins — this is the early-warning signal handed to `retention/retention-system.md` health scoring on conversion to paid.

Engineering: `scoringService.js` (EP-5), event instrumentation (`implementation.md` AC-2/AC-3), GSI-ScoreBand provisioning (`implementation.md` §DB). Every milestone weight is tunable per-tenant (defaults above) and persisted in `signals` for audit.
