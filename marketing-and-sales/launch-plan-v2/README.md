# RealEstateFlow — Launch Plan v2

This folder is the **canonical, AI-agent-executable launch playbook** for RealEstateFlow's Mumbai-first launch, and — since the September 2026 merge — it is also the home of the content system that used to live in `content-os/`. Every task is a self-contained markdown file an AI agent or a teammate can pick up and run end to end.

**No other file in this repository is a navigation root for the launch.** The four files that used to claim that job (`content-os/README.md`, `GTM-OS-README.md`, `master-index.md`, `user-guide.md`) are absorbed here and archived under `archive/content-os/`. The older `marketing-and-sales/launch-plan/` folder is historical — do not edit it.

---

## How to use this folder

1. **Read `00-PLAN-OVERVIEW.md`** — the wedge, the pricing pointer, the roadmap, the PMF gate.
2. **Read `00-OPEN-DECISIONS.md`** — eight marketing decisions (D22–D29) are deliberately unresolved. If your work touches one, mark it, do not settle it.
3. **Read `cross-cutting/pre-execution-checklist.md`** and `cross-cutting/skill-command-sheet.md`.
4. **Skim the six reference layers** (`10-` … `60-` below) for the layer your task sits in.
5. **Pick the next task** in execution order (§"Execution order"). Each file has a `> **Type:** 🤖 / 🤝 / 🧍` header so you can route it.
6. **For 🤖 AUTO tasks:** copy the **AI Prompt** block verbatim into an agent with repo access and run it. Verify the **Acceptance Criteria** afterwards.
7. **For 🧍 MANUAL tasks:** follow the numbered **Manual Steps** block; tick checkboxes as you go.
8. **For 🤝 HYBRID tasks:** run the AI Prompt for a draft, then complete the Manual Steps (sign, publish, post) before ticking ACs.
9. **Before anything goes public,** run the six-item checklist in `10-audience-and-voice/claims-and-proof-policy.md`.
10. **End every working day** with `marketing-and-sales/launch-implement/daily-log/dayXX.md`, using `00-DAILY-STANDUP-TEMPLATE.md`.
11. **Append every locked decision** to `00-DECISIONS-LOG.md`. Open ones go to `00-OPEN-DECISIONS.md`.

---

## The six reference layers

The layers are *reference*; the week folders are the *schedule*. A day file that needs content guidance links into a layer. Numbering is by tens so a layer can be inserted later without renumbering.

| Layer | Answers | Start at |
|---|---|---|
| `10-audience-and-voice/` | Who we talk to, what is true about the product, how we sound, what we may claim | `10-audience-and-voice/README.md` |
| `20-content-engine/` | How a piece of content gets made — frameworks, hooks, CTAs, visuals, prompts, the production run-sheet | `20-content-engine/README.md` |
| `30-channels/` | Where it goes — Instagram, WhatsApp, Facebook, LinkedIn, YouTube, founder presence | `30-channels/README.md` |
| `40-sales-and-conversion/` | How a follower becomes a paying agency — DM to demo, qualification, demo, objections, close, onboarding | `40-sales-and-conversion/README.md` |
| `50-measurement/` | What we measure, on PostHog + Razorpay + NPS + one sheet — and what we deliberately do not build | `50-measurement/README.md` |
| `60-automation/` | What runs without us, with everything unbuilt marked design-only | `60-automation/README.md` |

---

## Folder map

```
launch-plan-v2/
├── README.md                       # this file — the single entry point
├── 00-PLAN-OVERVIEW.md             # wedge · pricing pointer · roadmap · PMF gate
├── 00-DECISIONS-LOG.md             # append-only log of LOCKED decisions
├── 00-OPEN-DECISIONS.md            # D22–D29, deliberately unresolved
├── 00-ENGINEERING-INDEX.md         # index of the engineering tracking folders
├── 00-FILE-TEMPLATE.md             # the unified template for new task files
├── 00-DAILY-STANDUP-TEMPLATE.md    # for daily-log/dayXX.md
├── pricing.json                    # the only source of prices
│
├── 10-audience-and-voice/          # WHO we talk to and HOW we sound
├── 20-content-engine/              # HOW a piece of content gets made
├── 30-channels/                    # WHERE it goes
├── 40-sales-and-conversion/        # HOW a follower becomes a paying agency
├── 50-measurement/                 # WHAT we measure (PostHog · Razorpay · NPS)
├── 60-automation/                  # WHAT runs without us
│
├── pre-launch-prep/                # P1–P18 — T-21 to T-1
├── week-1-foundation/              # day-01 to day-07
├── week-2-soft-launch/             # day-08 to day-14
├── week-3-public-launch/           # day-15 to day-21
├── week-4-optimize-convert/        # day-22 to day-30
├── month-2-plus/                   # PMF-gated M2 work
│
├── cross-cutting/                  # asset calendar, reuse map, skills, vendors, risks, checklist
├── linkedin-posts/                 # 5 ready-to-publish founder posts (T-14 → T-3)
├── vs-pages/                       # 3 competitor LP drafts (Sell.do, Zoho, Excel)
│
├── archive/content-os/             # the retired Content OS, with a banner on every file
│
└── ── engineering tracking: INDEXED, NOT PART OF THE MARKETING PLAYBOOK ──
    ├── coding-agent-brief/  final-mvp-ready/  pending-tasks/  updated-files/  team-work/
    ├── 00-FINAL-REPORT.md
    └── PENDING-TASKS-EXECUTION-REPORT.md          # all indexed by 00-ENGINEERING-INDEX.md
```

---

## Execution order (high level)

1. **Block 0 — Pre-launch (T-21 → T-1):** `pre-launch-prep/P1*` to `P18*` in numerical order. Several can run in parallel — see each file's **Dependencies** block.
2. **Block 1 — Week 1 (Day 1–7):** `week-1-foundation/day-01*` to `day-07*`, strictly in order.
3. **Block 2 — Week 2 (Day 8–14):** soft launch.
4. **Block 3 — Week 3 (Day 15–21):** public launch plus cold outreach.
5. **Block 4 — Week 4 (Day 22–30):** optimise, convert, plan Month 2.
6. **Block 5 — Month 2+:** PMF-gated. Only start if the gate is met (≥3 paying · ≥40% activation · ≥10% reply rate · ≥1 promoter).

Forward-looking work beyond the week folders is expressed as **phases, not dates** — Phase A (M1 launch), Phase B (hardening), Phase C (growth) — because no launch date is logged.

> Open decision D28 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## Brand constants

**All of them live in one place: `10-audience-and-voice/brand-constants.md`.** Name, domain, handle, the v3 "Bazaar Signal" palette and type, the three language splits and their scopes, city scope, voice-over vendor, AWS region, the S3 bucket, the grievance mailbox, and the pricing pointer.

Do not restate a colour, a font, a handle or a price in any other file. The table that used to sit here listed the retired v2 green/navy palette and is gone.

---

## Source-of-truth files

| Topic | File |
|---|---|
| Wedge and positioning | `00-PLAN-OVERVIEW.md` + `pre-launch-prep/P4-competitive-positioning.md` |
| Positioning detail | `marketing-and-sales/realestateflow/BRAND-POSITIONING.md` |
| **Prices, trial, refund** | `pricing.json` — do NOT restate a price in any other file. The replacement proposal is `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md` |
| Brand constants | `10-audience-and-voice/brand-constants.md` |
| Visual system | `marketing-and-sales/creative/realestateflow-launch/brand-kit.md` (v3 "Bazaar Signal") |
| **Product facts** | `10-audience-and-voice/product-truth.md` |
| **What we may claim** | `10-audience-and-voice/claims-and-proof-policy.md` |
| Content system | `20-content-engine/README.md` |
| Metric definitions | `50-measurement/metric-dictionary.md` |
| **Open questions** | `00-OPEN-DECISIONS.md` |
| Locked decisions | `00-DECISIONS-LOG.md` |
| Month-1 organic pack | `marketing-and-sales/realestateflow/content-strategy-first-month/` |
| Existing assets to reuse | `cross-cutting/existing-asset-reuse-map.md` |
| Skills inventory | `cross-cutting/skill-command-sheet.md` |
| Vendor signup URLs | `cross-cutting/vendor-urls.md` |
| Engineering tracking | `00-ENGINEERING-INDEX.md` |
| Retired design records | `archive/content-os/README.md` |

---

## Stable IDs

Salvaged from the retired `master-index.md`. A finished piece of content is a recipe of IDs, so scripts, the content plan and analytics can all refer to the same objects.

| Prefix | Object | Canonical home |
|---|---|---|
| `FW-` | Framework | `20-content-engine/framework-library.md` |
| `CH-` | Character | `20-content-engine/cast-and-presenter.md` |
| `VP-` | Visual preset | `20-content-engine/visual-system.md` |
| `HF-` | Higgsfield workflow | `20-content-engine/higgsfield-guide.md` |
| `HK-` | Hook | `20-content-engine/hooks/hooks.json` |
| `CTA-` | CTA | `20-content-engine/ctas/ctas.json` |
| `CT-` | Content type | `20-content-engine/content-types.md` |
| `OPP-` | Content opportunity | `20-content-engine/content-plan/content-plan-500.csv` |
| `M-` | Metric | `50-measurement/metric-dictionary.md` |

Never redefine one of these objects outside its canonical home. Reference the ID.

---

## Conventions (every file enforces)

- File header carries 🤖 / 🤝 / 🧍 so an agent can filter
- All paths are repo-relative (e.g. `apps/crm/server/routes/grievance.js`) — never a Windows user path
- AI Prompts are one fenced block, copy-pasteable
- Success criteria are numeric or boolean, and therefore verifiable
- Risks are paired with mitigations; no orphan risks
- Dependencies are linked by file path or task ID
- India-specific notes are explicit about DPDP, RBI and GST
- Every file ends with a "Connected Skills" footer
- A section that depends on an open decision carries exactly:
  `> Open decision D2x — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`

---

## The three standing rules

1. **Pre-launch, zero customers.** No testimonials, no case studies, no agency counts, no adoption statistics. Product screen recordings and build-in-public notes are the proof we have.
2. **Never assert a loss figure — make the viewer produce their own.**
3. **The founder is never on camera.** Video is fronted by an AI presenter, which may never present itself as a broker, an owner, a customer or the founder.

All three are enforced by `10-audience-and-voice/claims-and-proof-policy.md`.

---

## When in doubt

For decisions not yet logged, default to the founder. For technical conventions, follow `apps/crm/server/routes/leads.js`, `apps/crm/server/tenantMiddleware.js` and `apps/crm/real-estate-crm-app/src/App.tsx`.
