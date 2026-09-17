# Slice 3a — Bounded Multi-Step Tool Loop

**Status: ✅ Done, tested. Shipped OFF by default behind `AGENT_TOOL_LOOP_ENABLED`.**

## Why

This is the fix the whole proposal is built around. `../01-diagnosis.md`'s first headline finding: the WhatsApp agent takes **one tool call per turn**. `llm/planTurn.js` line 104 read `functionCalls[0]` and discarded everything after it, so a compound request — *"Rajesh ke liye lead banao aur kal site visit schedule karo"* — was impossible by construction. The second half of the request wasn't rejected or reported; it was silently dropped, and the user got a reply that looked like success.

The loop keeps calling the model, feeding each tool result back, until the model produces a final answer or a bound trips. The user-visible outcome is one short reply for a task that took several invisible steps — multi-step capability and short replies aren't in tension, because only the final compose step is user-facing.

## Design decisions (and why)

**A new file, not a rewrite of `planTurn.js`.** `llm/runToolLoop.js` sits alongside the untouched single-shot planner, and `agentRuntime.js` picks one per turn via `AGENT_TOOL_LOOP_ENABLED` (default **off**). Given this lands before a launch, "the code ships but production behavior does not change until someone deliberately flips a flag" was worth more than the tidiness of replacing the old path outright. Rollback is an env var, not a redeploy.

**One tool call returns the *old* plan shape.** If the loop ends up making exactly one call (the common case), it returns `{kind:'tool', toolName, input, result, ...}` — the same shape the single-shot planner returns — so `agentRuntime.js` renders it through the existing deterministic formatter, byte-identical to today. Only genuinely compound turns (2+ calls) take the new `kind:'tool_loop'` path. This keeps the blast radius of turning the flag on proportional to how often users actually make compound requests, instead of changing every reply at once.

**The model's closing text is the reply for multi-step turns.** The deterministic formatter renders *one* tool result and structurally cannot summarize "created the lead **and** booked the visit". The model's own final message is the only thing that has seen every step. It's still validated through `isValidWhatsAppReply`, and falls back to formatting the last step if the model returned nothing usable (e.g. the loop stopped on its step cap).

**Tool execution is injected, not imported.** `runToolLoop` takes an `executeTool` callback; `agentRuntime.js` passes a closure over `invokeSkill` that also writes the audit entry. The loop never imports `skillInvoker` directly — which keeps permissions/audit ownership with the caller and makes the loop unit-testable with no DynamoDB.

**Two hard bounds.** Step cap (`AGENT_TOOL_LOOP_MAX_STEPS`, default 6) and wall-clock budget (`AGENT_TOOL_LOOP_BUDGET_MS`, default 25000). Whichever trips first stops the loop, and whatever was gathered is still returned with a `stopReason` — a bounded-out turn degrades to a partial answer rather than an error.

**A rejected call is handed back to the model, not thrown.** If the model asks for a disallowed tool or omits a required field, the refusal goes back as a `functionResponse` with `{ok:false, error}` so it can self-correct within the remaining budget. This matters more now that `delete_*` tools are gone (Phase 1 Slice 5) — a model trained-by-prompt to reach for `delete_lead` gets told *why* it can't and can pick `archive_lead` on the next step.

## Bug found: meeting creation was completely broken, at a second layer

Writing the compound-request test surfaced a live production bug. The test's second step (`create_meeting` with all four required fields supplied) never executed. Root cause:

```js
// planTurn.js, before this slice
input = normalizeToolInput(toolName, input);   // deletes scheduledDate
const missing = missingRequired(toolName, input);  // ...then asks where scheduledDate went
```

`normalizeToolInput` maps `scheduledDate` → `meetingDate` + `meetingTime` and **deletes** it. Validating afterwards meant every correctly-formed meeting request was answered with *"I need a bit more info to do that: scheduledDate."* — verified directly:

```
RAW keys:    title, scheduledDate, relatedEntityType, relatedEntityId
NORMALIZED:  title, relatedEntityType, relatedEntityId, meetingDate, meetingTime
scheduledDate survived normalization? false
```

This is the **same root cause** as the `skillInvoker.js` bug fixed in Phase 1 ([`../phase1-imp/07-bugs-found.md`](../phase1-imp/07-bugs-found.md) #1) — but an independent copy of it, one layer earlier. That matters: the Phase 1 fix was necessary but **not sufficient**, because the planner short-circuits and returns a clarify before the executor is ever reached. Meeting creation from WhatsApp was still 100% broken after Phase 1.

Fixed in both files by validating required fields against the args **as the model provided them**, then normalizing. Locked in with a regression test in `planTurn.test.js` (`create_meeting with all required fields plans a tool call, not a clarify`) that also asserts normalization still happens, just in the right order.

## How it was tested

**`agency-app/api/agents/llm/runToolLoop.test.js` — 13 tests.** Mocks the Gemini SDK at the chat-session level (`startChat`/`sendMessage`) so a whole multi-step conversation can be scripted turn by turn, with an injected fake `executeTool`:

- no tool calls → `chat` plan; no calls and no text → `clarify`
- exactly one call → the single-shot-compatible `tool` shape, with `result` carried so the caller doesn't re-execute
- **the compound request** → both `create_lead` and `create_meeting` run, in order, and both are returned
- **multiple calls in one response** all execute (the direct `functionCalls[0]` regression guard)
- step cap enforced and reported, keeping results gathered so far
- wall-clock budget stops the loop mid-flight
- a disallowed tool (`delete_lead`) is refused, never executed, and the refusal is fed back as a `functionResponse`
- a call missing required params is refused, not executed
- a tool that throws becomes a failed step, not a thrown turn
- results are truncated before going back to the model, while the caller still gets the full untruncated result for rendering
- `onApiCall` fires once per model round-trip (credit/telemetry accounting)
- missing `executeTool` throws loudly

**Full suite: 579/582 passing** (up from 565/568), same 3 pre-existing unrelated failures, zero new. Because the flag defaults off, every pre-existing test exercises the unchanged single-shot path — which is exactly the verification that shipping this is a no-op until enabled.

## Not done in this slice (rest of Phase 3)

The implementation plan's Phase 3 also lists: converting `domainRouter.js` from a hard gate to a ranker with scope escalation, turning on strict tool schemas (and deleting `coerceQueryToFilters`/`LEAD_STATUS_TYPOS`), adding a `find_person` resolver tool, consolidating the 12 overlapping metrics tools down to 3–4, and enabling prompt caching. All deliberately left for follow-up slices — each is independently shippable, and several (schema strictness, tool consolidation) change behavior in ways that want their own test pass rather than riding along with the loop.

## Rollout

The flag is a **CloudFormation parameter** (`AgentToolLoopEnabled`, default `'false'`), wired into all 5 Lambdas that run the agent. An earlier version of this doc said enabling it needed "no redeploy" — **that was wrong twice over**: the env var wasn't in the CFN template at all (so it could never have been set in a deployed environment), and even now, changing a CFN parameter requires a stack update. Corrected below.

1. Deploy with `AgentToolLoopEnabled=false` (the default) — zero behavior change, the loop code is dormant.
2. Enable in staging via a stack update with `AgentToolLoopEnabled=true`. Exercise a compound request end to end (`"create a lead for X and schedule a site visit tomorrow"`), confirm both records are created and one coherent reply comes back.
3. Watch `agent.tool_loop.result` logs for `stopReason` distribution — a high `step_cap`/`time_budget` rate means the bounds need tuning before wider rollout. Also watch `agent.tool_loop.scope_escalation` (Slice 3b).
4. Enable in production the same way.
5. **Rollback** = a stack update setting it back to `'false'`. For an emergency, the env var can be edited directly on the Lambda in the console for an immediate effect, but that drifts from the template — follow up with a stack update so the next deploy doesn't silently re-enable it.

Note `AGENT_TOOL_LOOP_MAX_STEPS` / `AGENT_TOOL_LOOP_BUDGET_MS` are **not** CFN parameters — they fall back to their defaults (6 / 25000) in a deployed environment. Add them the same way if they need tuning without a code change.
