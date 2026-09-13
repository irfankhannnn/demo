# Lead adapter + billing — test plan

Covers everything in `lead-adapter-architecture.md`: the lead-adapter pipeline
(Phases 0–4) and the billing model rework. Written so someone who did not make the
change can verify it end to end.

Two halves:
- **Part A — automated.** Already written and passing; run these first.
- **Part B — manual.** Needs a running stack; this is the part to walk through together.

---

## Part A — automated tests

### A1. Run everything

```bash
# Instagram microservice — 91 tests (80 pre-existing + 11 new)
cd backend_insta_sol_ms && npm test

# CRM server — jest is NOT in server/node_modules, so use npx
cd server
NODE_OPTIONS=--experimental-vm-modules npx jest leadIngestion.test.js
NODE_OPTIONS=--experimental-vm-modules npx jest aiCallBilling.test.js

# Type checks (both should add no NEW errors — see A3)
cd real-estate-crm-app && npx tsc --noEmit
cd frontend_insta_sol_ms && npx tsc --noEmit
```

### A2. Expected results

| Suite | Tests | What it proves |
|---|---|---|
| `backend_insta_sol_ms` | **91 pass** | Bridge mapping, retry-safety, chunking, kill switch, and that the 80 pre-existing tests still pass |
| `server/leadIngestion.test.js` | **16 pass** | Budget parsing (both vocabularies), intent→leadType, rental-vs-buyer split, seller price mapping, quality bar, dedupe, notification/EventBridge failure isolation |
| `server/aiCallBilling.test.js` | **9 pass** | Per-started-minute rounding, no double-charge, no charge without a session id, unanswered calls free, zero-rate disable, never throws |

### A3. Type-check baseline (important)

`real-estate-crm-app` has **98 pre-existing type errors** unrelated to this work.
Three are in files this change touched and were verified identical before and
after:

```
LeadDrawer.tsx(57,32)  TS6133 'LeadType' declared but never read
LeadDrawer.tsx(725,76) TS2769 No overload matches this call
LeadList.tsx(112,30)   TS6133 'reset' declared but never read
```

To re-verify the baseline yourself:

```bash
cd real-estate-crm-app
git stash push -- src/pages/crm/LeadList.tsx src/pages/crm/LeadDrawer.tsx \
                  src/pages/crm/LeadDetails.tsx src/types/crm.ts
npx tsc --noEmit 2>&1 | grep -E "LeadList|LeadDrawer|LeadDetails|types/crm"
git stash pop
```

The same three lines must appear. `frontend_insta_sol_ms` type-checks **clean**.

---

## Part B — manual verification

### B0. Setup

```bash
# server/.env
ADAPTER_INTERNAL_API_KEY=$(openssl rand -hex 32)   # note this value
AGENTS_ENABLED=true

# backend_insta_sol_ms/.env — the key MUST match the one above
CRM_INTERNAL_API_URL=http://localhost:3000
ADAPTER_INTERNAL_API_KEY=<same value>
INSTA_PROMOTE_ENQUIRIES_TO_LEADS=true
```

A tenant needs `instagramWebhookToken` set for B2:

```js
await updateAgencyConfig(tenantId, { instagramWebhookToken: 'test-token-123' });
```

---

### B1. Manual lead creation is free ← *the reported bug*

1. Note the credit balance (CRM → Billing Settings).
2. Create a lead by hand in the CRM UI.
3. **Expect:** lead created, **balance unchanged**, no ledger entry.
4. Billing Settings' per-action cost table should now show 0 for Lead/Contact/
   Property/Owner/Tenant/Khata (it renders straight from the API, so this needs no
   frontend change).

> This is what your tester hit. Previously every manual lead cost 10 credits.

---

### B2. ManyChat adapter still works, unchanged

```bash
curl -X POST http://localhost:3000/api/webhooks/instagram/test-token-123 \
  -H "Content-Type: application/json" \
  -d '{"subscriberId":"sub-001","name":"Rahul Sharma","phone":"9876543210",
       "requirement":"buy","budgetBracket":"80L-1Cr","preferredArea":"Andheri West",
       "postId":"179123","permalink":"https://instagram.com/p/abc"}'
```

**Expect:** `{"ok":true,"leadId":"..."}`; a buyer lead, `source: 'Instagram'`,
`sourceAdapter: 'manychat'`, `buyerRequirement.budget: 8000000`, `reelRef` populated.

Regression checks on the same endpoint:

| Input | Expect |
|---|---|
| `"requirement":"rent"` | leadType **tenant**, budget in `tenantRequirement` |
| `"requirement":"heavy_deposit_ok"` | leadType **tenant** |
| `"requirement":"sell"` | leadType **seller**, `sellerProperty.expectedPrice` ← *new; this silently became a buyer before* |
| same `subscriberId` + `postId` twice | second returns `duplicate: true`, only one lead |
| missing `phone` | `skipped: true`, no lead |
| bad token | `200 {skipped, unknown_webhook_token}` — **not** 401 (ManyChat must not retry a config error) |

---

### B3. Instagram agent adapter → CRM lead (the new path)

```bash
curl -X POST http://localhost:3000/api/internal/adapters/leads \
  -H "Content-Type: application/json" \
  -H "x-api-key: <ADAPTER_INTERNAL_API_KEY>" \
  -H "x-tenant-id: <tenantId>" \
  -d '{"leads":[{"name":"Priya Nair","phone":"9812345678","intent":"rent",
       "budgetBracket":"25L_50L","preferredArea":"Powai","source":"Instagram",
       "sourceAdapter":"insta-agent","dedupeKey":"ENQ-1",
       "externalRef":{"igUsername":"priya.n","igSenderId":"IGSID1","sourceMediaId":"M9"}}]}'
```

**Expect:** `{"ok":true,"results":[{"created":true,"leadId":"..."}]}`, a **tenant**
lead with `externalRef` populated and `reelRef.postId: "M9"`.

Security and edge cases:

| Case | Expect |
|---|---|
| wrong `x-api-key` | **401** |
| missing `x-tenant-id` | **400** |
| the AI-calling key instead of the adapter key | **401** (keys are separate by design) |
| same `dedupeKey` twice | second `duplicate: true`, one lead only |
| `"intent":"unknown"` | `skipped: true, reason: unresolved_lead_type`, no lead |
| no `phone` | `skipped: true, reason: missing_name_or_phone` |
| batch of 101 | **400** |
| one bad item in a batch of 3 | other 2 still created |

---

### B4. Full agent → microservice → CRM chain

Post a signed enquiry to `POST /api/insta/agent/enquiries` (HMAC, as the laptop
agent does).

**Expect:** `200` with a `promotion` block (`{forwarded: true, created: 1}`); the
enquiry in `insta-data` **and** a matching lead in `CrmTable`.

| Case | Expect |
|---|---|
| CRM stopped | **502**, `promotion.reason: 'network_error'`, **enquiry still stored** |
| retry after CRM restarts | succeeds, **still only one lead** (dedupe on `enquiryId`) |
| `INSTA_PROMOTE_ENQUIRIES_TO_LEADS=false` | `200`, enquiry stored, no CRM call |
| `CRM_INTERNAL_API_URL` blank | `200`, standalone mode, no failure |

---

### B4b. One person is one lead (phone dedupe)

The behaviour most worth testing hard, because getting it wrong either duplicates
people or silently overwrites an agent's work.

| # | Do this | Expect |
|---|---|---|
| 1 | Send a ManyChat lead (B2), then an Instagram agent enquiry (B3) with the **same phone** | **One** lead, not two. Second call reports `updated: true` (or `unchanged`) |
| 2 | On that lead, set status `qualified`, assign an agent, let it get a score. Then send another enquiry with the same phone | status, score and assignee **unchanged** |
| 3 | Lead has `budget: 8000000`. Send an enquiry quoting `budgetBracket` implying 5000000 | budget **stays 8000000** — a later enquiry does not revise a recorded budget |
| 4 | Lead has no `preferredArea`. Send an enquiry with one | area **is filled in** |
| 5 | Send an identical enquiry twice (nothing new) | Second is `unchanged: true`, **no** DynamoDB write, **no** new note line |
| 6 | Send 5 identical repeat enquiries | Notes gain **no** extra lines; item does not grow. *(This is the WhatsApp-volume protection.)* |
| 7 | Existing **buyer** lead; send a `rent` enquiry, same phone | Lead stays `buyer`; a note records the rental interest; `tenantRequirement` **not** written |
| 8 | One batch containing two enquiries with the same phone | **One** lead created, not two |
| 9 | Two enquiries with different unparseable phones (e.g. `+1-555-0100`, `+44 20 7946 0958`) | **Two separate** leads — blank normalized phones must never merge |
| 10 | Convert a lead, then send a new enquiry with that phone | A **new** lead is created (the converted one is gone by design) |
| 11 | Mark a lead `spam`, then send another enquiry with that phone | Existing lead updated; status **stays spam**; no new lead |
| 12 | Repeat enquiry on an existing lead | **No** duplicate notification, and **no** second AI qualification call (so no double billing) |

> Item 12 is the money one: an update must not re-fire `notifyNewLead` or
> `lead.created`, or every repeat DM would re-notify the agent and re-bill a
> qualification call.

---

### B5. One pipeline — the actual point

For a lead from **each** adapter (B2 and B3), confirm identical downstream
behaviour:

1. Notification fires.
2. `lead.created` published (needs `AGENTS_ENABLED=true`).
3. `LeadQualifierRule` → `lead-qualifier-handler` sets `score` with
   `scoreSource: 'llm_text'` (needs provisioning `live` **and** `aiEmployeeEnabled`).
4. "Call now to qualify" places a call; the outcome sets `score` with
   `scoreSource: 'ai_call'`, overwriting the text guess.
5. Converting the lead writes a BUYER/OWNER/CUSTOMER item and removes the LEAD row.

**Nothing in steps 1–5 should behave differently based on which adapter created the
lead.** If it does, that's the bug this whole change exists to prevent.

---

### B6. AI call billing

| Scenario | Expect |
|---|---|
| 90-second call | **30 credits** (2 started minutes × 15) |
| 10-second call | **15 credits** (1 started minute) |
| call-outcome delivered twice, same `callSessionId` | charged **once** |
| unanswered call, `duration: 0` | **no charge** |
| balance < 15 when starting a call | `POST /leads/:id/qualify-call` → **402**, no call placed |
| balance runs out mid-call | outcome still saved and scored; charge logged as `insufficient_credits` |

Verify the ledger entry records `callSessionId`, `durationSecs`, `minutes`, `perMinute`.

Also confirm an AI WhatsApp reply still deducts 15 (`agent_action`) — unchanged.

---

### B7. New statuses

1. Set a lead to **Site Visit** in LeadList, LeadDrawer and LeadDetails.
2. Set another to **Spam**.
3. **Expect:** badge reads "Site Visit" (not `site_visit`); filter by each works.
4. **Expect:** the spam lead is **not** picked up by follow-up crons or AI
   qualification; the site_visit lead **is** (it is active pipeline).

---

### B8. Phase 0 — the scan→query swap

Highest-risk change: if it were wrong, leads would silently vanish from lists.

1. Compare `GET /api/crm/leads` counts against the pre-change deploy for a tenant
   with a meaningful number of leads. **They must match exactly.**
2. Verify every filter still works: leadType, status, temperature, assignment,
   date range, budget range, area, city, propertyType, search, source.
3. Check for a tenant whose leads exceed one DynamoDB page (>1MB) — pagination must
   still return everything.
4. Confirm converted leads still behave correctly with `excludeConverted`.

> Safety argument: every LEAD item has written `GSI3PK`/`GSI3SK` since `createLead`
> was first committed (same commit), and the demo seeder sets them too — so no lead
> can exist outside `search-index`. Step 1 is the empirical confirmation.

---

## Part C — deploy

**Not yet deployed.** Order matters: the CRM must accept adapter traffic before the
microservice starts sending it.

```bash
# 1. CRM first — adds the adapter route + ADAPTER_INTERNAL_API_KEY
cd server/infra && ./deploy.sh <env>

# 2. Verify the route exists and rejects a bad key
curl -i -X POST https://<crm-api>/api/internal/adapters/leads \
  -H "x-api-key: wrong" -H "x-tenant-id: t" -d '{"leads":[]}'   # expect 401

# 3. Microservice second
cd backend_insta_sol_ms/infra && ./deploy.sh <env>

# 4. Frontends
cd real-estate-crm-app && npm run build && <deploy>
cd frontend_insta_sol_ms && npm run build && <deploy>
```

Both stacks need the **same** `ADAPTER_INTERNAL_API_KEY` in their `.env.<env>`
before deploying (`openssl rand -hex 32`). It flows via CFN param → SSM, per the
repo's existing secret convention.

**Rollback:** set `INSTA_PROMOTE_ENQUIRIES_TO_LEADS=false` on the microservice —
promotion stops immediately, the Instagram feature keeps working, and nothing in
the CRM is affected. No redeploy of the CRM needed.
