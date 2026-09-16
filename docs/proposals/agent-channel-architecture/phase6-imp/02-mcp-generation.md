# Phase 6 — MCP Tool-Registry Drift (Generation Half)

**Status: ✅ Complete. Drift is now structurally impossible, and closing it exposed three live OAuth scope bugs.**

## The blocker was environmental, and it lifted

The [detection half](01-mcp-drift-detection.md) deferred generation for one reason above all others: *"No TypeScript toolchain available here. `reality-flow-mcp` has no `node_modules` and no local `tsc`, so any TS I write or generate is unverifiable."*

That was true at the time. It is no longer: `npm install` in `reality-flow-mcp` succeeds, and `npx tsc --noEmit` compiles the existing source clean. Every claim below is verified by an actual build, not by inspection.

**Worth noting for next time:** the blocker was never checked, only assumed. One `npm install` would have lifted it days earlier. "No toolchain available" deserved a command, not a conclusion.

## What was generated, and what deliberately was not

`apps/crm/server/scripts/generate-mcp-tools.mjs` emits `services/reality-flow-mcp/src/services/generatedToolDefinitions.ts` — **the tool data only**.

The MCP service's own logic stays hand-written in `toolDefinitions.ts`, which imports the generated array: the interfaces, `convertToMcpTools`, and `inferScope`'s OAuth scope mapping.

That split is the point. `inferScope` decides whether a tool needs a read or a write scope. A generator that rewrote it would be one bad template away from handing a read-scoped client a write tool — the exact privilege escalation the detection half found and fixed. **Security-relevant logic does not go in machine-written files.**

Only fields the MCP service consumes are emitted; `meta` and `domain` drive server-side routing and mean nothing across the boundary.

## Result

```
before:  46 tools exposed of 66 canonical   (20 unreachable)
after:   68 tools exposed of 68 canonical   ✅
```

The capability regression is closed: MCP clients can archive records again (Slice 5 removed `delete_*` from the copy and never added the `archive_*` replacements, leaving external clients with **no way to remove a record at all**), `find_person` is reachable, and so are the 11 summary/briefing tools.

The archive scope fix from the detection half was **unexercised until now** — no archive tool existed in the copy to test it against. Verified live: all 8 `archive_*` tools resolve to `write_*`.

## Three OAuth scope bugs, found because generation made them reachable

Generating the file made 20 previously-absent tools callable, which is exactly when latent scope bugs stop being theoretical. All three were in `inferScope`.

### S1. 🟠 Twelve tools had no scope, and no scope means *no check*

`inferScope` returned `null` for anything it could not name-match, and its own comment claimed *"Tools not listed here require the wildcard 'crm' scope."*

`mcpController` reads it as:

```ts
if (requiredScope && !tokenScopes.includes(requiredScope)) { throw ... }
```

`null` is falsy. **The check is skipped entirely.** Not "requires a wildcard" — *unrestricted*.

Twelve tools fell through, including `search_khata_entries` and `get_khata_summary`. A client holding only `read_meetings` could read the tenant's **financial ledger**. Also affected: `get_business_health`, `get_dashboard_snapshot`, `get_daily_brief`, and the rest of the briefing surface.

### S2. 🟠 `includes('property')` does not match `search_properties`

The name-substring matching missed plurals. `search_properties` — the most-used property tool there is — and `get_properties_summary` both fell through to `null`, and therefore to S1.

### S3. 🔴 Contact and metrics tools were permanently uncallable

`inferScope` emitted `read_contacts`, `write_contacts` and `read_metrics`. **None of the three existed in `OAUTH_SCOPES`.** DCR clients are granted "all scopes", which means the 12 in that list — so no client could ever hold them.

Every one of the 9 contact tools and 12 metrics tools would have returned `Insufficient scope` to every OAuth client, forever. Not a security hole; a feature that could not work.

### The fix: derive the scope from data, not from the name

`inferScope` now takes the `ToolDefinition` and reads its `category` and `readOnly` fields — both already in the canonical registry:

```ts
const noun = SCOPE_NOUN_BY_CATEGORY[tool.category];
if (!noun) return 'crm';
return tool.readOnly ? `read_${noun}` : `write_${noun}`;
```

This kills all three at once. Plurals cannot be missed because names are not parsed. `readOnly` already encodes that `archive_*` is a write, which is a better authority than a name prefix. And it **never returns null** — an unmapped category falls back to the wildcard `crm` scope, so a tool added under a new category cannot silently become callable by everyone.

Supporting changes:
- `OAUTH_SCOPES` gained `read_contacts`, `write_contacts`, `read_khata`, `read_metrics`, and `crm`.
- `mcpController` now honours `crm` as an actual wildcard — it was declared as one in a comment but never implemented, so a client granted it would still have been refused everything.

## Enforcement

Four checks, wired so this cannot rot again:

| Check | Runs | Catches |
|---|---|---|
| `npm run check:mcp-tools` | CI | Committed file edited by hand or left stale — regenerates and compares byte-for-byte |
| `npm run check:mcp-drift` | CI | A **generator bug** producing self-consistent but wrong output — re-parses the committed file without using the generator |
| `npm run check:scopes` | MCP `prebuild` + CI | An unscoped tool, an ungrantable scope, or a write tool on a read scope |
| `npm run build` (MCP) | CI | The generated TypeScript actually compiles |

The two drift checks share no code deliberately. A single check run twice proves less than two checks that can disagree.

`check-mcp-tool-drift.mjs`'s zero-guard earned its place during this work: when the file's shape changed, it parsed 0 tools and **failed loudly** rather than reporting "in sync". A checker that silently passes is worse than no checker.

The CI step was `continue-on-error: true` with a note saying to flip it once the gap closed. It is now blocking.

## Still open

`inferScope`'s granularity is per-category, so a client granted `write_leads` can call every lead write including `archive_lead`. Splitting destructive operations into their own scope (`archive_leads`) is a reasonable future refinement; it needs a decision about existing granted tokens, so it is not a silent change.
