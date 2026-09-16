# 04 — AI Agent Architecture

> **Scope:** how RealEstateFlow's AI agents are structured, run, remember, are governed, and evolve. Builds on the runtime decisions in `03` and `20`. Research basis: Bedrock AgentCore (GA Oct 2025), Strands Agents SDK (Python 1.0 May 2026, TS 1.0 Apr 2026), verified June 2026 — see `20-technology-decisions.md` for citations and caveats.

---

## 1. Guiding Principle: "Simplest thing that works, then earn the complexity"

The strongest finding from research is also the most important architectural discipline: **do not build agents reflexively.** A large share of what the vision calls "engines" is best served by **single LLM calls or simple tool-use loops you orchestrate yourself** — cheaper, faster, easier to debug and evaluate than a multi-agent framework. We adopt an agent *framework* only when a task is genuinely multi-step, open-ended, and hard to fully specify in advance.

This yields a **three-tier maturity model** that doubles as the migration path:

| Tier | What it is | Use for | Infra |
|---|---|---|---|
| **T0 — Deterministic + single LLM call** | Your code; one Claude/Haiku call with structured output; maybe one tool round-trip | Intent routing, lead scoring, field extraction, qualification-question selection, message drafting, summarization | Lambda |
| **T1 — Tool-use loop (you orchestrate)** | A bounded loop: LLM ↔ a small set of MCP tools, you control termination | Sales assistant answering grounded questions, booking a visit, simple multi-turn flows | Lambda/Fargate |
| **T2 — Framework agents (Strands)** | Strands agents with planning, memory, multi-agent (Graph/Swarm/A2A) | Complex flows: end-to-end deal handling, multi-channel follow-up orchestration, agency-command, browser automation planning | Fargate → AgentCore Runtime |

Most of Phase 1 lives at **T0/T1**. Strands (T2) appears in Phase 2–3 where it pays for itself.

## 2. Framework Choice: Strands + AgentCore, LangGraph where ordering is sacred

(Full justification in `20`.) Summary:

- **Strands Agents SDK** is the default agent framework: AWS-native (first-class Bedrock, IAM, Secrets Manager, VPC), model-agnostic, MCP + A2A standard, multi-agent primitives (Graph/Swarm/Workflow), deploys to Lambda/Fargate/AgentCore, OpenTelemetry built in. Lowest-friction path on our existing AWS stack.
- **Bedrock AgentCore** provides the *managed runtime and surrounding services* when load justifies it: **Runtime** (serverless, 8-hour sessions, session isolation, idle-CPU not billed — ideal for chat agents that wait on user replies), **Memory**, **Identity** (OAuth token vault for external tools), **Gateway** (turns our existing REST/Lambda into MCP tools — see `05`), **Browser Tool** (isolated microVM browsers for portal automation — see `07`), **Observability/Evaluations**. Available in **ap-south-1 (Mumbai)**.
- **LangGraph** is reached for *only* inside specific sub-workflows that demand strict step ordering, human-approval gates, or time-travel auditability (e.g. a regulated, fully-audited qualification or a finance-touching approval). It composes with Strands; it is not the backbone.

We avoid OpenAI Agents SDK / bespoke orchestration as the primary path to stay AWS-native and standard (MCP/A2A) — models and runtime remain swappable.

## 3. The Agent Roster (domain-bounded, not one mega-agent)

Agents are **bounded by business domain**, mirroring the MCP server boundaries (`05`). Each has a narrow charter, a defined tool set, and its own evaluation suite. This keeps prompts small (cacheable), failures isolated, and costs attributable.

| Agent | Tier | Charter | Primary tools (MCP) | Model |
|---|---|---|---|---|
| **Conversation Router** | T0 | Classify inbound message intent, resolve/merge contact, pick the right agent | CRM MCP | Haiku |
| **Sales Assistant** | T1→T2 | Grounded customer conversation: project details, pricing, brochures, floor plans, payment plans; book visits/calls | Property, Knowledge, Visit, Document MCP | Sonnet (cached catalog) |
| **Lead Qualifier** | T0→T1 | Progressive profiling: extract budget, timeline, location, configuration, purpose; ask the next best question | Lead, CRM MCP | Haiku |
| **Lead Scorer** | T0 | Deterministic features + LLM signals → Hot/Warm/Cold + reasons | Lead MCP | Haiku |
| **Assignment** | T0/rules | Apply tenant rules (round-robin/region/project/team/quality) | CRM, Task MCP | rules + Haiku tiebreak |
| **Follow-Up / Nurture** | T2 | Drive multi-step journeys; compose grounded touchpoints; pick channel/timing | Marketing, Visit, Voice, Knowledge MCP | Sonnet/Haiku |
| **Voice Agent** | T1→T2 | Inbound/outbound calls (evolves `ai-calling-service`); qualify, follow up, schedule | Property, Lead, Visit, Knowledge MCP | Sonnet / Nova Sonic (Hindi) |
| **Marketing Agent** | T2 | Generate content/campaigns/reels; schedule; close loop to acquisition | Marketing MCP (Higgsfield/Meta/Blotato) | Sonnet |
| **Automation Agent** | T2 | Plan & execute portal/browser tasks with human-in-loop | Automation MCP + Browser runtime | Sonnet |
| **Agency-Command Agent** | T1 | The owner's WhatsApp/dashboard copilot ("aaj ke hot leads"); RBAC-scoped | Analytics, CRM, Task MCP | Sonnet |

**Coordination:** the Conversation Router (T0) and the EventBridge/SQS backbone (`03 §3`) do most "routing." True multi-agent coordination (Strands **Graph/Swarm** or **A2A**) is used only where one agent must delegate to another mid-task — e.g. Sales Assistant → Qualifier → Scorer in a single conversation, or Follow-Up → Voice. We prefer **event choreography over chat-based agent swarms** for cost and debuggability; agents talk to each other through domain events and explicit A2A calls, not an open free-for-all.

## 4. Memory Architecture

Three tiers, tenant-isolated:

1. **Conversation memory (short-term):** the thread itself — `Conversations`/`Messages` tables (`03 §7`), passed into the agent context window (windowed/summarized to control tokens). Cheap, authoritative.
2. **Entity memory (durable, structured):** the CRM record *is* the long-term memory. Budget, timeline, preferences, past visits live on the Lead/Contact — not in a vector blob. Agents read/write this via MCP tools. This is deliberate: structured memory is queryable, auditable, and billable; freeform agent "memory" is not.
3. **Semantic memory (knowledge):** tenant knowledge base via RAG (`14`) for project/sales/agency knowledge — retrieved, never assumed.

When we adopt **AgentCore Memory** (Phase 3), it manages short/long-term conversation memory with self-managed extraction strategies, but the **system of record remains the CRM** — AgentCore Memory is a performance/UX layer, not a second source of truth.

## 5. Grounding & Anti-Hallucination (product principle made architectural)

Every customer-facing answer must be grounded. Mechanisms:

- **Tool-gated facts:** the agent cannot state a price/availability/floor plan unless it came from a tool result (Property/Inventory or Knowledge MCP). System prompts forbid invented specifics; tools return structured data the agent quotes.
- **"I don't know" → task:** if no tool can answer, the agent says so and creates a human task (Task MCP) rather than guessing.
- **Citations in RAG:** Knowledge MCP returns sources; the Bedrock KB pattern already does this in the calling service (`anthropic.claude-3-sonnet` RetrieveAndGenerate with citations).
- **Evaluation harness:** each agent has a golden-set eval (groundedness, task success, safety) run in CI; AgentCore Evaluations (GA Mar 2026) or self-hosted scoring. No agent goes from approval-queue to autonomous without passing.

## 6. Human-in-the-Loop & Autonomy Graduation

Autonomy is a **per-tenant, per-workflow** setting, not global:

```
Level 0  Suggest      Agent drafts; human edits & sends (default for new tenants)
Level 1  Approve       Agent composes; human one-tap approves; auto-sends
Level 2  Auto+notify   Agent acts autonomously; human notified; can undo
Level 3  Auto          Fully autonomous (earned per workflow via eval + track record)
```

Implemented via an **agent action inbox** (dashboard + WhatsApp): an agent emits `ApprovalRequested`; the action parks until resolved or times out to a safe default. High-stakes actions (sending money-adjacent messages, posting public listings, outbound promotional calls) are pinned to Level 0/1 regardless of tenant setting, for compliance (`15`, `07`, `12`).

## 7. Agent Identity, Security & Cost Attribution

- **Machine identity:** each agent runs under a **Cognito M2M** client (cheap post-Nov-2025: only $0.00225/1k token requests) scoped to a tenant and a permission set. Tools enforce the agent's scope exactly like a user's — an agent can never exceed the RBAC of the context it serves (`15`).
- **Per-tenant credentials** for external tools (WhatsApp tokens, portal logins, voice keys) come from Secrets Manager via AgentCore Identity / our secret-resolver, never embedded.
- **Audit + cost:** every agent invocation writes an immutable audit record (tenant, agent, tools called, tokens, model, $-cost, outcome). This feeds both compliance and the usage meter (`17`). Cost controls: Haiku-first, prompt caching of stable prefixes (catalog/system prompt, 1-hr TTL → cached reads ~0.1× input), per-tenant rate/budget caps, and circuit breakers on runaway loops.

## 8. Evolution Path (maps to roadmap `21`)

```
Phase 1: T0/T1 only. Sales Assistant + Qualifier + Scorer + Router as Lambda
         tool-use loops over MCP tools. No framework yet. Approval-queue autonomy.
Phase 2: Introduce Strands for Follow-Up/Nurture and Agency-Command (Graph/A2A).
         Wrap domain APIs as MCP via AgentCore Gateway. Add Evaluations in CI.
Phase 3: Move stateful conversational/voice agents to AgentCore Runtime
         (session isolation, 8-hr, Memory, Identity). Add Marketing & Automation
         agents. Graduate trusted workflows to higher autonomy levels.
Phase 4: Multi-agent orchestration at scale; LangGraph for any audited sub-flows;
         continuous eval-driven optimization.
```

## 9. Why Not a Single Big Agent / Why Not Full Multi-Agent Now

- A **single mega-agent** with all tools has a giant uncacheable prompt, blurred failure modes, and no per-domain evaluation or cost attribution — it gets slower and dumber as tools grow.
- A **full multi-agent swarm from day one** multiplies token cost and debugging difficulty for flows that a single Haiku call handles. We add agents at the seams of real business domains and only when the task complexity demands reasoning, keeping each agent small, cacheable, evaluable, and cheap.
