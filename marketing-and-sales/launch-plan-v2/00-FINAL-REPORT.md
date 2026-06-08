# Launch Plan v2 — Final Authoring Report

**Date authored:** May 2026
**Status:** ✅ Complete — ready for AI-agent consumption
**Folder:** `marketing-and-sales/launch-plan-v2/`

This file is the closing summary of the v2 launch-plan authoring. It documents what was produced, where everything lives, how to consume the plan, and what's deliberately deferred.

---

## Why v2 (vs v1)

The original `launch-plan/` folder reflected an earlier strategy with different brand (RealtyFlow), different pricing (₹3,000 flat), multi-city focus (Mumbai+Pune+Delhi+Dubai), Hinglish copy, 7-day refund. v2 reflects the **current locked decisions**:

- Brand: **RealEstateFlow** + `realestateflow.in`
- Pricing: **₹999 / ₹1,999 + ₹500 per seat / ₹7,999 AI Employee** + 14-day free trial + 1-month money-back
- City: **Mumbai-only M1**, Pune ramp M2-M3
- Language: **English** (was Hinglish)
- AI Calling: **disabled M1** (commented out in App.tsx)
- AI Employee: **₹7,999/mo concierge add-on** (the wedge)
- Paid ads: **₹0 in M1** (founder-led + organic + outbound only)
- Founder: solo, 14h/day, 6-day week
- Compliance: **DPDP-first** (Privacy Policy + Cookie Banner + Grievance flow before launch)

`launch-plan/` is **untouched** as a historical reference. v2 is the canonical execution plan from now on.

---

## File inventory

**Total files authored:** 70 (+ 1 pricing.json = 71 deliverables)

### Foundation (6 files)
- `README.md` · `00-PLAN-OVERVIEW.md` · `00-DECISIONS-LOG.md` · `00-FILE-TEMPLATE.md` · `00-DAILY-STANDUP-TEMPLATE.md` · `pricing.json`

### Pre-launch (`pre-launch-prep/`) — 18 task files + 1 README
- P1 legal · P2 pricing · P3 deliverability · P4 positioning · P5 demo · P6 founder brand · P7 GST · P8 logos · P9 grievance · P10 analytics · P11 concierge · P12 seat-cap · P13 security · P14 paywall · P15 LP rewrite · P16 SEO/AEO · P17 cookie · P18 cloud infra
- `README.md` (folder index)

### Cross-cutting (`cross-cutting/`) — 6 reference files + 1 README
- `pre-execution-checklist.md` · `vendor-urls.md` · `skill-command-sheet.md` · `existing-asset-reuse-map.md` · `asset-production-calendar.md` · `risks-mitigations.md`
- `README.md` (folder index)

### Week 1 — Foundation (`week-1-foundation/`) — 7 day files + 1 README
- day-01 friction walkthrough → day-07 final audit
- `README.md` (folder index)

### Week 2 — Soft Launch (`week-2-soft-launch/`) — 7 day files + 1 README
- day-08 source prospects → day-14 collect testimonials
- `README.md` (folder index)

### Week 3 — Public Launch (`week-3-public-launch/`) — 7 day files + 1 README
- day-15 placeholders → day-21 metrics review
- `README.md` (folder index)

### Week 4 — Optimize & Convert (`week-4-optimize-convert/`) — 9 day files + 1 README
- day-22 CRO → day-30 M2 strategy
- `README.md` (folder index)

### LinkedIn posts (`linkedin-posts/`) — 5 drafts + 1 README
- post-1 through post-5 founder pre-launch sequence
- `README.md` (folder index)

### vs-pages (`vs-pages/`) — 3 drafts
- vs-sell-do · vs-zoho-crm · vs-excel-spreadsheet

### Month 2+ (`month-2-plus/`) — 6 strategic templates + 1 README
- M2-paid-ads · M2-pune-ramp · M2-referral-scale · M2-content-engine · M2-partnerships · M2-hiring-plan
- `README.md` (folder index)

### This summary
- `00-FINAL-REPORT.md` (this file)

---

## How to consume the plan (AI-agent SOP)

### Phase 1 — Block 0 (T-21 → T-1)

1. Tick `cross-cutting/pre-execution-checklist.md` (founder).
2. Read `00-PLAN-OVERVIEW.md`.
3. Execute P-files in dependency order per `pre-launch-prep/README.md`:
   - T-21: P3 + P18 + P6 (Posts 1-2)
   - T-19: P1 + P2 + P4
   - T-13: P8 + P15 + P16
   - T-8: P10 + P17 + P5 + P9 + P6 (Post 4 + Loom)
   - T-4: P12 + P14 + P11 + P7 + P6 (Post 5)
   - T-1: P13 (final audit)
4. Update `00-DECISIONS-LOG.md` after each P-file completes.

### Phase 2 — Day 1-30

5. Each morning, AI agent reads the day-N file in the appropriate week folder.
6. AI agent identifies 🤖 / 🧍 / 🤝 markers and runs AI Prompts for 🤖 sections.
7. Founder completes 🧍 sections.
8. End-of-day: founder writes `daily-log/dayNN.md` using `00-DAILY-STANDUP-TEMPLATE.md`.

### Phase 3 — Month 2+

9. Day 30: founder + Cascade build M2 Week-1 day-by-day plan from `week-4-optimize-convert/day-30-month-2-strategy.md` + `month-2-plus/*` templates.
10. New M2 day-files saved in `month-2-plus/` with `M2-week{N}-day-...` naming.

---

## File template

Every task file follows `00-FILE-TEMPLATE.md`:

- Type marker (🤖 / 🧍 / 🤝)
- Phase + Skills + Estimated time
- Objective
- Why This Matters for RealEstateFlow
- User Story
- Acceptance Criteria (checkbox list)
- Manual Steps (numbered)
- AI Prompt (copy-paste-able for Cascade or another LLM)
- Inputs · Outputs · Success Criterion
- Fallback / Plan B
- Risks table
- India / Mumbai-Specific Notes
- Dependencies (blocks · depends-on)
- Connected Skills (skill names from skill-command-sheet)

---

## What's deliberately deferred

- **Daily M2-M6 task files** — written when M1 results inform them (Day-30 onwards)
- **Pune-specific outreach templates** — `M2-pune-ramp.md` outlines; templates author M2 Week 2-3
- **Hindi/Marathi UI labels** — not M1 scope; queued M3+ if 5+ user requests
- **Mobile native apps** — web responsive M1; native app M3+
- **Enterprise tier (>10 seats)** — dropped from M1; revisit M3 if 2+ inbound enterprise asks

---

## Where decisions live (single sources of truth)

- **Locked decisions:** `00-DECISIONS-LOG.md`
- **Pricing canonical:** `pricing.json`
- **Brand constants:** `cross-cutting/existing-asset-reuse-map.md`
- **Vendor signup status:** `cross-cutting/pre-execution-checklist.md`
- **Risks register:** `cross-cutting/risks-mitigations.md`
- **PMF gate thresholds:** `00-PLAN-OVERVIEW.md`

---

## Quality bar (what counts as "done" for this plan)

For Cascade or any AI agent reading this folder cold, the plan should:

✅ Be **self-contained** — no need to reference v1 or external context for M1 execution
✅ Be **AI-executable** — each task has an AI Prompt that can run without founder hand-holding
✅ Be **fail-safe** — every task has a Fallback / Plan B
✅ Be **risk-aware** — every task has Risks + Mitigations + India-specific notes
✅ Be **traceable** — Decisions Log + per-file status tracking
✅ Be **reusable** — Pune/Delhi launch M2-M6 reuses 80%+ of the same playbook

If any of these break, this plan needs revision — not the playbook around it.

---

## Authoring credits

- **Plan author:** Cascade AI Agent + founder oversight
- **Plan version:** v2 (May 2026)
- **Source folder (v1):** `marketing-and-sales/launch-plan/` (untouched)
- **This folder:** `marketing-and-sales/launch-plan-v2/`

---

## Next action

The plan is now ready. The next action is **founder ticking the `pre-execution-checklist.md`** and starting Block 0 (T-21).

If anything in this plan breaks during execution, log a decision in `00-DECISIONS-LOG.md`, update the relevant task file, and continue. Don't pause the plan; iterate it.

— End of authoring —
