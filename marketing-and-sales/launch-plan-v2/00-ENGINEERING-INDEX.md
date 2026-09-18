# Engineering tracking — index

> **Status (17 Sep 2026):** An index only. Five folders and two reports in `launch-plan-v2/` track real engineering work against the real codebase. They are **not part of the marketing playbook**, and this merge did not move, edit or rewrite a single file inside them. This page exists so `README.md` can point at them once and move on.

If you are here to write marketing content, you are in the wrong file — go to `README.md` and pick a layer.

---

## What is here

| Folder / file | Files | Tracks | Status |
|---|---|---|---|
| `coding-agent-brief/` | 28 | The parallel-coding-agent programme: `00-MASTER-BRIEF.md`, `01-SHARED-CONTRACTS.md` (schemas, event and analytics contracts), `02-PR-SCHEDULE.md`, `03-ANTI-CONFLICT-RULES.md`, an audit report, 10 bug files (`bugs/BUG-001`…`010`) and 12 per-PR prompts (`prompts/PR-A`…`PR-L`) | Live. The PR prompts are the work queue. |
| `final-mvp-ready/` | 32 | The MVP-readiness implementation plan: 10 epic files (onboarding/WhatsApp, credits, SES migration, team analytics, data-quality crons, MCP agents, CFN deploy, testing, error handling), `notes/`, `pending-mvp/` (deployment steps, manual configuration, known issues, observability spec, testing guide) and `zishan_docs/` (technical readiness, code audit, launch action plan) | Implementation marked complete 2026-06-19; `pending-mvp/` holds the outstanding manual release steps. |
| `pending-tasks/` | 10 | Nine sequenced task lists — infra setup, external accounts, legal and compliance, content and brand, deployment, and one per launch week | Live checklist. |
| `updated-files/` | 8 | A gap analysis, the brand-positioning reconciliation, a Jira backlog, and delta documents for the launch plan, landing-page copy, SEO/AEO content, and an execution checklist | Historical delta record. Read for provenance, not as the current plan. |
| `team-work/` | 3 | Per-person task splits: `FOUNDER-tasks.md`, `MADHU-tasks.md`, `ZEESHAN-tasks.md` | Live. |
| `00-FINAL-REPORT.md` | 1 | The closing summary of the original May 2026 launch-plan authoring — what was produced, where it lives, what was deferred | Historical. |
| `PENDING-TASKS-EXECUTION-REPORT.md` | 1 | Execution report for the June 2026 pending-tasks consolidation | Historical. |

---

## Rules

1. **Owner:** the founder plus whichever coding agent is running. Not the content writers.
2. **The marketing merge does not touch these.** No file inside them was moved, renamed or edited when `content-os/` was folded into the six layers.
3. **Where they overlap the marketing playbook, they win on engineering facts.** `coding-agent-brief/01-SHARED-CONTRACTS.md` §3.4 is one of the sources for the live analytics event contract; `50-measurement/posthog-event-map.md` reads from it rather than inventing names.
4. **Pre-launch task ownership:** `pre-launch-prep/P1`–`P18` is the pre-launch checklist for the launch itself. `pending-tasks/` is the engineering-side companion. They are complementary, not duplicates — `pre-launch-prep/` carries the legal, GST, grievance, multitenancy-audit and cookie-consent items that have no engineering equivalent.
5. **Retired design specs** — the unbuilt growth-platform and Content OS engineering designs — are **not** here. They are in `archive/content-os/`, indexed with their build triggers in `50-measurement/design-only-backlog.md`.
