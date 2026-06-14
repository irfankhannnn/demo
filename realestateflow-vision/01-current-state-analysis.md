# 01 — Current-State Analysis

> **Source:** Direct analysis of branch `auth_rbac_feature` (HEAD `8079683`, "Security fixes: CORS, error handling, rate limiting, timing attacks, structured logging"). **Date:** 2026-06-12.
> This document describes **what exists today**, grounded in the code. It is deliberately honest about gaps. The vision (`02`) and target architecture (`03`+) build on this.

---

## 1. Executive Summary

The product today (brand: **RealEstateFlow** / RealtyFlow; legacy repo name "Cloudberry Real Estate") is a **production-grade, multi-tenant real-estate CRM SaaS** on AWS serverless, plus three adjacent systems in varying states of maturity:

1. **CRM platform** — React/TS SPA + Express-on-Lambda + DynamoDB single-table, ~150 endpoints, multi-tenant, with a recently redesigned data model (lead → transaction → account lifecycle), Cognito auth, RBAC (2-tier), KYC document handling, accounting ("Khata"), billing (Razorpay), and a launch/GTM apparatus. **This is the mature core.**
2. **AI Calling Service** — a separate Lambda microservice (Exotel + ElevenLabs + Bedrock KB) that is **built but disabled** before launch (`DISABLED_FEATURES.md`; internal routes not mounted).
3. **"AI Employee" (SyncBot)** — an OpenClaw-style natural-language CRM operator: 6 skills of `npx tsx` CLI scripts that call the CRM REST API. Provisioned **manually by a human with a 24h SLA** (there is no autonomous always-on runtime yet).
4. **Marketing automation system** — an extensive agent/skill/MCP apparatus (20 agent personas, 60+ skills, Higgsfield/Meta-Ads/Blotato MCPs) and a 24-week GTM plan. This is **content/ops tooling for the founding team**, not a tenant-facing product feature.

**The honest gap between today and the vision:** the platform is a *CRM with AI features bolted on the side*, most of them off. The vision (`02`) is an *AI agency operating system where the CRM is one subsystem*. There is **no WhatsApp integration in the product** (only AiSensy used for outbound onboarding broadcasts and a founder-escalation number), **no omnichannel lead acquisition, no qualification/scoring/assignment engines, no live AI agents, no browser automation, no RAG beyond the disabled calling service.** The good news: the foundations (multi-tenancy, auth, data model, billing, telephony plumbing, Bedrock access) are real and reusable.

## 2. System Inventory

| Subsystem | Path | State | Reuse verdict |
|---|---|---|---|
| CRM SPA | `real-estate-crm-app/` | Mature (50+ pages, 39 components) | **Keep & extend** |
| CRM backend API | `server/` | Mature (~150 endpoints, 23 route files) | **Keep; refactor into domain API** |
| Auth microservice | `reality-flow-authentication/` | Mature (Cognito, phone OTP, Google, invites) | **Keep** |
| Onboarding tool | `onboarding-page/` | Legacy, superseded by auth service | Retire |
| AI Calling | `ai-calling-service/` | Built, **disabled** | **Re-enable & evolve** (basis of `12`) |
| AI Employee (SyncBot) | `ai-employee/` | Prototype, human-provisioned | **Evolve into agent runtime** (`04`) |
| Marketing system | `claude-skills/`, `marketing-and-sales/`, `marketing/` | Founder tooling | Keep as internal; productize selectively (`13`) |
| Remotion video | `my-video/`, `first-video/` | Empty placeholders on this branch | N/A yet |
| Cron jobs | `cron/` | 3 EventBridge jobs (escalation, trial, demo reset) | Keep |
| Tests | `tests/playwright/` | ~20 E2E specs | Keep & expand |

## 3. CRM Core — Detailed Current State

### 3.1 Backend (`server/`)
- **Runtime:** Express app, dual-mode: local/container (`server.js`) and AWS Lambda via `@vendia/serverless-express` (`lambda-handler.js`), `nodejs20.x`, 512MB, 30s.
- **Two API Gateway REST APIs:** a **Public API** (`/realestateagency`, no auth — enquiry/contact/B2B forms) and a **CRM API** (`/realestatecrm`, JWT-authenticated), both on `services-api.cloudberrysolutions.in`, region `ap-south-1`. `{proxy+}` greedy integration.
- **Middleware chain:** CORS (allowlist) → request-id → request logging → billing webhook (raw body, pre-JSON) → body parsers (1MB) → static → rate limiting (in-memory, 100/min/IP) → security headers (CSP/HSTS/X-Frame) → per-route `validateToken` → per-route `extractTenantId` → error handler.
- **~150 endpoints across 23 route files.** Mounted & live: `crm` (customers/owners/properties/meetings/metrics), `contacts` (unified multi-role), `leads`, `buyers`, `enquiries`, `b2bLeads`, `khata` (accounting), `notifications`, `grievance` (DPDP Act), `billing`, `subscriptions`, `feedback` (NPS), `aiEmployeeStatus`, `areas`. **Disabled/not mounted:** `aiCallingInternal`, `developers`, `projects`, `realEstateAreas`, `buildings`/`flats` (per `DISABLED_FEATURES.md`).

### 3.2 Data model (recently redesigned — see `IMPLEMENTATION_COMPLETE.md`, `CRM_REDESIGN_ARCHITECTURE.md`)
The model was deliberately shifted from *prospect-tracking* to *post-transaction customer management*:
- **Lead** (prospect; type buyer/seller/tenant/owner; status new→contacted→qualified→negotiating→converted→lost; priority; source; requirement sub-objects) → **converts to** →
- **Buyer** (`purchases[]`: saleAmount, registration, stamp duty, brokerage, loan details), **Tenant/Customer** (`currentRental{}` + `rentalHistory[]`), **Owner** (bank details, portfolio), **Contact** (unified, multi-role).
- **Property** with a real lifecycle status (`available → for-sale/for-rent → sold/rented → vacant`), `saleInfo`/`rentalInfo`, plus title/OC/tax document S3 keys.
- **SELLER entity deleted**; seller-lead now becomes Owner + Property(for-sale).
- KYC everywhere: `photoS3Key`, `panDocS3Key`, `aadharDocS3Key` + presigned-URL retrieval.

### 3.3 Frontend (`real-estate-crm-app/`)
- React 18 + TS 5 + Vite 5 + Tailwind; React Router 7; Context API (Subscription, GoogleMaps) — no Redux. Capacitor configured for mobile (build exists, not primary). PostHog + Sentry. Google Maps.
- 50+ pages (lead/buyer/tenant/owner/property/contact/enquiry/B2B/developer/project/khata/calendar/hierarchy/analytics/admin/auth/public). `api.ts` is a 2000-line client; injects `Authorization: Bearer <idToken>` + `x-tenant-id`; auto-refresh on 401.
- **Mobile-first responsive pass incomplete** (~5 of 37 pages done per `MOBILE_FIRST_UPDATES.md`).

### 3.4 Auth & RBAC (`reality-flow-authentication/` + `server` middleware) — the `auth_rbac_feature` branch focus
- **Cognito-based**, separate microservice (own Lambda + CFN). Phone OTP via Cognito Custom Auth (Define/Create/Verify challenge Lambdas + SNS SMS), Google OAuth, PKCE. Refresh token in **httpOnly cookie**; id/access tokens in localStorage.
- **Member multi-identity:** one user can hold email + phone identities, auto-linked; global uniqueness enforced (`MEMBER_MULTI_IDENTITY_TEST.md`).
- **Tenant model:** `tenantId = admin's Cognito sub`. Server-derived tenant only (`extractTenantId` rejects client `x-tenant-id` when authenticated) — good isolation posture.
- **RBAC is intentionally minimal: 2 tiers.** Frontend `rbac.ts`: ADMIN = full CRUD; MEMBER = create/read/update, no delete. Backend `requireRole`/`requireAdmin`/`requireAdminOrManager` recognizes ADMIN/FOUNDER/OWNER/MANAGER/MEMBER but enforcement is coarse. **This is the single biggest gap for an "agency OS"** which needs team/region/role-scoped data access (see `15`).

### 3.5 Billing (`routes/billing.js`, `subscriptionService.js`)
- **Razorpay** subscriptions. Plans: solo ₹999/1-seat, team ₹1,999/3, teamplus ₹4,999/5, free, plus an "AI Employee" add-on (~₹5,000/mo, human-provisioned). 14-day trial auto-created on signup.
- Webhook: HMAC-SHA256 verify, 5-min replay window, **idempotent** via `WebhookLog` table. Events drive provisioning rows, Brevo emails, AiSensy WhatsApp broadcasts, PostHog. Seat-cap paywall (402) enforced.

### 3.6 Integrations in use today
Brevo (email), Razorpay (billing), **AiSensy (WhatsApp — outbound onboarding broadcasts + founder escalation only, NOT a product channel)**, PostHog (analytics), Sentry (errors), hCaptcha (grievance form), Google Maps, Exotel + ElevenLabs + Bedrock (in the disabled calling service), Higgsfield/Meta-Ads/Blotato (marketing MCPs, founder-side).

## 4. AI Calling Service — Built but Disabled

A standalone Lambda microservice (`ai-calling-service/`, own CFN stack, `ai-calling-data` single table, knowledge + recordings S3 buckets, Secrets Manager). Flow: CRM/UI → start call → fetch lead context from CRM internal API → ElevenLabs Conversational AI session (system prompt with `[NEED_DATA: INTENT]` markers) → Exotel outbound (`connect.json`, tenant in `CustomField`) → status + intent webhooks → **regex-based** intent detection (`intentService.js`) → data routing to CRM API or Bedrock KB (`anthropic.claude-3-sonnet`) → `injectContext` back to ElevenLabs → transcripts to DynamoDB. **Disabled before launch**; the CRM-side internal routes (`aiCallingInternal.js`) are not mounted. This is a strong, reusable basis for `12-voice-architecture.md`, but intent detection is brittle (regex) and would be replaced by an LLM/agent.

## 5. "AI Employee" (SyncBot) — Prototype, Human-Provisioned

`ai-employee/` is an **OpenClaw-style** agent persona (`IDENTITY.md`/`SOUL.md`/`AGENTS.md`/`MEMORY.md`) with **6 skills** (lead/buyer/tenant/owner/property/contact management), each a folder of `npx tsx` TypeScript CLI scripts that call the CRM REST API with `x-api-key` + `x-tenant-id`, plus `references/` docs. It encodes useful business rules (money normalization "80L→8000000", area-specificity prompts, confirmation gating, `responseMode` verbosity). **Critically: there is no always-on runtime and no WhatsApp wiring.** The "AI Employee" sold to customers is fulfilled by a **human within a 24h SLA** (`aiEmployeeProvisioningService.js`, `AIEmployeeProvisioning` table, 6-hourly escalation cron to founder email + WhatsApp). So the product *promises* an AI employee but currently *delivers* a manually-onboarded one. Closing this gap is the heart of the vision (`04`, `08`).

## 6. Marketing & Agent/Skill System — Founder Tooling

`claude-skills/` (20 agent personas across 6 teams + orchestrator; ~23 local skills + ~41 referenced marketing skills; cowork variants), `marketing-and-sales/` (24-week GTM plan, ₹20L budget, 3 personas Priya/Arjun/Suresh, landing pages, outreach templates, lead lists), and `.mcp.json` MCPs (`higgsfield` image/video, `meta-ads` campaigns, `blotato` social publishing, `git`). `skills-lock.json` pins one external skill (`huashu-design`). **This is internal go-to-market tooling run by the founding team via Claude**, not a multi-tenant product capability — an important distinction for the vision, which proposes productizing a *subset* (content/marketing engine) per-tenant (`13`).

## 7. Infrastructure & Deployment

- **All AWS, `ap-south-1`, serverless.** 3 CloudFormation stacks (backend, ai-calling, auth). Lambda + API Gateway (2 REST APIs, custom domain) + DynamoDB (PAY_PER_REQUEST, `DeletionPolicy: Retain`) + S3 + Cognito + SNS (SMS) + EventBridge (3 crons) + CloudWatch. Bedrock used by calling service.
- **~15 DynamoDB tables** (core, crm, agencies, areas, enquiries, b2b, khata, notifications, developers, communities, projects, Subscriptions, NPSResponses, WebhookLog, AIEmployeeProvisioning, TenantApiKeys, Grievances).
- **CI/CD is thin:** a single GitHub Actions workflow (`playwright.yml`) that builds the CRM and runs Playwright on PRs/`main`. **No automated deploy pipeline** — deploys are manual `deploy.sh`/`.ps1`.
- **Deploys frontends** to (per docs) `app.realestateflow.in` (CRM), `www.realestateflow.in` (marketing), `demo.realestateflow.in` (reset nightly).

## 8. Security Posture (as of HEAD commit)

Recent hardening (commit `8079683`): CORS restricted to `ALLOWED_ORIGINS`, generic prod error messages, security headers, **auth rate limiting** (OTP start 3/15min, confirm 5/15min, token/refresh 10/15min), **timing-safe** internal API-key comparison, structured logging replacing 71+ `console.log`. Server-derived tenant id. Good.

**Outstanding issues found:**
- 🔴 **Hardcoded production secrets in `ai-calling-service/deploy-lambda.ps1`** (Exotel keys/token/SID, ElevenLabs key, CRM internal API key, Bedrock KB id) committed to the repo. **Must be rotated and moved to Secrets Manager** (tracked in `15` and `19`).
- 🟠 In-memory rate limiter is per-Lambda-instance — ineffective across concurrent invocations; needs API Gateway throttling / WAF / shared store.
- 🟠 API Gateway CORS gateway-responses use `*`; tighten.
- 🟠 No DynamoDB PITR / no S3 versioning on docs bucket / no WAF / no API Gateway access logs (per `TODO_PRODUCTION_READINESS.md`).
- 🟠 RBAC too coarse for multi-agent, team-scoped agency use.

## 9. Known Gaps vs. a Full Agency OS (feeds the roadmap)

| Capability the vision needs | Today |
|---|---|
| WhatsApp as a product channel (inbound conversations) | ❌ None (AiSensy is outbound-broadcast only) |
| Instagram/Facebook/Telegram/web-chat acquisition | ❌ None |
| Omnichannel conversation engine / unified inbox | ❌ None |
| Lead qualification / scoring / assignment engines | ❌ None (status/priority are manual fields) |
| Always-on AI sales assistant (grounded) | ⚠️ Disabled calling-only prototype + human SyncBot |
| Follow-up automation journeys | ⚠️ Only cron rent-expiry/trial emails |
| Live AI voice | ⚠️ Built, disabled |
| Knowledge base / RAG (general) | ⚠️ Only in disabled calling service |
| Browser/portal automation (99acres/MagicBricks) | ❌ None |
| Marketing engine as a tenant feature | ⚠️ Founder-side tooling only |
| Fine-grained RBAC / team & region scoping | ❌ 2-tier only |
| Reporting/analytics beyond counts | ⚠️ Basic metrics; DynamoDB scans (MED-1 TODO) |
| Observability for AI (traces, eval) | ❌ None |
| Usage metering / AI billing | ❌ Seat-based only |

## 10. Architectural Strengths to Build On

1. **Clean multi-tenant isolation** (`TENANT#` keys, server-derived tenant) — extends naturally to agents and automation.
2. **Separated auth microservice** with Cognito — the right place to add fine-grained RBAC and M2M for agents.
3. **A real, recently-rationalized domain model** — leads/contacts/properties/visits/khata already exist; agents need a clean API over them, not a rewrite.
4. **Telephony + Bedrock plumbing already proven** in the calling service.
5. **Idempotent webhook + provisioning patterns** already in place — reusable for channel webhooks and async automation.
6. **An existing "skills calling the CRM API" pattern** (SyncBot) that maps almost 1:1 onto the MCP-tools direction in `05`.

**Bottom line:** RealEstateFlow today is a solid multi-tenant CRM with the *scaffolding* of AI ambitions (telephony, Bedrock, an agent persona, a marketing rig) mostly switched off or founder-side. The path forward (`18`) is **strangler-fig evolution**, not rewrite: wrap the existing domain in clean APIs/MCP servers, stand up a real agent runtime and a WhatsApp-first acquisition engine on top, and turn the disabled pieces back on behind proper guardrails.
