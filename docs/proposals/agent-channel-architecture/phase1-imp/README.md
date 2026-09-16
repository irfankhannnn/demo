# Phase 1 Implementation — WhatsApp Agent Foundation

This folder tracks the actual implementation of the proposal's Phase 1 ("make quality measurable, stop the bleeding" — see [`../03-implementation-plan.md`](../03-implementation-plan.md)), broken into smaller, independently-shippable **slices**. Each slice is built, tested, and verified before the next one starts — nothing here is built speculatively ahead of what's been proven.

This is the execution log for the proposal; the proposal docs (`../01-diagnosis.md` through `../05-retrieval-and-vector-search.md`) remain the design rationale and are not modified as slices ship.

## Why sliced, not built as one Phase 1

The original Phase 1 description bundled three different kinds of change into one phase: pure code cleanup, an infrastructure change (a new DynamoDB GSI), and a cross-cutting schema change (8 tools' worth of delete→archive). Verifying the codebase before writing code showed two of those are bigger than the proposal implied:

- **No GSI exists yet** on `AgencyConfigTable` — only its `TenantId` hash key. Adding one for `connectedWhatsAppPhone` means a CFN change, a deploy, and a wait for the index to finish backfilling before code can depend on it. That is not a same-sitting code edit.
- **Only 1 of 8 entities already has an "archived" state.** `property` has `archived` in its status enum already; `lead`, `contact`, `tenant`, `owner`, `buyer`, `meeting`, and `property_document` do not — two of them (`contact`, `property_document`) don't even have a stored status field at all.

Bundling these together would mean the whole phase can't ship until the slowest, riskiest piece (an infra deploy) is ready — and it would mean testing everything at once, which makes it hard to isolate what broke if something does. So each piece below is its own slice, with its own before/after, its own tests, and its own "why," built in dependency order.

## Status

| Slice | What | Status | Doc |
|---|---|---|---|
| 1 | Hot-path cleanup (remove debug fetches, dedupe tenant-resolution Scan) | ✅ **Done** | [`01-slice1-hot-path-cleanup.md`](01-slice1-hot-path-cleanup.md) |
| 2 | Add a GSI on `connectedWhatsAppPhone`, switch tenant lookup from Scan to Query | ✅ **Code done, tested — deploy pending (user-owned)** | [`02-slice2-gsi-tenant-lookup.md`](02-slice2-gsi-tenant-lookup.md) |
| 3 | `archive_property` tool (proof of concept — reuses the existing `archived` enum value) | ✅ **Done** | [`03-slice3-archive-property.md`](03-slice3-archive-property.md) |
| 4 | `archive_*` for the remaining 7 entities (each needs its own schema decision) | ✅ **Done** | [`04-slice4-archive-remaining-entities.md`](04-slice4-archive-remaining-entities.md) |
| 5 | Remove the 8 `delete_*` tools + the `gateDeleteToolPlan`/`pendingConfirmation` subsystem | ✅ **Done** | [`05-slice5-remove-delete-tools.md`](05-slice5-remove-delete-tools.md) |
| 6 | Eval set: export real Hinglish utterance→tool-call pairs, build a labelled fixture harness | 🟡 **Harness built — real data export still blocked** | [`06-slice6-eval-set.md`](06-slice6-eval-set.md) |
| — | Bugs found and fixed along the way (5 live production bugs, ~360 lines of dead code, several stale references) | — | [`07-bugs-found.md`](07-bugs-found.md) |

Slices 1, 3, 4, and 5 are fully done and tested (535 tests passing, zero regressions — verified against the pre-session baseline via `git stash`). Slice 2's code is done and tested; the actual CFN deploy and index backfill wait is a user-owned infra step. Slice 6's harness is real and working but has no real fixture data yet — see that doc.

Once the deploy step for Slice 2 lands, work moves to the proposal's Phase 2 (extract the agent core / principal-based sessions) — see [`../03-implementation-plan.md`](../03-implementation-plan.md) for that and everything after it (the bounded tool loop, channel-aware compose, web chat).

## How to read a slice doc

Each slice doc follows the same shape so the set is scannable:

1. **Why** — the problem, in terms of what a user or the system actually experiences, not just "the proposal said so."
2. **What changed / what will change** — concrete before/after, with code.
3. **How it was tested / how it will be tested** — the actual commands and assertions, not just "add tests."
4. **Verification result** (completed slices only) — what actually ran, what passed, what was ruled pre-existing vs. caused by this change.
5. **What's explicitly out of scope** — so the next slice's boundary is unambiguous.
