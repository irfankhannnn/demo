# Slice 3d — `find_person` Resolver Tool

**Status: ✅ Done, tested. Live immediately (not behind the tool-loop flag).**

## Why

[`../01-diagnosis.md`](../01-diagnosis.md)'s issue #3: *"Entity ambiguity resolved by prose rules. Buyer/seller/tenant/owner each have both a 'lead' form and a 'converted record' form in different tables. This is currently handled by rules in the planner system prompt rather than a resolver tool."*

When a user says *"Rajesh ka detail dikhao"*, the planner had to **guess** whether Rajesh is a lead in the pipeline or a converted buyer/owner/tenant — two different tables, two different tools. A wrong guess returns "not found" for a person who plainly exists. `find_person` lets the model ask instead of guess.

## What already existed (and why it wasn't enough)

`crmDynamodbService.js` already had `findPersonByPhone(tenantId, phone)`. It looked like the tool this slice needed, but has two disqualifying gaps:

1. **It never looks at leads.** It checks buyer, owner, and customer only — so it cannot answer the exact ambiguity that motivates this slice.
2. **Phone only.** The proposal specifies `find_person(name|phone)`, and "Rajesh" is the common case.

It was also never exposed as a tool. Left in place unchanged (it has its own callers and a narrower contract); `findPerson` is additive alongside it, and the code comment on each points at the other so the next reader doesn't mistake them for duplicates.

## What changed

**`crmDynamodbService.js` → new `findPerson(tenantId, { query })`** — searches leads **and** buyers/owners/tenants/contacts together, returning every match with its `recordType` and `id`:

- **Name-vs-phone detection**: `query.replace(/\D/g,'')` with a **7-digit** threshold. Shorter digit runs are far likelier to be part of a name or a house number than a number to look up.
- **Leads carry extra disambiguation fields** (`leadType`, `status`, `converted` via the existing `isLeadConverted`), because "is this lead already converted?" is precisely the question the caller is stuck on.
- **`Promise.allSettled`, not `Promise.all`** — one failing scan degrades that source's results rather than failing the whole lookup.
- **Capped at 10 matches**, so a common name can't return an unbounded payload into the model's context.
- **Empty/blank query short-circuits before any DynamoDB call** (verified directly, not just by reading).

**`toolDefinitions.js`** — `find_person` registered (`readOnly: true`, category `contact`), taking a single required `query`. TOOL_COUNT 65 → 66.

**`plannerPrompt.js`** — new rule pointing the model at it for a single named person, with the concrete Hinglish triggers it will actually see.

**`userCategoryService.js`** — granted to all four categories that already have contact-lookup access.

## Deviation from the plan, stated plainly

The implementation plan says: *"Add `find_person(name|phone)` … **remove the ~8 prose disambiguation rules** for buyer/seller/tenant/owner from `plannerPrompt.js` now that the model can call a tool instead of guessing."*

**I added the tool but did not remove those rules**, because they solve a different problem than `find_person` does:

- The existing rules (lines ~35–37) disambiguate **category/list** requests — *"buyers dikhao"*, *"sare tenants"*, *"qualified leads"*. Plural, no named individual.
- `find_person` disambiguates **one named individual** — *"open Rajesh"*.

Deleting the list rules would trade a solved problem for an unsolved one: `find_person` has nothing useful to say about *"show me all buyers"*. Removing them belongs with the metrics/tool consolidation work (3e), where list-tool overlap is the actual subject. Flagged here rather than silently skipped.

## Bug found while implementing

Reading `plannerPrompt.js` to add the new rule surfaced **another Slice 5 leftover** the earlier audit missed:

> `- Delete: if user has not confirmed after you asked, do NOT call delete_* — reply asking them to confirm (haan/yes).`

The `delete_*` tools were removed in Phase 1 Slice 5, so this instructed the model about a tool family that no longer exists — and worse, told it to ask for confirmation and wait, which now maps to nothing. Replaced with a rule pointing at `archive_*` and noting that archiving is reversible so no confirmation gate is needed.

**Why the audit missed it:** the audit greps searched for quoted tool names (`'delete_lead'`) and subsystem identifiers (`gateDeleteToolPlan`, `pendingConfirmation`). This line contains neither — it says `delete_*`, unquoted, in prose. It is the *same* class of miss recorded as the lesson in [`../phase1-imp/07-bugs-found.md`](../phase1-imp/07-bugs-found.md) #11a ("grep for the concept in prose/prompts too, not just identifiers") — written after finding the first two instances, and this is a third. Prompt files need reading, not just grepping.

## How it was tested

- **`skillInvoker.test.js`** — two new tests (26 total in that file). The dispatch one matters more than it looks: `findPerson` is declared `(tenantId, filters = {})`, so `Function.length` reports **1, not 2**, which means it *misses* skillInvoker's `handler.length === 2` branch and lands in the final `else`. That still passes `(tenantId, input)` correctly — but by fallback, not by design. The test pins the actual call shape so a future reshuffle of that dispatch chain can't silently start passing it the wrong argument. (This is the same brittle `handler.length` heuristic flagged in Phase 1 finding #1–4.)
- **Registry integrity** — `validateToolDefinitions` passes; `find_person` present, handler resolves.
- **Empty-query guard** — verified by direct invocation that a blank/missing query returns `{found:false}` without any DynamoDB fan-out.
- **Full suite: 583/586 passing**, same 3 pre-existing unrelated failures, zero new.

Not unit-tested: `findPerson`'s internal matching across the five sources. It calls `getLeads`/`getBuyers`/etc. as **same-module** references, which `jest.unstable_mockModule` cannot intercept — the same ESM limitation documented in [`../phase1-imp/03-slice3-archive-property.md`](../phase1-imp/03-slice3-archive-property.md) and Slice 2b. Verifying it properly needs either seeded data or a live tenant, so it belongs in the same staging pass as the tool loop.
