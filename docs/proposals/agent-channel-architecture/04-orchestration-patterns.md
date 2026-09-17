# Orchestration Patterns — Which Pattern, For Which Flow

The question this file answers: *should we design a pattern per tool, a pattern per flow, or one agent that handles every use case?*

**Answer: neither extreme.** One tool registry shared by everything; a small number of orchestration modes chosen per flow. The selection axis is not "how complex is the task" — it is **who is watching when the action happens**.

---

## The selection axis

```
                    Is a human reading the result, turn by turn,
                    at the moment the action is taken?

                    ├── YES ──────────────────────────────────┐
                    │                                          │
                    │   Agent may sequence its own tool calls. │
                    │   A wrong step is caught immediately by  │
                    │   the person reading the reply.          │
                    │                                          │
                    │   → BOUNDED TOOL LOOP                    │
                    │     WhatsApp chat, in-CRM web chat       │
                    │                                          │
                    ├── NO, it runs unattended ────────────────┤
                    │                                          │
                    │   LLM produces STRUCTURED FACTS only.    │
                    │   Deterministic code decides which tool  │
                    │   to call. Writes beyond a safe default  │
                    │   are queued for human approval.         │
                    │                                          │
                    │   → CONSTRAINED EXTRACTION + RULES       │
                    │     Call Intelligence, lead qualifier,   │
                    │     lead router, follow-up cron          │
                    │                                          │
                    ├── NO, it is latency-bound realtime ──────┤
                    │                                          │
                    │   One classification per conversational  │
                    │   turn. The "loop" is the live call.     │
                    │                                          │
                    │   → SINGLE-STEP CLASSIFIER PER TURN      │
                    │     Exotel voice                         │
                    │                                          │
                    └── NO, the caller is external ────────────┘
                        We expose tools; their model plans.
                        We own scoping and authorisation only.

                        → TOOL SURFACE, NO ORCHESTRATION
                          reality-flow-mcp
```

## Why this axis and not "task complexity"

Complexity is the intuitive axis and it is the wrong one. A lead-qualification decision is *cognitively* simple and a WhatsApp search is *cognitively* simple, but they carry completely different blast radii: the WhatsApp answer is read by a human one second later, while the qualifier writes a score to a record nobody looks at until a salesperson acts on it a week later.

The codebase already contains the correct instinct, written by whoever built Call Intelligence. `agency-app/api/services/callIntelligence/actionPlanner.js` opens with:

> *"This mapping is deterministic on purpose. The LLM reports what was said; the rules here decide what the CRM may be asked to do. That keeps tool arguments schema-valid and makes the behaviour unit-testable without an LLM."*

That is the best-practice statement for this whole system. The proposal below generalises it rather than inventing something new.

## The four modes

### Mode A — Bounded tool loop

**Use when:** a human is in the loop synchronously.

| Property | Value |
|---|---|
| Who picks the tool | The model |
| How many tool calls | 1..N, capped (recommend 6) + wall-clock budget |
| Writes | Immediate, unconfirmed (creates/updates) |
| Safety net | The human reads the reply immediately; every mutation writes an audit entry with a before-image |
| Flows | `flows/01-whatsapp-agent.md`, `flows/02-web-crm-chat.md` |

### Mode B — Constrained extraction + deterministic rules

**Use when:** the flow runs unattended (event-driven or scheduled).

| Property | Value |
|---|---|
| Who picks the tool | **Code**, from a structured LLM output |
| LLM's job | Produce validated JSON facts. It never names a tool. |
| Writes | One safe auto-applied default (a note, a score); everything else queued for approval |
| Safety net | Deterministic mapping is unit-testable without an LLM |
| Flows | `flows/03-call-intelligence.md`, `flows/04-background-automation.md` |

### Mode C — Single-step classifier per turn

**Use when:** realtime, latency-bound, and the conversation itself provides iteration.

| Property | Value |
|---|---|
| Who picks the tool | A classifier maps intent → one data fetch |
| How many tool calls | Exactly one per turn, or zero |
| Writes | Only via explicitly whitelisted intents (e.g. schedule site visit) |
| Flows | `flows/05-voice-exotel.md` |

### Mode D — Tool surface, no orchestration

**Use when:** the caller is an external AI application.

| Property | Value |
|---|---|
| Who picks the tool | The external client's model |
| Our responsibility | Complete tool coverage, correct schemas, per-tenant authorisation, rate limits |
| Explicitly not ours | Planning, looping, reply formatting |
| Flows | `flows/06-mcp-external.md` |

---

## What is shared across all four modes

These are **never** forked per pattern. Forking them is the failure mode this document exists to prevent — and it has already happened once, in the MCP tool registry (74 tools vs 87 canonical, see `01-diagnosis.md`).

| Shared component | Source of truth |
|---|---|
| Tool definitions and schemas | `agency-app/api/shared/toolDefinitions.js` |
| Tool execution + authorisation | `agency-app/api/skillInvoker.js` → `canUserAccessTool()` |
| Data access | `agency-app/api/crmDynamodbService.js` |
| Semantic retrieval | `05-retrieval-and-vector-search.md` (proposed) |
| Audit trail | `agency-app/api/agents/agentAuditService.js` |

A tool is written **once** and consumed by every mode. The mode decides *who chooses to call it* and *whether the result is applied or proposed* — never *what the tool is*.

---

## Decision table for new flows

When a new use case appears, answer in order:

1. **Is a human reading the output as it is produced?** → Mode A.
2. **Does it run on a timer or an event with nobody watching?** → Mode B. Do not give it Mode A autonomy because Mode A "already works."
3. **Is it realtime speech or otherwise latency-critical?** → Mode C.
4. **Is the caller outside our system?** → Mode D.

The specific anti-pattern to avoid: **granting an unattended cron job the same open, multi-step, autonomous write authority as the WhatsApp agent.** That is not an efficiency win — it is unsupervised mutation across nine entity types with no turn-by-turn human check.

## Where AI is correctly absent

Twenty of the twenty-six scripts in `agency-app/api/scripts/` use no LLM at all — credit reconciliation, trial reminders, grace-period expiry, escalation, expiring agreements, data backfills. That is correct and should stay that way. A deterministic business rule with a known answer does not become better by asking a model. Adding AI to these would add cost, latency and non-determinism to code whose whole value is being predictable.

**Mode E, implicitly: no AI.** It is the right answer more often than the other four combined.
