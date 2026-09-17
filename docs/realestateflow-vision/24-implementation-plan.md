# 24 — Implementation Plan

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. The "first 90 days", the team shape and most of the build-vs-integrate cheat sheet describe tools the code never adopted (Chatwoot, Strands, AgentCore Gateway, Bedrock Knowledge Bases, Lago, Langfuse, Aurora, Redis, Step Functions). Current sources: `docs/realestateflow-vision/21-roadmap.md` (Phase A/B/C), `docs/realestateflow-vision/00-phase-0-prerequisites.md` (hardening checklist with status), `docs/realestateflow-vision/20-technology-decisions.md` (what was adopted and what was not), `docs/proposals/agent-channel-architecture/` (the agent design being implemented), `docs/pending-items/` and `marketing-and-sales/launch-plan-v2/`. **REF-E04** below was never defined in `22-jira-epics.md` and no Postgres migration is planned.

> **Scope:** the concrete "how we actually start" — first 90 days in detail, team shape, sprint cadence, environment/tooling setup, and the pragmatic build-vs-integrate cheat sheet the user explicitly asked for ("architecture that can be implemented without rewriting everything; what integrations and open-source/third-party tools we can use"). Builds on `18`,`21`,`22`,`23`.

---

## 1. The Pragmatic Build-vs-Integrate Cheat Sheet

The fastest path reuses what exists and integrates proven tools rather than building from scratch. Recommended stack:

| Capability | **Integrate / OSS (don't build)** | Build (thin glue) |
|---|---|---|
| Omnichannel inbox + channels | **Chatwoot CE** (MIT, self-host) — WA/IG/FB/Telegram/web/email | Webhook→backbone adapter; agent reply via Chatwoot API |
| WhatsApp | **AiSensy** (already integrated) / Embedded Signup BSP | Channel adapter |
| Agent framework | **Strands Agents SDK** (AWS) | Agent definitions, tools |
| Managed agent runtime | **Bedrock AgentCore** (Runtime/Gateway/Memory/Browser) | Config, Gateway tool specs |
| MCP tools from existing APIs | **AgentCore Gateway** (OpenAPI/Lambda→MCP) | OpenAPI specs |
| LLMs | **Bedrock** (Claude Haiku/Sonnet, Nova) | Prompts, caching config |
| RAG | **Bedrock Knowledge Bases + S3 Vectors** | Ingestion pipeline, Knowledge MCP |
| Voice | **ElevenLabs Agents + Exotel** (both integrated) | MCP bridge, prompts |
| Voice (self-host option) | **Pipecat / LiveKit Agents** + Bedrock | Pipeline config |
| Image/video gen | **Higgsfield MCP** (integrated) + **Remotion** (in repo) | Marketing MCP |
| Social publishing | **Blotato MCP** (integrated) | Marketing MCP |
| Ads | **Meta-Ads MCP** (integrated) + CAPI | Closed-loop wiring |
| Browser automation | **AgentCore Browser Tool** / Playwright / Steel.dev | Automation MCP, workers |
| Metering/credits | **Lago** (OSS, self-host) | Event→meter wiring |
| Billing collection | **Razorpay** (integrated) | Credit-pack flows |
| LLM observability | **Langfuse** (OSS) or AgentCore Observability | Instrumentation |
| Email | **Brevo** (integrated) | — |
| Analytics/errors | **PostHog + Sentry** (integrated) | — |
| Reporting & operational DB | **Aurora Serverless v2 + RDS Proxy + Drizzle ORM** (`25`,`26`) | Row-level security, data parity validation, dual-write migration |
| Cache/queue/events | **Redis/Valkey, SQS, EventBridge, Step Functions** | Backbone |
| Secret scanning | **gitleaks** | CI hook |

**Headline:** ~80% of the platform is integration + configuration of tools the repo already touches (Bedrock, Exotel, ElevenLabs, AiSensy, Higgsfield/Meta/Blotato, Razorpay, Cognito, DynamoDB) plus a few OSS additions (Chatwoot, Lago, Langfuse). The genuinely new *code* is the **conversation backbone + agent definitions + MCP tools + engine logic** — all thin glue over existing capabilities. **No rewrite of the CRM.**

## 2. First 90 Days (detailed)

### Weeks 1–2 — Secure & set the table (REF-E00, E03 start)
- 🔴 Rotate + remove hardcoded secrets; Secrets Manager; gitleaks pre-commit + CI (REF-E00-S1). **This is day 1.**
- WAF + API GW logs + throttling; DynamoDB PITR; S3 versioning (REF-E00-S2/S3).
- Stand up dev/staging/prod IaC consolidation skeleton + deploy pipeline (REF-E03-S1).
- Feature-flag service; spike AgentCore Gateway against one endpoint.

### Weeks 3–5 — RBAC + MCP foundation (REF-E01, E02)
- Role/region model in auth service + domain enforcement (REF-E01-S1/S2); agent M2M clients (S3).
- Expose Lead/Property/CRM/Visit endpoints as MCP tools via Gateway (REF-E02-S1); tenant-index GSI (S2); Conversation tables (S3).
- Immutable audit log (REF-E03-S2).

### Weeks 6–9 — Conversation backbone + WhatsApp ingestion (REF-E10, E11)
- EventBridge + SQS + Redis/Valkey; Conversation Orchestrator (REF-E10).
- Chatwoot deployed (Fargate); WhatsApp via AiSensy → backbone; website widget; Meta Lead Ads sync (REF-E11).
- Contact resolve/merge across channels.

### **[PARALLEL, NON-BLOCKING] Weeks 6–12 — PostgreSQL Migration Foundation (REF-E04)**
*One backend engineer, runs alongside Phase 1, not in critical path.*
- **Week 6–7:** Provision Aurora Serverless v2 + RDS Proxy in staging; write Drizzle schema + migrations (`25`,`26`).
- **Week 8–9:** Dual-write service layer (e.g., `leadService.create()` writes to both DynamoDB + Postgres); keep reads from DynamoDB (source of truth).
- **Week 10–11:** Data parity validation (row count checks, sample spot-checks); migrate lowest-risk tables first (projects, developers, areas).
- **Week 12:** Postgres reads for non-critical queries; standby for Phase 2 (when reporting/joins needed).
- **Outcome:** Postgres foundation ready; zero user impact; can accelerate cutover in Phase 2–3 when reporting dashboards / agent analytics need complex joins.

### Weeks 10–13 — Sales Assistant + Qualification (REF-E12, E13) + Metering (REF-E16)
- Sales Assistant (T1 tool-use loop, Sonnet, cached catalog) over Property/Document/Visit MCP; grounding + escalate-to-human; approval-queue + action inbox (REF-E12).
- Qualifier (Haiku) slot extraction + next-best-question (REF-E13).
- Lago metering + budget caps from audit events (REF-E16).
- **Pilot with 3–5 friendly agencies behind flags.**

**90-day outcome:** secure, wrapped core + WhatsApp/web conversations auto-answered (grounded) and progressively qualified, metered, with human approval — the product wedge, live in pilot. Scoring/assignment (E14/E15) follow immediately into the next sprint set.

## 3. Team Shape (3–6 engineers)
| Role | Focus |
|---|---|
| **Tech lead / platform** | Backbone, MCP/Gateway, infra, security, CI/CD |
| **Backend (CRM/domain)** | Domain API refactor, RBAC, MCP tools, billing/metering |
| **AI/agents engineer** | Agents (Strands/tool-use), prompts, grounding, eval harness |
| **Channels/integrations** | Chatwoot, WhatsApp/IG/FB, voice bridge, marketing MCPs |
| **Frontend (shared)** | Dashboard: action inbox, pipeline+bands, config, usage |
| **(Phase 3+) data/analytics** | Aurora projection, dashboards, attribution |

Run **2-week sprints**, one engine to GA at a time, others in flag-gated beta. Weekly cost + eval review (groundedness, task success, $/action).

## 4. Engineering Standards (carry forward + add)
- Keep: TypeScript strict, ES modules, RESTful `/api/crm/*`, single-table `TENANT#` keys, structured logging, idempotent webhooks, Playwright E2E.
- Add: **every customer-facing AI answer grounded** (tool-gated, no invented facts); **server-side RBAC + tenant-from-token** on every MCP tool; **feature flag + approval-queue** for every new agent capability; **audit + cost** on every agent action; **eval suite per agent** in CI; **secret scanning**; **reconfirm vendor pricing** before financial commitment.

## 5. Definition of Success (per phase, measurable)
- **Phase 0:** zero exposed secrets; RBAC tests green; MCP tools live; automated deploys.
- **Phase 1:** pilot agencies' WhatsApp/web leads auto-captured + qualified; <60s first response; zero cross-tenant incidents; cost/conversation within target; >X% leads reach "qualified."
- **Phase 2:** follow-up journeys lift touches-to-conversion; voice handles inbound + reminders; grounded answers cite sources; "AI employee" no longer human-provisioned.
- **Phase 3:** marketing/automation/analytics live; credit billing live; margin positive per active tenant.

## 6. What to NOT Do (discipline)
- Don't build agents where a single LLM call works (`04 §1`).
- Don't adopt EKS or OpenSearch Serverless early (`16`).
- Don't ship portal *posting* before legal sign-off (`07`,`19`).
- Don't let any customer-facing AI invent facts (`04 §5`).
- Don't bill customers per token (`17`).
- Don't rewrite the CRM (`18`).
- Don't move past approval-queue autonomy without eval evidence (`04 §6`).

---

## 7. Immediate Next Actions (this week)
1. **Rotate the exposed secrets** in `agency-app/ai-calling/deploy-lambda.ps1` and purge history (REF-E00-S1).
2. Stand up the **feature-flag + audit-log** primitives (REF-E02-S3, E03-S2).
3. Spike **AgentCore Gateway** over the Lead + Property endpoints → first MCP tools (REF-E02-S1).
4. Deploy **Chatwoot** in staging and wire one WhatsApp number (AiSensy) → a stub backbone (REF-E11-S1).
5. Draft the **RBAC role/permission matrix** and review with the team (REF-E01-S1).

These five unblock the entire Phase 1 critical path while delivering the security fix that cannot wait.
