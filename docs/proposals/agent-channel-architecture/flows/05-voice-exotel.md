# Flow 05 — Exotel Voice Agent

**Mode C — single-step classifier per turn.** Realtime and latency-bound; the conversation itself provides iteration, so no tool loop is needed or wanted.

**Scope note:** this flow is **not** part of the channel-unification work in Flows 01/02. It is documented here because it is the one surface with no LLM-based understanding at all, and because its CRM bridge is now live again.

---

## Current architecture

```
Lead's phone
    │
    ▼
Exotel (telephony)  ◀──▶  ElevenLabs (STT / TTS / turn-taking)
    │                            │
    │ status webhooks            │ intent webhooks
    ▼                            ▼
ai-calling-service/src/routes/webhooks.js
    ▼
ai-calling-service/src/handlers/callOrchestration.js
    │
    ├─▶ intentService.classifyIntent()      ⚠ REGEX patterns — no LLM
    │      9 intents, ordered by priority
    │      + extractEntities(): BHK, budget (lakh/crore), location, date, time
    │
    ├─▶ intentService.routeAndFetchData()   deterministic switch/case
    │      CRM_API   → server/routes/aiCallingInternal.js
    │      VECTOR_DB → ragService (knowledge base)
    │      HYBRID    → both, CRM preferred
    │
    └─▶ elevenlabs.injectContext()          text injected into the live call
    ▼
DynamoDB: call session, transcript entries, intents detected, actions performed
```

**Intents** (`ai-calling-service/src/config/constants.js`): `PROPERTY_AVAILABILITY`, `PROPERTY_DETAILS`, `SCHEDULE_SITE_VISIT`, `FAQ_POLICY`, `AGENCY_INFO`, `PRICING_INFO`, `SMALL_TALK`, `HANDOFF_HUMAN`, `CALL_END`, `UNKNOWN`.

**Status correction:** the CRM bridge `server/routes/aiCallingInternal.js` was disabled pre-launch but has been **re-enabled** (commit `f65f6bf`) to serve Hot/Warm/Cold qualification calls. It is live, not dormant.

---

## Assessment

### What is right

- **Latency-appropriate.** Regex classification is effectively free. On a live call, a 300 ms model round trip per turn is a real UX cost — dead air. The instinct to avoid it is correct.
- **Deterministic routing per intent.** `INTENT_CONFIG` maps intent → data source cleanly.
- **Explicit escalation intents.** `HANDOFF_HUMAN` and `CALL_END` are first-class, not inferred.
- **Graceful degradation.** An unmatched utterance falls through to `SMALL_TALK` and ElevenLabs keeps the conversation alive rather than erroring.
- **Bounded write surface.** Only `SCHEDULE_SITE_VISIT` writes; everything else reads.

### What is wrong

**The classifier cannot handle the language its users actually speak.** The patterns are English-shaped:

```js
/(?:schedule|book|arrange).*(?:visit|viewing|appointment)/i
/(?:show|find|search|looking).*(?:properties|flats|apartments)/i
```

A caller saying *"kal dekhne aa sakta hoon kya?"* or *"do bedroom chahiye Andheri mein"* matches nothing and silently becomes `SMALL_TALK` — no data fetched, the agent answers with nothing useful. Given the project's own 70/30 Hinglish convention, this is the common case.

Entity extraction has the same problem. `extractEntities()` handles `lakh`/`crore` and `N BHK` well, but its location regex (`/(?:in|at|near|around)\s+([a-zA-Z\s]+?)/i`) requires an English preposition — *"Andheri mein"* yields nothing.

Note the internal contradiction: `server/agents/llm/planTurn.js` opens with *"one Gemini turn with function calling (**no regex NLU**)"*. The WhatsApp flow deliberately rejected regex NLU. The voice flow is entirely regex NLU. Same product, opposite conclusions, neither aware of the other.

---

## Target architecture

**Keep Mode C.** Do not add a tool loop — the latency budget forbids it and the live conversation already provides iteration. Replace only the classifier.

```
transcript turn
      │
      ▼
┌──────────────────────────────────┐
│ 1. Regex fast-path (unchanged)   │  free, sub-millisecond
│    high-confidence patterns only │  handles the clear English cases
└───────────┬──────────────────────┘
            │ miss / low confidence
            ▼
┌──────────────────────────────────┐
│ 2. LLM classifier fallback       │  small fast model, structured output
│    → { intent, entities }        │  strict enum, hard timeout (~400ms)
│    NO tool declarations          │  Mode C: classify, never orchestrate
└───────────┬──────────────────────┘
            │ timeout / failure
            ▼
┌──────────────────────────────────┐
│ 3. SMALL_TALK (unchanged)        │  existing graceful degradation
└───────────┬──────────────────────┘
            ▼
   routeAndFetchData()  ← unchanged
            ▼
   elevenlabs.injectContext()
```

This mirrors `server/agents/domainRouter.js` exactly — rules fast-path, LLM fallback, safe default — which is already proven in this codebase. **Reuse that shape rather than inventing a second one.**

Hard requirements for step 2: a strict timeout with fallback (never let classification stall a live call), a constrained enum output, and no tool access.

### Optional improvements

| Change | Value | Risk |
|---|---|---|
| Hinglish patterns in the regex layer (`dikhao`, `chahiye`, `kitna`, `mein`, `kal`) | Cheap; catches common cases without any model call | Low — do this first, it may be sufficient |
| Semantic search over the knowledge base | `ragService` currently answers FAQ/policy; embeddings would improve recall | Medium — but this is a **read-only** path, so it is a safe place to use vector search |
| Share the CRM tool registry with `server/skillInvoker.js` | Removes a second data path | Medium — `ai-calling-service` is a separate deployable; only worth it if the duplication grows |

### What must not change

- **No tool loop.** Realtime latency budget.
- **Write surface stays narrow.** Only explicitly whitelisted intents may write.
- **`HANDOFF_HUMAN` stays a first-class escape hatch.** When the agent is confused, transferring to a person is the correct answer, not more inference.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Agent ignores a clear Hinglish request | English-only regex | Hinglish patterns, then LLM fallback |
| Location never extracted from Hindi phrasing | preposition-dependent regex | Same |
| Dead air mid-call | classifier latency | Hard timeout → fall through to `SMALL_TALK` |
| Site visit booked for the wrong property | `lastMentionedPropertyId` context drift | Confirm the property aloud before writing ✅ partly exists |
| Call session orphaned | webhook lost | Session TTL + reconciliation against Exotel status |

---

## Acceptance criteria

1. A labelled set of real Hinglish call utterances classifies correctly at a materially higher rate than the current regex baseline — measured, not assumed.
2. Classification p99 stays inside the live-call latency budget, with the timeout path exercised in tests.
3. The write surface is unchanged: only whitelisted intents mutate the CRM.
4. `HANDOFF_HUMAN` and `CALL_END` continue to work regardless of classifier path taken.
5. No tool declarations are passed to any model in this flow.
