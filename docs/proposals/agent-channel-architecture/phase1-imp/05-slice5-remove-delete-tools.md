# Slice 5 — Remove `delete_*` Tools and the Confirmation Subsystem

**Status: ✅ Done, tested.** Shipped after Slices 3–4 gave every entity a working, tested `archive_*` replacement, as planned — the capability was never removed before its replacement was proven.

## Why

An LLM-driven agent that can hard-delete a CRM record is one misread instruction away from unrecoverable data loss. The mitigation for that risk (`gateDeleteToolPlan()` in `server/agents/agentRuntime.js`, a WhatsApp yes/no confirmation gate) added real complexity — a whole `pendingConfirmation` state machine — for a risk that, once every entity has a reversible `archive_*` tool, no longer needs a runtime gate: the agent simply no longer has a tool that causes unrecoverable loss.

## What changed

### 1. Removed the 8 `delete_*` tool definitions

From `server/shared/toolDefinitions.js`: `delete_lead`, `delete_contact`, `delete_property`, `delete_property_document`, `delete_tenant`, `delete_owner`, `delete_buyer`, `delete_meeting`. `ALLOWED_TOOL_NAMES` (derived from this list) updates automatically. Verified: `TOOL_COUNT` went from 73 to 65 (8 removed, matching the 8 archive tools added in Slices 3–4, net registry size unchanged). The underlying `deleteLead`/`deleteContact`/etc. functions in `crmDynamodbService.js` were **not** removed — `server/routes/crm.js` still exposes genuine hard-delete via the human-facing REST API (confirmed by checking — those routes are untouched and unrelated to the AI tool registry).

### 2. Removed the confirmation subsystem it was guarding

From `server/agents/agentRuntime.js`: `gateDeleteToolPlan()`, `planFromPendingConfirmation()`, `PENDING_YES_RE`/`PENDING_NO_RE`, the `confirm_pending` plan-kind branch, and the `pendingConfirmation`-specific half of `persistTurnState()` (its `lastListResults`/`currentEntity` persistence logic — used far more broadly, for follow-up context like "open the second one" — was kept, just simplified since `decision` is no longer a parameter it needs).

From `server/agents/interaction/decideInteraction.js`: the `case 'confirm':` and `case 'cancelled':` branches, and the `case 'confirmed':` fallthrough. Verified before removing: `kind: 'confirm'` was constructed in exactly one place in the whole codebase (the `gateDeleteToolPlan` branch just removed), and `kind: 'confirmed'`/`'cancelled'` were never constructed anywhere in production code at all — the `'confirmed'` case was already dead code before this session (its own `planFromPendingConfirmation()` re-issued the pending tool call as `kind: 'tool'`, never `'confirmed'` — a small pre-existing inconsistency, harmless, cleaned up as a side effect).

### 3. `server/shared/toolDefinitions.js` meta-derivation cleanup

`deriveOperationKind()` had `if (name.startsWith('delete_')) return 'delete';` — now unreachable (no tool name matches), removed along with the corresponding `case 'delete':` branches in `deriveReplyOwner()`/`derivePresentationTemplate()`, and the `requiresConfirmation` meta field (confirmed unused anywhere else in the codebase before removing it — it was the field `gateDeleteToolPlan()` was *supposed* to read but never actually did, hard-coding its own `startsWith('delete_')` check instead; genuinely dead even before this slice).

Also updated the 8 `archive_*` tool descriptions to include `"delete <entity>"` as an explicit trigger phrase with a note that there is no delete tool — without this, a user literally saying "delete this lead" had no clear signal pointing the model at `archive_lead`.

### 4. Interim MCP fix — and a correction to the risk originally flagged

At the start of this work, the plan (and the note given to the user) was: *"removing `delete_*` from the canonical registry does not by itself stop external MCP clients from deleting records, since `reality-flow-mcp` hand-maintains its own separate tool-definition copy."* **Verifying the actual request path showed this was overstated.** `server/routes/agentTools.js` (the HTTP endpoint `reality-flow-mcp` calls into) checks `ALLOWED_TOOL_NAMES.includes(toolName)` — the canonical, now delete-free list — *before* invoking `invokeSkill()`, which re-checks the same list itself. Both checks are against the canonical registry, not against whatever `reality-flow-mcp`'s local copy advertises. So an external client could still *see* `delete_lead` listed (a stale discovery-level artifact) but calling it was **already** rejected server-side with a 400 the moment the canonical registry lost the entry — no separate MCP-side fix was required to close a security gap, because there wasn't one left open.

The remaining issue was narrower than originally framed: **UX staleness**, not an authorization bypass — an external AI client could see a tool advertised, attempt to call it, and get a confusing "not allowed" error instead of the tool simply not being listed. Fixed anyway, since it was quick and directly relevant: removed the same 8 `delete_*` entries from `reality-flow-mcp/src/services/toolDefinitions.ts`. Verified structurally (brace/bracket balance, no dangling references) since no `tsc`/`node_modules` were available in this environment to do a real TypeScript build check — flagged as a residual verification step for whoever next builds this service.

The full drift-elimination fix (generating this file from the canonical registry, per [`../flows/06-mcp-external.md`](../flows/06-mcp-external.md)'s Phase 6) is still not done — this was a manual, interim removal of 8 known-stale entries, not the generated-schema fix.

### 5. Related cleanup found and fixed along the way

- **~360 lines of confirmed-dead code** in `server/skillInvoker.js` — a variable literally named `_TOOL_SCHEMAS_REMOVED`, explicitly commented as superseded and unused, still sitting in the file. Deleted.
- **`USER_CATEGORIES` permission allowlists** (`server/userCategoryService.js`) still referenced the now-removed `delete_*` tool names, and had no entries at all for any `archive_*` tool — meaning any surface that *does* enforce category-based permissions (unlike the primary WhatsApp flow, which doesn't pass a `userId` today — see [`07-bugs-found.md`](./07-bugs-found.md) #8) would have been unable to grant archive access to anyone. Fixed for the `admin` and `whatsapp_bot` categories.
- **`server/aiDtoMiddleware.js`** — the per-entity `*_TOOLS` sets and switch-cases that gate the (feature-flagged, currently-off-by-default) AI DTO transformation pipeline had `delete_*` cases and no `archive_*` cases at all. Added `archive_*` to each set, routing it through the same `buildUpdateConfirmation`-style view builder `update_*` already uses (archiving returns the full updated entity, unlike the old minimal `{metadata:{action:'deleted'}}` envelope `delete_*` used) — and removed the now-unreachable `delete_*` cases.

## How it was tested

1. **Registry verification**: `TOOL_COUNT` and `ALLOWED_TOOL_NAMES.filter(n => n.startsWith('delete_'))` checked directly — zero `delete_*` names remain, 8 `archive_*` names present, `validateToolDefinitions()` passes.
2. **`skillInvoker.test.js`**: the `'exposes all expected tools'` test now also asserts `ALLOWED_TOOLS` contains no `delete_*`-prefixed name at all — an explicit regression guard. The individual `delete_lead`/`delete_property`/`delete_buyer`/`delete_property_document` tests were converted (not deleted) into `"... is no longer a callable tool"` tests, asserting `invokeSkill` returns `ok: false` / `"Tool not allowed"` and the underlying handler is never called.
3. **`decideInteraction.test.js`**: the stale `'confirm instruction sets pending'` test (which exercised `delete_lead`-specific confirmation) was replaced with a test proving `archive_lead` now goes through the same `'mutation'` mode path as any other mutate tool.
4. **`aiDtoMiddleware.test.js`**: the stale `delete_lead`/`delete_meeting` DTO tests were replaced with tests proving those tool names now correctly pass through unchanged (since they're no longer in any `*_TOOLS` set), and new tests proving `archive_lead`/`archive_meeting` get the same update-confirmation DTO shape `update_lead`/`update_meeting` already get.
5. **`userCategoryService.test.js`**: ran unchanged — all existing assertions (`not.toContain('delete_lead')`, threshold-based counts) still passed without modification, since none of them asserted the *presence* of a `delete_*` tool.
6. **Full test suite**: 535 passing, only the 3 pre-existing unrelated failures remain (confirmed via `git stash` before any of this session's work began).

## Explicitly out of scope for this slice

- **The underlying `deleteLead`/`deleteContact`/etc. functions were not removed** — they remain available for a genuine admin-only hard-delete path via `server/routes/crm.js`.
- **The full `reality-flow-mcp` generated-schema fix (Phase 6)** — this slice did a manual interim removal, not the generator.
- **Phase 2/3 orchestration work** — this slice only removes tools and dead code from the current single-shot pipeline; it doesn't touch the bounded tool loop or agent-core extraction.
