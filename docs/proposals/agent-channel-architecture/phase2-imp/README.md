# Phase 2 Implementation — Agent Core Extraction (Scoped Subset)

Tracks the actual implementation of Phase 2 from [`../03-implementation-plan.md`](../03-implementation-plan.md), following the same slice-by-slice discipline as [`../phase1-imp/`](../phase1-imp/): verify against real code before writing, test every change against the full suite, document deviations honestly.

## Scope decision (confirmed with the user before starting)

Phase 2 as originally scoped had five parts. Billing/credit work (the existing credit-refund leak, and the full reserve→meter-per-step→settle/release primitive) is **explicitly deferred until after launch** — neither is touched in this phase. What's in scope now, in priority order given the stated goal of "make sure nothing breaks":

1. **Session re-keying** — `conversationStateService.js` moves from a raw phone key to a `principal` (`wa:<phone>`), so a future channel can share the same store.
2. **Business-logic extraction** — `whatsapp-message-processor.js` becomes a thin channel adapter; business logic moves into the agent core.
3. **Model-gateway seam** — `classify()`/`plan()`/`compose()` as the interface the agent core calls into, wrapping the existing Gemini call sites unchanged.

Three parallel research passes (mapping `conversationStateService.js` and every caller, the WhatsApp processor's business logic and the credit system, and every Gemini call site) grounded the plan in what the code actually does before any of it was written — see the git history / conversation log for the full research reports if needed; this doc set summarizes only what shipped.

## Status

| Slice | What | Status | Doc |
|---|---|---|---|
| 2a | Principal-based session re-key (dual-read fallback) | ✅ **Done** | [`01-slice2a-session-principal-rekey.md`](./01-slice2a-session-principal-rekey.md) |
| 2b | Extract business logic from the WhatsApp processor into the agent core | ✅ **Done** | [`02-slice2b-processor-extraction.md`](./02-slice2b-processor-extraction.md) |
| 2c | Model-gateway seam (classify/plan/compose) | ✅ **Done** | [`03-slice2c-model-gateway.md`](./03-slice2c-model-gateway.md) |

**Phase 2 is complete.** 565/568 tests passing, zero regressions across the whole phase (checked incrementally after each slice via the full suite, not just once at the end). The 3 remaining failures are pre-existing and unrelated (documented in `../phase1-imp/07-bugs-found.md`). Credit/billing work (the refund leak and the full reserve→meter→settle primitive) remains explicitly deferred until after launch.
