# 18 — Migration Strategy

> **Scope:** how to get from today's CRM (`01`) to the target OS (`03`) **without a rewrite**, using the strangler-fig pattern. Sequencing detail in `21`/`24`.

---

## 1. Core Principle: Strangle, don't rewrite
The existing serverless CRM is an asset, not a liability. We **wrap it in clean domain APIs/MCP tools and grow new capabilities around it**, retiring old pieces only as new ones prove out. Nothing in the vision requires replacing the CRM core; it requires *building on* it.

## 2. The Strangler-Fig Layers (order of construction)

```
Step 1  Stabilize & expose the core
        - Fix RBAC (2-tier → role/region model, 15)
        - Rotate hardcoded secrets (15)
        - Add tenant-index GSI (MED-1), conversation tables
        - Wrap domain endpoints as MCP tools via AgentCore Gateway (05)
        - Re-enable disabled internal routes (aiCallingInternal, projects…) behind flags

Step 2  Add the conversation backbone
        - EventBridge + SQS + Redis; Conversation Orchestrator
        - Chatwoot channel layer (WhatsApp via AiSensy/Embedded Signup) (08)

Step 3  Add reasoning (T0/T1 agents) over MCP
        - Router, Qualifier, Scorer, Sales Assistant — Lambda tool-use loops (04)
        - Approval-queue autonomy by default (04 §6)

Step 4  Turn on engines incrementally (acquisition→qual→score→assign→follow-up)
Step 5  Re-enable & evolve voice (12); add Step Functions follow-up journeys
Step 6  Add Strands + AgentCore where complexity demands (Phase 3)
Step 7  Add reporting projection (Aurora), marketing & automation engines
```

## 3. What We Keep / Wrap / Retire / Add

| Disposition | Items |
|---|---|
| **Keep & extend** | CRM SPA, CRM backend domain logic, auth microservice, DynamoDB model, Razorpay billing, telephony plumbing, Bedrock KB pattern, idempotency/provisioning patterns, Playwright tests |
| **Wrap (expose via MCP)** | All CRM/property/visit/lead endpoints; calling-service endpoints |
| **Evolve** | `ai-calling-service` (regex→agents, behind MCP); SyncBot skills→MCP tools; "AI Employee" human→agent; marketing skills→Marketing MCP subset |
| **Retire** | `onboarding-page` (superseded by auth service); SyncBot CLI scripts (after MCP); in-memory rate limiter; hardcoded-secret deploy script |
| **Add** | Conversation backbone, channel adapters (Chatwoot), agent runtime, scoring/assignment/follow-up engines, Knowledge MCP, automation platform, metering/credits, reporting projection, fine-grained RBAC, CI/CD pipeline |

## 4. Data Migration
- **Minimal.** The CRM data model was *just* redesigned (lead→transaction lifecycle) and is sound. No bulk migration needed for Phase 1–2.
- **Additive only:** new tables (Conversations, Messages, usage/credit ledger, assignment rules, scoring config) and new fields on Lead (score/band/qualification slots — partly present).
- **Reporting projection** (Aurora, P3): event-fed from DynamoDB via CDC/EventBridge — built in parallel, no downtime; DynamoDB stays source of truth.
- **GSI addition** (tenant-index) is a backfill, not a migration.

## 5. Backwards Compatibility & Risk Control
- **Feature flags** generalize the existing `DISABLED_FEATURES` toggling — every new engine ships behind a per-tenant flag; pilot tenants first.
- **Dual-run** where sensible: new scoring/assignment runs in shadow mode (logging recommendations) before it drives real routing.
- **Approval-queue first:** every agent capability launches at autonomy Level 0/1; graduate per tenant on evidence (`04 §6`).
- **No breaking API changes** to the SPA during wrapping — MCP tools sit beside REST, not replacing it.

## 6. Team & Sequencing Realities (3–6 engineers)
- One workstream at a time reaches GA; others in flag-gated beta.
- Reuse over greenfield: each engine starts as a T0/T1 tool-use loop, not a framework agent.
- Adopt managed services (AgentCore, Aurora) only when the simpler path strains — avoids ops overload.

## 7. Definition of "Migrated"
The migration is complete when: (a) every channel and agent reaches the business **only** through MCP/domain tools; (b) the CRM core is unchanged in responsibility but fully wrapped; (c) the disabled AI pieces are live behind guardrails; (d) "AI Employee" is a real agent, not a human SLA; (e) usage is metered and billed in credits. The CRM was never rewritten — it was surrounded.
