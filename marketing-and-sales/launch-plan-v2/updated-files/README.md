# Launch Plan v2 — Master-Prompt Update Pack

This folder is the **delta plan** produced by applying the *Happy Properties AI Employee & CRM — Master Prompt* (`HappyProperties-MasterPrompt.md`) against the existing `launch-plan-v2/` playbook.

> **Scope guardrail (per founder instruction):** This pack changes the **plan only**. It does **not** implement product features. The acceptance criteria, stories, and copy blocks here describe *what the launch plan must say and require*. The actual feature build (e.g., onboarding wizard, in-product dashboards, portal connectors) will be scoped separately. Wherever a story implies a feature, it is written at plan/story level, not as code.

> **Folder guardrail (per founder instruction):** Everything here is additive and lives **inside `launch-plan-v2/updated-files/`**. No existing `launch-plan-v2/` file is edited by this pack. Each delta file tells you *which* existing file to update and *how*, so you (or a follow-up agent) can apply the changes deliberately.

---

## The core finding (read this first)

The master prompt was written for a **different brand and market** than the existing plan:

| Dimension | Master Prompt ("Happy Properties") | Existing plan (`launch-plan-v2/`) |
|---|---|---|
| Brand name | Happy Properties | **RealEstateFlow** (`realestateflow.in`) |
| Market | UK (Rightmove/Zoopla, GBP £) | **India / Mumbai-first** (WhatsApp/Telegram, INR ₹) |
| Channel wedge | AI Employee + CRM (generic) | **AI Employee on WhatsApp + Telegram** for broking agencies |
| Pricing | £X / £X / Custom | **₹999 / ₹1,999 (+₹500/seat) / ₹7,999 AI Employee** |
| Launch scale | 50 paying in launch week, 200 by M6 | **3–5 paying M1**, solo-founder, ₹0 paid ads |
| Brand colours | Navy `#0D1B2A` + Amber `#F4A261` | Green `#22C55E` + Navy `#0F3A66` |

**Therefore the master prompt is treated as a strategic *template*, not a drop-in.** We keep RealEstateFlow's brand, market, pricing, and realistic solo-founder scale, and we **adopt the master prompt's frameworks**: the 10-epic Jira backlog, the phased launch structure, the landing-page copy formulas, the 90-day content calendar, the AEO rigor, and the messaging hierarchy — all re-expressed in the RealEstateFlow / India context.

The single biggest *net-new* gap the master prompt exposes is **#1: there is no Jira-importable backlog** anywhere in the plan. The plan is organised as `P*` and `day-*` task files, which is great for execution but not for sprint/backlog management. Filling that gap is the highest-value addition in this pack.

A handful of items require a **founder decision before they can be applied** — chiefly the brand-name question (Happy Properties vs RealEstateFlow) and the launch-scale targets. These are flagged in `00-GAP-ANALYSIS.md` and `01-BRAND-POSITIONING-RECONCILIATION.md` as `⚠️ DECISION`.

---

## What's in this pack

| File | Maps to master-prompt section | Purpose |
|---|---|---|
| `00-GAP-ANALYSIS.md` | All sections | Section-by-section: what already exists, what to change, what's net-new, and every conflict + decision point |
| `01-BRAND-POSITIONING-RECONCILIATION.md` | §1, §6 | Resolves the three competing brand identities; the messaging hierarchy + brand voice to adopt; the brand-name decision |
| `02-JIRA-BACKLOG.md` | §2 | **Net-new.** 10 epics + import-ready stories (Fibonacci points, P0/P1/P2), each cross-linked to the existing `P*`/`day-*` file that already covers it (or flagged as a true gap) |
| `03-LAUNCH-PLAN-DELTA.md` | §3 | Reconciles the master prompt's Phase 0–3 with the existing T-21 → Day-30 → M2 structure; lists the launch tasks to *add* (onboarding wizard, ProductHunt/press, in-product dashboards, etc.) |
| `04-LANDING-PAGE-COPY-DELTA.md` | §4 | The copy blocks to add/adjust in `pre-launch-prep/P15-landing-pages-rewrite.md`, rewritten in RealEstateFlow voice + INR |
| `05-SEO-AEO-CONTENT-DELTA.md` | §5 | robots.txt AI-bot directives, VideoObject schema, the India-adapted 90-day content calendar, platform tactics, and the KPI dashboard additions to `P16` + `M2-content-engine` |
| `06-EXECUTION-CHECKLIST.md` | §0, §7 | The master prompt's agent checklist re-expressed as an apply-order checklist: which existing file each delta lands in, and in what sequence |

---

## How to use this pack

1. **Read `00-GAP-ANALYSIS.md`** for the full picture and the decision points.
2. **Resolve the `⚠️ DECISION` items** (brand name, launch-scale targets) and log them in `../00-DECISIONS-LOG.md`.
3. **Import `02-JIRA-BACKLOG.md`** into Jira (or your tracker) — this is the new backbone for sprint planning.
4. **Apply each delta file** to its target existing file, following the apply-order in `06-EXECUTION-CHECKLIST.md`. Each delta is explicit about *target file → change*.
5. Anything that depends on a feature that does not yet exist is marked `🔧 FEATURE` so it can be routed to the separate feature-implementation conversation the founder mentioned.

---

## Legend used across this pack

| Marker | Meaning |
|---|---|
| ✅ EXISTS | Already covered by an existing `launch-plan-v2/` file — reference, don't rebuild |
| 🔁 CHANGE | Existing file needs an edit (copy, scope, or target) to match the master prompt's intent |
| ➕ ADD | Net-new task/story/section to add to the plan |
| 🔧 FEATURE | Implies product feature work — route to the separate feature conversation |
| ⚠️ DECISION | Needs a founder decision before it can be applied |
| 🇮🇳 ADAPTED | Master-prompt item kept, but localised from UK/GBP to India/INR/WhatsApp |
