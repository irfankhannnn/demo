# 00 — Validation & Feasibility Report

This report audits the proposed MVP plan against the **actual** `auth_rbac_feature` code and records every correction the implementing agents must know. Read this before any EPIC.

---

## A. Architecture facts (confirmed from code)

| Area | Reality | Source |
|------|---------|--------|
| Server module system | **ESM** — `"type": "module"`, `import`/`export` everywhere | `apps/crm/server/package.json`, `apps/crm/server/server.js` |
| AWS SDK | **v3** (`@aws-sdk/client-dynamodb`, `client-s3`, `lib-dynamodb` @ ^3.669) in server; v2 only in auth microservice | `apps/crm/server/package.json` |
| Bedrock | v3 `@aws-sdk/client-bedrock-agent-runtime` already used (RAG, tenant-isolated) | `services/ai-calling-service/src/services/ragService.js` |
| Frontend | React 18.3, **React Router v7.8.2**, TailwindCSS 3.4, lucide-react, PostHog, Sentry | `apps/crm/real-estate-crm-app/package.json` |
| Frontend API layer | Class-based `ApiService` (fetch); token `localStorage.auth_id_token` → `Authorization: Bearer`; `x-tenant-id` via `getTenantHeaders()` | `apps/crm/real-estate-crm-app/src/services/api.ts`, `src/config/tenant.ts` |
| CRM data | Single-table `cloudberry-real-estate-crm`, PK=`TENANT#{t}#{ENTITY}#{id}`, SK=`PROFILE`/`NOTE#`/`AGREEMENT#`; GSI1 owner-property, GSI2 status, GSI3 search | `apps/crm/server/crmDynamodbService.js`, `apps/crm/server/infra/cfn-backend.yaml` |
| Users | **Separate auth microservice** `reality-flow-authentication`; DynamoDB `UsersTable`, PK=`TenantId`, SK=`USER#{userId}`; `listUsersByTenant()` | `services/reality-flow-authentication/src/models/usersModel.ts` |
| Subscriptions | DynamoDB `Subscriptions`, PK=`tenantId`; `createTrialSubscription()`; fields incl. `plan`, `seatsPaid`, `seatsUsed`, `trialEndsAt`, `isPaying`, `gracePeriodActive`, `paymentStatus`, `razorpaySubscriptionId` | `apps/crm/server/subscriptionService.js`, `apps/crm/server/routes/subscriptions.js` |
| Auth/tenant on server | `validateToken` (calls auth svc `/auth/me`, sets `req.user`, `req.tenantId`, 5s cache) → `extractTenantId` → `requireRole(...)` | `apps/crm/server/middleware/validateToken.js`, `tenantMiddleware.js`, `middleware/requireRole.js` |
| Roles | Auth svc: `ADMIN`/`MEMBER`. Server `requireRole` supports `ADMIN/FOUNDER/OWNER/MANAGER`. Frontend `rbac.ts`: ADMIN=all, MEMBER=no-delete | `requireRole.js`, `src/utils/rbac.ts` |
| Billing webhook | `POST /api/billing/webhook`, mounted **before** `express.json()`, uses `express.raw()`, HMAC-SHA256 timing-safe verify | `apps/crm/server/routes/billing.js`, `apps/crm/server/server.js` |
| Razorpay (frontend) | `openCheckout()` loads checkout.js, uses **subscription_id** flow; key `VITE_RAZORPAY_KEY_ID` | `apps/crm/real-estate-crm-app/src/lib/razorpay.ts` |
| Email | **Brevo** in 4 routes (`auth.js`, `billing.js`, `grievance.js`, `feedback.js`) + 2 crons (`trial-reminder-cron.js`, `escalation-cron.js`). **No SES client present.** | grep `api.brevo.com` |
| WhatsApp | **AiSensy** broadcast already wired in billing webhook (`sendAiSensyBroadcast`). No Bailey/inbound gateway. | `apps/crm/server/routes/billing.js` |
| Skills | 6 skills in `ai-employee/skills/` (lead/buyer/contact/owner/property/tenant). CLI: `npx tsx scripts/*.ts '<json>'`. Call CRM API via Axios `crmClient` (`CRM_API_BASE`,`CRM_TOKEN`). **Not** direct DynamoDB. | `ai-employee/skills/*`, `utils/crm-client.ts` |
| MCP | `.mcp.json` references only **external** servers (higgsfield/meta-ads/blotato/git). No internal MCP server. | `.mcp.json` |
| Crons | Each cron = its own CFN template in `/cron/*.yaml` (EventBridge Rule + Lambda + Permission). Handlers in `apps/crm/server/scripts/*-cron.js`. | `cron/trial-reminder.yaml` |
| Deploy | `apps/crm/server/infra/deploy.sh`: `npm ci` → zip `function.zip` (incl. `scripts/`) → S3 → `cloudformation deploy cfn-backend.yaml` → force API GW deploy. Lambda handler `lambda-handler.handler`. Syntax gate `apps/crm/server/scripts/build.sh`. | `apps/crm/server/infra/deploy.sh` |

---

## B. Corrections to the original plan

1. **Do NOT create a brand-new `PaymentModal.tsx` from scratch.** A working `PaywallModal.tsx` + `src/lib/razorpay.ts` already implement tiered checkout (Solo ₹999 / Team ₹1999 / Team+ ₹4999, monthly/annual 20% off). **Reuse and extend** these for the upgrade flow. Build a *separate small* `BuyCreditsModal` only for one-time credit-pack purchases (Razorpay **Orders** API, not subscriptions).

2. **Unified credit model maps onto existing tiers.** The owner wants a single credit system with **free + ₹1999 + ₹4999** packs and 20% annual. Reuse existing Razorpay plan IDs: `plan_team_*` (₹1999) and `plan_teamplus_*` (₹4999). Free credits attach to the trial/`free`/`solo` state. No new subscription engine needed.

3. **SES uses AWS SDK v3** (`@aws-sdk/client-sesv2`), consistent with the rest of the server. Brevo stays as fallback. Migrate the **4 routes + 2 crons** through one `emailService.js`.

4. **WhatsApp: keep AiSensy, add Bailey only for the inbound gateway** and "connect your WhatsApp" onboarding. Bailey is **optional** per owner instruction — the product must function fully without it. Gate all Bailey code behind `BAILEY_ENABLED`.

5. **Credit tables follow `cloudberry-real-estate-*` naming** and PAY_PER_REQUEST, matching every existing table. Add to `cfn-backend.yaml` (not a separate stack) so the API Lambda role already covers them.

6. **MCP server wraps the CRM API path the skills already use** (Axios `crmClient`), not DynamoDB. This keeps tenant isolation + validation in one place (the CRM API).

7. **Team analytics is a cross-service join.** Team member identity comes from the auth microservice (`/users`), performance metrics from CRM leads (`assignedTo`, `status`, `convertedAt`). Plan a backend aggregation endpoint in the **main server** that calls the auth svc for the member list and the CRM service for metrics.

8. **Expiring-agreements cron can reuse existing logic.** `crmDynamodbService.js` already has a `leaseEndingWithinDays` customer filter and a `PROPERTY_AGREEMENT` entity with `endDate`. Reuse rather than invent.

9. **Agents (Bedrock) are net-new** but a v3 Bedrock client pattern already exists in `ai-calling-service` — copy its client setup and tenant-isolation approach.

10. **Lambda packaging already includes `scripts/`** — new cron handlers placed in `apps/crm/server/scripts/` ship automatically. New top-level modules must be added to the `zip` include list in `deploy.sh` if outside `routes/middleware/utils/validation/lib/scripts`.

11. **`TrialCountdownBanner.tsx` already exists** — `src/components/TrialCountdownBanner.tsx` is a live component. Do NOT create a duplicate `TrialBanner.tsx`. E1-T2 implementers must check this component first and extend/reuse it rather than creating a new file.

12. **Auth svc `/internal/users` does NOT return a list** — only `/internal/users/count?tenantId=` exists as an internal endpoint (returns `{ count: number }`). For team member list (E4-T1), the server must forward the admin's Bearer token from `req.headers.authorization` to `GET {AUTH_SERVICE_URL}/users`. There is no server-to-server user-list endpoint — use the authenticated user-facing endpoint with the forwarded token.

13. **E2-T3 code snippet has a duplicate import bug** — the original plan text contained leftover `import { deductCredits } from '../services/creditService.js'` and `import { getCosts } from '../config/creditConfig.js'` lines above the correct root-level imports. The ONLY correct imports in `apps/crm/server/middleware/meterCredits.js` are `import { deductCredits } from '../creditService.js'` and `import { getCosts } from '../creditConfig.js'`. The `services/` and `config/` directories do not exist.

14. **`apps/crm/server/agents/` is a new directory and must be explicitly added to the deploy.sh zip** — root `*.js` are auto-included but subdirectories need explicit listing. The current zip command must be extended to include `agents/` and to exclude `mcp-server/`. See `07-infra-cfn-deploy.md` §6.

15. **Billing route is at `/api/billing/webhook` not `/api/billing`** — `billing.js` is mounted at `/api/billing` in server.js, and the webhook handler inside is `POST /webhook`, making the full path `POST /api/billing/webhook`. The raw body trick applies to the route handler itself using per-route `express.raw()` middleware, not to the router-level mount.

16. **`RegisterAdmin.tsx` already exists** at `apps/crm/real-estate-crm-app/src/pages/RegisterAdmin.tsx` — only the route in `App.tsx` is missing. Do not recreate the page component; only add the `<Route path="/onboarding/register-admin" ...>` entry.

17. **Two separate leads route files** — `apps/crm/server/routes/crm.js` AND `apps/crm/server/routes/leads.js` are both mounted under `/api/crm/leads` in server.js. E2-T4 must identify which file contains each create endpoint before adding metering. Confirm in server.js mount order before modifying.

---

## C. Feasibility verdict per workstream

| Workstream | Feasible? | Notes / risk |
|-----------|-----------|---------------|
| Onboarding route fix | ✅ Trivial | One route addition; page + endpoint already exist |
| Upgrade flow | ✅ | Reuse `PaywallModal`/`openCheckout`; only wire entry points + trial banner |
| Bailey WhatsApp gateway | ⚠️ Medium | External dependency (Bailey acct, public webhook URL, WABA approval). Keep optional/flagged. Inbound→MCP routing needs a deterministic command parser + auth mapping by `to` number. |
| Unified credits | ✅ | Ledger pattern is standard. Risk: **atomic deduction** under concurrency — use DynamoDB conditional writes on a balance item, not sum-of-scan, for the hot path (see E2-T2). |
| SES migration | ✅ | SDK already v3; needs domain/sender verification (manual AWS step) + IAM `ses:SendEmail`. |
| Team analytics + Excel | ✅ | Cross-service aggregation. Excel via `xlsx` (new dep) or server-built CSV (no dep). Recommend server-side `exceljs`/`xlsx`. |
| Data-quality crons | ✅ | Reuse existing filters; new CFN cron templates following `trial-reminder.yaml`. |
| MCP server | ✅ | Wrap existing CLI/Axios skills; run as stdio locally and/or Lambda HTTP. |
| Bedrock agents | ⚠️ Medium | Net-new; cost + latency + prompt-quality risk. Gate behind credit checks and per-tenant enable flag. Start with Qualifier only, then expand. |

**Overall:** The MVP is feasible on the existing architecture with **no rewrites**. The two medium-risk items (Bailey, agents) are isolatable behind flags so the core product (onboarding + credits + analytics + crons + SES) can ship first.

---

## D. Key risks & mitigations

1. **Credit double-spend (concurrency).** Mitigation: maintain a single `BALANCE` item per tenant and deduct with a `ConditionExpression: balance >= :cost` `UpdateItem`; write the ledger row in the same `TransactWriteItems`. Never compute balance by scanning the ledger on the request path (E2-T2).
2. **Cross-tenant leak.** Mitigation: every new query keyed by `TENANT#{tenantId}` from `req.tenantId`; add a test that a tenant cannot read another's credits/analytics (E8 security tests).
3. **Webhook spoofing (Bailey, credit-purchase).** Mitigation: HMAC verify like the existing Razorpay handler; mount raw-body routes before `express.json()`.
4. **Email deliverability during SES sandbox.** Mitigation: keep Brevo fallback active; document SES production-access request as a release gate.
5. **Agent runaway cost.** Mitigation: deduct credits *before* invoking the model; per-tenant daily cap; Haiku-first routing.
6. **Schema drift between auth svc & CRM.** Mitigation: analytics join only on stable `userId`; tolerate missing members gracefully.

---

## E. Decisions still needing owner confirmation

These are surfaced in `README` of each EPIC and aggregated here. Defaults are chosen so work can proceed if no answer is given.

1. MCP deployment: **stdio (local) first**, Lambda HTTP later. *(default: stdio first)*
2. Credit costs & pack sizes: defaults proposed in E2-T1, all config-table driven. *(default: proposed table)*
3. Excel library: **`xlsx`** server-side. *(default: xlsx)*
4. Auto-assign vs alert-only for incomplete/expiring records: **alert-only** for MVP. *(default: alert-only)*
5. Backfill historical analytics: **no** for MVP (forward-only). *(default: no)*
6. Bailey: ship **behind `BAILEY_ENABLED=false`** until WABA approved. *(default: off)*
