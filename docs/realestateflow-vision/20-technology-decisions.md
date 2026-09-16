# 20 — Technology Decisions (ADRs)

> **Scope:** the load-bearing technology choices as concise Architecture Decision Records, each with options, decision, rationale, and trade-offs. Research verified **June 2026**. **Verification caveat:** many official AWS/Meta/ElevenLabs pricing pages returned HTTP 403 to automated fetch; figures are corroborated across ≥2 sources (incl. AWS "What's New" announcements) but **exact $ should be reconfirmed on live pages before budgeting.**

---

### ADR-01 — Evolve the serverless core (no rewrite)
**Decision:** Strangler-fig on the existing Lambda + DynamoDB + Cognito CRM. **Why:** the core is mature and the data model was just rationalized; risk and cost of rewrite are unjustified. **Trade-off:** carrying some legacy patterns short-term. → `18`

### ADR-02 — Agent framework: Strands (default) + AgentCore (managed runtime), LangGraph only for ordered/audited sub-flows
**Options:** Strands, LangGraph, OpenAI Agents SDK, bespoke.
**Decision:** **Strands Agents SDK** (Python 1.0 May 2026 / TS 1.0 Apr 2026) as default; **Bedrock AgentCore** (GA Oct 2025; Mumbai available) for managed Runtime/Memory/Identity/Gateway/Browser/Observability when load justifies; **LangGraph** reserved for sub-flows needing strict ordering/human-approval/time-travel audit.
**Why:** AWS-native (Bedrock/IAM/Secrets/VPC), model-agnostic, MCP+A2A standard, lowest friction on our stack; AgentCore Runtime's 8-hr sessions + session isolation + idle-CPU savings fit chat agents. **Trade-off:** AgentCore is newer; some per-unit pricing unverified. → `04`

### ADR-03 — Don't build agents reflexively (T0/T1 before T2)
**Decision:** single LLM calls / tool-use loops for most engines; framework agents only for genuinely open-ended multi-step tasks. **Why:** cheaper, faster, debuggable, evaluable. **Trade-off:** some later refactor T1→T2. → `04 §1`

### ADR-04 — Models: Haiku-first, Sonnet for conversation, aggressive prompt caching
**Decision:** **Claude Haiku 4.5** ($1/$5 per 1M) for routing/scoring/extraction; **Claude Sonnet 4.6** ($3/$15) for customer conversation; **prompt caching** (1-hr TTL, cached reads ~0.1× input) of stable catalog/system prompt; Amazon **Nova** as an optional cost floor for trivial bulk tasks. **Why:** dominant cost lever; quality where it matters. **Trade-off:** Nova pricing unverified; cache invalidation discipline required. → `04 §6`,`17`

### ADR-05 — Business-domain MCP servers (not mega-server, not per-endpoint)
**Decision:** 11 domain MCP servers (`05`), most generated from existing REST/Lambda via **AgentCore Gateway**; custom SDK servers (Streamable HTTP) where bespoke. **Why:** tool-count hygiene, bounded ownership, composability, multi-tenant enforcement; also a future partner/product surface. **Trade-off:** more servers to operate than one. → `05`

### ADR-06 — Omnichannel inbox: Chatwoot CE (self-hosted) as channel layer
**Options:** Chatwoot, raw per-channel webhooks, commercial inbox.
**Decision:** **Chatwoot Community (MIT, self-hosted)** for channel ingestion + human-agent inbox; **our CRM remains source of truth**; agents on top.
**Why:** covers all required channels, data ownership (DPDP), free human-inbox/HITL surface. **Trade-off:** shared-DB logical isolation (mitigate per `08`/`R15`); Enterprise-only SLA/audit (we provide our own). → `08`

### ADR-07 — WhatsApp: Embedded Signup, start Tech-Provider/BSP (AiSensy)
**Decision:** multi-tenant onboarding via **Embedded Signup**; begin via existing **AiSensy** BSP / Tech-Provider model (agencies pay Meta directly); keep conversations in the **free 24h window**, prefer Utility over Marketing templates. **Why:** avoid carrying Meta billing/credit risk early; minimize per-message cost (per-message pricing since Jul 2025). **Trade-off:** BSP margin vs ops; revisit at scale. → `08 §4`

### ADR-08 — Voice: ElevenLabs Agents + Exotel SIP (managed) now; evaluate Pipecat/LiveKit + Bedrock Nova Sonic (self-host) at scale
**Decision:** managed stack for GA (native Hindi/Hinglish, ~$0.08/min + LLM passthrough); self-host path kept open for cost/data-residency at volume; **always route via licensed Indian telephony (Exotel)** — VoIP→PSTN is prohibited. **Why:** fastest compliant path, reuses current integrations. **Trade-off:** vendor per-minute cost; Nova 2 Sonic GA/region unverified. → `12`

### ADR-09 — RAG: Bedrock Knowledge Bases on S3 Vectors (defer OpenSearch)
**Decision:** Bedrock KB (citations + per-tenant metadata filtering) backed by **S3 Vectors** (GA Dec 2025, ~cents at small scale); consider **pgvector** if Aurora adopted; **avoid OpenSearch Serverless** (~$175–350/mo floor) until volume justifies. **Why:** cheapest viable, no idle floor, native integration. **Trade-off:** S3 Vectors sub-second (not ms) latency; non-filterable parent-child chunk metadata. → `14`

### ADR-10 — Compute: Lambda + Fargate; NO EKS; Aurora Serverless v2 as lazy reporting projection
**Decision:** Lambda (APIs/async/T0-T1), Fargate (steady services/Chatwoot/T2 pre-AgentCore/browser workers), AgentCore Runtime (P3 stateful agents); **no EKS**; **Aurora Serverless v2 (scale-to-zero)** as an event-fed reporting/RLS projection while DynamoDB stays source of truth. **Why:** EKS ops cost/extended-support trap unjustified at 3–6 eng; serverless scale-to-zero; SQL reporting DynamoDB can't do. **Trade-off:** two data stores to keep consistent (event-fed, eventual). → `16`

### ADR-11 — Identity: stay on Cognito; fine-grained RBAC; M2M agent identities
**Decision:** keep **Cognito** (Essentials $0.015/MAU, 10k free); extend 2-tier → role/region model; agents use **Cognito M2M** (now only $0.00225/1k token requests). **Why:** lowest-cost (already integrated); M2M cheap post-Nov-2025. **Trade-off:** Cognito DX vs Clerk/WorkOS — acceptable given incumbency. → `15`

### ADR-12 — Billing: credits over tokens; Lago meter + Razorpay collection
**Decision:** subscription + included **credits (business actions)** + overage packs; internal metering via **Lago (OSS self-host)**; collect via **Razorpay**; keep auto-debit **≤ ₹15,000** (RBI no-AFA cap; ₹1L limit doesn't apply to SaaS). **Why:** good UX, margin control, no per-event fees, India-compliant recurring. **Trade-off:** running Lago; Stripe Meters alternative if going global. → `17`

### ADR-13 — Browser automation: AgentCore Browser Tool (microVM) + SQS + per-tenant Secrets; official lead-retrieval before posting
**Decision:** AgentCore Browser Tool (per-session microVM isolation) as primary runtime, Playwright/Fargate as fallback; queue-based, credential-isolated, audited, HITL for 2FA; **build official lead-retrieval first; gate posting**. **Why:** strongest isolation; legal risk demands caution. **Trade-off:** highest-maintenance subsystem; legal exposure (`R2`). → `07`

### ADR-14 — Event-driven backbone (EventBridge + SQS + Step Functions + Redis)
**Decision:** EventBridge (domain events), SQS (per-tenant work queues), Step Functions (follow-up journeys), Redis/Valkey (cache/rate/dedup/session). **Why:** conversations/automations are async and bursty; replaces the ineffective in-memory rate limiter. **Trade-off:** more moving parts than synchronous calls. → `03`,`16`

### ADR-15 — Observability: CloudWatch + OTel + LLM tracing + immutable audit
**Decision:** ADOT/OpenTelemetry across services; AgentCore Observability/Evaluations or self-hosted **Langfuse** for LLM prompt/cost/latency/quality; immutable audit log feeding compliance + metering. **Why:** AI systems need eval + cost visibility; audit is a security+billing requirement. **Trade-off:** instrumentation effort. → `15`,`16`,`17`

---

## Decisions at a Glance
| Area | Choice | Avoided |
|---|---|---|
| Core | Strangle serverless CRM | Rewrite |
| Agents | Strands + AgentCore, T0/T1-first | Mega-agent, premature framework, EKS-hosted |
| Models | Haiku-first + Sonnet + caching | Per-token customer billing, always-Opus |
| Tools | Domain MCP via Gateway | Mega-MCP, per-endpoint sprawl |
| Channels | Chatwoot CE + Embedded Signup | Per-channel rebuild |
| Voice | ElevenLabs+Exotel (self-host option) | Direct VoIP→PSTN (illegal in India) |
| RAG | Bedrock KB + S3 Vectors | OpenSearch Serverless floor |
| Compute | Lambda+Fargate, Aurora lazy | EKS, Postgres-as-CRM |
| Identity | Cognito + fine RBAC + M2M | Auth migration |
| Billing | Credits + Lago + Razorpay | Per-token, >₹15k auto-debit |
| Automation | AgentCore Browser + gating | Ungoverned scraping |

**All pricing figures: reconfirm on live vendor pages before financial commitment (see caveat above).**
