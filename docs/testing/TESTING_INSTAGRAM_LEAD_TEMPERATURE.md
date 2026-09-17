# Testing guide — Instagram lead intake + Lead Temperature migration

Covers everything shipped in this PR: the Instagram/ManyChat webhook intake, the
retirement of `priority` in favor of `score` (Hot/Warm/Cold), the AI qualification
call pipeline (repaired `aiCallingInternal.js` + `ai-calling-service`), and the
frontend surfaces for all of it. Written so someone unfamiliar with the change can
follow it end to end with real commands and expected output.

---

## 0. Prerequisites

### Environment variables (`agency-app/api/.env`)

```bash
CRM_DYNAMODB_TABLE_NAME=...
AGENCY_CONFIG_DYNAMODB_TABLE_NAME=...
NOTIFICATIONS_TABLE_NAME=...
AUTH_SERVICE_URL=...
INTERNAL_API_KEY=...
AGENTS_ENABLED=true                      # gates lead.created/lead.qualified events
AI_CALLING_INTERNAL_API_KEY=some-shared-secret   # NEW — ai-calling-service -> CRM auth
AI_CALLING_SERVICE_URL=https://<ai-calling-service-url>  # NEW — CRM -> ai-calling-service
```

### Tenant setup (DynamoDB `AgencyConfig` table, or via the service functions)

```js
// One-time, per tenant testing this feature:
await updateAgencyConfig(tenantId, {
  instagramWebhookToken: 'test-webhook-token-123',  // used in the webhook URL
  aiEmployeeEnabled: true,                          // required for AI qualification
});
```

Without `aiEmployeeEnabled: true`, the webhook intake and manual-override paths
still work — only the AI qualification call ("Call now to qualify" button, and
automatic qualification) is gated off, by design (see § 4).

### Local server

```bash
cd server && npm run dev   # or your usual local start command
```

---

## 1. Instagram webhook intake

### 1a. Happy path

```bash
curl -X POST http://localhost:3000/api/webhooks/instagram/test-webhook-token-123 \
  -H "Content-Type: application/json" \
  -d '{
    "subscriberId": "manychat-sub-001",
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "requirement": "buy",
    "budgetBracket": "80L-1Cr",
    "preferredArea": "Andheri West",
    "postId": "17912345678901234",
    "permalink": "https://instagram.com/p/example"
  }'
```

**Expected:** `200 { "ok": true, "leadId": "<uuid>" }`

Then verify the lead in the CRM:

```bash
curl http://localhost:3000/api/crm/leads/<leadId> -H "Authorization: Bearer <token>"
```

Check:
- `source` = `"Instagram"`
- `leadType` = `"buyer"`
- `buyerRequirement.requirement` = `"buy"`, `budget` = `8000000` (80L bracket → lower bound)
- `buyerRequirement.preferredArea` = `"Andheri West"`
- `reelRef` = `{ "postId": "17912345678901234", "permalink": "https://instagram.com/p/example" }`
- `score` = `null` (not yet qualified)
- **No `priority` field at all** — this is the core of the migration; confirm it's absent, not just `null`.

### 1b. Idempotency

Re-send the exact same request (same `subscriberId` + `postId`). Expected: `200 { "ok": true, "duplicate": true }` — no second lead created.

### 1c. Unknown webhook token

```bash
curl -X POST http://localhost:3000/api/webhooks/instagram/does-not-exist \
  -H "Content-Type: application/json" -d '{"name":"X","phone":"123"}'
```
**Expected:** `200 { "ok": true, "skipped": true, "reason": "unknown_webhook_token" }` — 200, not 401/404, by design (ManyChat retries aggressively on non-2xx).

### 1d. Missing name/phone

```bash
curl -X POST http://localhost:3000/api/webhooks/instagram/test-webhook-token-123 \
  -H "Content-Type: application/json" -d '{"requirement":"rent"}'
```
**Expected:** `200 { "ok": true, "skipped": true, "reason": "missing_name_or_phone" }`

### 1e. Budget bracket parsing — check a few shapes manually

`<50L` → 4,900,000 (lower bound minus 1L, conservative) · `50L-80L` → 5,000,000 · `1Cr+` → 10,000,000. If these look wrong for your actual ManyChat bracket copy, adjust `parseBudgetBracket()` in `agency-app/api/routes/webhooks.js` — it's a pure function, easy to unit test in isolation.

### 1f. In-app notification fired

Check the tenant's notification inbox (`GET /api/notifications`) — a `NEW_LEAD` notification should appear immediately, referencing the new lead, regardless of `AGENTS_ENABLED`.

---

## 2. Temperature filtering, sorting, metrics

```bash
# Filter
curl "http://localhost:3000/api/crm/leads?temperature=hot" -H "Authorization: Bearer <token>"
curl "http://localhost:3000/api/crm/leads?temperature=unscored" -H "Authorization: Bearer <token>"

# Sort
curl "http://localhost:3000/api/crm/leads?sortBy=temperature&sortOrder=desc" -H "Authorization: Bearer <token>"

# Metrics
curl "http://localhost:3000/api/crm/leads/metrics" -H "Authorization: Bearer <token>"
```

**Expected metrics shape:**
```json
{
  "total": 42,
  "byType": { "buyer": 30, "seller": 5, "tenant": 4, "owner": 3 },
  "byStatus": { "new": 10, "contacted": 8, "...": "..." },
  "byTemperature": { "hot": 5, "warm": 12, "cold": 8, "unscored": 17 },
  "conversionRate": 22
}
```
No `byPriority` key should be present.

### Regression check — old `priority` param is silently ignored, not an error

```bash
curl "http://localhost:3000/api/crm/leads?priority=high" -H "Authorization: Bearer <token>"
```
**Expected:** `200`, returns leads **unfiltered** by that param (since `priority` is no longer a recognized filter) — not a 400/500. Confirms backward compatibility for any client not yet updated.

---

## 3. Manual temperature override

```bash
curl -X PUT http://localhost:3000/api/crm/leads/<leadId> \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"score": "HOT"}'
```

Check the response / a follow-up `GET`:
- `score` = `"HOT"`
- `scoreSource` = `"manual"` (stamped by the server — confirm you did **not** send `scoreSource` yourself and it still shows up)
- `scoredAt` = a fresh timestamp

If this is the lead's **first** transition to `HOT` and it's already `assignedTo` someone, check that team member's notification inbox for a `LEAD_HOT` notification (🔥 Hot lead).

### Regression check — sending old `priority` in a PUT is silently dropped

```bash
curl -X PUT http://localhost:3000/api/crm/leads/<leadId> \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"priority": "high", "notes": "test"}'
```
**Expected:** `200`, `notes` updates, no `priority` field appears anywhere in the response.

---

## 4. AI qualification call

This exercises the repaired `aiCallingInternal.js` + `ai-calling-service`. Two ways to test depending on how far your environment is set up.

### 4a. Without a deployed `ai-calling-service` (internal API contract only)

Simulate what `ai-calling-service` would send, directly against the CRM:

```bash
# 1. Context fetch (what the call script would use)
curl "http://localhost:3000/api/internal/leads/<leadId>/context" \
  -H "x-api-key: <AI_CALLING_INTERNAL_API_KEY>" -H "x-tenant-id: <tenantId>"
```
**Expected:** `200` with `lead`, `summary`, and `rubricContext: { hasNamedAreaOrBuilding, requirementType }`. Set the lead's `preferredArea` to `"Andheri West"` vs `"Mumbai"` and confirm `hasNamedAreaOrBuilding` flips `true`/`false` accordingly (city-level values don't count).

```bash
# 2. Simulate a completed qualification call reporting HOT
curl -X PATCH "http://localhost:3000/api/internal/leads/<leadId>/call-outcome" \
  -H "x-api-key: <AI_CALLING_INTERNAL_API_KEY>" -H "x-tenant-id: <tenantId>" \
  -H "Content-Type: application/json" \
  -d '{
    "callSessionId": "test-session-1",
    "status": "completed",
    "duration": 87,
    "outcome": "interested",
    "callPurpose": "lead_qualification",
    "temperature": "HOT",
    "scoreValue": 85,
    "scoreReasons": "Named Andheri West and a specific building, wants to move this week."
  }'
```
**Expected:** `200 { "success": true, "score": "HOT", "assignedTo": "<userId or null>" }`. Then confirm:
- The lead's `score`/`scoreValue`/`scoreReasons`/`scoredAt` are set, `scoreSource` = `"ai_call"`.
- If `AGENTS_ENABLED=true`, a `lead.qualified` EventBridge event fired (check logs for `aiCallingInternal.callOutcome.lead_qualified_event_published`) and, if the qualifier/router Lambdas are deployed, the lead gets auto-assigned shortly after.
- A `LEAD_HOT` notification appears.

### Regression check — auth is enforced

```bash
curl -X PATCH "http://localhost:3000/api/internal/leads/<leadId>/call-outcome" \
  -H "x-tenant-id: <tenantId>" -H "Content-Type: application/json" -d '{"status":"completed"}'
```
**Expected:** `401` (missing/wrong `x-api-key`).

### 4b. With a deployed `ai-calling-service` — full loop

1. Deploy `agency-app/ai-calling/cfn-template.yaml` with real Exotel + ElevenLabs credentials.
2. In the CRM UI, open a lead's detail page or drawer and click **"Call now to qualify"**.
3. Expected: a toast "Qualification call started"; a real phone call should ring the lead's number within seconds.
4. During the call, the agent should ask 2-3 short questions per the rubric (`agency-app/api/utils/leadRubric.js`) and end within ~90 seconds.
5. After the call ends, poll the lead (`GET /api/crm/leads/<leadId>`) — `score` should update within a few seconds of the call ending. If it doesn't, check `ai-calling-service` logs for `Qualification call ended without a parseable result` — this means the agent didn't emit `[QUALIFICATION_RESULT: {...}]`; the lead stays unscored, which is the intended fail-safe (no guessing).

### Regression check — `aiEmployeeEnabled` gate

With `aiEmployeeEnabled: false` for the tenant, click "Call now to qualify" in the UI (or `POST /api/crm/leads/<leadId>/qualify-call`).
**Expected:** `409 { "error": "AI calling not enabled for this tenant" }`. The UI button should be hidden in this case, not just error — if you see the button when the flag is off, that's a bug to fix before merging.

---

## 5. LLM-fallback qualification (no call)

If `AGENTS_ENABLED=true` and `aiEmployeeEnabled=true` but AI calling isn't configured/deployed, `lead-qualifier-handler.js` still fires on `lead.created` and gives a fast text-only guess.

Trigger manually (mirrors what EventBridge would send):

```bash
node -e "
import('./server/scripts/lead-qualifier-handler.js').then(({handler}) =>
  handler({ detail: { tenantId: '<tenantId>', leadId: '<leadId>' } })
).then(r => console.log(JSON.stringify(r, null, 2)));
"
```

**Expected:** the lead gets `score`/`scoreValue`/`scoreReasons`/`scoredAt`, `scoreSource: "llm_text"`. If you then simulate an AI call outcome (§4a) for the same lead, confirm the AI call's result **overwrites** the LLM-text result (more authoritative) — `scoreSource` should flip to `"ai_call"`.

---

## 6. Backfill script (existing leads → temperature)

```bash
# Dry run first — always
node agency-app/api/scripts/backfill-lead-temperature.js --tenant=<tenantId>

# Review the printed JSON summary: migrated / leftUnscored / skippedAlreadyScored counts

# Then actually write
node agency-app/api/scripts/backfill-lead-temperature.js --apply --tenant=<tenantId>
```

**Expected mapping** (conservative — nothing becomes HOT automatically):
- old `priority: high` → `score: WARM`
- old `priority: medium` → `score: WARM`
- old `priority: low` → `score: COLD`
- no old `priority` at all → left `unscored` (not guessed at)

All migrated leads get `scoreSource: "migrated"` — verify this is visibly distinguishable in the UI (badge still shows Hot/Warm/Cold correctly; `scoreReasons` shows the "Migrated from priority=..." note).

Run it a second time (without `--apply`, or with) — leads that already have a `score` should show up under `skippedAlreadyScored`, not get re-migrated.

---

## 7. Frontend walkthrough

1. **Lead List** (`/crm/leads`)
   - Temperature column shows a colored badge (🔥 rose / 🌤️ amber / ❄️ sky / grey "Unscored") instead of the old Low/Medium/High priority pill.
   - Open Filters → new **Temperature** dropdown (All / Hot / Warm / Cold / Unscored) sits alongside Type/Status/Agent. Selecting "Hot" and confirming the list narrows correctly.
   - Click the Temperature column header — list re-sorts by `scoreValue` descending/ascending.

2. **Lead Drawer** (click a lead from the list) and **Lead Details page** (`/crm/leads/:id`)
   - Temperature badge + `scoreReasons` (if any) shown where Priority used to be.
   - "Change" link opens an inline Hot/Warm/Cold picker; Save persists it (see §3) and updates the badge without a full page reload.
   - "Call now to qualify" button — hidden if `aiEmployeeEnabled` is off for the tenant; visible and clickable otherwise (see §4).
   - Neither page should show a "Priority" label or Low/Medium/High dropdown anywhere.

3. Create a **new** lead via the UI form — confirm it saves successfully with no `priority` field sent, and the new lead shows "Unscored" until qualified.

---

## 8. Regression checklist — things that must NOT have broken

- [ ] Creating/updating/searching/converting a **Buyer** — its own `priority` (low/medium/high) field, dropdown, and filters are untouched. (`pages/crm/BuyerDetails.tsx`)
- [ ] **Customer/Tenant** and **B2B Lead** lists — their own `priority` filters/columns are untouched. (`CustomerList.tsx`, `TenantList.tsx`, `B2BLeadsList.tsx`)
- [ ] Lead **conversion** (Lead → Buyer) still works; the new Buyer's `priority` is now derived from the lead's `score` (HOT→high, WARM→medium, COLD→low, unscored→`medium` default) instead of a nonexistent `lead.priority` — spot-check a HOT lead converts to a `high`-priority Buyer.
- [ ] Existing **WhatsApp webhook** (`POST /api/webhooks/whatsapp`) still works — untouched, but confirm the new `/instagram/:token` route mounted alongside it didn't disturb routing.
- [ ] AI chat agent — ask it "show me hot leads" / "leads breakdown" / "who should I call" and confirm it responds sensibly using the new temperature language, not stale "priority" wording, and doesn't error out.
- [ ] Run the backend test suite: `cd server && npm test`. Expected: all tests pass **except** these pre-existing, unrelated failures (confirmed via `git diff` against the base branch showing zero changes to the files/logic involved — not introduced by this PR):
  - `normalizers/leadTextNormalizer.test.js` — `titleCase` casing bug, unrelated to leads/temperature.
  - `skillInvoker.test.js` — 8 handler-argument-shape mismatches on unrelated tools (`delete_lead`, `get_property`, `update_contact_role`, `create_meeting`, `get_crm_metrics`, `delete_buyer`, etc.) — none reference priority/temperature/score.
  - `agents/responseFormatter.test.js` — 2 unrelated formatting mismatches ("Andheri West" missing from a create-confirmation card, `*Note*` header missing from note formatting).
  - If any *other* test fails, that's a real regression — do not merge until fixed.
- [ ] Frontend production build succeeds: `cd real-estate-crm-app && npm run build`.

---

## 9. Known follow-ups (not blocking, tracked as open items)

- `agency-app/ai-calling/cfn-template.yaml` doesn't wire a `WEBHOOK_BASE_URL` env var — pre-existing gap, needed before ElevenLabs intent webhooks work live, unrelated to this migration.
- No email notification for "new lead" to the tenant owner specifically (only in-app) — resolving a reliable owner-contact-email source (Subscriptions table) was deliberately deferred rather than guessed at.
- Backfill's `high→WARM` / `medium→WARM` / `low→COLD` mapping is a starting judgment call — revisit after watching real qualification-call results for a few weeks.
