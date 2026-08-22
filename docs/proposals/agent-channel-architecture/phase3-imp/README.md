# Phase 3 Implementation — The Reliability Fix

Phase 3 from [`../03-implementation-plan.md`](../03-implementation-plan.md) — *"Ships: the actual 'complete flow from WhatsApp' capability. This phase answers the original goal directly."*

Same discipline as [`../phase1-imp/`](../phase1-imp/) and [`../phase2-imp/`](../phase2-imp/): verify against real code before writing, test every change against the full suite, document deviations and anything found along the way.

## Status

| Slice | What | Status | Doc |
|---|---|---|---|
| 3a | Bounded multi-step tool loop (the `functionCalls[0]` fix) | ✅ **Done — shipped OFF behind `AGENT_TOOL_LOOP_ENABLED`** | [`01-slice3a-bounded-tool-loop.md`](./01-slice3a-bounded-tool-loop.md) |
| 3b | Router hard gate → ranker (scope escalation on a mis-scoped turn) | ✅ **Done — same flag as 3a** | [`02-slice3b-router-ranker.md`](./02-slice3b-router-ranker.md) |
| 3c | Strict tool schemas; retire `coerceQueryToFilters`/`LEAD_STATUS_TYPOS` | ⛔ **Blocked — gated on eval data** | — |
| 3d | `find_person` resolver tool | ✅ **Done — live, not flag-gated** | [`03-slice3d-find-person.md`](./03-slice3d-find-person.md) |
| 3e | Consolidate the 12 overlapping metrics tools down to 3–4 | 📋 Not started | — |
| 3f | Prompt caching on the stable prefix | 📋 Not started | — |

**583/586 tests passing**, zero regressions. The 3 remaining failures are pre-existing and unrelated (documented in [`../phase1-imp/07-bugs-found.md`](../phase1-imp/07-bugs-found.md) #9–10).

## Why 3c is blocked, not just "not started"

[`../03-implementation-plan.md`](../03-implementation-plan.md) gates it explicitly: *"run both paths in parallel for one phase, log every divergence, delete repair code only once the eval set shows no regression."* The eval set (Phase 1 Slice 6) has a working harness but **no real fixture data** — sourcing it needs AWS access to export real conversation logs. Deleting `coerceQueryToFilters`/`LEAD_STATUS_TYPOS` without that baseline would be removing input-repair code with no way to detect what it was silently rescuing. Blocked on data, not effort.

## Note on 3d's scope

3d shipped the `find_person` tool but deliberately **kept** the prose disambiguation rules the plan said to remove — they solve list/category ambiguity ("show me all buyers"), which `find_person` doesn't address. Removing them belongs with 3e. Reasoning in the slice doc.

## Why 3a shipped behind a flag

This work landed before a launch, against a standing "make sure nothing breaks" instruction. The loop is a genuine behavior change — it's the one piece of this proposal that changes what the agent *does*, not just how the code is arranged. Shipping it dormant behind `AGENT_TOOL_LOOP_ENABLED=false` means the code is in place and tested, production behavior is unchanged, and enabling it is a config flip with an instant rollback path. See the slice doc's Rollout section.

## Bug found while implementing

Meeting creation from WhatsApp was **completely broken** — every well-formed `create_meeting` request was answered *"I need a bit more info to do that: scheduledDate"*. Same root cause as the `skillInvoker.js` bug fixed in Phase 1, but an independent copy of it in `planTurn.js`, one layer earlier — which means the Phase 1 fix alone never actually made meeting creation work. Fixed in both the new loop and the live single-shot planner, with a regression test. Full detail in the slice doc.
