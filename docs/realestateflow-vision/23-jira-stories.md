# 23 — Jira Stories

> **Scope:** representative, ready-to-refine user stories per epic (`22`), with acceptance criteria. Not exhaustive — it covers Phase 0–2 in implementable detail (the near-term work) and samples Phase 3–4. Format: **As a [role], I want [capability], so that [value].** AC = acceptance criteria. SP = rough story points.

---

## REF-E00 · Security Remediation
- **REF-E00-S1** (SP5) As the platform team, I want all hardcoded secrets removed from `ai-calling-service/deploy-lambda.ps1` and rotated, so that credentials aren't exposed. **AC:** secrets in Secrets Manager; script reads from env/Secrets; old keys rotated/revoked; git history purged; `gitleaks` pre-commit + CI scan blocks new secrets.
- **REF-E00-S2** (SP3) As an operator, I want WAF + API Gateway access logs + throttling, so that the public APIs are protected. **AC:** WAF rate rules live; access logs to CloudWatch; in-memory limiter removed; 429s on abuse.
- **REF-E00-S3** (SP2) As an operator, I want DynamoDB PITR and S3 versioning enabled, so that data is recoverable. **AC:** PITR on all tables; versioning + lifecycle on docs bucket.

## REF-E01 · Fine-Grained RBAC
- **REF-E01-S1** (SP8) As an agency owner, I want roles (Owner/Manager/Team-Lead/Agent), so that staff see only what they should. **AC:** roles assignable; permission matrix enforced server-side; SPA gates UI; tests prove an Agent can't read another agent's leads.
- **REF-E01-S2** (SP5) As a manager, I want region/team scoping, so that territory data is isolated. **AC:** leads/contacts filtered by team/region; cross-scope access denied + audited.
- **REF-E01-S3** (SP5) As the platform, I want agent M2M identities scoped per tenant, so that agents never exceed their principal's permissions. **AC:** Cognito M2M clients; scope claims; MCP tools assert scope; isolation test passes.

## REF-E02 · Domain API & MCP Foundation
- **REF-E02-S1** (SP8) As an agent developer, I want Lead/Property/CRM/Visit endpoints exposed as MCP tools via Gateway, so that agents can act through governed tools. **AC:** tools discoverable; tenant derived from token (not args); audited; idempotency keys on mutations.
- **REF-E02-S2** (SP3) As the platform, I want a `tenant-index` GSI (PK=tenantId, SK=EntityType), so that reads stop scanning. **AC:** GSI live; hot read paths use Query not Scan; latency improved.
- **REF-E02-S3** (SP3) As the platform, I want Conversation/Message tables + a feature-flag service, so that the backbone and gated rollout exist. **AC:** tables with tenant keys + GSIs; per-tenant flags toggle engines.

## REF-E03 · CI/CD & Observability
- **REF-E03-S1** (SP8) As the team, I want an automated build/test/deploy pipeline per env, so that releases are safe and fast. **AC:** GitHub Actions deploy with approvals; dev/staging/prod; rollback; IaC consolidated.
- **REF-E03-S2** (SP5) As an operator, I want an immutable audit log of privileged user/agent actions, so that we have compliance + cost data. **AC:** every tool call logged (tenant/identity/action/cost); tamper-evident; queryable.

## REF-E10 · Conversation Backbone
- **REF-E10-S1** (SP8) As the platform, I want inbound messages normalized to a `MessageReceived` event on EventBridge with SQS work queues, so that channels are decoupled from processing. **AC:** dedup via Redis; per-tenant queues; DLQ + retry/backoff.
- **REF-E10-S2** (SP5) As the platform, I want a Conversation Orchestrator that resolves contact, opens a thread, and routes to an agent, so that every message is handled. **AC:** contact merged across channels; thread persisted; routed by Haiku classifier.

## REF-E11 · Omnichannel Ingestion
- **REF-E11-S1** (SP8) As an agency, I want to connect my WhatsApp number via embedded signup, so that customer chats flow into the platform. **AC:** WABA connected (AiSensy/Embedded Signup); inbound webhook → backbone; outbound within 24h window; opt-in recorded.
- **REF-E11-S2** (SP5) As a website visitor, I want a chat widget, so that I can ask about properties. **AC:** embeddable widget; session → backbone; lead created on capture.
- **REF-E11-S3** (SP3) As an agency, I want Meta Lead Ads synced, so that ad leads enter the CRM instantly. **AC:** lead form retrieval + webhook; dedup; instant follow-up trigger; attribution stamped.

## REF-E12 · AI Sales Assistant
- **REF-E12-S1** (SP8) As a prospect, I want accurate answers about projects/pricing/floor plans, so that I can decide. **AC:** answers sourced only from Property/Knowledge/Document MCP; no invented facts; citations where applicable; <60s first response.
- **REF-E12-S2** (SP5) As a prospect, I want to book a site visit in chat, so that I don't have to call. **AC:** `schedule_visit` creates CRM visit + confirmation + reminder; conflict handling.
- **REF-E12-S3** (SP3) As an agency, I want AI replies to wait for my approval by default, so that I stay in control. **AC:** autonomy Level 0/1; agent action inbox (dashboard + WhatsApp); one-tap approve; timeout to safe default.
- **REF-E12-S4** (SP3) As the platform, I want the assistant to escalate to a human when unsure, so that we never bluff. **AC:** low-confidence/unknown → "don't know" + Task created + human notified.

## REF-E13 · Qualification
- **REF-E13-S1** (SP8) As an agent, I want leads progressively profiled (budget/timeline/location/config/purpose), so that I get qualified leads. **AC:** Qualifier extracts slots per turn; updates Lead; asks one next-best question; no interrogation.
- **REF-E13-S2** (SP3) As the platform, I want enrichment from ad/portal/prior chats before asking, so that we minimize questions. **AC:** known fields pre-filled; only gaps asked.

## REF-E14 · Scoring
- **REF-E14-S1** (SP5) As an agent, I want leads banded Hot/Warm/Cold with reasons, so that I prioritize. **AC:** weighted model + Haiku signals; reasons stored; recompute on events; recency decay.
- **REF-E14-S2** (SP3) As an owner, I want to tune weights/thresholds, so that scoring fits my business. **AC:** per-tenant config; changes recompute; override allowed.

## REF-E15 · Assignment
- **REF-E15-S1** (SP8) As a manager, I want a configurable assignment rule chain, so that leads reach the right agent. **AC:** round-robin/region/project/team/quality; capacity + availability respected; manager-queue fallback.
- **REF-E15-S2** (SP5) As a manager, I want SLA timers with auto-escalation, so that no lead rots. **AC:** timer per band; breach → reassign/escalate + notify; logged.

## REF-E16 · Metering & Cost Guards
- **REF-E16-S1** (SP5) As the business, I want every AI action metered to a credit ledger, so that we control cost and can bill. **AC:** Lago consumes audit events; tokens/minutes/messages→credits; per-tenant balance.
- **REF-E16-S2** (SP3) As the platform, I want per-tenant budget caps + circuit breakers, so that runaway usage can't destroy margin. **AC:** soft warn + hard cap; loop limits; alerts.

## REF-E20 · Follow-Up
- **REF-E20-S1** (SP8) As an agency, I want automated multi-touch nurture journeys, so that leads convert without manual chasing. **AC:** Step Functions journeys; branch on engagement; grounded touchpoints; stops on takeover/conversion; channel-cost-aware.

## REF-E21 · Knowledge/RAG
- **REF-E21-S1** (SP8) As an agency, I want to upload brochures/FAQs and have AI answer from them with citations, so that answers are accurate. **AC:** Bedrock KB + S3 Vectors; per-tenant metadata filter; citations; versioned re-ingestion.

## REF-E22 · Voice
- **REF-E22-S1** (SP8) As a prospect, I want to call and get answers/book visits in Hindi/Hinglish, so that I'm helped 24/7. **AC:** inbound via Exotel; ElevenLabs agent grounded via MCP; visit booked; human transfer on request; recording + consent.
- **REF-E22-S2** (SP5) As an agency, I want automated reminder calls, so that visits aren't no-shows. **AC:** journey-triggered transactional calls (1600-series); outcome logged to CRM.

## REF-E23 · IG/FB · REF-E24 · Strands
- **REF-E23-S1** (SP5) As a prospect commenting on a reel, I want an auto DM with details, so that I engage. **AC:** comment→private-reply DM (1/comment); → backbone; lead captured.
- **REF-E24-S1** (SP8) As an owner, I want to ask my WhatsApp "aaj ke hot leads bhejo", so that I run the agency from chat. **AC:** Agency-Command agent (RBAC-scoped) queries Analytics/CRM MCP; formatted reply; only owner's data.

## Phase 3–4 samples
- **REF-E31-S1** (SP8) As an agency, I want to generate + schedule 3 on-brand reels for a project by command, with approval. **AC:** Marketing MCP generates (Higgsfield/Remotion) grounded in brand+inventory; review gate; scheduled via Blotato; metered.
- **REF-E32-S1** (SP8) As an agency, I want portal leads pulled into the CRM automatically. **AC:** official push/email ingestion; dedup; routed; (posting remains gated per `07`).
- **REF-E33-S1** (SP8) As an owner, I want a pipeline/ROI dashboard. **AC:** Aurora projection (RLS); funnel by band/source/agent; channel CAC/ROI.
- **REF-E34-S1** (SP5) As a customer, I want plans with included AI credits + top-up packs. **AC:** credit entitlements; Razorpay ≤₹15k auto-debit; packs; usage dashboard.
- **REF-E40-S1** (SP13) As an agent on-site, I want a mobile app to capture leads/visits. **AC:** Capacitor app; offline capture; sync; push.

---

## Cross-Cutting (Definition of Done — applies to every story)
- Tenant isolation enforced + tested (no cross-tenant access).
- Server-side RBAC enforced; agent actions audited with cost.
- Grounding respected (no invented facts) for any customer-facing AI.
- Behind a feature flag; piloted before broad rollout; autonomy starts at approval-queue.
- Tests (unit + Playwright/E2E where UI); observability + alarms; docs updated.
- Compliance checks (DPDP/DLT/Meta policy) where the story touches data/messaging/voice.
