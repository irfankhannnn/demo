# Working Context Snapshot

**Project:** RealtyFlow / Cloudberry Real Estate CRM — WhatsApp SyncBot  
**Path:** `D:\reality_flow_crm\nabi-app-git-bkp\`  
**Updated:** 2026-07-19

## Active workstream (start here)

→ **[`syncbot-interaction-design.md`](syncbot-interaction-design.md)**  
→ Spec: [`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md)  
→ Transformation layer: [`docs/ai-response-design/README.md`](../ai-response-design/README.md)

## What this folder contains

| File | What it covers |
|------|----------------|
| `syncbot-interaction-design.md` | **Active** — consistent WhatsApp responses across entities |
| `session-timeline.md` | Chronological Baileys/robustness work (historical) |
| `architecture-and-approach.md` | WhatsApp/Baileys architecture |
| `openclaw-references.md` | OpenClaw-inspired patterns |
| `robustness-implementation.md` | Baileys reliability fixes |
| `agent-budget-issue.md` | Budget update vs note bug |
| `current-issues-and-pending.md` | Open issues (includes SyncBot UX) |
| `files-changed.md` | Files touched in earlier sessions |
| `key-decisions.md` | Design decisions |
| `testing-notes.md` | Test commands |

## How to use this

1. Read `README.md`, then `syncbot-interaction-design.md`, then `current-issues-and-pending.md`.
2. For Baileys socket issues, use the robustness docs.
3. For response UX, prefer Interaction Design v1 over outdated checklist items in entity READMEs.

## Important reminders

- `whatsapp-platform` owns the socket; `server` owns the agent + formatter.
- AI DTO flags default off until each entity pipeline is complete.
- Do not put WhatsApp templates inside `docs/ai-response-design/` — that is data-only.
