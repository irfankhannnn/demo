# 21 — Roadmap: Phase A → B → C

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. The June "Phase 0–4, ≈Q1–Q4" plan is re-baselined as Phase A (M1 launch) → Phase B (hardening) → Phase C (growth), with no dates; most of what June called Phase 1–3 is already built, the Phase 4 mobile app shipped early, and the items the founder dropped (portal posting, tenant marketing agent, Telegram) are out.

> **Scope:** what is already done, what has to happen before taking payment, what has to happen before selling Team plans, and what comes after. No dates: the team is a solo founder plus AI agents and contractors (D20), so the order matters and the calendar does not. Checklist detail: `00-phase-0-prerequisites.md`. Summary for a new reader: `QUICK-START.md`.

**Status words used below:** **Done** (in code, with a path) · **Partly done** · **Not started** · **Dropped**.

---

## 1. Already Done (shipped before this re-baseline)

June put most of this in Phase 1–3, and the mobile app in Phase 4. It is in the repo today. Several services run on dev only; nothing is in front of a paying customer yet.

| Capability | Status | Where |
|---|---|---|
| Multi-tenant CRM: leads, contacts, properties, meetings, khata, billing | Done | `apps/crm/server/`, `apps/crm/real-estate-crm-app/` |
| Lead ingestion pipeline: adapters → `ingestLead()` → `lead.created` | Done | `apps/crm/server/leadIngestion.js`, `docs/lead-adapter-architecture.md` |
| Qualification (Hot/Warm/Cold rubric) and routing, on EventBridge | Done | `apps/crm/server/scripts/lead-qualifier-handler.js`, `lead-router-handler.js`, `utils/leadRubric.js` |
| Agent runtime: classify → plan → execute tools → compose, bounded tool loop, model gateway | Done (off unless `AGENTS_ENABLED=true`) | `apps/crm/server/agents/` |
| WhatsApp command channel for agency staff (Baileys) | Done | `services/whatsapp-platform/`, `apps/crm/server/routes/webhooks.js` |
| In-CRM web chat | Done | `apps/crm/server/routes/agentChat.js`, `agents/channels/webChannel.js` |
| Outbound AI calling (ElevenLabs + native Exotel), mid-call CRM tools | Done | `services/ai-calling-service/` |
| Follow-up call scheduling, retries and escalation | Done | `services/followup-agent-service/` |
| Call Intelligence: recording upload → transcription → AI review → approved actions | Done | `apps/crm/server/services/callIntelligence/`, `routes/callRecordings.js` |
| Knowledge / RAG: DynamoDB vector search + Titan v2 embeddings | Done | `apps/crm/server/services/embeddings/`, `services/knowledge/`, `infra/create-vector-index.sh` |
| One MCP server, 72 tools generated from the shared registry, own OAuth | Done | `services/reality-flow-mcp/`, `apps/crm/server/shared/toolDefinitions.js` |
| Credits: ledger, metering at the call site, 402 on a short balance, Razorpay packs, admin cost editor | Done | `apps/crm/server/creditService.js`, `creditConfig.js`, `middleware/meterCredits.js`, `routes/creditAdmin.js` |
| Instagram hosted service: OAuth connect, DMs, comments + private replies, keyword rules, insights, CRM hand-off | Done on dev; prod not deployed, Meta App Review pending | `apps/instagram/`, `docs/pending-items/instagram-service-status.md` |
| Public property pages + site-visit booking | Done | `apps/property-pages-ms/` |
| Click-to-call with role-based phone masking | Done | `apps/crm/server/routes/clickToCall.js`, `middleware/phoneMasking.js` |
| Launch compliance and growth plumbing: grievance portal, cookie consent, in-app account deletion, NPS, seat caps, paywall + trial countdown, demo tenant, team analytics with Excel export | Done | `apps/crm/server/routes/grievance.js`, `feedback.js`, `admin.js`, `utils/excel.js`; `components/CookieConsentBanner.tsx`, `NpsModal.tsx`, `SeatCounter.tsx`, `PaywallModal.tsx`, `DeleteAccountModal.tsx`; `docs/epics/EPIC-1..13-COMPLETION.md` |
| Mobile app: Capacitor 8 wrapper with Android and iOS projects, push tokens | Done (store submission pending) | `apps/crm/real-estate-crm-app/capacitor.config.ts`, `android/`, `ios/`, `apps/crm/server/services/push/`, `docs/launch/MOBILE_LAUNCH_YOUR_TASKS.md` |
| Infrastructure as code + tracked manual deploys into separate dev and prod accounts | Done | 17 CFN templates; `infra/cicd/<service>/deploy.sh`, `infra/cicd/README.md` |
| DynamoDB PITR on all CRM tables, S3 versioning | Done | `apps/crm/server/infra/cfn-backend.yaml` |
| CI test workflows (server jest + MCP drift, Instagram tests) | Done | `.github/workflows/server-tests.yml`, `insta-sol-ms-tests.yml` |

---

## 2. Phase A — M1 Launch

**Goal:** put what is built in front of the first Mumbai agencies and be able to take their money safely. Nothing new gets built here that is not on this list.

### A1 — Payment enforcement (must be done before taking payment)
- **Partly done.** `payment.failed` starts a 7-day grace and `subscription.cancelled`/`halted` update the Subscriptions table (`apps/crm/server/routes/billing.js`); the frontend paywall respects grace (`components/PaywallModal.tsx`).
- **Not started:** `subscription.charged` does not clear grace; `apps/crm/server/scripts/grace-period-expiry-cron.js` exists but is **not scheduled** in CloudFormation; there is no server-enforced read-only after grace ends (only the browser blocks). (D17, `29-payment-system-implementation.md`.)

### A2 — API protection (must be done before taking payment)
- **Not started:** API Gateway stage throttling, access logs, and restricting gateway-response CORS, which still returns `Access-Control-Allow-Origin: *` (`apps/crm/server/infra/cfn-backend.yaml`).
- **Partly done:** the app-level limiter is in-memory per Lambda instance (`apps/crm/server/middleware/rateLimiter.js`), so it does not hold across concurrent invocations. Throttling on the Instagram and property-pages APIs is already in their templates.
- WAF is **Phase B** (after the first customers), per D17.

### A3 — Keys
- **Partly done:** the leaking deploy script is deleted, env files are untracked, and secrets come from Secrets Manager / SSM.
- **Not started:** rotation of the Exotel, ElevenLabs, Gemini, Baileys and CRM API keys is **unconfirmed**, and there is no gitleaks in CI. No history rewrite; never force-push (D18, `docs/security-key-rotation.md`).

### A4 — Domain and legal pages
- **Not started:** `realestateflow.in` does not answer on port 443, so the privacy, terms and data-deletion pages are unreachable and the CRM `/legal/*` routes lead nowhere. Point the domain and `www` at the landing CloudFront distribution and deploy `infra/cicd/landing-pages/deploy.sh` (`docs/pending-items/instagram-app-review-actions.md`). This also blocks Meta App Review.

### A5 — Pricing, settled in one place
- **Partly done:** pricing exists but disagrees between sources. `marketing-and-sales/launch-plan-v2/pricing.json` says Team+ ₹1,999 + ₹500 per extra seat; `apps/crm/real-estate-crm-app/src/lib/plans.ts` and `apps/landing-pages/pricing/index.html` say ₹4,999 for up to 10 members; the top-up modal displays ₹499/₹1,799/₹3,999 while the server charges ₹500/₹2,000/₹5,000 (`BuyCreditsModal.tsx` vs `creditConfig.js`).
- **Not started:** approve `38-pricing-plan-contacts-and-credits.md` (Proposed) and make every surface read from one source. Remove "Telegram" from pricing and marketing copy — no Telegram channel exists (D14).

### A6 — Roles for M1
- **Done for M1:** ADMIN/MEMBER is enough to launch (D15). MANAGER and lead scoping are Phase B; do not sell Team plans until they exist.

### A7 — Voice at launch
- **Done:** outbound only (D16) — AI calling and follow-up calls are already outbound-only, inside tenant business hours.
- **Not started:** capture call consent at lead intake. DLT registration is Phase B, before any bulk calling.

### A8 — Ship to production
- **Partly done:** CRM backend and frontend deploy through the wrappers; the Instagram service is on dev only.
- **Not started:** prod deploy of the Instagram service (after A4 and Meta App Review), app store submission (`docs/launch/MOBILE_LAUNCH_YOUR_TASKS.md`), and Razorpay account readiness.
- **Discipline:** deploy only from `main` or the integration branch — a CRM frontend deploy from another checkout overwrote newer work on 2026-09-15 (`docs/pending-items/deploys-and-branches.md`).

**Phase A is done when:** a paying agency can sign up, be charged, fall into grace and be put into server-enforced read-only; keys are rotated; the API is throttled and logged; the domain serves the legal pages; one price list drives every surface.

---

## 3. Phase B — Hardening

**Goal:** make the platform safe to sell to teams and to scale beyond the first few agencies.

| Item | Status today | What is left |
|---|---|---|
| **MANAGER role + "members see only their own leads"** (D15) | Not started | Add MANAGER to the auth model (`services/reality-flow-authentication/src/models/usersModel.ts`); scope lead reads/writes for MEMBER to `assignedTo`; tests. Required before selling Team plans. |
| **Unguarded DELETE routes** | Partly done | Two mounted routes have no role check: `apps/crm/server/routes/aiIntegrations.js`, `routes/notifications.js` (device-token unregister). |
| **Cursor pagination + MED-1** | Partly done | Leads and customers take limit/offset but slice in memory after a scan; contacts, owners, properties and meetings are unpaginated scans (`TODO(MED-1)` in `apps/crm/server/crmDynamodbService.js`). Replace scans with Queries and return `{ items, nextCursor, hasMore }`. |
| **CRM mutation audit** (D17) | Not started | Agent actions go to `AgentAuditTable`; general CRM mutations are not audited. Add one, admin-readable. |
| **Archive instead of TTL delete** (D17) | Not started | `AgentAuditTable` rows expire at 90 days and credit ledger rows at 12 months. Export to S3 instead of deleting; never delete CRM data. |
| **E2E tests in CI** | Not started | 31 Playwright specs exist under `tests/playwright/` but are not run by `playwright.yml`; they need a dev backend target. |
| **WAF** (D17) | Not started | After the first customers. |
| **DLT registration** (D16) | Not started | Before any bulk calling. |
| **GitHub Actions deploy to dev** (D19) | Not started | Deploys stay manual through the wrappers until then. |
| **Soft credit caps and spend alerts** | Not started | Today the only guard is the hard stop at zero balance plus the 6-step tool-loop cap. |
| **Route decision: projects / developers / buildings / areas** | Not started | The route files exist but are not mounted in `apps/crm/server/server.js`. See the open question below. |

**Phase B is done when:** a MEMBER sees only their own leads, every list endpoint is Query-based and cursor-paginated, every CRM mutation is audited and nothing is deleted by TTL, and the E2E suite gates merges.

---

## 4. Phase C — Growth

**Goal:** widen the channels and the automation, once the product is being paid for. Scope is exactly what D14 keeps.

| Item | Status today | Notes |
|---|---|---|
| **Official WhatsApp Business Cloud API for customer messaging** | Not started | Plan in `39-whatsapp-official-api-plan.md` (Proposed). Baileys stays the agency's own command channel only. Chatwoot is dropped (D9). |
| **WhatsApp nurture journeys** | Not started | Build on the official API, not on Baileys. The follow-up service already has the scheduling and escalation shape. |
| **Instagram DM assistant** | Not started | Drafts first, auto-send later, once draft acceptance is measured (D14). |
| **Tenant social publishing** | Not started | Only after Meta App Review (D14, `docs/pending-items/instagram-app-review-actions.md`). |
| **Inbound AI voice** | Not started | Outbound is built; inbound answering and human transfer come later (D14, D16). |
| **Portal lead ingestion** | Not started | New adapters on the existing `ingestLead()` pipeline. Posting to portals by browser automation is **dropped** (D14). |
| **Brochure and floor-plan tools** | Not started | Upload, extract and answer from brochures with citations, on the existing DynamoDB vector store. |
| **Internal operations system** | Not started | Starts only after the M1 PMF gate (D21, `internal-operations/31-internal-ops-overview.md`). |
| **Reporting store (Postgres)** | Parked | Parked as a possible future reporting store fed from DynamoDB, no date (D8, `27-phase-2-postgres-analytics-agent-tables.md`). DynamoDB stays the source of truth. |
| **Second model provider** | Not started | Only when cost or outage data justifies it; the gateway seam already exists (`apps/crm/server/agents/modelGateway/`). |

---

## 5. Dropped

| Item | Why |
|---|---|
| Posting listings to portals via browser automation | Account-block risk (D14). Portal **lead ingestion** stays, as adapters. |
| Tenant-facing marketing agent | Dropped (D14). `13-marketing-architecture.md` and `internal-operations/32` are history, not plan. |
| Telegram channel | No code exists; remove it from pricing and marketing copy (D14). |
| Chatwoot as the channel layer | Dropped (D9); channels are adapters into `ingestLead()`. |
| Strands / AgentCore migration, 11 MCP servers, Bedrock Knowledge Bases, Lago | Considered, not adopted — see `20-technology-decisions.md`. |
| DynamoDB → Postgres migration | Never happening; DynamoDB stays the source of truth (D8). |

---

## 6. Sequencing Logic

1. **Get paid safely first (Phase A).** Grace enforcement, key rotation, API protection and a working domain are cheap and block everything commercial.
2. **Then make it sellable to teams (Phase B).** Lead scoping, pagination and audit are what a second and third seat require.
3. **Then widen (Phase C).** Official WhatsApp, nurture, DM assistant, inbound voice and portal ingestion all assume paying customers and a hardened base.

Lead scoring and assignment are already built and are not re-planned here: the founder is building a next-generation lead engine separately, and docs `10` and `11` will be updated when it lands (D11).

## 7. Guardrails Across All Phases

- **One thing reaches production at a time**; everything else stays behind a flag (`AGENTS_ENABLED`, `AGENT_TOOL_LOOP_ENABLED`, per-category toggles in `apps/crm/server/featureToggleService.js`).
- **Humans approve before anything is sent to a customer.** Drafts first, auto-send only with evidence.
- **Grounded answers only** — customer-facing AI answers come from CRM tools or knowledge search, and a weak match returns nothing.
- **Never delete CRM data.** Archive instead, in every design.
- **Compliance is per phase, not retrofitted:** consent at intake (A), DLT before bulk calls (B), Meta App Review before tenant publishing (C), DPDP obligations throughout.
- **Deploy only from `main` or the integration branch.**

## 8. Open Questions

> **Open question:** does M1 launch include the Instagram service in production (which needs Meta App Review first), or only the CRM plus the WhatsApp command channel?

> **Open question:** mount `routes/projects.js`, `developers.js`, `buildings.js` and `areas.js` (with tests and role checks), or leave them unmounted until a feature needs them?

> **Open question:** no current monthly run-cost estimate exists for M1 (Lambda, DynamoDB, Gemini, ElevenLabs and Exotel minutes, ECS Fargate for Baileys). The June estimates assumed Chatwoot and Aurora and are not usable.
