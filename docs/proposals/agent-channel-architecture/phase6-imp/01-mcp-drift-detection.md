# Phase 6 — MCP Tool-Registry Drift (Detection Half)

**Status: ✅ Superseded — generation is now done.** See [`02-mcp-generation.md`](./02-mcp-generation.md).

This document records the detection half and remains accurate about what it shipped. Its stated blocker for generation ("no TypeScript toolchain available here") turned out to be untested — `npm install` in `reality-flow-mcp` works, and generation landed shortly after. The drift numbers below (46 of 66 exposed) are the *pre-generation* state; it is now 68 of 68.

## Why

[`../flows/06-mcp-external.md`](../flows/06-mcp-external.md): `reality-flow-mcp/src/services/toolDefinitions.ts` is a hand-maintained **copy** of the canonical registry. Its own header says so, and it had already drifted twice over — 74 exposed vs 87 canonical, with a doc-comment still claiming 54.

## What shipped

### 1. Security fix: `archive_*` was being granted READ scope

`inferScope()` maps each tool to an OAuth scope, treating `/^(create|update|delete|convert)_/` as writes. **`archive_` was not in that list**, so every archive tool would have fallen through to the `read_*` branch — meaning a read-scoped OAuth client could archive records. A real privilege escalation.

It wasn't live (archive tools were never added to the MCP copy), but it was a **loaded gun**: the moment anyone propagated the archive tools to MCP — which is exactly what the other half of Phase 6 does — it would have fired. Found by reading `inferScope` *before* writing the generator, precisely because generating would have triggered it.

Fixed: `archive` added to every write-detection pattern, with a comment explaining why archiving is a write (reversible ≠ read-only).

### 2. `server/scripts/check-mcp-tool-drift.mjs` + `npm run check:mcp-drift`

Compares the canonical registry against the MCP copy and exits non-zero on any difference, in either direction:
- **canonical-but-not-in-MCP** — a capability external clients can't reach
- **in-MCP-but-not-canonical** — the dangerous direction: a client sees the tool, calls it, gets a 400

It also fails loudly if it parses **zero** tools, so a change to the file's shape can't silently turn the check into a no-op that always passes.

## Current measured drift

```
canonical: 66 tools
mcp copy:  46 tools
❌ 20 canonical tools NOT reachable from MCP
✅  0 stale tools advertised over MCP
```

**The dangerous direction is clean** — nothing is advertised that doesn't exist, confirming the Slice 5 interim removal of `delete_*` from the MCP copy held.

The 20 missing break down as:
- **8 `archive_*`** — a **capability regression I introduced**: Slice 5 removed `delete_*` from the MCP copy but never added the archive replacements, so an MCP client currently has *no way to remove a record at all*.
- **`find_person`** — added in Slice 3d, never propagated.
- **11 metrics/summary tools** (`get_leads_summary`, `get_pipeline_summary`, `get_priority_leads`, …) — pre-existing drift, never in the MCP copy.

## Why generation was deferred (and the regression not yet closed)

The plan's fix is to **generate** the MCP file from the canonical registry at build time. I did not do that, and did not hand-add the 20 missing tools either. Reasons, in order of weight:

1. **No TypeScript toolchain available here.** `reality-flow-mcp` has no `node_modules` and no local `tsc` in this environment, so any TS I write or generate is **unverifiable** — I cannot even confirm it compiles. Hand-writing ~20 tool definitions (~200 lines) into a deployable service's source with no type-check, days before a launch, is a bad trade.
2. **Regenerating a deployable service's source is not a pre-launch change.** A detector is additive and cannot break anything. A generator rewrites the file the MCP service actually ships.
3. **The gap is a missing capability, not a broken one.** External clients can't archive or fetch summaries. Nothing they *can* call is wrong.

## What's left for the generation half (post-launch)

1. Write `generate-mcp-tools.mjs` emitting the tool array from `server/shared/toolDefinitions.js`.
2. Wire it into `reality-flow-mcp`'s `prebuild` so a stale copy can't be deployed.
3. Add `npm run check:mcp-drift` to CI so the committed output is verified in sync.
4. Update the stale "54 CRM tools" header comment.
5. **Verify `inferScope` assigns `write_*` to all 8 archive tools once they exist in the copy** — the fix above is in place but currently unexercised, since no archive tool is in the file yet.

## Priority note

Item 5 plus the archive regression means: **whoever closes this gap must confirm archive tools land on `write_*` scope.** The fix is written, but nothing exercises it today. Closing the capability gap without checking that would re-open the privilege-escalation path this slice just closed.
