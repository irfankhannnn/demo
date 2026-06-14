# 15 — Security Architecture

> **Scope:** enterprise-grade, multi-tenant security model — identity, RBAC, tenant/credential/agent isolation, secrets, encryption, audit, and compliance. Builds on the existing Cognito auth microservice (`01 §3.4`). Research verified June 2026 (`20`).

---

## 1. Posture Today (start point)
Good foundations: Cognito-based auth microservice (phone OTP + Google + PKCE, refresh in httpOnly cookie), **server-derived tenant id** (anti-spoofing), recent hardening (CORS allowlist, security headers, auth rate-limiting, timing-safe key compares, structured logging). **Two material gaps:** (1) RBAC is only 2-tier (ADMIN/MEMBER) — too coarse for an agency OS; (2) **hardcoded production secrets in `ai-calling-service/deploy-lambda.ps1`** committed to the repo. Both are addressed below.

## 2. Immediate Remediation (do now — `19`, `24`)
🔴 **Rotate and remove the hardcoded Exotel/ElevenLabs/CRM/Bedrock secrets** in `ai-calling-service/deploy-lambda.ps1`; move to Secrets Manager; purge from git history; add pre-commit secret scanning (gitleaks) + CI secret scanning. This is the top security action.

## 3. Identity & Authentication
- **Stay on Amazon Cognito** (lowest-cost path since already integrated; Essentials $0.015/MAU with 10k free). Keep phone OTP + Google + PKCE.
- **Agent/machine identity:** each agent and service uses a **Cognito M2M** app client (now cheap: $0.00225/1k token requests after AWS removed the $6/client/mo fee in Nov 2025), scoped per tenant + permission set. AgentCore **Identity** manages OAuth tokens to external tools (WhatsApp/portals) in a secure vault when adopted.
- **Sessions:** short-lived id/access tokens, refresh in httpOnly cookie (current pattern); rev"oke on role change.

## 4. RBAC — from 2-tier to an agency role model
Extend the auth service + domain layer to a real role/permission model:

| Role | Scope |
|---|---|
| **Owner** | Full tenant: all data, config, billing, automation, team |
| **Manager** | Their team(s): data, assignment rules, reports |
| **Team Lead** | Their team's leads/agents |
| **Agent (RM)** | Own assigned leads/contacts/visits only |
| **AI Agent (machine)** | Scoped to the user/context it serves — **never exceeds** that principal's permissions |

- **Permission model:** resource × action (lead/contact/property/visit/khata/automation/marketing × create/read/update/delete/assign/export), grouped into roles; **region/team scoping** as an additional dimension (an agent sees only their territory).
- **Enforcement is server-side in the domain layer and MCP tools** (`05 §4`) — frontend gating is UX only. Tenant id always server-derived. Agents carry scope claims; tools assert `scopes ⊇ required`.
- This is the natural extension of the `auth_rbac_feature` branch already in flight.

## 5. Multi-Tenant Isolation (defense in depth)
| Dimension | Mechanism |
|---|---|
| **Data** | DynamoDB `TENANT#` partition keys (existing); Aurora **Row-Level Security** when adopted (`16`); metadata filters in Bedrock KB (`14`) |
| **Credentials** | Secrets Manager namespaced per tenant; per-tenant **KMS** data keys; resolved only for the calling tenant |
| **Agents** | Per-tenant M2M identity + scope; agent memory keyed by tenant; no cross-tenant context |
| **Automation** | Isolated browser **microVMs** per session (`07`), per-tenant queues |
| **Conversations** | Tenant-keyed Conversation/Message stores; channel tokens per tenant |
| **Billing/usage** | Metered + isolated per tenant (`17`) |

## 6. Secrets & Encryption
- **Secrets Manager** for all third-party credentials (channel tokens, portal logins, voice/telephony keys, API keys). At scale, manage the $0.40/secret cost via **per-tenant JSON secrets** or KMS-encrypted DynamoDB items rather than thousands of individual secrets.
- **KMS** ($1/key/mo): per-tenant customer-managed keys for sensitive fields (KYC docs, financial data); AWS-managed keys for low-sensitivity at-rest.
- **Encryption everywhere:** TLS in transit; DynamoDB/S3/Aurora at rest; KYC docs in tenant-prefixed S3 with PITR/versioning (currently missing — enable).

## 7. Audit & Observability (security-relevant)
- **Immutable audit log** for every privileged action (user or agent): who/what/tenant/tool/args-redacted/outcome/cost — feeds compliance and billing (`17`).
- **CloudTrail** on API Gateway, **API Gateway access logs** (currently off — enable), **WAF** in front of public APIs (currently none).
- LLM-action traces (`04`) included in audit for explainability.

## 8. Network & Platform Hardening (from `TODO_PRODUCTION_READINESS`)
Tighten API Gateway CORS gateway-responses off `*`; replace the ineffective in-memory rate limiter with **API Gateway throttling + WAF rate rules**; enable DynamoDB **PITR**; S3 **versioning** + block-public; VPC + PrivateLink for AgentCore/Bedrock when adopted; least-privilege IAM per service (already mostly in place).

## 9. Compliance
- **DPDP Act 2023 (India):** consent capture for lead/customer data, purpose limitation, data-subject access/deletion (the **grievance flow already implements** the DPDP request path), 7-day SLA, breach process. Self-hosting channels (Chatwoot) + data in our AWS keeps PII controlled.
- **RERA-awareness** for property claims in marketing/sales content.
- **Telephony:** DLT/TCCCPR consent + DND (`12`).
- **Data residency:** keep India tenant PII in **ap-south-1**; Dubai tenants may require separate handling (note for later).
- **Recording/consent** for voice; retention policies.

## 10. Agent-Specific Threats & Mitigations
| Threat | Mitigation |
|---|---|
| Prompt injection (via inbound messages/docs) | Treat all external content as untrusted; tools enforce permissions regardless of prompt; no secret/credential in agent context; output filters |
| Agent over-action | Scoped M2M identity; HITL gates on high-stakes actions; circuit breakers; per-tenant budget/rate caps |
| Data exfiltration via tools | Tenant-derived scope on every tool; egress audit; DLP on outbound content |
| Cross-tenant leakage | Tenant id never an argument; isolation tests in CI |
| Runaway cost | Budget guards, loop limits, model caps (`17`) |

## 11. Phasing
- **P0/P1:** rotate secrets + scanning; fine-grained RBAC + region/team scoping; WAF + API GW logs + throttling; PITR/S3 versioning.
- **P2:** agent M2M identities + scoped MCP enforcement; immutable audit log; per-tenant KMS for sensitive fields.
- **P3:** AgentCore Identity/Policy, VPC/PrivateLink, prompt-injection defenses at scale, formal DPDP tooling.
