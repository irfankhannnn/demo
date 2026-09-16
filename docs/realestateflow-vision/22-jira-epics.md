# 22 — Jira Epics

> **Scope:** the epic-level backlog mapped to phases (`21`). Each epic has a goal, key outcomes, dependencies, and primary doc reference. Stories in `23`. IDs use prefix **REF** (RealEstateFlow).

---

## Phase 0 — Foundation

### REF-E00 · Security Remediation & Hardening
**Goal:** eliminate the active secret exposure and bring the platform to production-grade security baseline.
**Outcomes:** secrets rotated to Secrets Manager; git history purged; secret scanning in CI; WAF + API GW access logs + throttling; DynamoDB PITR; S3 versioning; CORS tightened.
**Depends:** none (do first). **Ref:** `15`,`19`

### REF-E01 · Fine-Grained RBAC & Tenant Scoping
**Goal:** extend 2-tier auth to Owner/Manager/Team-Lead/Agent + region/team scoping + agent M2M identities.
**Outcomes:** role/permission model in auth service + domain layer; region/team data scoping; M2M clients for agents.
**Depends:** none. **Ref:** `15`

### REF-E02 · Domain API & MCP Foundation
**Goal:** expose existing domain capabilities as governed MCP tools.
**Outcomes:** AgentCore Gateway wrapping CRM/Lead/Property/Visit/Contact endpoints; tenant+scope enforcement; tenant-index GSI (MED-1); conversation tables; feature-flag framework.
**Depends:** REF-E01. **Ref:** `05`,`16`,`18`

### REF-E03 · CI/CD, IaC & Observability Baseline
**Goal:** automated, observable delivery.
**Outcomes:** automated deploy pipeline; consolidated IaC; dev/staging/prod; CloudWatch alarms + OTel; immutable audit log.
**Depends:** none. **Ref:** `16`,`15`

---

## Phase 1 — Acquisition & Qualification

### REF-E10 · Conversation Backbone
**Goal:** event-driven async core for all channels.
**Outcomes:** EventBridge + SQS + Redis/Valkey; Conversation Orchestrator; Conversation/Message stores; idempotency/dedup.
**Depends:** REF-E02,E03. **Ref:** `03`,`16`

### REF-E11 · Omnichannel Ingestion (WhatsApp + Web + Lead Ads)
**Goal:** capture conversations from the priority channels.
**Outcomes:** Chatwoot channel layer; WhatsApp via AiSensy/Embedded Signup; website chat widget; Meta Lead Ads sync; contact resolve/merge.
**Depends:** REF-E10. **Ref:** `08`

### REF-E12 · AI Sales Assistant (grounded)
**Goal:** grounded conversational agent answering + booking.
**Outcomes:** Sales Assistant (T1, Sonnet, cached catalog) over Property/Document/Visit MCP; grounding + "don't-know→task"; approval-queue autonomy.
**Depends:** REF-E11, REF-E02. **Ref:** `04`,`09`

### REF-E13 · Lead Qualification Engine
**Goal:** progressive profiling to "qualified."
**Outcomes:** Qualifier (Haiku) slot extraction + next-best-question; Lead MCP updates; enrichment.
**Depends:** REF-E12. **Ref:** `09`

### REF-E14 · Lead Scoring Engine
**Goal:** Hot/Warm/Cold with reasons.
**Outcomes:** deterministic weighted model + Haiku signals; event-driven recompute; pipeline banding; tenant tuning.
**Depends:** REF-E13. **Ref:** `10`

### REF-E15 · Lead Assignment Engine
**Goal:** zero-drop routing with rules.
**Outcomes:** rule chain (round-robin/region/project/team/quality); capacity/availability; SLA timers + escalation/reassign.
**Depends:** REF-E14, REF-E01. **Ref:** `11`

### REF-E16 · Usage Metering & Cost Guards
**Goal:** measure and cap AI usage.
**Outcomes:** Lago meter from audit events; credit ledger; per-tenant budget caps + circuit breakers.
**Depends:** REF-E03. **Ref:** `17`

---

## Phase 2 — Nurture, Voice & Knowledge

### REF-E20 · Follow-Up Automation Engine
**Goal:** multi-touch nurture journeys.
**Outcomes:** Step Functions journeys; channel-aware grounded touchpoints; autonomy graduation; stop-on-takeover.
**Depends:** REF-E13,E11. **Ref:** `09`

### REF-E21 · Knowledge & RAG Platform
**Goal:** ground agents in tenant knowledge.
**Outcomes:** Bedrock KB + S3 Vectors; Knowledge MCP; per-tenant ingestion + citations; versioning.
**Depends:** REF-E02. **Ref:** `14`

### REF-E22 · AI Voice System
**Goal:** inbound + follow-up voice, MCP-grounded.
**Outcomes:** re-enable ai-calling-service behind MCP; ElevenLabs+Exotel; Hindi/Hinglish; inbound answering + reminder calls + human transfer; consent/recording.
**Depends:** REF-E21,E20. **Ref:** `12`

### REF-E23 · Social Channel Expansion (IG/FB)
**Goal:** Instagram + Facebook acquisition.
**Outcomes:** IG DMs + comment-to-DM; FB messages/comments; app-review; attribution.
**Depends:** REF-E11. **Ref:** `08`

### REF-E24 · Strands Agent Runtime & Evaluation
**Goal:** framework agents where complexity demands.
**Outcomes:** Strands for Follow-Up/Agency-Command; Graph/A2A; eval harness in CI; Agency-Command WhatsApp copilot.
**Depends:** REF-E20. **Ref:** `04`

---

## Phase 3 — Scale, Marketing & Automation

### REF-E30 · AgentCore Runtime Adoption
**Goal:** managed agent infra at scale.
**Outcomes:** stateful agents on AgentCore Runtime; Memory; Identity; Observability; VPC/PrivateLink.
**Depends:** REF-E24. **Ref:** `04`,`16`

### REF-E31 · AI Marketing Engine
**Goal:** tenant content/campaign/reel generation + publishing.
**Outcomes:** Marketing MCP (Higgsfield/Meta/Blotato + Remotion); brand-grounded; approval gate; closed-loop CAPI.
**Depends:** REF-E21,E16. **Ref:** `13`

### REF-E32 · Portal/Browser Automation Platform
**Goal:** safe portal lead-retrieval (GA) + gated posting (beta).
**Outcomes:** official lead-retrieval; AgentCore Browser microVM runtime; SQS + per-tenant Secrets; HITL 2FA; audit; kill switch; legal sign-off.
**Depends:** REF-E30,E01. **Ref:** `07`,`19`

### REF-E33 · Reporting Projection & Analytics
**Goal:** real analytics beyond counts.
**Outcomes:** Aurora Serverless v2 (RLS) event-fed projection; Analytics MCP; dashboards; ROI/attribution.
**Depends:** REF-E10. **Ref:** `16`,`05`

### REF-E34 · Credit Billing & Add-On Packs
**Goal:** monetize AI in business units.
**Outcomes:** credit plans live; overage/add-on packs (voice/marketing/automation); Razorpay ≤₹15k auto-debit; usage dashboard; "AI employee included" repackaging.
**Depends:** REF-E16. **Ref:** `17`

### REF-E35 · Consented Outbound Voice at Scale
**Goal:** compliant outbound qualification campaigns.
**Outcomes:** DLT/140-series; consent + DND; batch outbound; voice-as-journey-step.
**Depends:** REF-E22,E20. **Ref:** `12`

---

## Phase 4 — Agency OS at Scale

### REF-E40 · Mobile App · REF-E41 · Multi-Agent Orchestration & LangGraph sub-flows · REF-E42 · Future Property Experience (3D) pilots · REF-E43 · Partner/Product MCP Surface · REF-E44 · Autonomy Expansion & Continuous Eval.
**Ref:** `02`,`03 §9`,`04`,`05 §6`

---

## Epic Dependency Map (high level)
```
E00,E01,E03 ──► E02 ──► E10 ──► E11 ──► E12 ──► E13 ──► E14 ──► E15
                          │                       │
                          └─► E16            E20,E21 ──► E22, E23, E24
                                                  │
                                          E30 ──► E31, E32, E33, E34, E35
                                                  │
                                                  └─► E40–E44
```
