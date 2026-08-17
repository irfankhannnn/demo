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
| [01-diagnosis.md](./01-diagnosis.md) | What exists today across all three AI surfaces, and where each falls short |
| [02-target-architecture.md](./02-target-architecture.md) | The channel-agnostic core: bounded tool loop, channel-aware compose, session model |
| [03-implementation-plan.md](./03-implementation-plan.md) | Sequenced, independently-shippable phases with file-level tasks |
| [04-orchestration-patterns.md](./04-orchestration-patterns.md) | **Which pattern for which flow, and why** — answers "one agent or many?" |
| [05-retrieval-and-vector-search.md](./05-retrieval-and-vector-search.md) | DynamoDB Vector Search: validated fit, constraints, design, risks |

### Flows

One architecture document per flow — see [flows/README.md](./flows/README.md).

| # | Flow | Mode | Status today |
|---|---|---|---|
| [01](./flows/01-whatsapp-agent.md) | WhatsApp agent | A — bounded tool loop | Built, single-shot |
| [02](./flows/02-web-crm-chat.md) | In-CRM web chat | A — bounded tool loop | Not built |
| [03](./flows/03-call-intelligence.md) | Call Intelligence | B — extraction + rules | Built, **reference implementation** |
| [04](./flows/04-background-automation.md) | Qualifier / router / follow-up | B — extraction + rules | Built, using the wrong mode |
| [05](./flows/05-voice-exotel.md) | Exotel voice | C — classifier per turn | Built, regex (no LLM) |
| [06](./flows/06-mcp-external.md) | MCP for external AI apps | D — tool surface only | Built, registry drifted |

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
| API Gateway **REST** response streaming | ⚠️ **Could not verify.** Treated as unconfirmed in [flows/02](./flows/02-web-crm-chat.md), with a fallback |

### Two things a prior analysis missed, both load-bearing

- **Multi-tenancy.** A vector index with no `SearchSchema` partition key searches the *entire* index — every tenant. With `ProjectionType: ALL`, another agency's data comes back in the response. Fix: `tenantId` as the index `HASH`, which AWS then **requires** in every `SearchConditionExpression` — turning tenant isolation from a convention into an API-enforced constraint.
- **Inline filters only support `=`.** No `<`, `>`, `IN`. So *"under ₹2 crore"* cannot be an inline filter, which reshapes the property-matching design ([05 §5](./05-retrieval-and-vector-search.md)).

---

## Non-goals

- **No code changes in this PR.** Documentation and design only.
- **No model provider selection.** Pluggability is a later, independent phase.
- **No restructuring of the Exotel voice pipeline** beyond replacing its classifier ([flows/05](./flows/05-voice-exotel.md)).
- **No changes to billing, delete semantics or infra** beyond what the channel and retrieval work requires.

## Relationship to existing docs

- `docs/current_design/` documents *current runtime behaviour*; update it when a phase ships, not from this proposal.
- `docs/CALL_INTELLIGENCE.md` documents Flow 03 as built — [flows/03](./flows/03-call-intelligence.md) proposes additions on top of it.
