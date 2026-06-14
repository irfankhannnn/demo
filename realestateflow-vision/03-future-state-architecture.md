# 03 — Future-State Architecture

> **Purpose:** the target technical architecture for RealEstateFlow as an AI Agency Operating System. It is designed to be reached **incrementally from today's stack** (`01`) via the strangler-fig migration in `18`, not by rewrite. Detailed per-domain designs live in `04`–`17`; this is the system-level blueprint and the glue between them.

---

## 1. Design Tenets

1. **Evolve the serverless core; don't rewrite it.** The existing Lambda + DynamoDB + Cognito CRM stays the system of record. We add layers around it.
2. **One domain API, many interfaces.** Every channel (WhatsApp, voice, dashboard, IG/FB) and every agent reaches the business through the **same domain services**, exposed both as REST (today) and as **MCP tools** (new, `05`).
3. **Agents are orchestrators, not data owners.** Agents reason and call tools; the tools enforce tenancy, validation, and RBAC. An agent can never bypass the domain layer.
4. **Async, event-driven backbone.** Conversations, calls, automations, and follow-ups are inherently asynchronous and bursty → queue + event driven (EventBridge/SQS), not synchronous request chains.
5. **Tenant isolation end-to-end** — data, credentials, agent memory, automation runs, billing (`15`).
6. **Cost-aware by default.** Cheapest model that works (Haiku-tier for routing/scoring, Sonnet-tier for conversation), aggressive prompt caching, managed services only when load justifies them (`17`, `20`).
7. **Human-in-the-loop is a first-class state**, not an afterthought — every autonomous workflow has an approval/exception path.

## 2. Layered Architecture (target)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  L1  EXPERIENCE / INTERFACES                                              │
│  CRM SPA · Agency WhatsApp (command) · Voice (PSTN) · Mobile (future)     │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L2  CHANNEL ADAPTERS (ingress/egress, per-platform rules)               │
│  WhatsApp Cloud API · Instagram · Messenger · Telegram · Web Chat · SIP   │
│  → normalize to a single internal "Conversation/Message" event           │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L3  CONVERSATION & EVENT BACKBONE                                       │
│  EventBridge (domain events) · SQS (work queues) · Step Functions (long  │
│  workflows) · Conversation Orchestrator (routes msg → right agent)       │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L4  AGENT RUNTIME (reasoning)                                           │
│  Strands agents (Sales Assistant, Qualifier, Scorer, Assigner, Voice,    │
│  Marketing, Automation, Agency-Command) · Memory · Identity · Eval       │
│  Phase-1: agents-on-Lambda/Fargate · Phase-3: Bedrock AgentCore Runtime  │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L5  TOOL / MCP LAYER (business-domain MCP servers)                      │
│  Lead · Property/Inventory · CRM · Visit · Task · Marketing · Voice ·    │
│  Automation · Document · Knowledge · Analytics MCP  (see 05)             │
│  Exposed from existing domain services via AgentCore Gateway / SDK       │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L6  DOMAIN SERVICES (system of record — TODAY'S CODE, refactored)      │
│  Express/Lambda domain modules: leads, contacts, properties, visits,     │
│  khata, subscriptions, notifications, enquiries  → clean internal API    │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L7  DATA & KNOWLEDGE                                                    │
│  DynamoDB (operational) · Aurora Postgres (reporting/analytics, later) · │
│  Vector store (Bedrock KB / OpenSearch / pgvector) · S3 (docs/media)     │
│  · Redis/Valkey (session, rate, dedup) · Secrets Manager + KMS           │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L8  PLATFORM (cross-cutting)                                            │
│  Cognito (identity, RBAC, M2M) · Billing/Metering · Observability        │
│  (CloudWatch+OTel+LLM traces) · Audit log · IaC/CI-CD                     │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. The Conversation Backbone (the heart of the OS)

Every inbound signal — a WhatsApp message, an IG comment, a missed call, a web-chat line, a lead-ad submission — becomes a normalized **`MessageReceived`** event:

```
Channel webhook (L2) → validate+dedupe (Redis) → publish MessageReceived (EventBridge)
   → Conversation Orchestrator (L3):
        1. resolve/merge Contact (by phone/handle)  [CRM MCP]
        2. load/open Conversation thread + history    [Conversation store]
        3. classify intent + route to agent           [cheap Haiku call]
        4. enqueue to agent (SQS, per-tenant fairness)
   → Agent (L4) runs, calls tools (L5→L6), produces reply + CRM outcome
   → Egress adapter (L2) sends reply respecting channel rules (24h window, etc.)
   → emit domain events (LeadQualified, VisitBooked, ScoreChanged…) → downstream
```

This backbone is **channel-agnostic**: adding Telegram or a new portal is a new L2 adapter, nothing else changes. It is also where **human-in-the-loop** lives: an agent can emit `ApprovalRequested` → the reply waits in an agent inbox in the dashboard/WhatsApp until a human approves (Phase-1 default), and per-tenant/per-workflow config graduates flows to auto-send.

## 4. Where Each Vision Engine Lives

| Engine (vision pillar) | Layer(s) | Doc |
|---|---|---|
| Lead Acquisition (omnichannel capture) | L2 adapters + L3 backbone | `08` |
| Lead Qualification | L4 Qualifier agent + L5 Lead/CRM MCP | `09` |
| Lead Scoring | L4 (deterministic + Haiku) → `LeadScore` on record | `10` |
| Lead Assignment | L3 rules engine + L6 team service | `11` |
| AI Sales Assistant | L4 Sales agent + L5 Property/Knowledge MCP (grounded) | `09`, `14` |
| Follow-Up Automation | L3 Step Functions journeys + L4 | `09`, `07` |
| AI Voice | L2 SIP + L4 Voice agent (evolves ai-calling-service) | `12` |
| AI Marketing | L4 Marketing agent + L5 Marketing MCP (Higgsfield/Meta/Blotato) | `13` |
| Browser/Portal Automation | L4 Automation agent + L5 Automation MCP + isolated browser runtime | `07` |
| Knowledge & RAG | L7 vector + L5 Knowledge MCP | `14` |
| Future 3D property experience | L1 + L7 media (S3/CloudFront) | §9 below |

## 5. Compute & Runtime Strategy (summary; full rationale in `16`, `20`)

- **Keep serverless (Lambda) for the domain API and channel webhooks** — bursty, stateless, cheap at low volume.
- **Agent runtime evolves in three steps:** (1) Strands agents packaged in Lambda/Fargate behind SQS; (2) long-running or stateful conversational agents move to **Fargate** (warm, websockets to voice); (3) at scale, **Bedrock AgentCore Runtime** for managed session isolation, 8-hour sessions, idle-CPU cost savings, Memory & Identity. **EKS is explicitly not recommended** for a 3–6 engineer team (`16`).
- **Event/queue:** EventBridge for domain events (fan-out, schemas), SQS for per-tenant work queues (fairness, retries, DLQs), Step Functions for multi-day follow-up journeys.

## 6. Model Strategy

| Job | Model (Bedrock, ap-south-1) | Why |
|---|---|---|
| Intent routing, lead scoring, field extraction, classification | **Claude Haiku 4.5** ($1/$5 per 1M) | High volume, cheap, fast |
| Customer-facing conversation (WhatsApp/voice sales assistant) | **Claude Sonnet 4.6** ($3/$15) | Quality + tool use; cache the catalog prefix |
| Hard reasoning (rare: complex deal analysis, planning) | Sonnet 4.6 / escalate | Cost-controlled |
| Ultra-cheap bulk classification (optional) | Amazon Nova Lite/Micro | Cost floor for simple tasks |

**Prompt caching is mandatory** for the sales assistant: cache the (large, stable) system prompt + tenant product catalog with 1-hour TTL → cached reads ~0.1× input, the single biggest cost lever (`17`). Embeddings via Bedrock Titan/Cohere for RAG (`14`).

## 7. Data Architecture Evolution

- **Phase 1–2:** stay on **DynamoDB single-table** for operational data. Fix the known scan inefficiency (`MED-1`: add a `tenant-index` GSI `PK=tenantId, SK=EntityType`) before agents drive read volume up.
- **Conversation store:** new DynamoDB tables `Conversations` (PK `TENANT#..#CONV#id`) and `Messages` (SK timestamp), TTL on raw payloads, with a GSI by contact and by channel.
- **Phase 3 (reporting/analytics):** introduce **Aurora Serverless v2 Postgres** as a read/reporting store fed by EventBridge → it unlocks ad-hoc queries, dashboards, and **Row-Level-Security tenant isolation** that DynamoDB scans can't do well (`16`). CRM stays source-of-truth in DynamoDB; Postgres is a projection.
- **Vector/Knowledge:** start with **Bedrock Knowledge Bases** (metadata-filtered per tenant) reusing the calling service's pattern; choose the cheapest backing store in `14` (S3 Vectors / pgvector over OpenSearch Serverless to avoid its OCU floor).

## 8. Cross-Cutting Platform

- **Identity & RBAC (`15`):** extend Cognito + auth microservice from 2-tier to a real role/permission model (Owner, Manager, Team Lead, Agent, plus agent **machine identities** via Cognito M2M). Region/team scoping enforced in the domain layer and surfaced to MCP tools as scope claims.
- **Secrets & per-tenant credentials (`15`):** Secrets Manager namespaced per tenant for channel tokens, portal logins, voice keys; KMS per-tenant data keys for sensitive fields. **Immediately remediate the hardcoded secrets** found in `ai-calling-service/deploy-lambda.ps1`.
- **Observability:** CloudWatch + OpenTelemetry (ADOT) across services; **LLM-specific tracing/eval** (AgentCore Observability/Evaluations or self-hosted Langfuse) for prompt/latency/cost/quality. Every agent action writes to an **immutable audit log** (who/what/tenant/tool/cost).
- **Billing/metering (`17`):** a usage meter captures conversations, AI minutes, listings posted, creatives generated → drives credit-based plans on top of Razorpay.
- **IaC/CI-CD (`16`):** consolidate the 3 CFN stacks, add an automated deploy pipeline (the current gap), per-environment (dev/staging/prod) with the demo-reset pattern retained.

## 9. Future Property Experience (design only — do not implement)

A premium, later-phase tier: **3D tours / virtual walkthroughs / Gaussian-splatting** captures. Architecture: capture (phone/360 rig) → processing pipeline (3rd-party splatting/photogrammetry service or batch GPU job) → artifacts in **S3**, served via **CloudFront**, embedded in listing pages and shareable in WhatsApp/IG. Stored as a `PropertyExperience` asset linked to the Property entity; gated by plan/credits. No commitment to a specific vendor now; the data model simply reserves the linkage. Keep it out of the critical path.

## 10. Reference Request Lifecycles (end-to-end)

**(a) New WhatsApp lead → qualified → assigned → visit booked:**
`WhatsApp webhook → MessageReceived → resolve Contact (CRM MCP) → Sales agent (Sonnet, cached catalog) answers grounded from Property/Knowledge MCP → Qualifier agent (Haiku) extracts budget/timeline/location via progressive profiling → Scorer (Haiku + rules) sets Hot/Warm/Cold → Assignment rules pick agent (round-robin/region) → Task + Visit created (Task/Visit MCP) → confirmation sent → events LeadQualified/VisitBooked → dashboard + agent notified.`

**(b) Outbound follow-up journey:**
`Step Functions journey (per lead) waits/branches on engagement → at each step Marketing/Comms agent composes a grounded message → sent via best channel (WhatsApp template within policy / voice call via Voice agent) → responses re-enter the backbone.`

**(c) Agency command via WhatsApp:**
`Owner texts "aaj ke hot leads bhejo" → Agency-Command agent (authenticated as a user, RBAC-scoped) → Analytics/CRM MCP query → formatted reply.`

## 11. What This Architecture Deliberately Avoids

- A second CRM / data rewrite (we wrap, not replace).
- Kubernetes/EKS for a small team (`16`).
- A single mega-agent or a single mega-MCP (we use domain-bounded agents and MCP servers — `04`, `05`).
- Per-token customer billing (`17`).
- Synchronous long chains across services (everything bursty is async).
- Vendor lock-in at the reasoning layer: Strands is model-agnostic and MCP/A2A-standard, so models and even the runtime can be swapped.

---

**In one sentence:** put an **event-driven conversation backbone** and a **domain-bounded agent+MCP layer** on top of the **existing serverless CRM**, so every channel and every AI capability speaks to the same governed business core — and grow from simple Lambda agents to managed AgentCore only as load demands.
