# RealEstateFlow — Launch Plan v2 (executable shadow folder)

This folder is the **canonical, AI-agent-executable** launch playbook for RealEstateFlow's Mumbai-first launch. Every task is a self-contained markdown file that an AI agent (or a teammate) can pick up and execute end-to-end without further context. The original `launch-plan/` folder is preserved as historical archive — **do not edit it**.

---

## How to use this folder

1. **Start by reading these in order:** `00-PLAN-OVERVIEW.md` → `cross-cutting/pre-execution-checklist.md` → `cross-cutting/skill-command-sheet.md`.
2. **Pick the next task** in execution order (see §3 below). Each file has a `> **Type:** 🤖 / 🤝 / 🧍` header so you can route it.
3. **For 🤖 AUTO tasks:** copy the **AI Prompt** block verbatim into Cascade (or any agent that has access to this repo) and run it. Verify the **Acceptance Criteria** afterwards.
4. **For 🧍 MANUAL tasks:** follow the numbered **Manual Steps** block; tick checkboxes as you complete each.
5. **For 🤝 HYBRID tasks:** run the AI Prompt to produce a draft, then complete the Manual Steps (sign, publish, post, etc.) before ticking ACs.
6. **End every working day** by writing `marketing-and-sales/launch-implement/daily-log/dayXX.md` using `00-DAILY-STANDUP-TEMPLATE.md`.
7. **Append every locked decision** to `00-DECISIONS-LOG.md`.

---

## Folder map

```
launch-plan-v2/
├── README.md                       # this file
├── 00-PLAN-OVERVIEW.md             # condensed wedge / pricing / roadmap
├── 00-DECISIONS-LOG.md             # append-as-you-go decision log
├── 00-FILE-TEMPLATE.md             # the unified template for new tasks
├── 00-DAILY-STANDUP-TEMPLATE.md    # for daily-log/dayXX.md
├── pricing.json                    # single source of truth for prices
│
├── pre-launch-prep/                # P1–P18 — T-21 to T-1
├── week-1-foundation/              # day-01 to day-07
├── week-2-soft-launch/             # day-08 to day-14
├── week-3-public-launch/           # day-15 to day-21
├── week-4-optimize-convert/        # day-22 to day-30
│
├── cross-cutting/                  # asset calendar, asset reuse map, skills, vendors, risks, checklist
├── linkedin-posts/                 # 5 ready-to-publish founder posts (T-14 → T-3)
├── vs-pages/                       # 3 competitor LP drafts (Sell.do, Zoho, Excel)
└── month-2-plus/                   # PMF-gated M2 work (paid ads, programmatic SEO, webinar, referral)
```

---

## Execution order (high level)

1. **Block 0 — Pre-launch (T-21 → T-1):** `pre-launch-prep/P1*` to `P18*` in numerical order. Multiple files can run in parallel — see each file's **Dependencies** block.
2. **Block 1 — Week 1 (Day 1-7):** `week-1-foundation/day-01*` to `day-07*` strictly in order.
3. **Block 2 — Week 2 (Day 8-14):** soft launch.
4. **Block 3 — Week 3 (Day 15-21):** public launch + cold outreach.
5. **Block 4 — Week 4 (Day 22-30):** optimize, convert, plan Month 2.
6. **Block 5 — Month 2+:** PMF-gated; only start if PMF gate met (≥3 paying / ≥40% activation / ≥10% reply rate).

---

## Brand constants (locked)

| Field | Value |
|---|---|
| Brand | RealEstateFlow |
| Domain | `realestateflow.in` |
| Logo PNG (source) | `marketing-and-sales/realestateflow/assets/logos/final/logo.png` |
| Brand colors | primary green `#22C55E` · navy `#0F3A66` · dark `#07111E` |
| City focus M1 | **Mumbai only** |
| Language (website) | **English** |
| Language (ads) | 60% English / 25% Hinglish / 15% Marathi |
| Voice-overs | ElevenLabs only |
| Trial | 14-day, no card (Solo/Team/Team+) — **none** for AI Employee |
| Refund | 1 month (Solo/Team/Team+) — **none** for AI Employee |
| Pricing | see `pricing.json` |
| Grievance Officer email | `info@realestateflow.in` |
| AWS region | `ap-south-1` (Mumbai) |
| S3 bucket for launch artefacts | `cloudberry-real-estate-launch` |
| Internal name "OpenClaw" | tech-forum / LinkedIn devrel only — never public marketing |

---

## Conventions (every file enforces)

- File header has 🤖 / 🤝 / 🧍 type so an agent can filter
- All paths are repo-relative (e.g., `server/routes/grievance.js`)
- AI Prompts are wrapped in a single fenced block, copy-pasteable
- Success Criteria are numeric or boolean (verifiable)
- Risks are paired with mitigations (no orphan risks)
- Dependencies are linked by file path or task ID
- India-specific notes are explicit about DPDP / RBI / GST
- Every file ends with a "Connected Skills" footer

---

## Source-of-truth files

| Topic | File |
|---|---|
| Wedge & positioning | `00-PLAN-OVERVIEW.md` + `pre-launch-prep/P4-competitive-positioning.md` |
| Pricing | `pricing.json` (do NOT change pricing in any other file; reference this) |
| Brand kit | `marketing-and-sales/creative/realestateflow-launch/brand-kit.md` |
| Existing assets to reuse | `cross-cutting/existing-asset-reuse-map.md` |
| Skills inventory | `cross-cutting/skill-command-sheet.md` |
| Vendor signup URLs | `cross-cutting/vendor-urls.md` |

---

## When in doubt

- The master plan that produced this folder is at `C:\Users\qures\.windsurf\plans\realestateflow-launch-implementation-plan-v2-853037.md`.
- The file inventory + template spec is at `C:\Users\qures\.windsurf\plans\launch-plan-v2-file-inventory-853037.md`.
- For decisions not yet logged, default to the founder; for technical conventions, follow `server/routes/leads.js` + `server/tenantMiddleware.js` + `real-estate-crm-app/src/App.tsx`.
