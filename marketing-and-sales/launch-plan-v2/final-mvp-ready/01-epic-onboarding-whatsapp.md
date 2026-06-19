# EPIC 1 — Onboarding Completion + Bailey WhatsApp Gateway

**Outcome:** A new agency owner can sign up (Google OAuth → RegisterAdmin → trial), see their trial status, upgrade in-app, and (optionally) connect their WhatsApp so inbound messages reach the MCP/skills system.

**Architecture anchors (do not deviate):**
- Frontend routing: `real-estate-crm-app/src/App.tsx`, React Router v7, `ProtectedRoute` HOC (lines ~77-93).
- Signup page exists: `src/pages/RegisterAdmin.tsx` (submits `agencyName`, `displayName`, `consentAccepted` to `POST {AUTH_API_URL}/auth/register-admin`).
- Role selection navigates to `/onboarding/register-admin` (`src/pages/RoleSelection.tsx:25`) — **route is missing**, caught by `*` → `/crm`.
- Existing upgrade UI: `src/components/PaywallModal.tsx` + `src/lib/razorpay.ts` (`openCheckout`).
- Subscription state: `src/contexts/SubscriptionContext.tsx` (polls `/subscriptions/trial-status` every 5 min).
- Server webhook pattern: `server/routes/billing.js` (raw body + HMAC).

---

## E1-T1 — Wire the RegisterAdmin route (CRITICAL, unblocks signup)

**Goal:** Make `/onboarding/register-admin` reachable so ADMIN signup completes.

**Files**
- MODIFY `real-estate-crm-app/src/App.tsx`

**Detail**
- Import `RegisterAdmin` (lazy-load to match existing code-splitting if used in the file).
- Add inside the authenticated `<Routes>`:
  ```tsx
  <Route
    path="/onboarding/register-admin"
    element={<ProtectedRoute authState={authState}><RegisterAdmin /></ProtectedRoute>}
  />
  ```
- Place it alongside the other `/onboarding/*` routes (role-selection already navigates here). Do not remove the `*` fallback.

**Security**
- Route is auth-gated via `ProtectedRoute`. RegisterAdmin already sends Bearer `getIdToken()`. No tenant data exposed pre-registration.

**Tests**
- Add `tests/playwright/ui/onboarding-register-admin.spec.ts`: mock auth state = authenticated, visit `/onboarding/register-admin`, assert form renders (`agencyName`, `displayName` inputs + consent checkbox), assert submit calls `POST /auth/register-admin` (intercept).
- Verify the CI glob actually runs this path (see infra note in `08-testing-and-acceptance.md` about the `tests/*.spec.ts` vs `tests/playwright/ui/**` mismatch).

**Acceptance**
- After Google login as a new user → RoleSelection → "Admin" → RegisterAdmin form loads (no redirect to `/crm`), submission creates tenant + trial.

**Depends on:** none.

---

## E1-T2 — Trial banner + in-app upgrade entry points

**Goal:** Trial users always see days remaining and a working "Upgrade" path (reusing PaywallModal).

**Files**
- NEW `real-estate-crm-app/src/components/TrialBanner.tsx`
- MODIFY `real-estate-crm-app/src/contexts/SubscriptionContext.tsx` (expose `trialDaysLeft`, `isTrialExpired`, `gracePeriodActive` — already present in status shape; ensure exported)
- MODIFY the CRM shell/layout that renders the dashboard header (locate the component that wraps `/crm` routes in `App.tsx`) to mount `<TrialBanner />`.

**Detail**
- `TrialBanner` reads `useSubscription()`; if `isTrialing` show "`{trialDaysLeft}` days left in trial — Upgrade"; if `isTrialExpired && !isPaying` show urgent variant. Clicking opens the existing `PaywallModal` (lift its open-state into context or a small zustand/local state — match how PaywallModal is currently toggled).
- Reuse Tailwind classes/spacing from existing banners; brand primary `#2563EB`.
- Do **not** duplicate checkout logic — PaywallModal already calls `openCheckout`.

**Security**
- Read-only display of subscription status already fetched by context.

**Tests**
- `TrialBanner.test.tsx` (vitest/RTL if configured; else Playwright): renders correct copy for trialing / expired / paying (hidden) states.

**Acceptance**
- Trialing tenant sees countdown; clicking Upgrade opens PaywallModal; paying tenant sees no banner.

**Depends on:** E1-T1.

---

## E1-T3 — Billing settings page (current plan + manage)

**Goal:** A `/crm/settings/billing` page showing current plan, next billing date, trial state, and upgrade button; later hosts credit balance (E2-T7) and Buy-Credits (E2-T8).

**Files**
- NEW `real-estate-crm-app/src/pages/crm/BillingSettings.tsx`
- MODIFY `real-estate-crm-app/src/App.tsx` (add protected route)
- Reuse `apiService` pattern from `src/services/api.ts` to call `GET /api/subscriptions/current`.

**Detail**
- Show `plan`, `paymentStatus`, `nextBillingDate`, `seatsUsed/seatsPaid`, trial countdown.
- "Upgrade / Change plan" opens PaywallModal.
- Admin-only mutating actions guarded by `PermissionGuard`/`isAdmin()`.

**Security**
- `GET /subscriptions/current` already tenant-scoped server-side.

**Tests**
- Playwright: page renders plan info from a mocked `/subscriptions/current`.

**Acceptance**
- Admin can view plan + open upgrade; non-admin sees read-only.

**Depends on:** E1-T1.

---

## E1-T4 — Bailey: data model + "Connect WhatsApp" onboarding step (OPTIONAL, flagged)

**Goal:** Let an admin connect their WhatsApp Business number via Bailey. Entirely behind `BAILEY_ENABLED`.

**Files**
- MODIFY `reality-flow-authentication/src/models/usersModel.ts` — add optional fields to `UserItem`:
  ```ts
  whatsAppPhoneNumber?: string;
  whatsAppBusinessAccountId?: string;
  whatsAppVerified?: boolean;
  whatsAppConnectedAt?: string;
  ```
  (Also extend the update function used by the users controller; keep backward compatible — all optional.)
- NEW `real-estate-crm-app/src/pages/onboarding/ConnectWhatsApp.tsx` — shows Bailey QR / pairing, polls verification.
- MODIFY `real-estate-crm-app/src/App.tsx` — add `/onboarding/connect-whatsapp` (ProtectedRoute). Make it a **skippable** step after RegisterAdmin.
- NEW `server/bailey.js` — (root-level, per file convention) Bailey client wrapper (`getPairingQr(phone)`, `sendWhatsAppMessage(to,text,media)`, `verifyBaileySignature(rawBody,sig,ts)`), all no-op when `BAILEY_ENABLED!=='true'`.

**Detail**
- Wrapper mirrors the AiSensy helper style in `billing.js` (axios, non-fatal try/catch, env-guarded).
- Frontend step must be optional: a "Skip for now" button routes to `/crm`.

**Security**
- Store only the connected number + WABA id; no message bodies at rest beyond the audit table (E1-T6).
- Validate phone format server-side before persisting.

**Tests**
- Unit test `bailey.js` returns no-op shapes when disabled.
- Playwright: with flag on (mocked), QR step renders and Skip works.

**Acceptance**
- With `BAILEY_ENABLED=false` (default) the step is hidden and nothing breaks. With it on, admin can connect or skip.

**Depends on:** E1-T1.

---

## E1-T5 — Bailey inbound webhook (OPTIONAL, flagged)

**Goal:** Receive WhatsApp messages and enqueue them for processing, with verified signatures.

**Files**
- NEW `server/routes/webhooks.js` — `POST /api/webhooks/whatsapp`
- MODIFY `server/server.js` — mount `webhooksRoutes` **before** `express.json()` using `express.raw({ type: 'application/json' })` (same ordering trick as billing).

**Detail**
- Verify `x-bailey-signature` + `x-bailey-timestamp` via `verifyBaileySignature` (HMAC-SHA256, timing-safe — copy the exact compare from `billing.js`).
- Resolve tenant by the destination number (`to`) → look up user with `whatsAppPhoneNumber` (auth svc internal endpoint or a GSI). Reject unknown numbers with 200 (ack) but no-op.
- Publish an EventBridge event `source: 'whatsapp.incoming'`, `detailType: 'message.received'` with `{messageId, from, to, text, media, tenantId, receivedAt}`. (EventBridge client = v3 `@aws-sdk/client-eventbridge`, new dep.)
- Always return 200 quickly; processing is async.

**Security**
- Reject on signature mismatch (401). Never echo secrets. Rate-limit per source number.
- Idempotency: dedupe on `messageId`.

**Tests**
- Unit: valid signature → 200 + event published (mock EventBridge); invalid → 401.

**Acceptance**
- Signed inbound message produces exactly one EventBridge event; unsigned is rejected.

**Depends on:** E1-T4, infra `07` (EventBridge rule + permission).

---

## E1-T6 — Bailey message processor → MCP/skills (OPTIONAL, flagged)

**Goal:** Turn an inbound WhatsApp message into a CRM action via the MCP/skills layer, then reply.

**Files**
- NEW `server/scripts/whatsapp-message-processor.js` (Lambda handler `handler`, placed in `scripts/` so it ships via existing zip).
- NEW cron/event CFN: see `07-infra-cfn-deploy.md` (`whatsapp-processor.yaml`).
- NEW `server/whatsappAuditService.js` — persist message + outcome in CRM table under `PK=TENANT#{t}#WHATSAPP#{messageId}`.

**Detail**
- Parse a deterministic command grammar first (cheap, no LLM):
  - `lead: <name>, <phone>, <type>` → calls skill/MCP `create_lead`.
  - `search leads <filter>` → `search_leads`.
  - Fallback: route free text to the Router agent (EPIC 6) if `AGENTS_ENABLED`.
- Invoke the skill via the same mechanism the MCP server uses (EPIC 6, `E6-T1`) — reuse one shared invoker module to avoid duplication.
- Reply via `bailey.sendWhatsAppMessage`.
- **Deduct credits** for `whatsapp_send` and for any CRM mutation (EPIC 2 middleware/service).

**Security**
- All actions execute under the resolved `tenantId` only.
- Validate parsed fields before calling skills (reuse server validation utils in `server/validation/`).

**Tests**
- Unit: command parser table-driven tests; processor calls invoker with correct tenant + deducts credits (mock creditService).

**Acceptance**
- "lead: Rahul, 9876543210, buyer" via WhatsApp creates a lead for the right tenant and replies with confirmation; credits decremented.

**Depends on:** E1-T5, E2 (credits), E6-T1 (skill invoker).

---

## EPIC 1 open decisions
- Bailey vendor specifics (signature header names, pairing API shape) must be confirmed against Bailey docs at implementation time; the wrapper isolates this.
- Default ship state: **`BAILEY_ENABLED=false`**. Core onboarding (T1–T3) ships regardless.
