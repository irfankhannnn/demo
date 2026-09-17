# EPIC 1 — Onboarding Completion + Bailey WhatsApp Gateway

**Outcome:** A new agency owner can sign up (Google OAuth → RegisterAdmin → trial), see their trial status, upgrade in-app, and (optionally) connect their WhatsApp so inbound messages reach the MCP/skills system.

**Architecture anchors (do not deviate):**
- Frontend routing: `agency-app/web/src/App.tsx`, React Router v7, `ProtectedRoute` HOC.
- Signup page: `agency-app/web/src/pages/RegisterAdmin.tsx` — **ALREADY EXISTS**, only needs a route.
  Submits `agencyName`, `displayName`, `consentAccepted` to `POST {VITE_AUTH_API_URL}/auth/register-admin`.
- Role selection (`src/pages/RoleSelection.tsx`) navigates to `/onboarding/register-admin` — **route is missing**, caught by `*` → `/crm`.
- Existing upgrade UI: `agency-app/web/src/components/PaywallModal.tsx` + `agency-app/web/src/lib/razorpay.ts` → `openCheckout({ planId, name, email, phone?, onSuccess, onFailure, onDismiss? })`.
- Trial countdown: `agency-app/web/src/components/TrialCountdownBanner.tsx` — **ALREADY EXISTS**. Reuse/extend; do NOT create a duplicate.
- Subscription state: `agency-app/web/src/contexts/SubscriptionContext.tsx`, hook `useSubscriptionContext()`, polls `GET /api/subscriptions/trial-status` every 5 min. Exposes: `{ subscription, isPaying, isTrialing, trialDaysLeft, isTrialExpired, gracePeriodActive, refetch }`.
- Server webhook pattern: `agency-app/api/routes/billing.js` — HMAC timing-safe compare + `express.raw()` per-route. Copy this exact pattern for Bailey webhook.
- Server auth URL env: `AUTH_SERVICE_URL` (server-side) / `VITE_AUTH_API_URL` (frontend).
- See `notes/codebase-reference.md` for all exact paths, function signatures, and env vars.

---

## E1-T1 — Wire the RegisterAdmin route (CRITICAL, unblocks signup)

**Status:** ✅ IMPLEMENTED (2026-06-19, branch `mvp-readiness-launch`)

**Goal:** Make `/onboarding/register-admin` reachable so ADMIN signup completes.

**Files**
- MODIFY `agency-app/web/src/App.tsx`

**Detail**
- `RegisterAdmin` page already exists at `agency-app/web/src/pages/RegisterAdmin.tsx`. Do NOT recreate it.
- Import it (lazy-load to match other page imports — check if other onboarding pages use `lazy()`):
  ```tsx
  const RegisterAdmin = lazy(() => import('./pages/RegisterAdmin'));
  ```
- Add inside the authenticated `<Routes>` near `/onboarding/role-selection`:
  ```tsx
  <Route
    path="/onboarding/register-admin"
    element={<ProtectedRoute authState={authState}><RegisterAdmin /></ProtectedRoute>}
  />
  ```
- Place it alongside the other `/onboarding/*` routes. Do not remove the `*` fallback.
- `authState` is the local state variable already used in the existing `ProtectedRoute` JSX in `App.tsx`.

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

**Status:** ✅ IMPLEMENTED (2026-06-19, branch `mvp-readiness-launch`)

**Goal:** Trial users always see days remaining and a working "Upgrade" path (reusing PaywallModal).

**Files**
- CHECK FIRST: `agency-app/web/src/components/TrialCountdownBanner.tsx` — **this already exists**. Read it before creating anything new.
  - If it already shows trial days + upgrade CTA → just wire it up (mount it in the layout).
  - If it lacks days-left display or upgrade button → extend it in place; do NOT create a duplicate file.
  - Only create `TrialBanner.tsx` as a new file if the existing one is architecturally incompatible.
- MODIFY `agency-app/web/src/contexts/SubscriptionContext.tsx` — verify `trialDaysLeft`, `isTrialExpired`, `gracePeriodActive` are exported from `useSubscriptionContext()`. They are already in the `SubscriptionStatus` type — confirm they're in the hook return.
- MODIFY the CRM shell/layout that renders the dashboard header (locate the component that wraps `/crm` routes in `App.tsx`) to mount the trial banner component.

**Detail**
- Read `TrialCountdownBanner.tsx` first. Then:
- Banner reads `useSubscriptionContext()` → `{ isTrialing, trialDaysLeft, isTrialExpired, isPaying, gracePeriodActive }`.
- If `isTrialing`: show "`{trialDaysLeft}` days left in trial — Upgrade".
- If `isTrialExpired && !isPaying && !gracePeriodActive`: show urgent variant.
- If `isPaying`: render nothing.
- Clicking "Upgrade" opens the existing `PaywallModal` (set `forceOpen={true}` on local state, `onClose` resets it).
  ```tsx
  // PaywallModal props: { forceOpen?: boolean, onClose?: () => void }
  const [showPaywall, setShowPaywall] = useState(false);
  <PaywallModal forceOpen={showPaywall} onClose={() => setShowPaywall(false)} />
  ```
- Reuse Tailwind classes/spacing from existing banners; brand primary `#2563EB`.
- Do **not** duplicate checkout logic — `PaywallModal` → `openCheckout` already handles it.

**Security**
- Read-only display of subscription status already fetched by context.

**Tests**
- `TrialBanner.test.tsx` (vitest/RTL if configured; else Playwright): renders correct copy for trialing / expired / paying (hidden) states.

**Acceptance**
- Trialing tenant sees countdown; clicking Upgrade opens PaywallModal; paying tenant sees no banner.

**Depends on:** E1-T1.

---

## E1-T3 — Billing settings page (current plan + manage)

**Status:** ✅ IMPLEMENTED (2026-06-19, branch `mvp-readiness-launch`)

**Goal:** A `/crm/settings/billing` page showing current plan, next billing date, trial state, and upgrade button; later hosts credit balance (E2-T7) and Buy-Credits (E2-T8).

**Files**
- NEW `agency-app/web/src/pages/crm/BillingSettings.tsx`
- MODIFY `agency-app/web/src/App.tsx` (add protected route)
- Reuse `apiService` pattern from `src/services/api.ts` to call `GET /api/subscriptions/current`.

**Detail**
- Fetch `GET /api/subscriptions/current` via `apiService` (or direct fetch using `getTenantHeaders()` + `Authorization: Bearer {getIdToken()}`). Returns `{ plan, paymentStatus, seatsPaid, seatsUsed, trialEndsAt, nextBillingDate, ... }`.
- Show `plan`, `paymentStatus`, `nextBillingDate`, `seatsUsed/seatsPaid`, trial countdown.
- "Upgrade / Change plan" → `<PaywallModal forceOpen={showPaywall} onClose={...} />`.
- Later: add `CreditBalanceCard` (E2-T8) to this page.
- Admin-only mutating actions guarded by `isAdmin()` from `src/utils/rbac.ts`.

**Security**
- `GET /subscriptions/current` already tenant-scoped server-side.

**Tests**
- Playwright: page renders plan info from a mocked `/subscriptions/current`.

**Acceptance**
- Admin can view plan + open upgrade; non-admin sees read-only.

**Depends on:** E1-T1.

---

## E1-T4 — Bailey: data model + "Connect WhatsApp" onboarding step (OPTIONAL, flagged)

**Status:** ✅ IMPLEMENTED (2026-06-19, branch `mvp-readiness-launch`)

**Goal:** Let an admin connect their WhatsApp Business number via Bailey. Entirely behind `BAILEY_ENABLED`.

**Files**
- MODIFY `platform/auth/src/models/usersModel.ts` — add optional fields to `UserItem`:
  ```ts
  whatsAppPhoneNumber?: string;
  whatsAppBusinessAccountId?: string;
  whatsAppVerified?: boolean;
  whatsAppConnectedAt?: string;
  ```
  (Also extend the update function used by the users controller; keep backward compatible — all optional.)
- NEW `agency-app/web/src/pages/onboarding/ConnectWhatsApp.tsx` — shows Bailey QR / pairing, polls verification.
- MODIFY `agency-app/web/src/App.tsx` — add `/onboarding/connect-whatsapp` (ProtectedRoute). Make it a **skippable** step after RegisterAdmin.
- NEW `agency-app/api/bailey.js` — root-level (ships via `*.js` in zip, consistent with `agency-app/api/subscriptionService.js`). Exports: `getPairingQr(phone)`, `sendWhatsAppMessage(to, text, media?)`, `verifyBaileySignature(rawBody, sig, ts)`. All return no-op shapes when `process.env.BAILEY_ENABLED !== 'true'`.

  **CFN env vars to add (07):** `BAILEY_ENABLED`, `BAILEY_API_KEY` (NoEcho), `BAILEY_WEBHOOK_SECRET` (NoEcho), `BAILEY_API_ENDPOINT` (default `https://api.bailey.ai`).

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

**Status:** ✅ IMPLEMENTED (2026-06-19, branch `mvp-readiness-launch`)

**Goal:** Receive WhatsApp messages and enqueue them for processing, with verified signatures.

**Files**
- NEW `agency-app/api/routes/webhooks.js` — `POST /api/webhooks/whatsapp`
- MODIFY `agency-app/api/server.js` — mount `webhooksRoutes` **before** `express.json()` using `express.raw({ type: 'application/json' })` (same ordering trick as billing).

**Detail**
- Verify `x-bailey-signature` + `x-bailey-timestamp` via `verifyBaileySignature` (HMAC-SHA256, timing-safe — copy the timing-safe compare pattern from `agency-app/api/routes/billing.js` which already does this for Razorpay).
- Resolve tenant by the destination number (`to`) → look up user with `whatsAppPhoneNumber` in `UsersTable` via auth svc. Since no internal list endpoint exists, use a DynamoDB query on the auth svc's UsersTable with a GSI on `whatsAppPhoneNumber` (add to E1-T4 schema as an indexed field) OR store a reverse-lookup in a separate DynamoDB item. Reject unknown numbers with 200 (ack) but no-op.
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

**Status:** ✅ IMPLEMENTED (2026-06-19, branch `mvp-readiness-launch`)

**Goal:** Turn an inbound WhatsApp message into a CRM action via the MCP/skills layer, then reply.

**Files**
- NEW `agency-app/api/scripts/whatsapp-message-processor.js` (Lambda handler `handler`, placed in `scripts/` so it ships via existing zip).
- NEW cron/event CFN: see `07-infra-cfn-deploy.md` (`whatsapp-processor.yaml`).
- NEW `agency-app/api/whatsappAuditService.js` — persist message + outcome in CRM table under `PK=TENANT#{t}#WHATSAPP#{messageId}`.

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
- Validate parsed fields before calling skills (reuse server validation utils in `agency-app/api/validation/`).

**Tests**
- Unit: command parser table-driven tests; processor calls invoker with correct tenant + deducts credits (mock creditService).

**Acceptance**
- "lead: Rahul, 9876543210, buyer" via WhatsApp creates a lead for the right tenant and replies with confirmation; credits decremented.

**Depends on:** E1-T5, E2 (credits), E6-T1 (skill invoker).

---

## EPIC 1 open decisions
- Bailey vendor specifics (signature header names, pairing API shape) must be confirmed against Bailey docs at implementation time; the wrapper isolates this.
- Default ship state: **`BAILEY_ENABLED=false`**. Core onboarding (T1–T3) ships regardless.
