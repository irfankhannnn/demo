# Agent Architecture Proposal — WhatsApp, Web AI, and Semantic Retrieval

**Status:** Proposed — for review before implementation
**Branch:** `kalim-work-ai` · **Reviewed against:** `auth_rbac_feature` @ `f6b557e`

## Goals

1. **Complete flows from WhatsApp.** A user finishes a whole task in one exchange ("create a lead and schedule a visit tomorrow"), and the reply stays short.
2. **A ChatGPT/Claude-style web AI inside the CRM.** Full-length streamed responses, visible tool activity, rendered entity cards — performing the same real actions.
3. **Choose the right orchestration pattern per flow**, rather than one agent shape applied everywhere.
4. **Evaluate DynamoDB Vector Search** (released 4 Aug 2026) for semantic retrieval.

The central decision: **one agent core with two channel adapters**, not two agents. What differs between WhatsApp and web is how much of the answer is rendered and how fast — not what the agent can do. Building them separately would duplicate the tool registry and conversation logic, and drift apart exactly as the MCP tool registry already has.

---

## Contents

### Core

| File | Contents |
|---|---|
| [01-diagnosis.md](01-diagnosis.md) | What exists today across all three AI surfaces, and where each falls short |
| [02-target-architecture.md](02-target-architecture.md) | The channel-agnostic core: bounded tool loop, channel-aware compose, session model |
| [03-implementation-plan.md](03-implementation-plan.md) | Sequenced, independently-shippable phases with file-level tasks |
| [04-orchestration-patterns.md](04-orchestration-patterns.md) | **Which pattern for which flow, and why** — answers "one agent or many?" |
| [05-retrieval-and-vector-search.md](05-retrieval-and-vector-search.md) | DynamoDB Vector Search: validated fit, constraints, design, risks |

### Flows

One architecture document per flow — see [flows/README.md](flows/README.md).

| # | Flow | Mode | Status today |
|---|---|---|---|
| [01](flows/01-whatsapp-agent.md) | WhatsApp agent | A — bounded tool loop | Built, single-shot |
| [02](flows/02-web-crm-chat.md) | In-CRM web chat | A — bounded tool loop | Not built |
| [03](flows/03-call-intelligence.md) | Call Intelligence | B — extraction + rules | Built, **reference implementation** |
| [04](flows/04-background-automation.md) | Qualifier / router / follow-up | B — extraction + rules | Built, using the wrong mode |
| [05](flows/05-voice-exotel.md) | Exotel voice | C — classifier per turn | Built, regex (no LLM) |
| [06](flows/06-mcp-external.md) | MCP for external AI apps | D — tool surface only | Built, registry drifted |

---

## The four headline findings

1. **The WhatsApp agent takes one tool call per turn.** `planTurn.js` uses `functionCalls[0]` and discards the rest. Compound requests are impossible by construction — this is the real blocker for "complete flow from WhatsApp," not message length.

2. **Unattended flows are running with chat-agent autonomy.** The lead qualifier, router and follow-up cron all call `invokeAgent()` — inheriting open function-calling across 87 tools with nobody watching. Meanwhile Call Intelligence, one directory over, already does this correctly.

3. **The MCP tool registry has drifted.** 74 tools exposed externally vs 87 canonical, with a header comment claiming 54. Hand-maintained copies drift; this one already has.

4. **DynamoDB Vector Search is a real fit, with one blocker and one trap.** Both target tables already meet every prerequisite except the SDK, which is definitively too old. And a vector index without a `tenantId` partition key would search across **all tenants** — see below.

---

## Verification notes

Every code claim in these documents was checked against the branch. Highlights:

| Claim | Result |
|---|---|
| `CrmTable` / `PropertiesTable` on `PAY_PER_REQUEST` | ✅ Confirmed (`cfn-backend.yaml:655`, `:595`) — all tables are |
| Bedrock `InvokeModel` IAM already present | ✅ Confirmed (`:1426`, `:2342`), including a `Resource: '*'` grant |
| `@aws-sdk/client-bedrock-runtime` already a dependency | ✅ `^3.1073.0`, unused for embeddings |
| `searchLeads` / `searchProperties` load-all-then-substring | ✅ Confirmed (`:5823`, `:5934`); underlying `getLeads` is a **full `ScanCommand`** capped at `maxPages: 100` |
| No property-matching capability exists | ✅ Zero matches for `matchProperties` / `recommendedProperties` |
| `khata` has no agent tools | ✅ Zero matches in the registry |
| 8 `delete_*` tools exposed to the model | ✅ Confirmed |
| **DynamoDB SDK supports `SearchVectors`** | ❌ **No.** Locked at `3.936.0` (2025-11-19); first supporting release is `3.1103.0` (2026-08-04) |
| API Gateway **REST** response streaming | ⚠️ **Could not verify.** Treated as unconfirmed in [flows/02](flows/02-web-crm-chat.md), with a fallback |

### Two things a prior analysis missed, both load-bearing

- **Multi-tenancy.** A vector index with no `SearchSchema` partition key searches the *entire* index — every tenant. With `ProjectionType: ALL`, another agency's data comes back in the response. Fix: `tenantId` as the index `HASH`, which AWS then **requires** in every `SearchConditionExpression` — turning tenant isolation from a convention into an API-enforced constraint.
- **Inline filters only support `=`.** No `<`, `>`, `IN`. So *"under ₹2 crore"* cannot be an inline filter, which reshapes the property-matching design ([05 §5](05-retrieval-and-vector-search.md)).

---

## Non-goals

- **No code changes in this document set.** These docs are documentation and design only — actual implementation is tracked separately, see [Implementation status](#implementation-status) below.
- **No model provider selection.** Pluggability is a later, independent phase.
- **No restructuring of the Exotel voice pipeline** beyond replacing its classifier ([flows/05](flows/05-voice-exotel.md)).
- **No changes to billing, delete semantics or infra** beyond what the channel and retrieval work requires.

## Implementation status

Phase 1 implementation is essentially complete, sliced into smaller, independently-tested pieces (the original Phase 1 description bundled a pure code change, an infra change, and a schema change together — verification against the live code showed that's riskier to ship as one unit than as several). Tracked in [`phase1-imp/`](phase1-imp/):

| Slice | What | Status |
|---|---|---|
| 1 | WhatsApp hot-path cleanup (debug fetches removed, tenant lookup deduplicated) | ✅ Done |
| 2 | GSI + Query for tenant lookup | ✅ Code done, tested — deploy pending (user-owned) |
| 3 | `archive_property` (proof of concept) | ✅ Done |
| 4 | `archive_*` for the remaining 7 entities | ✅ Done |
| 5 | Remove `delete_*` tools + confirmation subsystem | ✅ Done |
| 6 | Labelled tool-choice eval set (parallel track) | 🟡 Harness built — real data export still blocked |

614 tests passing (at time of writing this phase: 535), zero regressions from any Phase 1 change (verified against the pre-work baseline via `git stash`). Along the way, verification surfaced and fixed 5 currently-live production bugs unrelated to any single slice's goal (`create_meeting` failed on every well-formed call; `update_contact_role` was completely broken; phone-lookup tools never matched a real number; `delete_property_document` silently never deleted anything; a meeting-status state machine gap) plus ~360 lines of confirmed-dead code — see [`phase1-imp/07-bugs-found.md`](phase1-imp/07-bugs-found.md).

**Phase 2 (agent core extraction) is also complete**, scoped to the three structural pieces the user asked for before launch — session re-keying, business-logic extraction from the WhatsApp processor, and a model-gateway seam. Credit/billing work (an existing refund leak, and the full reserve→meter→settle primitive) is explicitly deferred until after launch. Tracked in [`phase2-imp/`](phase2-imp/):

| Slice | What | Status |
|---|---|---|
| 2a | Principal-based session re-key (`wa:<phone>`, dual-read fallback) | ✅ Done |
| 2b | Extract business logic from the WhatsApp processor into the agent core | ✅ Done |
| 2c | Model-gateway seam (classify/plan/compose) | ✅ Done |

614 tests passing (at time of writing this phase: 565), zero regressions across the whole phase. The riskiest finding: `logMessage` (inbound) sits *between* access-control passing and the agent running in the original processor, and a denied message was never logged — a single combined extraction function would have silently changed one of those two behaviors, so Slice 2b split into two functions specifically to preserve that seam. See [`phase2-imp/`](phase2-imp/) for the full detail per slice.

**Phase 3 (the reliability fix) has started** — the bounded multi-step tool loop is built and tested, shipped **OFF by default** behind `AGENT_TOOL_LOOP_ENABLED` so production behavior is unchanged until it's deliberately enabled. This is headline finding #1 fixed: the agent can now complete a compound request ("create a lead **and** schedule a visit") in one turn instead of silently dropping everything after the first tool call. Tracked in [`phase3-imp/`](phase3-imp/):

| Slice | What | Status |
|---|---|---|
| 3a | Bounded multi-step tool loop (the `functionCalls[0]` fix) | ✅ Done — shipped off behind a flag |
| 3b–3f | Router→ranker, strict schemas, `find_person`, metrics consolidation, prompt caching | 📋 Not started |

614 tests passing. Implementing 3a surfaced another live production bug: **meeting creation from WhatsApp was completely broken** — every well-formed request was answered *"I need a bit more info to do that: scheduledDate"*, because `planTurn.js` validated required fields *after* the normalizer deleted the field being validated. Same root cause as the Phase 1 `skillInvoker.js` fix, but an independent copy one layer earlier, which means that earlier fix never actually made meetings work. Fixed in both, with a regression test.

See [`phase1-imp/README.md`](phase1-imp/README.md) for the full breakdown and reasoning.

**Launch readiness.** Three audit passes (frontend/responsive, call-recording pipeline, backend security) plus two follow-up passes are recorded in [`launch-readiness/01-audit-findings.md`](launch-readiness/01-audit-findings.md). **717 server tests passing**, plus 35 in `ai-calling-service`; `vite build` passes. Everything scoped for launch is code-complete — what is left is deployment and a run against the real model and real AWS, both of which are user-owned.

**Now also complete:** Phase 3e (analytics consolidation), 3f (prompt prefix), 4 (channel-aware compose), 5 (in-CRM web chat), 5b (background-flow hardening), 5c (Hinglish voice intents), and the generation half of Phase 6 (MCP drift closed, 46/66 → 71/71). Phase R0's SDK blocker is lifted — `SearchVectorsCommand` is available — so R1 onward is unblocked.

**Still open:** Phase 3c (blocked on Slice 6's real eval data), Phase R1–R6 (needs a non-prod spike against real AWS), and token-by-token streaming of the web chat reply (needs a streaming-capable entry point; see [`phase4-5-imp/`](phase4-5-imp/)).

## Relationship to existing docs

- `docs/current_design/` documents *current runtime behaviour*; update it when a phase ships, not from this proposal.
- `docs/CALL_INTELLIGENCE.md` documents Flow 03 as built — [flows/03](flows/03-call-intelligence.md) proposes additions on top of it.
