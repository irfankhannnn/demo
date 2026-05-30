# 06 — Execution Checklist (Apply Order)

Maps to master-prompt **§0 + §7**. The master prompt's final checklist re-expressed as an **apply-order**: which existing `launch-plan-v2/` file each delta lands in, in what sequence. Tick as you apply each change.

> Reminder: this pack changes the **plan**, not the product. Items marked 🔧 FEATURE define a launch requirement but the build is routed to the separate feature-implementation conversation.

---

## Step 0 — Resolve decisions (do first)

- [ ] **D1 — Brand name:** confirm `RealEstateFlow` (recommended) vs `Happy Properties`. Log in `../00-DECISIONS-LOG.md`. *(If Happy Properties → stop; spin up a rebrand program first; this pack assumes RealEstateFlow.)*
- [ ] **D2 — Palette/typography:** confirm keep green `#22C55E` + navy `#0F3A66` + Inter (recommended) vs adopt master's navy+amber/Sora. Log.
- [ ] **D3 — Launch-scale targets:** confirm keep M1 = 3–5 paying / ₹0 ads / PMF gate (recommended) vs master's 50-in-launch-week. Log.

Reference: `01-BRAND-POSITIONING-RECONCILIATION.md`, `03-LAUNCH-PLAN-DELTA.md` §2.

---

## Step 1 — Stand up the Jira backlog (highest-value net-new)

- [ ] Import `02-JIRA-BACKLOG.md` (10 epics, 85 stories) into Jira/tracker.
- [ ] Set priorities P0/P1/P2 → Highest/High/Medium; map points; set `Linked File` per row.
- [ ] Tag the 29 `➕/🔧` gap stories; route the 🔧 FEATURE ones to the feature conversation.
- [ ] Confirm the 56 `✅ specced` stories link to their existing `P*`/`day-*` file.

---

## Step 2 — Apply brand & positioning deltas

- [ ] Add brand-voice principles + dual "AI Employee + CRM" framing note → `00-PLAN-OVERVIEW.md` §1.
- [ ] Add L1/L2/L3 messaging ladder → `P4` outputs (`wedge.md`) and reuse in cold email (`day-09`, `day-17`).
- [ ] Add umbrella tagline + mission → `00-PLAN-OVERVIEW.md`, `/about` brief in `P15`.
- [ ] Confirm website voice = English (supersedes legacy Hinglish-website rule); Hinglish stays for ads only.

Reference: `01`.

---

## Step 3 — Apply launch-plan deltas

- [ ] Add master-prompt phase-view mapping → `00-PLAN-OVERVIEW.md` §3.
- [ ] Create onboarding-wizard task → `week-1-foundation/` (E04-02, 🔧). 
- [ ] Create welcome-sequence task (Day 0/3/7/14) → `week-2-soft-launch/` (E04-03).
- [ ] Create press-release task → `week-3-public-launch/` (E09-03).
- [ ] Extend ProductHunt/launch-platform assets → `week-3-public-launch/day-16-directory-submissions.md` (E09-04, optional).
- [ ] Create webinar task → `month-2-plus/` (E09-10).
- [ ] Create in-product dashboards task → `month-2-plus/` (E07-02..05, 🔧).

Reference: `03`.

---

## Step 4 — Apply landing-page copy deltas (into `P15`)

- [ ] Hero trust row (`✓ no setup fee · ✓ WhatsApp + portals · ✓ live in 24h`) — E03-01.
- [ ] Add Problem/Agitation section (3 pain cards) — E03-02.
- [ ] Upgrade to AI Employee | CRM two-column split — E03-03.
- [ ] Add social-proof stat bar (labelled benchmarks) — E03-04.
- [ ] Localise How-It-Works (WhatsApp + Indian portals + Khata) — E03-01.
- [ ] Confirm pricing trust line (no £ import; INR per `pricing.json`) — E03-05.
- [ ] Add 7 localised FAQ Q&As (DPDP, 24h, Indian portals) — E03-06.
- [ ] Adopt urgency CTA ("Your competitors are already using AI") — E03-01.

Reference: `04`. Keep all pricing/trust wording sourced from `pricing.json`; label benchmark stats; swap to first-party data after beta.

---

## Step 5 — Apply SEO/AEO/content deltas (into `P16` + `M2-content-engine`)

- [ ] Update robots.txt with explicit AI-bot stanzas — E03-11.
- [ ] Add VideoObject schema to AC + schema list — E06-04.
- [ ] Add frontload-answer (44.2%) rationale to AEO rules — E06-07.
- [ ] Add the 7 localised FAQ Q&As to FAQPage blob — E03-06.
- [ ] Create 90-day content calendar → `month-2-plus/M2-content-calendar-90day.md` — E06-08.
- [ ] Add YouTube channel + transcript strategy → `M2-content-engine.md` — E06-09.
- [ ] Add Google Business Profile task → `P16` platform tactics — E06-05.
- [ ] Consolidate KPI dashboard → `M2-content-engine.md` — E07-07.

Reference: `05`. Keep India-adapted targets; do not import UK volume goals wholesale.

---

## Step 6 — Verify (master-prompt §7, adapted)

- [ ] All Jira epics created with correct structure ✔ (Step 1)
- [ ] Seed stories expanded from repo scan + cross-linked ✔ (`02`)
- [ ] Launch plan reconciled with phases + new tasks ✔ (`03`)
- [ ] Landing-page copy deltas applied in `P15` ✔ (`04`)
- [ ] robots.txt AI-bot directives in `P16` ✔ (`05`)
- [ ] JSON-LD (incl. VideoObject + localised FAQ) in `P16` ✔ (`05`)
- [ ] 90-day content calendar exists ✔ (`05`)
- [ ] Brand decisions logged in `00-DECISIONS-LOG.md` ✔ (Step 0)
- [ ] KPI dashboard consolidated ✔ (`05`)
- [ ] 🔧 FEATURE stories routed to the separate feature conversation ✔

---

## What is explicitly NOT done here (and why)

| Not done | Reason |
|---|---|
| Editing existing `P*`/`day-*` files | This pack is additive; deltas tell you *how* to edit, applied deliberately after decisions are logged |
| Building any product feature | Out of scope per founder; routed to separate conversation (🔧 stories) |
| Rebranding to "Happy Properties" | Requires founder decision D1; not a deliberate request |
| Adopting GBP pricing / GDPR / UK portals / IDX-MLS | Localised to INR / DPDP / Indian portals; UK-only constructs dropped |
| Committing to 50-in-launch-week / 200-by-M6 | Incompatible with locked solo-founder + ₹0-ads + PMF gate (D3) |

---

## One-line summary for the founder

> Your `launch-plan-v2` already covers ~66% of the master prompt for the India market. The real adds are: **(1) a Jira backlog** (new), **(2) onboarding wizard + welcome sequence + in-product dashboards**, **(3) a few landing-page copy sections** (problem/agitation, stat bar, AI/CRM split, localised FAQ), and **(4) the 90-day content calendar + YouTube + explicit AI-bot robots.txt**. Keep RealEstateFlow's brand, INR pricing, and conservative M1 targets — the master prompt's UK/GBP/50-customer assumptions don't fit your locked constraints.
