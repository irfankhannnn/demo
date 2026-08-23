# Credit refund on a failed agent turn

**Status: ✅ Fixed.** Policy chosen by the product owner: refund **only when no CRM write landed**.

## The bug

`invokeAgent` charges before it works:

1. Check balance ≥ `AGENT_ACTION_CREDITS` (default **15**)
2. **Deduct 15 credits** — atomic DynamoDB transaction with a ledger entry
3. *Then* run the pipeline: classify → plan → execute → compose
4. If step 3 throws, a catch returns *"Sorry, I could not process that right now."*

The credits from step 2 were never returned. **The customer paid 15 credits for an apology.**

This is not an exotic path. It fires on a Gemini timeout or 5xx, a DynamoDB throttle, a malformed model response, or a Lambda timeout mid-turn — the ordinary failure modes of a network-dependent pipeline.

## What made it a small fix

`refundCredits()` already existed in `creditService.js` and had since before the agent was written. Its default reason is literally `'handler_failure'`, its doc comment reads *"Use this when charge succeeded but the subsequent handler action failed — so the user is not left without credits"*, and `routes/leads.js:401` already used it exactly this way.

The agent path simply never called it. This was a missing wire, not missing machinery.

It also means refunds are **auditable**: `refundCredits` writes a `refund.<actionType>` ledger entry carrying `refundFor` and the original reason, rather than silently adjusting a balance.

## The policy, and why it is narrow

A turn can fail *after* a tool has already succeeded. The user says *"create a lead for Rahul"*, the lead **is created**, then compose throws. Refunding there would hand the customer both the lead and their money back.

Two options were put to the product owner:

| | Behaviour | Trade-off |
|---|---|---|
| A | Refund on any exception | Simplest; occasionally pays for work that was done |
| **B — chosen** | Refund only when no tool returned `ok` | Fairer both ways; the information was already available |

**B was chosen.** The complaint being fixed is *"you charged me and did nothing"* — not *"you charged me and it half-worked"*.

## How it works

`runConversationalPipeline` publishes its live `toolResults` array onto `context.turnToolResults`. Because it is the same array the pipeline appends to (not a copy), it reflects exactly what ran before the throw.

`refundOnFailedTurn` then:

- **Skips** when `LOCAL_DEV_BYPASS` is set — nothing was deducted in the first place
- **Skips** when any entry has `result.ok === true`, logging `agent.invoke.refund_skipped` with reason `crm_write_landed`
- **Refunds** otherwise, logging `agent.invoke.refunded`
- **Swallows its own failure**, logging `agent.invoke.refund_failed`

That last point matters: the customer has already hit one failure. A second one from the refund path must never replace the graceful message with an error.

If the turn died *before* the pipeline set the array (config load, history fetch), the property is absent — and absent means nothing ran, so it refunds. That is the correct default.

## Observability

Three log events, all carrying `tenantId` and `agentId`:

| Event | Meaning |
|---|---|
| `agent.invoke.refunded` | Credits returned |
| `agent.invoke.refund_skipped` | Not refunded because a CRM write landed |
| `agent.invoke.refund_failed` | The refund itself failed — **needs attention**, the customer is still short |

A rising `agent.invoke.refunded` rate is a signal about pipeline health, not about billing. It counts turns that charged and delivered nothing.

## Tests

`agents/agentRuntime.creditRefund.test.js`, 7 cases:

- refunds when classify throws, and when the planner throws
- refunds when a tool ran and **failed** — no write landed
- does **not** refund when a write landed then compose threw
- never refunds a successful turn
- a failing refund does not replace the user-facing message
- does not refund a turn that was never charged (insufficient credits)

It is a **separate file** from `agentRuntime.pipeline.test.js` because that one sets `AI_EMPLOYEE_BYPASS_PROVISIONING`, which makes `LOCAL_DEV_BYPASS` true and skips the credit path entirely. `LOCAL_DEV_BYPASS` is read once at module load, so the two cannot share a file.

## Two things this work surfaced

**The composer only runs for some tools.** `useComposer` requires `meta.replyOwner === 'llm'`. A first draft of the "tool failed" test used `search_leads`, which is formatter-rendered, so the mocked composer failure was unreachable and the test failed for the wrong reason. Worth knowing when writing any test that expects a composer error.

**The Phase 3e tools inherit their meta correctly.** Checked while debugging the above: `get_crm_summary`, `get_work_queue` and `get_business_trends` all derive `replyOwner: 'llm'` / `presentationTemplate: 'summary_llm'`, so they narrate through the composer as the tools they replaced did.

## Not covered

The **non-conversational** agents (qualifier, router, followup) also run through `invokeAgent` and are also charged. They now get the same refund, since `refundOnFailedTurn` sits in the shared catch. They have no `turnToolResults` — single-shot agents call no tools — so a failure always refunds, which is right for them.
