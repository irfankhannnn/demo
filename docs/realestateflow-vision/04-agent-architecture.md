# 04 — AI Agent Architecture

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. The agent runtime was built in-house (classify → plan → execute → compose, model gateway, Gemini adapter, optional tool loop) instead of Strands/AgentCore; this doc now describes that runtime as the direction and lists the June options as considered, not adopted.

> **Scope:** how RealEstateFlow's AI agents are structured, run, remember, are governed and evolve. Builds on `03` and `20`. Implementation detail: `docs/proposals/agent-channel-architecture/` and `docs/current_design/08-agent-runtime-flow.md`.

---

## 1. Guiding Principle: "Simplest thing that works, then earn the complexity"

Most of what the vision calls "engines" is best served by **single LLM calls or small tool-use loops we orchestrate ourselves** — cheaper, faster, easier to debug and evaluate than a multi-agent framework. That is how the runtime was built.

| Tier | What it is | Use for | Built today |
|---|---|---|---|
| **T0 — Deterministic + single LLM call** | Our code plus one model call with structured output | Intent/domain classification, lead qualification, drafting, summarising | Domain classifier (rules fast-path, then LLM), lead qualifier, Call Intelligence extraction |
| **T1 — Tool-use loop (we orchestrate)** | Plan one tool call, or a bounded multi-step loop we terminate | Agency-command questions, CRM updates, booking | Agent runtime: one tool call per turn by default; bounded loop behind `AGENT_TOOL_LOOP_ENABLED` |
| **T2 — Framework agents** | Planning, memory, multi-agent graphs | Only if a flow is truly open-ended | Not built; no current need |

## 2. Runtime: In-House Pipeline + Model Gateway

**As built** (`agency-app/api/agents/`):

- **Pipeline** (`agentRuntime.js`): **classify** the message into CRM domains or smalltalk (`domainRouter.js`, rules first, then `GEMINI_CLASSIFIER_MODEL`) → **plan** a single scoped tool call or a chat/clarify reply (`llm/planTurn.js`), or run a **bounded tool loop** (`llm/runToolLoop.js`, max steps and time budget) → **execute** through the in-process tool registry (`agency-app/api/skillInvoker.js` over `shared/toolDefinitions.js`) → **compose** a channel-shaped reply (`llm/composeReply.js`; WhatsApp vs web length and formatting).
- **Model gateway** (`modelGateway/index.js`): the `classify`/`plan`/`planAndRun`/`compose` seam. Gemini is the one adapter today (`@google/generative-ai`). A new provider is added here without changing the runtime. Bedrock invoke works in the dev account as of 17 Sep 2026 (Claude Haiku 4.5, Titan v2), so a Bedrock adapter is now possible.
- **Flags:** `AGENTS_ENABLED` (global, default `false` in CFN) and `AGENT_TOOL_LOOP_ENABLED` (default `false`).
- **Channels:** WhatsApp command channel (`WhatsAppProcessorFunction`, EventBridge `message.received`) and CRM web chat (`/api/crm/agent-chat`, `agents/channels/webChannel.js`).
- **Direction:** keep this runtime and widen the model gateway (more adapters, cheapest model per job). This matches the goal of pluggable models and lower cost.

**Considered, not adopted (June 2026 plan):**
- **Strands Agents SDK** as the default framework.
- **Bedrock AgentCore** Runtime/Memory/Identity/Gateway/Browser Tool/Evaluations. Revisit only if long-running voice or stateful agents need managed sessions.
- **LangGraph** for strictly ordered, audited sub-flows.

## 3. The Agent Roster

Agents are **bounded by business domain**. The classifier limits each turn to the domains it needs, so the planner only sees that domain's tools (small, stable prompt).

| Agent | Tier | Charter | Tools | Built today | Model today |
|---|---|---|---|---|---|
| **Domain router** | T0 | Classify message into CRM domains / smalltalk | — | Yes (`domainRouter.js`) | Rules, then `GEMINI_CLASSIFIER_MODEL` |
| **Agency-command agent** | T1 | Owner's WhatsApp/web copilot ("aaj ke hot leads") | Tool registry (72 tools, 9 categories) | Yes (agent runtime) | `GEMINI_MODEL` |
| **Lead qualifier** | T0 | Hot/Warm/Cold from intake data | Agent runtime | Yes (`scripts/lead-qualifier-handler.js`) | `GEMINI_MODEL` |
| **Lead router / assignment** | T0 | Pick a team member for a qualified lead | Agent runtime + agency config | Yes (`scripts/lead-router-handler.js`) | `GEMINI_MODEL` |
| **Follow-up** | T0 + scheduler | Daily text follow-ups (draft/autosend); AI follow-up calls with retries and escalation | CRM + voice service | Yes (lead-followup cron, `agency-app/followup-agent`) | `GEMINI_MODEL` / ElevenLabs |
| **Voice agent** | T1 | Outbound calls: qualify, confirm visits, collect feedback | ElevenLabs server tools → CRM | Yes, outbound (`agency-app/ai-calling`) | ElevenLabs Conversational AI |
| **Call Intelligence** | T0 | Transcribe recordings, suggest actions for approval | CRM | Yes | Amazon Transcribe + Gemini |
| **Instagram lead analyst** | T0 | Summarise DM thread, score, draft Hinglish reply | — | Yes, dev (`agency-app/instagram-api/services/leadAnalyst.js`) | Gemini, rules fallback |
| **Customer sales assistant** | T1 | Grounded customer conversation on WhatsApp/Instagram | Property, knowledge, meeting tools | No — Phase C (WhatsApp official API; Instagram DM assistant drafts first) | — |
| **Marketing agent (tenant)** | — | — | — | **Dropped** | — |
| **Automation (portal posting) agent** | — | — | — | **Dropped** (browser posting to portals) | — |

> Lead scoring and assignment are built as above. The founder is building a next-generation lead engine separately; these docs will be updated when it lands.

**Coordination:** EventBridge events (`lead.created` → `lead.qualified` → routing; `meeting.completed` → follow-up) do the routing between agents. We prefer event choreography over chat-based agent swarms.

## 4. Memory Architecture

Three tiers, tenant-isolated:

1. **Conversation memory (short-term):** WhatsApp/web conversation history and state stored as rows in the CRM table under the tenant key (`agency-app/api/whatsappConversationService.js`, `conversationStateService.js`), windowed into the prompt. Separate `Conversations`/`Messages` tables were not built.
2. **Entity memory (durable, structured):** the CRM record *is* the long-term memory. Budget, timeline, preferences and visits live on the Lead/Contact, read and written via tools.
3. **Semantic memory (knowledge):** DynamoDB vector search over properties and agency policies (`14`), retrieved, never assumed.

**Considered, not adopted:** AgentCore Memory.

## 5. Grounding & Anti-Hallucination

- **Tool-gated facts:** prices, availability and property details must come from a tool result; prompts forbid invented specifics.
- **"I don't know" → task:** if no tool answers, say so and create a human task.
- **Retrieval with sources:** policy answers come from `knowledge-vector-index` passages (`agency-app/api/services/knowledge/policySearchService.js`) with a distance threshold so weak matches are dropped. The voice agent phrases the answer itself. The June Bedrock Knowledge Base `RetrieveAndGenerate` path was replaced.
- **Evaluation today:** `agents/goldenConversations.test.js` checks the deterministic formatter in `npm test`; `agency-app/api/eval/whatsapp-tool-choice.eval.js` checks tool choice against live Gemini but runs outside `npm test` and CI. **Plan:** groundedness and task-success evals per agent, required before a workflow moves from approval to autonomous.

## 6. Human-in-the-Loop & Autonomy Graduation

Autonomy is a **per-tenant, per-workflow** setting:

```
Level 0  Suggest      Agent drafts; human edits & sends (default for new tenants)
Level 1  Approve      Agent composes; human one-tap approves; auto-sends
Level 2  Auto+notify  Agent acts autonomously; human notified; can undo
Level 3  Auto         Fully autonomous (earned per workflow via eval + track record)
```

**Today:** the follow-up cron has `draft`/`autosend` modes (`agency-app/api/routes/aiEmployeeConfig.js`, default `draft`); Call Intelligence actions wait for approval (`agency-app/api/routes/callRecordings.js`); Instagram replies are written by a person or fired by a keyword rule. The chat agent acts on the owner's own command and has no approval inbox. **Plan:** an agent action inbox for customer-facing replies (Instagram DM assistant drafts first, auto later). High-stakes actions (money-adjacent messages, public posts, promotional calls) stay at Level 0/1.

## 7. Agent Identity, Security & Cost Attribution

- **Identity today:** agents run inside the tenant's context; tenant id is always server-derived. Service-to-service calls use `x-api-key` and HS256 service JWTs (the MCP server's `mcp-agent` identity, `platform/mcp/src/services/tokenService.ts`). **Cognito M2M is not implemented.**
- **Scoping:** today an agent inherits ADMIN/MEMBER-level access with no lead scoping. When MANAGER and "members see only their own leads" land (before Team plans), tools must enforce the same scope for agents.
- **Credentials:** from Secrets Manager/SSM, never in prompts.
- **Audit + cost:** agent actions are written to `AgentAuditTable` (`agents/agentAuditService.js`, 90-day TTL today; plan is to archive instead of TTL delete). Credits are charged per agent action (`deductCredits` in `agentRuntime.js`) and refunded when a turn fails without doing anything (`agentRuntime.creditRefund.test.js`). Cost levers: cheaper classifier model, domain-scoped tool sets, stable prompt prefixes for implicit caching, bounded tool loops.

## 8. Evolution Path (phases, no dates)

```
Built:   in-house pipeline + model gateway (Gemini) · agency-command agent on
         WhatsApp + web · qualifier/router handlers · follow-up cron + call jobs ·
         outbound voice · Call Intelligence · Instagram lead analyst (dev)
Phase A: launch with AGENTS_ENABLED per environment; outbound voice only.
Phase B: member/manager scoping enforced for agent tool calls; evals in CI;
         audit rows archived instead of TTL delete.
Phase C: customer sales assistant on the official WhatsApp API and Instagram DMs
         (drafts first); inbound voice; brochure/floor-plan tools; more model
         adapters behind the gateway.
```

## 9. Why Not a Single Big Agent / Why Not Full Multi-Agent Now

- A **single agent seeing every tool** gets a large, unstable prompt and blurred failure modes. The domain classifier keeps each turn small.
- A **multi-agent swarm** multiplies cost and debugging effort for flows a single call handles. We add agents at business-domain seams only when the task needs it.
