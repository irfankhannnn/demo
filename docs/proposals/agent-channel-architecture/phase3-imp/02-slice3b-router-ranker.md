# Slice 3b — Router: Hard Gate → Ranker (Scope Escalation)

**Status: ✅ Done, tested. Ships behind the same `AGENT_TOOL_LOOP_ENABLED` flag as Slice 3a.**

## Why

[`../01-diagnosis.md`](../01-diagnosis.md)'s issue #2: *"Router hard-gates the tool list. A wrong domain guess is unrecoverable mid-turn."* `domainRouter.js` picks 1–2 domains before the planner runs, and `getToolsForDomain()` narrows the function declarations to just those domains. If the router guesses wrong, the planner **physically does not have** the right tool and can only give up — the user gets a shrug for a request the system was perfectly capable of handling.

This was unfixable before Slice 3a, because a single-shot planner has no "mid-turn" in which to recover. Now that a loop exists, recovery is possible: a step that produces no tool call is a signal that the scope was wrong, not that there's nothing to do.

## What changed

`runToolLoop.js` gains an `allowScopeEscalation` option. When the first step produces **no tool call** and the router had actually narrowed the list, the loop retries once against the **full** tool registry instead of failing closed:

```js
if (functionCalls.length === 0) {
  if (!escalated && canEscalate && steps.length === 0) {
    escalated = true;
    logger.info('agent.tool_loop.scope_escalation', { tenantId, domains, scopedToolCount: toolNames.length, modelText: text.slice(0, 120) });
    chat = buildChat(buildGeminiToolDefinitions(null)); // null = all tools
    pendingMessage = userPayload;                        // re-ask the original question
    continue;
  }
  finalText = text;
  stopReason = 'done';
  break;
}
```

Design points worth stating:

- **Escalation is bounded to once per turn** (`!escalated`) and only on the first step (`steps.length === 0`). If tools already ran, the scope was evidently fine and a later no-tool-call response genuinely means "done".
- **It only fires when the router actually narrowed something** (`Array.isArray(toolNames) && toolNames.length > 0`). An unscoped turn has nothing to escalate to.
- **Cost is one extra round-trip, and only on turns that were going to fail anyway.** A correctly-scoped turn never pays it.
- **The rebuilt chat re-asks the original question**, not a continuation — the model gets a clean attempt with the full toolset rather than a confusing history where it just said it couldn't help.
- **Every escalation is logged** (`agent.tool_loop.scope_escalation`, plus an `escalated` field on the turn's summary log). Per the proposal: *"Log every escalation — that log becomes the router's training/eval data."* A high escalation rate is a direct signal that `domainRouter.js`'s rules need work, measurable in production without any extra instrumentation.

`agentRuntime.js` passes `allowScopeEscalation: true` on the loop path. The single-shot path is untouched, so this is inert unless `AGENT_TOOL_LOOP_ENABLED=true`.

## What this is *not*

The proposal describes a fuller version — *"load the top-ranked domain's tools eagerly, but let the loop pull in additional tools from other domains if it discovers mid-loop that it needs them"* — i.e. genuinely incremental, domain-by-domain widening mid-loop. What shipped is the simpler and more predictable form: one all-or-nothing widening to the full registry, triggered by the one signal that reliably means "wrong scope" (no tool call on step one).

That was a deliberate trade. Incremental widening needs the model to somehow express *which* domain it wants, which the function-calling API gives no clean channel for — you'd be inferring it from prose, which is exactly the kind of fragile heuristic the rest of this proposal is trying to remove. The all-or-nothing version captures most of the value (a mis-scoped turn recovers instead of dying) at a fraction of the complexity, and the escalation logs will show whether anything more elaborate is actually warranted.

## How it was tested

Two tests added to `apps/crm/server/agents/llm/runToolLoop.test.js` (15 total in that file now):

- **`a mis-scoped turn escalates to the full registry and recovers`** — router scoped to `['search_leads']`, user asks about properties. Model's first response has no tool call; the loop escalates, and the second attempt calls `search_properties` and succeeds. Asserts the tool actually executed with the right args.
- **`escalation happens at most once, and not at all when disabled`** — with `allowScopeEscalation: false`, exactly one round-trip happens and the model's text is returned as-is (no retry).

**Full suite: 581/584 passing**, same 3 pre-existing unrelated failures, zero new.

## Rollout

Shares Slice 3a's flag and rollout path — see [`01-slice3a-bounded-tool-loop.md`](01-slice3a-bounded-tool-loop.md). One extra thing to watch once enabled: the `agent.tool_loop.scope_escalation` rate. A few percent is healthy (the router is doing its job, escalation catches the tail). A high rate means the router's rules are mis-firing often enough to be worth fixing directly rather than papering over with escalation round-trips.
