# Working Context Snapshot

**Project:** Nabi/Git backup of RealtyFlow / Cloudberry Real Estate CRM WhatsApp integration
**Path:** `D:\reality_flow_crm\nabi-app-git-bkp\`
**Created:** 2026-06-25
**Purpose:** Capture the architecture, decisions, and current state of the WhatsApp/Baileys robustness work so future sessions can continue without losing context.

## What this folder contains

| File | What it covers |
|------|----------------|
| `session-timeline.md` | Chronological list of what was built, reviewed, and fixed in this session |
| `architecture-and-approach.md` | High-level architecture, component responsibilities, data flow |
| `openclaw-references.md` | OpenClaw-inspired patterns that were applied (echo loops, debounce, idempotency, retry) |
| `robustness-implementation.md` | The 10 issues fixed during the code review and the follow-up reliability fixes |
| `agent-budget-issue.md` | The separate issue where "update budget" created a note instead of updating the lead |
| `current-issues-and-pending.md` | Open questions, known issues, and next steps |
| `files-changed.md` | Complete list of files touched in this session |
| `key-decisions.md` | Important design decisions and their rationale |
| `testing-notes.md` | Test commands, results, and how to verify |

## How to use this

1. Start a new chat session and point the agent at this folder.
2. Read `README.md` (this file), then `session-timeline.md`, then `current-issues-and-pending.md`.
3. Use the other files as reference for the specific area you want to work on.

## Important reminders

- The `baileys-service` runs on port 3003 and owns the Baileys socket.
- The `server` (Express) runs on port 4000 and receives webhooks from `baileys-service`.
- In local dev, the server processes webhooks directly; in production, it is invoked by EventBridge.
- `baileys-service` now patches `@whiskeysockets/baileys` on `npm install` via `patch-package`. If the patches are missing, run `npm install` or `npx patch-package` in `baileys-service`.
- The `__test_config.mjs` file was deleted earlier; if your IDE still shows it as open, it is a stale tab.
