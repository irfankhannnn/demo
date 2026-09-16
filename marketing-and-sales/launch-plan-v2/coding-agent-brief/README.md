# Coding Agent Brief — How to Use This Folder

## Quick Start

### For the Founder

**Step 1 — One-time setup (do once before any agent starts):**

1. Add the tagged comment blocks to `apps/crm/server/server.js` and `apps/crm/real-estate-crm-app/src/App.tsx` (described in `00-MASTER-BRIEF.md §11,§12`).
2. Ensure `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md` is up-to-date with any last-minute schema changes.
3. Create the 7 new DynamoDB tables from `01-SHARED-CONTRACTS.md §1` in AWS Console (so they exist when agents deploy).

**Step 2 — Launch Batch 1 (4 agents in parallel):**

Feed each of these prompts to a separate AI agent instance:
- `prompts/PR-A-demo-environment.md` → Agent 1
- `prompts/PR-B-grievance-flow.md` → Agent 2
- `prompts/PR-C-cookie-consent.md` → Agent 3
- `prompts/PR-D-lp-build-pipeline.md` → Agent 4

Each agent runs in parallel. All 4 create PRs. Review and merge in the order: PR-D first, then PR-A, then PR-C, then PR-B.

**Step 3 — Merge Batch 1, then launch Batch 2 (3 agents in parallel):**

After ALL Batch 1 PRs are merged to `main`:
- `prompts/PR-E-analytics-layer.md` → Agent 5
- `prompts/PR-F-billing-webhook.md` → Agent 6
- `prompts/PR-G-security-audit.md` → Agent 7

**Step 4 — Merge Batch 2, then launch Batch 3 (2 agents in parallel):**
- `prompts/PR-H-seat-cap.md` → Agent 8
- `prompts/PR-I-landing-pages.md` → Agent 9

**Step 5 — Merge Batch 3, then launch Batch 4 (2 agents in parallel):**
- `prompts/PR-J-paywall-trial.md` → Agent 10
- `prompts/PR-K-nps-modal.md` → Agent 11

**Step 6 — Merge Batch 4, then launch Batch 5 (1 agent):**
- `prompts/PR-L-signup-brevo.md` → Agent 12

---

### For Each AI Agent

**Every agent does this first:**
1. Read `00-MASTER-BRIEF.md` (entire document)
2. Read `01-SHARED-CONTRACTS.md` (entire document)
3. Read your specific PR prompt file
4. Read the source task files listed in the prompt
5. Read the existing code files listed in the prompt ("Patterns to Copy" section)
6. Then write code

**Every agent does this at the end:**
1. Create the branch (`cursor/pr-{batch}{letter}-{name}-8e67`)
2. Commit all new files + modifications
3. Push branch
4. Create PR with the template from the prompt's "PR Description Template"
5. Set PR as Draft unless the batch is Batch 6

---

## Document Index

| File | What it contains | Who reads it |
|---|---|---|
| `README.md` | This file — how to use the folder | Founder |
| `00-MASTER-BRIEF.md` | Complete codebase context, patterns, env vars, shared file conventions | ALL agents (mandatory) |
| `01-SHARED-CONTRACTS.md` | DDB table schemas, API route specs, TypeScript interfaces, Razorpay plan IDs | ALL agents (mandatory) |
| `02-PR-SCHEDULE.md` | Day-wise PR plan, file ownership, merge order | Founder + each agent |
| `03-ANTI-CONFLICT-RULES.md` | How to prevent merge conflicts, tagged blocks, stubs | ALL agents + Founder |
| `prompts/PR-A-demo-environment.md` | Demo seed script + cron | Agent for PR-A |
| `prompts/PR-B-grievance-flow.md` | Grievance route + admin UI | Agent for PR-B |
| `prompts/PR-C-cookie-consent.md` | Cookie consent banner (2 variants) | Agent for PR-C |
| `prompts/PR-D-lp-build-pipeline.md` | LP Vite pipeline + partials | Agent for PR-D |
| `prompts/PR-E-analytics-layer.md` | PostHog CRM + LP snippet + server SDK | Agent for PR-E |
| `prompts/PR-F-billing-webhook.md` | Razorpay webhook + OpenClaw | Agent for PR-F |
| `prompts/PR-G-security-audit.md` | Multi-tenancy pentest + audit docs | Agent for PR-G |
| `prompts/PR-H-seat-cap.md` | Seat-cap enforcement + subscription service | Agent for PR-H |
| `prompts/PR-I-landing-pages.md` | 12 LP HTML pages + JSON-LD schemas | Agent for PR-I |
| `prompts/PR-J-paywall-trial.md` | Trial countdown + paywall modal + Razorpay | Agent for PR-J |
| `prompts/PR-K-nps-modal.md` | NPS survey modal + feedback backend | Agent for PR-K |
| `prompts/PR-L-signup-brevo.md` | Signup → Brevo + UTM attribution | Agent for PR-L |

---

## Day-wise Timeline

| Day | Batch | Active agents | PRs | Merge end-of-day |
|---|---|---|---|---|
| Day 1 | Batch 1 | 4 | PR-A, PR-B, PR-C, PR-D | ✅ merge all 4 |
| Day 2 | Batch 2 | 3 | PR-E, PR-F, PR-G | ✅ merge all 3 |
| Day 3 | Batch 3 | 2 | PR-H, PR-I | ✅ merge both |
| Day 4 | Batch 4 | 2 | PR-J, PR-K | ✅ merge both |
| Day 5 | Batch 5 | 1 | PR-L | ✅ merge |
| Day 6 | Batch 6 | 1 | PR-M (analytics CI) | ✅ merge |

Total: 6 days, 13 PRs, 12 AI agent sessions.

---

## Key Design Decisions Embedded in This Plan

1. **Stubs everywhere** — agents create stubs (placeholder functions with `// replace with PR-X` comments) for dependencies not yet built. This allows parallel work without missing imports.

2. **Tagged comment blocks** — `apps/crm/server/server.js` and `App.tsx` use `// === [LAUNCH ROUTES IMPORTS] ===` blocks so multiple agents can add to the same file without conflicts.

3. **PostHog-only in CRM** — `analytics.ts` wraps PostHog only. GA4/Pixel/LinkedIn/Hotjar are LP-only. This is architecturally enforced by the file ownership matrix.

4. **Deep-link CTAs** — all LP "Start Trial" CTAs include `utm_source=lp-{page}` so PostHog can stitch anonymous LP sessions to CRM user sessions.

5. **Cookie consent split** — LP banner has 4 toggles; CRM banner has 2 (no Marketing toggle since GA4/Pixel/LinkedIn are absent in CRM).

6. **Batch dependency chain** — each batch depends on the previous batch fully merging. This prevents an agent from building on stale code.
