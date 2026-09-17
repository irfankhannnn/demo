# 30 — Credits & Metering Implementation

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Rewritten to document the credit metering that is live on DynamoDB; the June design (Postgres ledger, token-based pricing at 1 credit ≈ ₹0.10, model router) is retired, and the proposed new pricing model lives in doc 38.

> **Replaced:** the June 2026 version of this doc said credits were "0% implemented" and specified a Postgres/Knex ledger, per-action prices from ₹0.05 to ₹10, packs from ₹50, a Bedrock model router converting token cost into credits, and optional Lago. None of that was built. The shipped model is simpler: people use the CRM for free, AI work costs credits, and 1 credit = ₹1.

> **Pricing:** current (pre-launch) pricing is in `marketing-and-sales/launch-plan-v2/pricing.json` and CRM `apps/crm/real-estate-crm-app/src/lib/plans.ts`, which disagree on Team+; it is being replaced by the proposal in `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md` (plans limited by number of properties plus AI credits, property search not consuming AI credits, and a new billable unit "Contacts" for leads contacted). The numbers below are what the code does today, not final prices.

---

## 1. Model in one paragraph

Every tenant has a whole-number credit balance. **Manual CRM work costs 0.** Credits are spent only when AI works for the tenant: one AI agent turn costs **15**, and one started minute of an AI phone call costs **15**. **1 credit = ₹1.** Balances are topped up by a monthly allotment (which **replaces** the balance, no carry-over) and by one-time packs bought through Razorpay. Costs, packs and the free allotment live in a DynamoDB config table that a platform operator can change without a deploy.

---

## 2. Components

| Part | File |
|---|---|
| Balance + ledger (grant, deduct, refund, monthly reset, paginated ledger) | `apps/crm/server/creditService.js` |
| Costs, packs, free allotment (defaults + runtime config, 60 s cache) | `apps/crm/server/creditConfig.js` |
| Metering helpers (`precheckCredits`, `chargeCreditsForAction`, `meterCredits`, 402 response) | `apps/crm/server/middleware/meterCredits.js` |
| AI turn charge and refund | `apps/crm/server/agents/agentRuntime.js` (`invokeAgent`) |
| AI call charge and pre-call check | `apps/crm/server/aiCallBilling.js`, called from `routes/aiCallingInternal.js`, `routes/aiCalling.js`, `routes/leads.js` |
| Tenant API | `apps/crm/server/routes/subscriptions.js` (`/api/subscriptions/credits*`) |
| Operator API | `apps/crm/server/routes/creditAdmin.js` (`/api/credit-config`) |
| Pack purchase → grant | `apps/crm/server/routes/billing.js` (`payment.captured`), `razorpayOrders.js` |
| Monthly reset | `apps/crm/server/scripts/credit-reset-cron.js` |
| Balance repair (manual script) | `apps/crm/server/scripts/credit-balance-reconcile.js` |
| Tables | `CreditsTable`, `CreditConfigTable` in `apps/crm/server/infra/cfn-backend.yaml` |
| Frontend | `src/contexts/CreditsContext.tsx`, `src/hooks/useCredits.ts`, `src/components/BuyCreditsModal.tsx`, `src/pages/crm/BillingSettings.tsx` (under `apps/crm/real-estate-crm-app/`) |

---

## 3. Data model (DynamoDB)

### Credits table — `${Env}-realestateflow-credits`

One table holds both the balance and the ledger. Point-in-time recovery on, `DeletionPolicy: Retain`.

| Item | Key | Fields |
|---|---|---|
| Balance | `tenantId`, `sk = BALANCE` | `balance` (integer), `updatedAt` |
| Ledger entry | `tenantId`, `sk = LEDGER#<ISO time>#<8 hex chars>` | `actionType`, `amount` (+ grant / − deduct), `balanceBefore`, `balanceAfter`, `meta`, `createdAt`, `GSI1PK = tenantId`, `GSI1SK = <actionType>#<time>`, `expiresAt` |

- GSI `actionType-index` (`GSI1PK`, `GSI1SK`) lists a tenant's entries by action type.
- TTL on `expiresAt`: ledger entries expire about **12 months** after they are written. Balance items have no TTL.

### Credit config table — `${Env}-realestateflow-credit-config`

Key `configKey`, three items: `FREE_TIER`, `PACKS`, `COSTS`. Each stores `value`, `updatedAt`, `updatedBy`, `previousValue`. If an item is missing or the read fails, the code defaults in `creditConfig.js` are used. Every default can also be overridden by an environment variable (for example `CREDIT_COST_AGENT_ACTION`).

---

## 4. What costs credits

Defaults from `creditConfig.js` `COSTS`:

| Action key | Credits | Charged where |
|---|---|---|
| `lead_add` | 0 | `POST` lead (`routes/leads.js`) |
| `contact_add` | 0 | contacts and buyers (`routes/contacts.js`, `routes/buyers.js`) |
| `property_add` | 0 | property create (`routes/crm.js`) |
| `owner_add` | 0 | owner create (`routes/crm.js`) |
| `tenant_add` | 0 | tenant create (`routes/crm.js`) |
| `khata_entry` | 0 | khata entry (`routes/khata.js`) |
| `record_update`, `whatsapp_send`, `email_send`, `bulk_import_per_record`, `analytics_report` | 0 | defined but not called by any route today |
| **`agent_action`** | **15** | every `invokeAgent` turn |
| **`ai_call_per_minute`** | **15** per started minute | settled AI call |

Zero-cost actions still pass through the metering helpers, which skip the ledger when cost ≤ 0, so a cost can be switched on later from config.

### AI agent turns (15 credits each)

`invokeAgent` in `agents/agentRuntime.js` runs for these agents, and each run is one charge:

| Agent id | Trigger |
|---|---|
| `whatsapp` | each inbound WhatsApp message the AI Employee answers |
| `web` | each web chat message (`/api/crm/agent-chat`) |
| `qualifier` | each `lead.created` event (skipped if the lead was scored recently) |
| `router` | each `lead.qualified` event when the tenant has team members |
| `followup` | each stale lead in the daily follow-up cron |

So a new lead that is auto-qualified and auto-routed costs up to **30** credits before anyone replies.

Order of checks: global switch `AGENTS_ENABLED`, rollout percentage, AI Employee provisioned (`status = live`) and enabled for the tenant, then balance ≥ 15, then deduct. If the balance is short the turn returns `insufficient_credits` and does not run. If the turn throws **before any CRM write succeeded**, the 15 credits are refunded as `refund.agent_action`; if a tool already wrote to the CRM, there is no refund. Local development bypasses all of this.

The charge amount comes from the `AGENT_ACTION_CREDITS` environment variable (CloudFormation parameter `AgentActionCredits`, default `'15'`), read once at module load so the deduct and the refund always match. **Changing `agent_action` in the config table does not change what is charged**; change the parameter and redeploy.

### AI phone calls (15 credits per started minute)

- **Before dialling:** `hasCreditForAiCall` requires a balance of at least one minute (15). It fails **open**: if pricing or balance cannot be read, the call is allowed.
- **After the call:** `chargeForAiCall` runs when the call outcome is posted to `PATCH /api/internal/leads/:leadId/call-outcome`. Minutes = `ceil(durationSecs / 60)`; 0 seconds is not billed. The charge is de-duplicated per `callSessionId` (Exotel and ElevenLabs can both report a duration), and calls without a session id are not billed. It never fails the outcome write; if the balance is short at that point, the shortfall is logged and not charged.

### Not metered today

MCP tool calls (`/api/crm/agent/tool`), Instagram lead analysis (`apps/instagram/`), call-recording analysis (`services/callIntelligence/` calls Gemini directly), knowledge lookups during AI calls, and WhatsApp/email template sends.

---

## 5. How credits come in

| Source | Amount (default) | How |
|---|---|---|
| Starting grant | **1,000** (`FREE_TIER.monthlyFreeCredits`) | `initializeTenantCredits`, ledger `initial_grant`. Only called when `GET /api/subscriptions/trial-status` has to create the subscription row (see issue C3). |
| Monthly reset, not paying | **1,000** | `credit-reset-cron.js`, ledger `monthly_reset`, balance **set to** the allotment |
| Monthly reset, paying, plan `teamplus` | **15,000** (`PACKS.professional.monthlyCredits`) | same |
| Monthly reset, paying, plan `team` | **5,000** (`PACKS.starter.monthlyCredits`) | same |
| Monthly reset, paying `solo` | 1,000 (falls back to free) | same |
| Top-up pack | `pack_500`: 500 for ₹500 · `pack_2000`: 2,000 for ₹2,000 · `pack_5000`: 5,000 for ₹5,000 | Razorpay Order → `payment.captured` → `grantCredits` (`purchase`) |
| Custom amount | credits × `overagePricePerCredit` (default ₹1.0), rounded up | same route with `credits` instead of `packId`; max `MAX_CREDIT_PURCHASE` (default 100,000) |
| Refund / reversal / chargeback | negative | `billing.js` deducts the granted credits (`refund`, `chargeback_reversal`) |

`PACKS` also holds `starter` (₹1,999 / month, 5,000 credits, Razorpay plan `plan_team`), `professional` (₹4,999 / month, 15,000 credits, `plan_teamplus`) and `annualDiscountPct` 20. These subscription bundles appear nowhere in `pricing.json`.

### Monthly reset schedule

`CreditResetFunction` runs daily on `cron(30 18 * * ? *)` UTC (00:30 IST). For each subscription it decides if today is the reset day, claims the day with a conditional write on `lastCreditResetAt`, then sets the balance.
- **Paying:** reset on `billingAnniversaryDay` (last day of shorter months for 29–31).
- **Not paying:** reset when today's day **and month** match `trialEndsAt`, `lastCreditResetAt` or `createdAt` (see issue C2).

---

## 6. APIs

### Tenant (`validateToken` + tenant)

| Method + path | Returns / does |
|---|---|
| `GET /api/subscriptions/credits` | `balance`, `costs`, `packs`, `freeTier`, `resetDate` (= `lastCreditResetAt`), `monthlyAllotment` (always the free-tier value) |
| `GET /api/subscriptions/credits/ledger?limit=&startKey=` | newest first, `limit` ≤ 100 (default 50), `nextKey` for paging |
| `POST /api/subscriptions/credits/purchase` `{ packId }` or `{ credits }` | roles `ADMIN`, `FOUNDER`, `OWNER`; creates a Razorpay Order at the **server** price with `notes.tenantId`, `notes.credits` |

Any metered route answers `402 { error: 'insufficient_credits', balance, required }`; the frontend turns that into an `insufficient-credits` event that opens `BuyCreditsModal`.

### Platform operator (`/api/credit-config`)

Guarded by `requirePlatformOperator` (role `PLATFORM_OPERATOR` or `SUPER_ADMIN`, or user id / email in `PLATFORM_OPERATOR_USER_IDS` / `PLATFORM_OPERATOR_EMAILS`). Tenant admins cannot use it.

| Method + path | Does |
|---|---|
| `GET /api/credit-config` | full config (`FREE_TIER`, `PACKS`, `COSTS`) |
| `PUT /api/credit-config/costs` | replace `COSTS`; keys must be known, values 0 … `MAX_ACTION_COST_CREDITS` (default 1,000) |
| `PUT /api/credit-config/packs` | replace `PACKS` (no validation) |
| `PUT /api/credit-config/free-tier` `{ monthlyFreeCredits }` | set the free allotment |

There is no endpoint to grant credits to one tenant by hand.

---

## 7. Known issues

| # | Issue | Evidence |
|---|---|---|
| C1 | **Pack prices differ between server and UI.** The server charges ₹500 / ₹2,000 / ₹5,000; `BuyCreditsModal` shows ₹499 / ₹1,799 / ₹3,999. The customer pays the server price. The modal should read packs from `GET /api/subscriptions/credits`. | `creditConfig.js` `creditPacks`; `apps/crm/real-estate-crm-app/src/components/BuyCreditsModal.tsx` `PACK_OPTIONS` |
| C2 | **Free allotment does not repeat monthly.** For non-paying tenants the reset matches day **and month**, so after the first reset it fires about once a year. | `scripts/credit-reset-cron.js` `isAnniversaryToday` |
| C3 | **New sign-ups can start with 0 credits.** Post-registration creates the subscription row without a grant; the 1,000-credit grant happens only if `trial-status` creates the row. | `routes/auth.js` post-registration; `routes/subscriptions.js` trial-status |
| C4 | **Paying tenants get the free allotment.** The reset picks the allotment from `plan`, which activation never updates (doc 29, issue P2). | `credit-reset-cron.js` `getMonthlyAllotment` |
| C5 | **Cost editor rejects the shipped defaults.** `PUT /costs` refuses 0 for `lead_add`, `contact_add`, `property_add`, `owner_add`, `tenant_add`, which are 0 by design. A partial body also replaces the whole `COSTS` item, so missing keys become free. | `routes/creditAdmin.js` `CRITICAL_COST_KEYS` |
| C6 | `agent_action` in config is display-only; the charge follows `AGENT_ACTION_CREDITS`. | `agentRuntime.js`, `creditConfig.js` comment |
| C7 | Billing page usage chart is random mock data, although the ledger endpoint exists. | `src/pages/crm/BillingSettings.tsx` (`Math.random()`) |
| C8 | Ledger entries TTL-expire after ~12 months. Under the "never delete CRM data" rule they should be archived instead. | `creditService.js` `ttlMonths` |
| C9 | The balance-repair script has no schedule. | no reference to `credit-balance-reconcile` in any template |

---

## 8. Roadmap

1. **Pricing model:** follow doc 38 once approved (property limits, free property search, "Contacts" unit). Until then keep the flat model above.
2. **Fix C1–C4** before paid launch; they change what customers pay or receive.
3. **Low-balance alert** (in-app and email) and a **per-tenant monthly cap** on AI spend. Neither exists today; the only guard is the balance check. Alerts should use the existing `AlertEmail` parameter / SNS topic pattern in `cfn-backend.yaml`, not a hard-coded address.
4. **Real usage chart** from the ledger (C7).
5. **Operator grant endpoint** for goodwill credits, with a ledger reason.
6. Decide whether MCP calls, Instagram analysis and call-recording analysis should be metered, in line with doc 38.
