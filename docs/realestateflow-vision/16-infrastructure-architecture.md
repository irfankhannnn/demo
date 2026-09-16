# 16 — Infrastructure Architecture

> **Scope:** the target AWS infrastructure and an honest evaluation of the "big" components (EKS, Postgres, OpenSearch, Redis, etc.) against the codebase and a small-team reality. Validates the vision's infra list rather than assuming it. Research verified June 2026 (`20`); **AWS pricing 403-blocked to automated fetch — reconfirm exact rates.**

---

## 1. Principle: managed-serverless first, add heavy infra only when load justifies it
The platform is a **3–6 engineer** operation. Every component must earn its operational cost. We **keep the serverless core**, add an **event backbone** and **agent runtime**, and adopt heavier services **lazily**.

## 2. Component-by-Component Verdict (validating the vision's list against reality)

| Vision component | Verdict | Rationale |
|---|---|---|
| **AWS EKS** | ❌ **Not now** | EKS is **not justified** at this team size. Control-plane fee ($73/mo) is the cheap part; the real cost is ops (node upgrades, add-ons, version churn) and the **extended-support trap** ($0.60/hr, 6×, after ~14 months). Use **Lambda + Fargate** instead. Revisit only with a hard k8s mandate. |
| **PostgreSQL** | ✅ **Yes, lazily** | **Aurora Serverless v2 (scale-to-zero, GA Nov 2024)** as a **reporting/analytics + RLS** store, fed from events. CRM stays DynamoDB (source of truth); Postgres is a projection. Unlocks ad-hoc queries DynamoDB can't. |
| **OpenSearch** | ⚠️ **Defer** | Serverless has a **~$175–350/mo floor** — a tax pre-scale. Use **S3 Vectors** for RAG (`14`); adopt OpenSearch only when search/analytics volume justifies the floor. |
| **Redis** | ✅ **Yes** | **ElastiCache Serverless (Valkey)** for idempotency/dedup, rate-limit counters, conversation session cache, hot config. (Replaces the ineffective in-memory rate limiter.) |
| **SQS** | ✅ **Yes** | Per-tenant work queues (agents, automation, follow-up), DLQs, fairness, retries. Core of the async backbone. |
| **SNS** | ✅ (already used) | SMS (Cognito), fan-out notifications. |
| **EventBridge** | ✅ **Yes** | Domain event bus (schemas, fan-out) — the backbone of `03 §3`. |
| **Step Functions** | ✅ **Yes** | Long-running follow-up journeys (`09`), multi-day workflows. |
| **S3** | ✅ (already used) | Docs/media/recordings/assets/vectors. Enable versioning + lifecycle. |
| **CloudFront** | ✅ **Yes** | Frontend + media + future 3D tours. |
| **Bedrock** | ✅ (already used) | Models + Knowledge Bases (`14`). |
| **AgentCore** | ✅ **Phase 3** | Managed agent runtime/memory/identity/gateway/browser when load justifies (`04`,`05`,`07`). |
| **Secrets Manager + KMS** | ✅ **Yes** | Per-tenant credentials + encryption (`15`). |
| **CloudWatch + OpenTelemetry** | ✅ **Yes** | Unified observability + LLM tracing (ADOT; AgentCore Observability / Langfuse). |

**Net:** the vision's list is broadly right, with three corrections — **drop EKS**, **defer OpenSearch (use S3 Vectors)**, and **adopt Postgres as a lazy reporting projection, not a CRM replacement.**

## 3. Target Topology

```
                         CloudFront ──► S3 (SPA, media, 3D assets)
 Users / Channels
   │                ┌────────────── API Gateway (REST: public + CRM) ──┐
   ▼                ▼                                                   ▼
 Chatwoot (channels) → Channel webhooks (Lambda) → EventBridge (domain events)
                                                        │
                          ┌─────────────────────────────┼───────────────────────┐
                          ▼                             ▼                        ▼
                   SQS work queues            Step Functions journeys      Conversation
                          │                    (follow-up `09`)            Orchestrator
                          ▼                                                     │
                 Agent runtime (Strands)                                       │
                 Lambda/Fargate → AgentCore Runtime (P3)                       │
                          │ MCP tools (Gateway)                                │
                          ▼                                                     ▼
                 Domain services (Express/Lambda)  ◄──────────────────  CRM/Contact resolve
                          │
        ┌─────────────────┼───────────────────────────────────────────┐
        ▼                 ▼                 ▼              ▼            ▼
   DynamoDB         Aurora SvlessV2     S3 Vectors    Redis/Valkey   Secrets+KMS
   (operational)    (reporting/RLS,P3)  (RAG `14`)   (cache/rate)   (per-tenant)
        │
        ▼  (CDC/events)
   Aurora reporting projection

 Cross-cutting: CloudWatch + OTel + LLM traces · CloudTrail · WAF · audit log
 Region: ap-south-1 (Mumbai). Dubai tenants: data-residency review (`15`).
```

## 4. Compute Strategy
- **Lambda:** APIs, channel webhooks, T0/T1 agent functions, event handlers — bursty, scale-to-zero.
- **Fargate:** steady/long-lived services — Chatwoot, websocket/voice bridges, T2 Strands agents pre-AgentCore, browser-automation workers. ~$0.04/vCPU-hr, no control-plane fee.
- **AgentCore Runtime (P3):** stateful conversational/voice agents (8-hr sessions, isolation, idle-CPU savings, Memory/Identity).
- **No EKS.**

## 5. Data Strategy (recap from `03 §7`)
- **DynamoDB** operational source of truth; **fix the `tenant-index` GSI** (MED-1) to replace table scans before agent read-volume grows; add Conversation/Message tables.
- **Aurora Serverless v2** as event-fed reporting projection with **RLS** tenant isolation (P3) — powers analytics the dashboard/Agency-Command agent need.
- **S3 Vectors** for RAG; **Redis/Valkey** for cache/rate/dedup/session.

## 6. CI/CD & IaC (close the current gap)
Today: 3 separate CFN stacks, **manual deploys**, only a Playwright CI. Target:
- **Consolidate IaC** (CFN/SAM or CDK) across services with shared parameters/secrets; per-env (dev/staging/prod).
- **Automated deploy pipeline** (GitHub Actions → build/test/deploy with approvals) — the biggest current ops gap.
- Keep the **demo-reset** pattern; add **infra tests** + **secret scanning** (`15`).
- Blue/green or canary for the agent runtime; feature flags for engine rollout (the existing `DISABLED_FEATURES` toggling generalizes to flags).

## 7. Observability
CloudWatch metrics/logs/alarms (currently documented, not deployed — deploy them), **OpenTelemetry/ADOT** traces across services, **LLM-specific observability** (AgentCore Observability/Evaluations or self-hosted **Langfuse**) for prompt/cost/latency/quality, plus the immutable **audit log** (`15`). Alarms on 5xx, Lambda errors/throttles, DynamoDB throttles, agent cost/loops, channel quality ratings.

## 8. Cost Posture (high level; detail in `17`)
Serverless + scale-to-zero keeps idle cost low. The notable always-on floors we **avoid early**: OpenSearch Serverless ($175+/mo) and EKS. Dominant variable costs at scale: LLM tokens (mitigated by Haiku-first + caching), voice minutes, generative video, WhatsApp marketing templates, browser-automation minutes.

## 9. Phasing
- **P1:** keep current serverless; add EventBridge + SQS + Redis/Valkey; CI/CD pipeline; observability + WAF; GSI fix.
- **P2:** Step Functions journeys; S3 Vectors RAG; Fargate for Chatwoot/agents.
- **P3:** Aurora reporting projection (RLS); AgentCore Runtime/Gateway/Browser; consolidated multi-env IaC.
