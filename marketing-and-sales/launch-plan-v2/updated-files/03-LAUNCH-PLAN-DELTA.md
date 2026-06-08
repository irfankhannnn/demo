# 03 — Launch Plan Delta

Maps to master-prompt **§3**. The existing plan is mature; this file (a) maps the master prompt's Phase 0–3 onto the existing structure, (b) reconciles the scale targets, and (c) lists the launch tasks to **add**.

---

## 1. Phase mapping (master prompt → existing plan)

The master prompt's 8-week linear shape is a *simplification* of the existing T-21 → Day-30 → M2 structure. Don't replace — map.

| Master-prompt phase | Goal (master) | Existing equivalent | Verdict |
|---|---|---|---|
| **Phase 0 — Foundation** (wks 1–3) | live with 10 beta users | `pre-launch-prep/` (P1–P18, T-21→T-1) + `week-1-foundation/` (day-01..07) | ✅ Covered, deeper. Master's 9 tasks ⊂ existing P-files |
| **Phase 1 — Closed Beta** (wks 4–7) | validate AI + CRM, 3 testimonials | `week-2-soft-launch/` (day-08..14) | ✅ Covered (8–12 testers, 5+ testimonials) |
| **Phase 2 — Public Launch** (wk 8) | 50 paying in launch week | `week-3-public-launch/` (day-15..21) | 🔁 Covered, but **target differs** (see §2). Add PH/press (§3) |
| **Phase 3 — Growth** (M3–6) | 200 paying, case studies, ranking | `week-4-optimize-convert/` + `month-2-plus/` | ✅ Covered (case studies, G2, programmatic SEO, paid, affiliate, Pune ramp) |

**Master-prompt Phase 0 task → existing file crosswalk:**

| Master Phase-0 task | Existing file |
|---|---|
| 0.1 Finalise positioning & brand voice | `P4-competitive-positioning.md`, `01` of this pack |
| 0.2 AI Employee core flow | `P11-openclaw-concierge.md` (E01) |
| 0.3 CRM data model locked | product + `P5`, `P13` |
| 0.4 Landing page copy live | `P15-landing-pages-rewrite.md` + `04` |
| 0.5 robots.txt + sitemap | `P16-seo-aeo-master.md` + `05` |
| 0.6 JSON-LD on landing page | `P16` |
| 0.7 GSC + Bing verified | `P16` search-console-submission |
| 0.8 Demo seeded with realistic data | `P5-demo-environment.md` |
| 0.9 Beta agencies recruited | `week-2/day-08..10` |

> **Takeaway:** every master-prompt Phase-0 line already has an owner file. No new pre-launch tasks needed except the **onboarding** additions in §3.

---

## 2. ⚠️ Scale-target reconciliation (DECISION D2)

| Metric | Master prompt | Existing plan (`00-PLAN-OVERVIEW.md` §5) | Recommendation |
|---|---|---|---|
| Beta users | 10 agencies | 8–12 Mumbai testers | ✅ Align — keep existing |
| Launch-week paying | **50** | trial signups 30–50; **paying 3–5 (M1)** | ⚠️ **Keep existing.** 50 paying in a week with ₹0 ads + solo founder is not credible |
| Month-6 paying | 200 | (M3–6 city expansion; no hard 200 number) | Set a *stretch* M6 goal (e.g., 50–100) once PMF gate clears; don't hard-commit 200 |
| Paid ads in launch | implied | **₹0 in M1** (locked) | Keep ₹0 M1; paid is PMF-gated (`M2-paid-ads-readiness.md`) |

**Why:** the existing plan has a locked **PMF gate** (≥3 paying / ≥40% activation / ≥10% reply / ≥1 promoter) before any paid spend (`00-PLAN-OVERVIEW.md` §4). The master prompt's aggressive numbers assume a funded GTM motion. Preserve the gate; treat master numbers as *aspirational ceilings*, not commitments. **Log D2.**

---

## 3. Launch tasks to ADD (➕)

These fill the genuine launch-plan gaps the master prompt surfaces. Each is written as a new task to **create** in the named existing folder, following `00-FILE-TEMPLATE.md`.

### ➕ A. Onboarding setup wizard (Phase 0/1)
- **Create:** `week-1-foundation/day-XX-onboarding-wizard.md` *(or fold into existing day-01/02 friction work)*
- **Why:** activation event = "AI handles ≥1 lead within 7 days." Without a guided wizard, trial users stall. (Backlog E04-02.)
- **AC highlights:** 3-step wizard (connect WhatsApp → import leads → configure AI), resumable, empty-state fallbacks, PostHog step events.
- **Type:** 🔧 FEATURE (build routed separately) + 🤝 (copy/empty-state text in-plan).

### ➕ B. Welcome email/WhatsApp sequence Day 0/3/7/14 (Phase 1)
- **Create:** `week-2-soft-launch/day-XX-welcome-sequence.md` *(complements `day-13-checkin-drip.md`)*
- **Why:** master §EPIC-04 welcome cadence; drives activation + trial→paid. (E04-03.)
- **AC:** Brevo (email) + AiSensy (WhatsApp) templates for Day 0 (setup nudge), Day 3 (first-lead nudge), Day 7 (activation check / book call), Day 14 (trial-ending → convert). DPDP consent respected.
- **Type:** 🤝 (templates in-plan; automation 🔧).

### ➕ C. Press release (Phase 2)
- **Create:** `week-3-public-launch/day-XX-press-release.md`
- **Why:** master §EPIC-09. Target India PropTech / real-estate trade press + Mumbai startup press.
- **AC:** 1 release draft (≤450 words, founder quote, Mumbai angle, data point), media list (10–15 India outlets/journalists), send log. Reuse messaging L2 from `01`.
- **Type:** 🤝.

### ➕ D. ProductHunt / launch-platform assets (Phase 2, low priority for India)
- **Fold into:** `week-3-public-launch/day-16-directory-submissions.md` (extend, don't duplicate)
- **Why:** master §EPIC-09. For India B2B, PH is secondary to cold outreach + LinkedIn; keep light.
- **AC:** PH gallery (5 images), tagline, first comment, hunter ask — *if* the founder opts in. Otherwise mark deferred.
- **Type:** 🤝 / optional.

### ➕ E. Launch webinar / live demo (Phase 2/3)
- **Create:** `month-2-plus/M2-webinar.md` *(or note in `day-30-month-2-strategy.md`)*
- **Why:** master §Phase-2 + content calendar Week 9. Record for YouTube (feeds E06-09).
- **AC:** webinar deck outline, registration LP, Cal.com/Zoom setup, recording → YouTube pipeline.
- **Type:** 🤝.

### ➕ F. In-product analytics dashboards (Phase 3)
- **Create:** `month-2-plus/M2-product-analytics-dashboards.md`
- **Why:** master §EPIC-07 (agent performance, lead velocity, AI activity log, revenue forecast). Today these are **manual** (`day-21` metrics review). Productising them is post-PMF.
- **AC:** define the 4 dashboards' metrics + data sources; route build to feature conversation. (E07-02..05.)
- **Type:** 🔧 FEATURE + plan.

---

## 4. Updated phase timeline (to add to `00-PLAN-OVERVIEW.md` §3)

Append a "master-prompt phase view" alongside the existing roadmap so both vocabularies map cleanly:

```
PHASE 0 (Foundation)      = pre-launch-prep T-21→T-1  +  week-1  (day 1-7)
PHASE 1 (Closed Beta)     = week-2  (day 8-14)         [+ welcome sequence, onboarding wizard]
PHASE 2 (Public Launch)   = week-3  (day 15-21)        [+ press release, webinar, optional PH]
PHASE 3 (Growth)          = week-4 (day 22-30) + month-2-plus  [+ in-product dashboards]
PMF GATE between Phase 2 and Phase 3 paid spend (unchanged)
```

---

## 5. Apply targets

| Change | Target |
|---|---|
| Add phase-view mapping | `00-PLAN-OVERVIEW.md` §3 |
| Log scale-target decision (D2) | `00-DECISIONS-LOG.md` |
| New task: onboarding wizard | `week-1-foundation/` (new day file) + backlog E04-02 |
| New task: welcome sequence | `week-2-soft-launch/` (new day file) + E04-03 |
| New task: press release | `week-3-public-launch/` (new day file) + E09-03 |
| Extend: ProductHunt assets | `week-3-public-launch/day-16-directory-submissions.md` + E09-04 |
| New task: webinar | `month-2-plus/` + E09-10 |
| New task: in-product dashboards | `month-2-plus/` + E07-02..05 (🔧 feature) |
