# 19 — Risk Analysis

> **Scope:** the risks that can sink or slow RealEstateFlow's evolution, with likelihood × impact and concrete mitigations. Cross-references the relevant design docs.

---

## 1. Risk Register (ranked by exposure)

| # | Risk | Likelihood | Impact | Exposure | Mitigation | Ref |
|---|---|---|---|---|---|---|
| R1 | **Hardcoded production secrets in repo** (Exotel/ElevenLabs/CRM/Bedrock in `deploy-lambda.ps1`) | **Certain (present)** | High | 🔴 Critical | Rotate now; move to Secrets Manager; purge git history; secret scanning in pre-commit + CI | `15`,`24` |
| R2 | **Portal automation ToS / legal exposure** (99acres/MagicBricks bot-block; no official upload API; IT Act/Copyright risk) | High | High | 🔴 Critical | Build official lead-retrieval first; gate posting, per-tenant consent, HITL, kill switch; pursue partnerships; legal review | `07` |
| R3 | **AI hallucination** quotes wrong price/availability → reputational/financial harm | High | High | 🔴 Critical | Tool-gated facts; "don't-know→task"; citations; eval harness; HITL on high-stakes | `04`,`09`,`14` |
| R4 | **Runaway AI cost** destroys margin | Medium | High | 🟠 High | Haiku-first; prompt caching; per-tenant budget caps + circuit breakers; metering | `17`,`04` |
| R5 | **Telephony/messaging compliance breach** (DLT/TCCCPR/DND; WhatsApp policy; quality-rating drop) | Medium | High | 🟠 High | Consent capture; 140/1600 series; DND scrubbing; in-window messaging; template discipline; rate limits | `08`,`12` |
| R6 | **DPDP / data-privacy violation** (lead PII mishandled) | Medium | High | 🟠 High | Consent + purpose; data-subject access/deletion (grievance flow); self-host channels; KMS; residency | `15`,`08` |
| R7 | **Scope creep / over-engineering** (build agents/EKS/OpenSearch too early) | **High** | Medium | 🟠 High | T0/T1-first discipline; defer EKS/OpenSearch; one engine to GA at a time; flags | `04`,`16`,`18` |
| R8 | **Small team overwhelmed** by surface area (8 engines, many integrations) | High | Medium | 🟠 High | Strangler-fig sequencing; managed services lazily; reuse existing assets; ruthless prioritization | `18`,`21` |
| R9 | **Multi-tenant isolation failure** (cross-tenant data/credential leak) | Low | Critical | 🟠 High | Server-derived tenant everywhere; isolation tests in CI; per-tenant secrets/KMS; microVM browsers | `15`,`05` |
| R10 | **Vendor pricing/feature change** (AgentCore/ElevenLabs/WhatsApp/models) | Medium | Medium | 🟡 Med | MCP/A2A standards keep models/runtime swappable; multi-option designs (managed+self-host); reconfirm pricing | `12`,`20` |
| R11 | **Prompt injection** via inbound messages/documents | Medium | Medium | 🟡 Med | Untrusted-content handling; tool-permission enforcement regardless of prompt; no secrets in context; output filters | `15` |
| R12 | **RBAC too coarse** for team-scoped agency use blocks adoption | Medium | Medium | 🟡 Med | Fine-grained role/region model early (already in-flight on `auth_rbac_feature`) | `15` |
| R13 | **No automated deploy pipeline** → slow, error-prone releases | High | Low–Med | 🟡 Med | Build CI/CD early; consolidate IaC; feature flags | `16` |
| R14 | **WhatsApp per-message cost** balloons if conversations leave free window | Medium | Medium | 🟡 Med | <60s response SLA keeps 24h window open; Utility>Marketing; monitor cost/conversation | `08`,`17` |
| R15 | **Chatwoot shared-DB isolation** insufficient for strict tenancy | Medium | Medium | 🟡 Med | Treat CRM as source of truth; per-tenant/shard Chatwoot or raw adapters if needed | `08` |
| R16 | **Voice quality/latency in Hindi/Hinglish** disappoints | Medium | Medium | 🟡 Med | Pilot both stacks; human transfer; HITL; measure CSAT | `12` |
| R17 | **India auto-debit cap (₹15k)** complicates higher-tier billing | Medium | Low–Med | 🟡 Med | Keep auto-debit ≤₹15k; credit packs; invoicing for enterprise | `17` |
| R18 | **Pricing-figure drift** (research figures from 403-blocked pages) | High | Low | 🟢 Low | Reconfirm all $ before budgeting; figures flagged in `20` | `20` |

## 2. Top-5 Watchlist (founder attention)
1. **R1 secrets** — fix this week; it's an active exposure.
2. **R2 portal legal** — a go/no-go business decision, not just engineering; get legal input before shipping posting.
3. **R3 hallucination** — the product's credibility depends on grounding; invest in the eval harness early.
4. **R7/R8 over-engineering & team load** — the most likely way this stalls is building too much too soon; enforce T0/T1-first and one-engine-to-GA.
5. **R5/R6 compliance** — India telephony + DPDP are non-negotiable; bake in from day one, not retrofitted.

## 3. Risk-Adjusted Guidance
The biggest *technical* risks (isolation, hallucination, cost) are all manageable with patterns already chosen in this plan. The biggest *non-technical* risks (portal legality, compliance, team bandwidth, over-engineering) require **discipline and business judgment** more than code. The architecture deliberately reduces exposure by **reusing the proven core, deferring heavy infra, standardizing on swappable protocols, and gating every autonomous capability behind approval queues and budgets.**
