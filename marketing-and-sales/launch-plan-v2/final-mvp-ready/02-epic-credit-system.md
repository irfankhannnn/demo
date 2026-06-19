# EPIC 2 — Unified Credit-Based Billing System

**Outcome:** One credit system for the whole product. Each tenant has a balance; actions consume credits; free credits + two paid packs (₹1,999 / ₹4,999, 20% off annual) top up the balance. Every cost and pack is **owner-configurable** without code changes.

**Architecture anchors:**
- DynamoDB v3 (`@aws-sdk/lib-dynamodb`), single-table naming `cloudberry-real-estate-*`, PAY_PER_REQUEST.
- Server ESM, middleware chain `validateToken → extractTenantId → requireRole`.
- Existing Razorpay subscription flow (`PaywallModal` + `openCheckout`, plan ids `plan_team_*`=₹1999, `plan_teamplus_*`=₹4999) and webhook `server/routes/billing.js` (raw body + HMAC).
- `req.tenantId` is the only trusted tenant source.

---

## E2-T1 — Credit config + tables (CFN) + seed

**Goal:** Two new tables and an owner-editable config, all matching existing conventions.

**Files**
- MODIFY `server/infra/cfn-backend.yaml` (add tables + extend Lambda role Resource list + add env vars to `ApiLambdaFunction`)
- MODIFY `server/infra/deploy.sh` (add new table-name params)
- NEW `server/creditConfig.js` (root-level, matching `*Service.js` convention; loads config from table with hard-coded safe defaults as fallback)

> **File placement:** backend modules go at **server root** (`server/creditService.js`, `server/creditConfig.js`, etc.) — there is no `server/services/` or `server/config/` dir in this repo. Root `*.js` ships via the existing zip. See `07-infra-cfn-deploy.md` §6.

**Tables (add to `cfn-backend.yaml`, mirror `CrmTable` block style):**

1. `cloudberry-real-estate-credits` — **balance + ledger in one table** (single-table):
   - PK `tenantId` (S), SK (S):
     - `BALANCE` — the hot balance item: `{ balance:Number, updatedAt }`
     - `LEDGER#{isoTs}#{rand}` — immutable ledger rows.
   - GSI `actionType-index`: GSI1PK=`tenantId`, GSI1SK=`{actionType}#{isoTs}` (reporting).
   - TTL attribute `expiresAt` on ledger rows (optional cleanup after N months).
2. `cloudberry-real-estate-credit-config` — owner-editable config:
   - PK `configKey` (S) — e.g. `COSTS`, `PACKS`, `FREE_TIER`.
   - Value blob (Map). Seeded by `E2-T1` seed script; editable via `E2-T6` admin route.

**Default config (seed) — all configurable later:**
```jsonc
// FREE_TIER
{ "monthlyFreeCredits": 1000 }
// PACKS  (Razorpay reused; annual = monthly*12*0.8)
{
  "starter":      { "label": "Starter",      "priceMonthly": 1999, "monthlyCredits": 5000,  "razorpayPlan": "plan_team" },
  "professional": { "label": "Professional", "priceMonthly": 4999, "monthlyCredits": 15000, "razorpayPlan": "plan_teamplus" },
  "annualDiscountPct": 20,
  "overagePricePerCredit": 0.10
}
// COSTS  (credits per action — owner decides; these are defaults)
{
  "lead_add": 10, "contact_add": 5, "property_add": 8, "owner_add": 3,
  "tenant_add": 3, "khata_entry": 1, "record_update": 1,
  "agent_action": 15, "whatsapp_send": 1, "email_send": 1,
  "bulk_import_per_record": 8, "analytics_report": 5
}
```

**Detail**
- Lambda role: append the two new table ARNs to `RealEstateApiDynamoAndS3Access` (same place `CrmTable.Arn` is listed).
- Add env vars `CREDITS_TABLE_NAME`, `CREDIT_CONFIG_TABLE_NAME` to `ApiLambdaFunction.Environment` and to `deploy.sh` param generation + `cfn-params.json`.
- `creditConfig.js` caches config in-memory ~60s; falls back to the hard-coded defaults if the config table read fails (resilience).

**Security**
- Config writes admin-only (E2-T6). Reads tenant-agnostic (pricing is global) but never expose internal cost overrides that aren't meant to be public — costs are fine to show.

**Tests**
- Unit: `creditConfig.getCosts()` returns table value, falls back to defaults on error.
- CFN: `aws cloudformation validate-template` passes.

**Acceptance**
- Tables deploy; seed populates config; Lambda can read both.

**Depends on:** none (infra foundation).

---

## E2-T2 — CreditService with **atomic** deduction

**Goal:** Safe, concurrency-correct credit ops. **No sum-of-scan on the request path.**

**Files**
- NEW `server/creditService.js` (root-level)
- `InsufficientCreditsError` — define as an **inline class** in `creditService.js` (no `errors/` dir; match the style of `server/expressError.js`)

**API**
```js
getBalance(tenantId)                         // read BALANCE item (fast)
grantCredits(tenantId, amount, reason, meta) // += balance + write ledger (TransactWrite)
deductCredits(tenantId, amount, actionType, meta) // atomic conditional decrement + ledger
getLedger(tenantId, { limit, startKey })     // paginated ledger read
resetMonthlyCredits(tenantId, plan)          // set/refresh monthly allotment
```

**Atomic deduction (the critical bit)**
- Use a single `TransactWriteItems`:
  1. `Update` BALANCE: `SET balance = balance - :cost` with `ConditionExpression "attribute_exists(balance) AND balance >= :cost"`.
  2. `Put` ledger row `LEDGER#{ts}#{rand}` with before/after, actionType, meta, createdBy.
- On `TransactionCanceledException` due to the condition → throw `InsufficientCreditsError(balance, required)`.
- `grantCredits` similarly transacts balance `+=` and a ledger row; if BALANCE item missing, upsert with `if_not_exists(balance, :zero)`.

**Security**
- All keys built from the passed `tenantId` (caller passes `req.tenantId`).
- Amounts validated `> 0`, integers (or fixed-point) — reject NaN/negative.

**Tests**
- Unit (mock DocumentClient): deduct success path writes both items; insufficient → throws typed error and writes nothing.
- **Concurrency test**: simulate two parallel deducts that together exceed balance → exactly one succeeds (assert on conditional failure).

**Acceptance**
- Balance never goes negative; ledger and balance always consistent (same transaction).

**Depends on:** E2-T1.

---

## E2-T3 — Metering middleware

**Goal:** Declarative per-route credit metering.

**Files**
- NEW `server/middleware/meterCredits.js`

**Detail**
```js
import { deductCredits } from '../creditService.js';
import { getCosts } from '../creditConfig.js';

export function meterCredits(actionType) {
  return async (req, res, next) => {
    try {
      const cost = (await getCosts())[actionType] ?? 0;
      if (cost > 0) {
        const r = await deductCredits(req.tenantId, cost, actionType, {
          path: req.path, method: req.method, userId: req.user?.userId,
        });
        req.creditLedgerId = r.ledgerId;
      }
      next();
    } catch (err) {
      if (err.name === 'InsufficientCreditsError') {
        return res.status(402).json({
          error: 'insufficient_credits',
          balance: err.balance, required: err.required,
          message: 'Out of credits. Buy more to continue.',
        });
      }
      next(err);
    }
  };
}
```
- **Placement matters:** put `meterCredits` **after** `validateToken`+`extractTenantId` (needs `req.tenantId`) and ideally after validation so we don't charge for malformed requests. Recommended order: `validateToken, extractTenantId, requireRole, validateBody, meterCredits('lead_add'), handler`.
- **Refund on handler failure:** if the downstream handler throws after deduction, the route should call `grantCredits(..., 'refund')`. Provide a small wrapper `withCreditRefundOnError` OR deduct *inside* the handler after the write succeeds. **Recommended:** deduct inside the service call path (post-write) for create endpoints to avoid charging on failure. Document the chosen approach per route in E2-T4.

**Security/correctness**
- Decide deduct-before vs deduct-after per endpoint; default **deduct-after-success** for create endpoints (wrap in handler) to prevent charging failed writes. Use middleware form only for idempotent/cheap actions.

**Tests**
- Unit: 402 on insufficient; passes through on success; zero-cost actions skip deduction.

**Acceptance**
- A metered route returns 402 with balance info when credits are exhausted.

**Depends on:** E2-T2.

---

## E2-T4 — Integrate metering into CRM write routes

**Goal:** Charge credits for the real actions.

**Files**
- MODIFY `server/routes/crm.js` (lead/contact/property/owner/tenant create; bulk import)
- MODIFY `server/routes/khata.js` (entry create) — confirm path exists; if khata lives elsewhere, locate via route registration in `server.js`.

**Detail**
- For each create endpoint, after the DynamoDB write succeeds, call `deductCredits(req.tenantId, cost, '<action>', { recordId })`. Wrap so a failed write does **not** charge.
- Map: leads→`lead_add`, contacts→`contact_add`, properties→`property_add`, owners→`owner_add`, customers/tenants→`tenant_add`, khata→`khata_entry`, bulk import→`bulk_import_per_record × count`.
- Keep responses unchanged on success; include `creditsRemaining` in the response body for UI convenience.

**Security**
- Never trust a client-sent cost. Cost comes from config only.

**Tests**
- Integration (supertest against the express app with mocked Dynamo): creating a lead deducts `lead_add`; failed create deducts nothing.

**Acceptance**
- Each create action moves the balance by the configured amount; failures don't.

**Depends on:** E2-T3, E2-T2.

---

## E2-T5 — Credit purchase (Razorpay Orders) + webhook grant

**Goal:** One-time credit-pack purchase that grants credits on payment capture.

**Files**
- MODIFY `server/routes/subscriptions.js` — add `POST /credits/purchase`
- MODIFY `server/routes/billing.js` — in `payment.captured` (and/or `order.paid`), if `notes.credits` present, `grantCredits`
- NEW `server/razorpayOrders.js` — create Orders via Razorpay REST (server key/secret env), since current frontend flow is subscription-only.

**Detail**
- `POST /credits/purchase` (admin/owner only): body `{ packId | credits }`. Compute amount from config (`PACKS`/`overagePricePerCredit`), create a Razorpay **Order** with `notes:{ tenantId, credits }`, return `{ orderId, amount, credits }`.
- Frontend `BuyCreditsModal` (E2-T8) opens checkout with `order_id` (not subscription_id).
- Webhook: on capture with `notes.credits`, call `grantCredits(tenantId, credits, 'purchase', { razorpayOrderId, amountPaise })`. Idempotent on `razorpayPaymentId` (store in ledger meta; skip if already granted).

**Security**
- Reuse existing HMAC verification already in `billing.js`. Validate `notes.tenantId` matches the order.
- Idempotency guard against duplicate webhook delivery.

**Tests**
- Unit: purchase computes correct amount from config; webhook grants once even if delivered twice.

**Acceptance**
- Completing a pack purchase increases balance exactly once.

**Depends on:** E2-T2, E2-T1.

---

## E2-T6 — Credit management + admin config routes

**Goal:** Read balance/ledger; let owner edit costs/packs.

**Files**
- MODIFY `server/routes/subscriptions.js`:
  - `GET /credits` → `{ balance, costs, packs, freeTier, resetDate }`
  - `GET /credits/ledger?limit&startKey` → paginated rows
- NEW `server/routes/creditAdmin.js` (mounted `/api/credit-config`, `requireRole('ADMIN','FOUNDER','OWNER')`):
  - `GET /` → current config
  - `PUT /costs`, `PUT /packs`, `PUT /free-tier` → update config table
- MODIFY `server/server.js` to mount the new router (after json + auth).

**Security**
- Config mutations admin-only; validate numeric ranges (costs ≥ 0, packs > 0).
- `GET /credits*` tenant-scoped via `req.tenantId`.

**Tests**
- Integration: non-admin gets 403 on config PUT; admin update reflected in `GET /credits`.

**Acceptance**
- Owner changes a cost in config; new value takes effect within cache TTL (~60s) with no deploy.

**Depends on:** E2-T2, E2-T1.

---

## E2-T7 — Monthly credit reset cron

**Goal:** Refresh each tenant's monthly free/plan allotment on their cycle.

**Files**
- NEW `server/scripts/credit-reset-cron.js` (handler `handler`, ships via zip)
- NEW CFN `cron/credit-reset.yaml` (clone `cron/trial-reminder.yaml`; daily; pass `CREDITS_TABLE_NAME`, `CREDIT_CONFIG_TABLE_NAME`, `SUBSCRIPTIONS_TABLE`)

**Detail**
- Daily: for each subscription whose billing/anniversary day == today (or trial tenants monthly), set the monthly allotment: free tenants → `monthlyFreeCredits`; paid → pack `monthlyCredits`. Use `resetMonthlyCredits` (set-to, not add, OR add — **decision: set-to allotment + carry-over policy = no carry-over for MVP**, configurable later).
- Idempotent: store `lastCreditResetAt` on the subscription; skip if already reset this cycle.

**Security**
- Cron Lambda role limited to the credits/subscriptions tables.

**Tests**
- Unit: tenant due today resets to correct allotment; not-due tenant untouched; double-run same day = no-op.

**Acceptance**
- On cycle day, balances refresh to plan allotment exactly once.

**Depends on:** E2-T2, E2-T1.

---

## E2-T8 — Frontend: balance display + Buy Credits

**Goal:** Show balance everywhere relevant; allow pack purchase; handle 402 gracefully.

**Files**
- MODIFY `real-estate-crm-app/src/contexts/SubscriptionContext.tsx` — also fetch `GET /api/subscriptions/credits`; expose `creditBalance`, `creditCosts`, `packs`.
- NEW `real-estate-crm-app/src/components/CreditBalanceCard.tsx` — "Credits: {balance}", reset date, "Buy more".
- NEW `real-estate-crm-app/src/components/BuyCreditsModal.tsx` — calls `POST /credits/purchase`, then `openCheckout` with `order_id` (extend `src/lib/razorpay.ts` to accept an order flow alongside subscription flow).
- MODIFY `real-estate-crm-app/src/pages/crm/BillingSettings.tsx` (E1-T3) and CRM dashboard header to mount `CreditBalanceCard`.
- Global 402 handling: in `ApiService.handleResponse`, detect `error==='insufficient_credits'` and surface a toast + open BuyCreditsModal.

**Security**
- Display only; purchases admin-gated server-side.

**Tests**
- Playwright: balance renders from mocked `/credits`; a mocked 402 triggers BuyCreditsModal.

**Acceptance**
- User sees live balance; hitting a 402 prompts purchase; completing purchase updates balance.

**Depends on:** E2-T5, E2-T6.

---

## EPIC 2 acceptance (whole)
- Free tenant starts with `monthlyFreeCredits`; actions deduct configured costs atomically; 402 when empty; pack purchase (₹1999/₹4999, 20% annual) tops up; monthly reset works; owner edits costs/packs with no deploy.
