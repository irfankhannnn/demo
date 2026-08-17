# Flow 04 — Background Automation

**Mode B — constrained extraction + deterministic rules.**

Covers three unattended flows that currently share the wrong machinery:

| Script | Trigger | Job |
|---|---|---|
| `server/scripts/lead-qualifier-handler.js` | EventBridge `lead.created` | Hot/Warm/Cold temperature from intake data |
| `server/scripts/lead-router-handler.js` | EventBridge `lead.qualified` | Assign the lead to a team member |
| `server/scripts/lead-followup-cron.js` | Scheduled | Generate follow-up nudges |

---

## The problem

All three call `invokeAgent()` from `server/agents/agentRuntime.js` — **the same entry point the WhatsApp chat agent uses**. That means they inherit the full Mode A machinery: domain routing, open function-calling over the CRM tool registry, and the ability to write to the CRM with nobody reading the result.

This is backwards. Nobody is watching a cron job. Per `../04-orchestration-patterns.md`, the correct question is not "how complex is the task" but "who is watching when the action happens" — and the answer here is *nobody, for hours or days*.

The blast radius is the entire tool registry: 87 tools across 8 domains, including (today) 8 `delete_*` tools.

The irony is that the same codebase already does this correctly one directory over — see `../flows/03-call-intelligence.md`.

### What these flows actually need

| Flow | Real decision | Tools genuinely required |
|---|---|---|
| Qualifier | one label: `HOT` / `WARM` / `COLD` + reasons | **none** — read the lead, write a score |
| Router | one assignee from a known team list | **none** — read team members, write `assignedTo` |
| Follow-up | one message body | **none** — read context, hand text to the delivery path |

None of the three needs to *choose* a tool. All three need a model to produce one structured value.

`lead-qualifier-handler.js` already hints at this — it has an `extractScoreLabel()` helper that tries `JSON.parse`, then falls back to substring-sniffing the prose for `"hot lead"` / `"cold lead"`. That fallback exists because the output is not schema-constrained. Under Mode B it would not be needed.

---

## Target architecture

```
EventBridge  lead.created / lead.qualified        Cron  (follow-up)
        │                                            │
        └──────────────────┬─────────────────────────┘
                           ▼
              ┌────────────────────────────┐
              │ 1. GATHER (code)           │  explicit reads, no model
              │    getLead / team list /   │
              │    conversation context    │
              └─────────────┬──────────────┘
                            ▼
              ┌────────────────────────────┐
              │ 2. EXTRACT (LLM)           │  structured output ONLY
              │    NO tool declarations    │  schema-validated
              │    passed to the model     │  the model cannot name a tool
              └─────────────┬──────────────┘
                            ▼
              ┌────────────────────────────┐
              │ 3. DECIDE (code)           │  deterministic mapping
              │    rubric thresholds,      │  unit-testable without an LLM
              │    assignment rules        │
              └─────────────┬──────────────┘
                            ▼
              ┌────────────────────────────┐
              │ 4. APPLY (skillInvoker)    │  narrow allowlist per flow
              │    qualifier → update_lead │  (score fields only)
              │    router    → update_lead │  (assignedTo only)
              │    followup  → send + note │
              └─────────────┬──────────────┘
                            ▼
                     audit entry + EventBridge event
```

### Per-flow tool allowlist

The key control: each background flow gets an **explicit allowlist**, not the whole registry.

| Flow | Allowed | Everything else |
|---|---|---|
| Qualifier | `update_lead` — restricted to `score`, `scoreValue`, `scoreReasons`, `scoreSource` | denied |
| Router | `update_lead` — restricted to `assignedTo` | denied |
| Follow-up | message delivery + `add_lead_note` | denied |

Enforced at the invocation boundary, not by prompt instruction. `skillInvoker` already supports a `source` parameter (`{ userId, source }`) — that is the natural place to hang a per-source allowlist, alongside the existing `canUserAccessTool()` check.

### Score authority is already modelled correctly

`lead-qualifier-handler.js` documents that its `scoreSource: 'llm_text'` result is overwritten by a later AI **call** result (`scoreSource: 'ai_call'`, written by `routes/aiCallingInternal.js`), because a real conversation is more authoritative than intake text. That precedence rule is good and should be preserved verbatim — it is a genuine domain insight, not incidental code.

---

## Where semantic retrieval helps

| Flow | Use | Caution |
|---|---|---|
| Follow-up | *"what did we last discuss with this lead?"* — retrieve similar past call summaries for context | Read-only, so low risk |
| Router | assign by similarity to leads an agent has closed before | Fairness/consistency concern — do not ship without measuring |
| Qualifier | none | The rubric is explicit and deterministic; embeddings would add noise, not signal |

Retrieval here is **input to step 1 (gather)**, never a substitute for step 3 (decide).

---

## Migration

These flows are live and produce data the CRM depends on. Change them without changing their outputs first.

1. **Freeze current behaviour in tests.** Capture real inputs and current outputs as fixtures — before touching anything.
2. **Constrain the model call.** Remove tool declarations; require structured output. Outputs must match the frozen fixtures.
3. **Extract the decision into code.** Move rubric thresholds and assignment rules out of the prompt into testable functions.
4. **Apply the allowlist.** Verify by attempting a denied tool and asserting rejection.
5. **Delete `extractScoreLabel`'s prose-sniffing fallback** once output is schema-constrained.

Each step is independently revertable, and step 1 is what makes the rest safe.

---

## Failure modes

| Symptom | Cause | Mitigation |
|---|---|---|
| A cron writes to an unexpected entity | full registry available to an unattended flow | per-source allowlist |
| Score flip-flops between runs | non-deterministic prose parsing | structured output + idempotency (24h cooldown already exists in the qualifier) |
| Silent no-op | model returned unparseable text; fallback guessed `WARM` | schema validation → typed failure → DLQ, not a silent default |
| Lead qualified twice | duplicate EventBridge delivery | cooldown check ✅ already implemented |
| Follow-up sent to a converted/lost lead | stale gather step | re-read state inside step 1, immediately before apply |

---

## Acceptance criteria

1. No background flow can call a tool outside its declared allowlist — proven by a denial test.
2. The model in each flow receives **zero** tool declarations.
3. Rubric and assignment logic are unit-testable with no LLM in the loop.
4. Outputs match the pre-migration fixtures.
5. A malformed model response produces a typed failure and a DLQ entry — never a guessed default.
6. `scoreSource` precedence (`ai_call` > `llm_text`) is preserved.
