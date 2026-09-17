# Slice 6 — Labelled Eval Set (Parallel Track)

**Status: 🟡 Harness built and working; real data export still blocked.** The fixture format, the Jest-based runner, and `npm run eval` are all in place and verified to behave correctly (skips cleanly without credentials, attempts real calls when they're present). What's still missing is exactly what was flagged as the blocker from the start: the 200-300 real Hinglish utterances, which need either AWS access this environment doesn't have, or an export handed over by someone who does.

## What was built

- **`agency-app/api/eval/fixtures/whatsapp-tool-choice.json`** — the fixture format, seeded with 5 hand-written examples (not the real export): a plain search, a greeting, a Hinglish property-area query, and two archive-tool regression cases (`"archive this lead"` and `"delete this lead"` — the second one specifically proving the planner falls back to `archive_lead` now that no `delete_*` tool exists, per Slice 5's added trigger phrases).
- **`agency-app/api/eval/whatsapp-tool-choice.eval.js`** — the runner. Imports the real `planTurn()` and runs it against the real Gemini API for each fixture, comparing `{kind, toolName, input}` against `expected`. Reports a pass-rate summary line and per-failure detail in `afterAll()`.
- **`npm run eval`** — wired into `agency-app/api/package.json`, pointed at `**/eval/*.eval.js` specifically so it stays out of the default `npm test` path (confirmed: the full suite's test count was unaffected by adding this file, since Jest's default `testMatch` doesn't pick up `.eval.js`).
- **Credential-gated, not credential-required**: `describe.skip` when `GEMINI_API_KEY` is unset (verified: all 6 tests skip cleanly, not fail, with the key unset) vs. a live `describe` block that actually calls `planTurn()` when it is set (verified: with a key present in this environment's `.env`, it correctly attempted real API calls — they failed on the network layer in this sandbox, which has no outbound internet access; that's an environment limitation of where this was built, not a flaw in the harness itself).

## Why

Right now there is no way to know whether *any* change to the WhatsApp agent's tool-choice behavior — this proposal's Phase 3 bounded tool loop, in particular — made things better or worse, because nothing measures tool-choice accuracy today. Verified directly: `agency-app/api/agents/goldenConversations.test.js` and `agency-app/api/agents/run-golden-check.mjs` test **reply formatting** (given a tool result, is the rendered WhatsApp text correct) — they never invoke the planner and assert nothing about which tool it chose. `agency-app/api/agents/llm/planTurn.test.js` gets closer (it mocks Gemini and asserts `plan.toolName`), but covers only 3 hand-written cases, not a real corpus.

This confirms [`../01-diagnosis.md`](../01-diagnosis.md)'s finding verbatim: *"No tool-choice eval, only reply-formatting tests. Nothing asserts 'this Hinglish message should call this tool with these args.'"*

Without this, Phase 3 (the bounded tool loop — the actual "complete flow from WhatsApp" fix) has no way to prove it didn't regress tool selection while adding multi-step capability. Building the eval harness now, in parallel with the lower-risk Phase 1 slices, means it's ready before Phase 3 needs it — not built under pressure once Phase 3 is already in flight.

## What will change

### 1. Source real utterances (the part that needs a decision)

Good news: the raw material already exists and is richer than a from-scratch label set would be. `agency-app/api/whatsappConversationService.js` logs every inbound message *and* every outbound reply, and — critically — **the outbound log item already stores `toolCalls: agentResult.result?.toolResults`**, the exact `{tool, input, result}` shape a tool-choice eval needs. Every real conversation the agent has already had is a labelled example of what it actually did (not necessarily what it *should* have done — see the labelling caveat below).

Storage shape (`agency-app/api/whatsappConversationService.js`):
```
PK = TENANT#<tenantId>#WHATSAPP#<contactPhone>
SK = MESSAGE#<timestamp>#<messageId>
```
Readable via `listConversations`/`getConversation` (used by the CRM UI's conversation view) or a direct table scan/query against `CRM_DYNAMODB_TABLE_NAME`.

**One real constraint: a 90-day TTL** (`WHATSAPP_CONTEXT_TTL_SECONDS`). Conversations older than that have already expired. Whatever the export mechanism is, it should run soon and should archive its output outside DynamoDB (a versioned fixture file, not a live query re-run each time) — otherwise the eval set silently shrinks over time as source data expires.

**Decision needed from the team, not assumable:** does this environment have AWS credentials/access configured to query the live `CRM_DYNAMODB_TABLE_NAME` for a bulk export, or does the export need to happen through someone with that access, with the result handed over as a file? This blocks starting the export step specifically — it does not block designing the fixture format or the harness itself (below), which can be built and tested against a handful of hand-written examples first, then swapped to the real export once it exists.

### 2. Design the fixture format

Proposed shape — one JSON file per fixture, or one array in a manifest, following the plan's own suggested size (200-300 examples):

```json
{
  "id": "eval-0001",
  "utterance": "kal dekhne aa sakta hoon kya Andheri wali property?",
  "context": { "tenantId": "t1", "lastDiscussedEntity": null },
  "expected": {
    "kind": "tool",
    "toolName": "search_properties",
    "input": { "area": "Andheri" }
  },
  "source": "whatsapp_conversation_export",
  "sourceMessageId": "...",
  "labelledBy": "human-review",
  "notes": "Real utterance; agent originally called get_leads_summary (wrong) — corrected during labelling."
}
```

The `notes`/`labelledBy` fields matter: per the plan's own risk list (`../03-implementation-plan.md` Risks), *"label from real inbound messages and what the user evidently wanted... including messages the agent got wrong today... have someone other than the runtime author do the labelling."* A raw export of `toolCalls` the agent already made is **not** automatically ground truth — it's what happened, which may itself be a bug this whole proposal exists to fix. Every fixture needs a human decision: was the logged tool call actually correct, and if not, what should it have been.

### 3. Build the harness

Extends the existing `planTurn.test.js` mocking pattern (`jest.unstable_mockModule('@google/generative-ai', ...)`) rather than inventing a new one — same Jest/ESM setup already proven in this codebase, just driven by the fixture list instead of 3 inline cases:

```js
import fixtures from '../../eval/fixtures/whatsapp-tool-choice.json' assert { type: 'json' };

describe('tool-choice eval set', () => {
  test.each(fixtures)('$id: $utterance', async (fixture) => {
    mockGenerateContent.mockResolvedValue(/* real Gemini call, or a recorded response for CI */);
    const plan = await planTurn(fixture.utterance, fixture.context);
    expect(plan.kind).toBe(fixture.expected.kind);
    if (fixture.expected.kind === 'tool') {
      expect(plan.toolName).toBe(fixture.expected.toolName);
      expect(plan.input).toMatchObject(fixture.expected.input);
    }
  });
});
```

Two modes were planned, per the plan's *"no live token spend per commit"* requirement:
- **CI mode**: mocked Gemini responses recorded once, so the suite runs with zero API cost/flakiness on every commit. **Not built.** This needs a real recorded Gemini response per fixture to be honest — fabricating a plausible-looking "recorded" response without ever having actually called the model would test nothing real. Deferred until live mode has run at least once against real credentials to produce genuine recordings.
- **Live mode** (manual/scheduled, not per-commit): actually calls Gemini. **Built** — `agency-app/api/eval/whatsapp-tool-choice.eval.js`, gated on `GEMINI_API_KEY` being present (`describe.skip` otherwise), run via `npm run eval`. Verified to skip cleanly without a key and to attempt real calls with one (see "What was built" above).

### 4. Baseline the current pipeline

**Not done yet** — this needs the harness to actually complete a live run, which needs working network access to the Gemini API. Whoever runs `npm run eval` next, with `GEMINI_API_KEY` set in an environment with real outbound access, gets the first real baseline number. That number is the actual point of Slice 6 for the rest of the roadmap — it's what Phase 3's bounded tool loop gets measured against later.

## How it was tested

The harness's own behavior was verified directly (not against real Gemini calls, since none succeeded in this sandbox):
1. **Skip path** — confirmed running `npm run eval` with `GEMINI_API_KEY` unset skips all 6 tests (not fail).
2. **Live-attempt path** — confirmed running with the key present in `.env` (this environment already had one) correctly triggers a real `generateContent()` call inside `planTurn()`; it failed at the network layer (no outbound internet in this sandbox), not inside the harness's own logic — the stack trace bottoms out in `@google/generative-ai`'s HTTP layer, not in anything this slice wrote.
3. **Isolation from `npm test`** — confirmed the full default suite's test-suite count (38) was unaffected by adding this file; Jest's default `testMatch` doesn't pick up `*.eval.js`.

The "intentionally-wrong fixture" and "reformat the 3 existing `planTurn.test.js` cases" checks from the original plan were **not** run, since both require an actual live pass to observe pass/fail behavior against real model output — deferred to whoever runs this with working network access.

## Explicitly out of scope for this slice

- **The 200-300 real Hinglish utterance export.** Still blocked on the same data-sourcing decision from the original plan — no AWS access in this environment to bulk-export `whatsappConversationService`'s conversation logs, and the 90-day TTL means this shouldn't sit much longer.
- **No changes to `planTurn.js` or `domainRouter.js` themselves** — this slice only measures the current behavior, it doesn't change it. That's Phase 3.
- **No CI-mode (mocked/recorded) harness yet** — needs at least one real live run's output to seed honestly, per above.
