# Slice 2c — Model-Gateway Seam

**Status: ✅ Done, tested.**

## Why

Three files independently constructed their own `GoogleGenerativeAI` client and called Gemini directly: `domainRouter.js` (classify), `llm/planTurn.js` (plan, function-calling), `llm/composeReply.js` (compose, plain text). A fourth call site (`agentRuntime.js`'s `runSingleShotAgent`, for non-conversational agents) is out of scope for this slice. Research before writing code confirmed there was no existing shared wrapper — the gateway is a genuinely new abstraction, not a refactor of one — and turned up two real quirks a naive "unify the three" pass would have silently erased: `domainRouter.js` alone checks a `GEMINI_CLASSIFIER_MODEL` env fallback the other two don't, and `planTurn` throws on a missing key/model where the other two return `null`. Neither is touched here.

## What changed

New module `agency-app/api/agents/modelGateway/index.js` exporting `classify(message, opts)`, `plan(message, opts)`, `compose(params)` — each one a single-line delegation to the existing, unchanged `routeDomains`/`planTurn`/`composeReply`. `agentRuntime.js` now imports from the gateway instead of the three files directly; the only change to its three call sites is the function name (`routeDomains` → `classify`, `planTurn` → `planWithGateway`, `composeReply` → `composeWithGateway`, renamed on import to avoid colliding with the local `plan` variable already used in `runConversationalPipeline`) — arguments, the `onApiCall` callback convention, and everything else at each call site is untouched.

This is intentionally the smallest possible seam: the gateway's "one adapter" *is* the three existing functions, exactly as the proposal specifies for this phase. A future non-Gemini model provider would be added inside the gateway later, without `agentRuntime.js` changing again.

## How it was tested

1. **New file `agency-app/api/agents/modelGateway/index.test.js`** (4 tests) — proves the gateway is genuinely pure delegation: each function forwards its arguments unchanged to the underlying `routeDomains`/`planTurn`/`composeReply` and returns whatever they return unchanged, including the `null` case `composeReply` returns on invalid output.
2. **Zero changes needed** to `agents/llm/planTurn.test.js`, `agents/agentRuntime.test.js`, or `agents/goldenConversations.test.js` — all three passed unchanged after the swap, which is the real verification signal that the seam didn't alter behavior (these tests exercise the domain-routing rules fast-path and reply-formatting contracts that would break if the gateway forwarded arguments incorrectly).
3. **Full suite**: 565/568 passing (up from 561/564 before this slice), same 3 pre-existing unrelated failures, zero new ones.

## Explicitly out of scope for this slice

- **The three underlying files were not touched internally** — no shared Gemini client, no normalized env-var resolution, no fixed throw-vs-null inconsistency. All flagged, none silently "fixed" as a side effect.
- **`runSingleShotAgent`'s direct Gemini call** (non-conversational agents) — not wrapped by the gateway in this slice.
- **A non-Gemini adapter** — not built; the gateway has exactly one adapter today, as planned.

## Phase 2 status

All three slices (2a session re-key, 2b processor extraction, 2c model gateway) are done and tested. 565/568 tests passing, zero regressions across the whole phase (verified incrementally after each slice, not just at the end). Credit/billing work (the refund leak and the full reserve→meter→settle primitive) remains explicitly deferred until after launch, per the scope decision in `../phase2-imp/README.md`.
