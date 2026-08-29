# Slice 3f — Prompt caching

**Status: ✅ Done, but not the way the plan assumed.** Explicit caching does not apply at this prompt size; prefix ordering does, and was badly wrong.

## Explicit context caching does not apply — measured, not assumed

The plan says *"Enable prompt caching on the stable prefix (system prompt + tool schemas); verify a non-zero cache hit rate before relying on the cost saving."*

The verification says **don't enable it**. `GoogleAICacheManager` does exist in `@google/generative-ai/server`, so it would have been easy to wire up and it would have cached nothing: explicit context caching has a minimum-token floor far above this prompt.

Measured, not estimated:

| Scope | Size |
|---|---|
| `analytics` domain (4 tools) | ~742 tokens |
| `properties` domain (8 tools) | ~1,408 tokens |
| `leads` domain (8 tools) | ~3,770 tokens |
| **All nine domains together** | **~11,987 tokens** |

Even the worst case is an order of magnitude below the floor, and the planner is never handed all nine domains anyway — the router's whole purpose is to hand it one or two. There is no configuration in which explicit caching fires here.

## What does work: prefix ordering

Gemini's **implicit** caching keys on an exact shared prefix and needs no API call. That makes prompt *order* a cost property — and one that fails completely silently: put per-turn content early and nothing errors, the cache simply never hits.

The planner prompt had the routed-domain note on **line 4**, before the entire rules block:

```
You are SyncBot ... (tenant: X).

YOUR JOB THIS TURN: ...
{domainBlock}          ← changes every time routing changes
RULES:
... ~3 KB of static rules ...
{style}
{stateBlock}
```

Because the domain note sat before the rules, a different routing decision changed **every byte after it**. Two turns from the same tenant shared only ~200 characters of prefix.

Moving both variable blocks to the tail:

| | Shared prefix between two differently-routed turns |
|---|---|
| Before | ~200 chars |
| After | **3,094 of 3,192 chars (97%)** |

The rules block, the personality style and the header are now identical across every turn for a tenant.

`tenantId` remains in the first line. That means the prefix is per-tenant rather than global, which is correct — it is stable *within* a tenant, and a shared cross-tenant prefix is not something to want in a multi-tenant product anyway.

## Guarded, because the failure is silent

`plannerPrompt.caching.test.js` asserts:
- ≥2,500 shared prefix chars across different domains, different conversation states, and both changing together
- per-turn content appears in the last quarter of the prompt
- the prompt is **deterministic** — a `Date.now()` or `Math.random()` anywhere in it would defeat caching entirely and nothing else would notice
- the domain constraint is still present after being moved

A comment at the top of `buildPlannerSystemPrompt` says where new content must go and why.

## The other half: prompts naming hidden tools

Slice 3e deprecated eleven analytics tools. `prompts.js` still carried a trigger table naming ten of them — plus a fully worked example — and `plannerPrompt.js` named an eleventh. The model was being told to call tools it could no longer see.

This is the **third** occurrence of prompt prose drifting from the tool registry in this codebase:

1. Slice 5 removed the `delete_*` tools; live prompt text kept instructing delete-confirmation.
2. Two later audits missed those leftovers, because both searched for identifiers in *code* and prompts are *prose*.
3. Slice 3e, above.

`promptToolReferences.test.js` now runs that grep across every prompt file on every commit, checking three things: no deprecated tool is named, no non-existent tool is named, and no tool is named that the planner cannot be handed. It was verified to fail on a reintroduced reference before being committed.

The trap was never that the check was hard. It was that nobody ran one.

## Not done

Neither `composerPrompt.js` nor `domainRouter.js`'s router prompt was reordered. Both are already short and almost entirely static — the composer's only variable is the personality line, and the router prompt has none — so there is nothing to gain. Worth revisiting only if either grows a per-turn block.
