# Codebase Reference — AI Agent Quick Reference

**Purpose:** Every implementing agent MUST read this file before writing any code. It maps exact file paths, function signatures, env vars, DynamoDB details, and route paths as they exist on the `auth_rbac_feature` branch today.

---

## 1. Server — Root Layout

### Module system
`agency-app/api/package.json` has `"type": "module"` → use `import`/`export` everywhere in server.
AWS SDK: **v3** (`@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, etc.) — never use v2 patterns.

### Existing root-level service files (ship via `*.js` in zip)
```
agency-app/api/crmDynamodbService.js     — all CRM entity ops (12 entity types)
agency-app/api/subscriptionService.js    — getSubscription(tenantId), incrementSeatsPaid(tenantId), decrementSeatsPaid(tenantId)
agency-app/api/agencyConfigService.js    — per-tenant agency config
agency-app/api/dynamodbService.js        — general DynamoDB utility helpers
agency-app/api/awsClientWrapper.js       — AWS SDK client factory
agency-app/api/s3Service.js              — S3 upload/delete
agency-app/api/logger.js                 — logging (pino or console)
agency-app/api/expressError.js           — custom error classes (InsufficientCreditsError goes HERE, not a new file)
agency-app/api/requestId.js              — request ID generation
agency-app/api/webhookLogService.js      — webhook idempotency log
agency-app/api/notificationDynamodbService.js
agency-app/api/enquiryDynamodbService.js
agency-app/api/grievanceDynamodbService.js
agency-app/api/projectsDynamodbService.js
agency-app/api/developersDynamodbService.js
agency-app/api/areasDynamodbService.js
agency-app/api/realEstateAreasDynamodbService.js
agency-app/api/aiEmployeeProvisioningService.js
```

### New root-level service files to create (all EPICs)
```
agency-app/api/creditService.js          — E2-T2 (deductCredits, grantCredits, getBalance, getLedger, resetMonthlyCredits)
agency-app/api/creditConfig.js           — E2-T1 (getCosts, getPacks, getFreeTier — 60s in-memory cache)
agency-app/api/emailService.js           — E3-T1 (sendEmail — SES primary, Brevo fallback)
agency-app/api/teamAnalyticsService.js   — E4-T1 (getTeamAnalytics(tenantId, {startDate,endDate}))
agency-app/api/dataQualityService.js     — E5-T1 (findIncomplete(tenantId), findExpiringAgreements(tenantId, days))
agency-app/api/skillInvoker.js           — E6-T1 (invokeSkill(tenantId, toolName, input, {userId}))
server/agentAuditService.js      — E6-T3 (logAgentAction(tenantId, agentId, action, input, output, credits))
agency-app/api/bailey.js                 — E1-T4 (getPairingQr, sendWhatsAppMessage, verifyBaileySignature — no-op when BAILEY_ENABLED!=='true')
agency-app/api/razorpayOrders.js         — E2-T5 (createOrder({amount, receipt, notes}))
agency-app/api/whatsappAuditService.js   — E1-T6 (logMessage, logOutcome — PK=TENANT#{t}#WHATSAPP#{msgId})
```

---

## 2. Server — Routes

### Existing route files and their mount paths in server.js
```
agency-app/api/routes/billing.js         → /api/billing      (MOUNTED BEFORE express.json() — raw body)
agency-app/api/routes/auth.js            → /api/auth
agency-app/api/routes/subscriptions.js   → /api/subscriptions
agency-app/api/routes/crm.js             → /api/crm          (general CRM + leads at root)
agency-app/api/routes/leads.js           → /api/crm/leads    (also mounted separately)
agency-app/api/routes/contacts.js        → /api/crm/contacts
agency-app/api/routes/buyers.js          → /api/crm/buyers
agency-app/api/routes/khata.js           → /api/khata
agency-app/api/routes/feedback.js        → /api/feedback
agency-app/api/routes/grievance.js       → /api (grievance sub-paths)
agency-app/api/routes/notifications.js   → /api/notifications
agency-app/api/routes/aiEmployeeStatus.js → /api/ai-employee
agency-app/api/routes/b2bLeads.js        → /api
agency-app/api/routes/enquiries.js       → /api/enquiries
agency-app/api/routes/areas.js, areasBuildings.js, buildings.js, flats.js,
  developers.js, projects.js, publicAreas.js, realEstateAreas.js → various /api paths
agency-app/api/routes/aiCallingInternal.js → internal calling
```

### New route files to create
```
agency-app/api/routes/admin.js           — E4-T1 mount: /api/admin    (validateToken + extractTenantId + requireAdmin)
agency-app/api/routes/webhooks.js        — E1-T5 mount: /api/webhooks BEFORE express.json() with express.raw()
agency-app/api/routes/creditAdmin.js     — E2-T6 mount: /api/credit-config (requireAdmin)
```

### New routes to add to existing files
```
agency-app/api/routes/subscriptions.js:
  GET  /credits            → balance + costs + packs (E2-T6)
  GET  /credits/ledger     → paginated ledger (E2-T6)
  POST /credits/purchase   → create Razorpay Order (E2-T5, admin only)

agency-app/api/routes/admin.js (NEW):
  GET  /team-analytics              → { items: [ memberMetrics ] } (E4-T1)
  GET  /team-analytics/export       → xlsx download (E4-T2)
  GET  /agent-activity              → agent log (E6-T7)

agency-app/api/routes/creditAdmin.js (NEW):
  GET  /                   → current config
  PUT  /costs              → update credit costs
  PUT  /packs              → update packs
  PUT  /free-tier          → update free tier

agency-app/api/routes/webhooks.js (NEW):
  POST /whatsapp           → Bailey inbound (E1-T5)
```

### Exact middleware chain (must follow in all new routes)
```js
router.get('/path', validateToken, extractTenantId, requireRole('ADMIN'), async (req, res) => {
  // req.tenantId is safe to use here
  // req.user.userId is the authenticated user
});
```

---

## 3. Server — Middleware

```
agency-app/api/middleware/validateToken.js
  export: validateToken(req, res, next)
  — calls {AUTH_SERVICE_URL}/auth/me, 5s cache, sets req.user + req.tenantId + req.agency

agency-app/api/middleware/requireRole.js
  export: requireRole(...allowedRoles)   — factory, e.g. requireRole('ADMIN','MANAGER')
  export: requireAdmin                   — requireRole('ADMIN','FOUNDER','OWNER')
  export: requireAdminOrManager          — requireRole('ADMIN','MANAGER')

agency-app/api/middleware/tenantMiddleware.js
  export: extractTenantId(req, res, next)          — mandatory; fails if no tenantId
  export: extractTenantIdOptional(req, res, next)  — optional; falls back to x-tenant-id header

agency-app/api/middleware/validateBody.js
  export: validateBody(schema)(req, res, next)

agency-app/api/middleware/rateLimiter.js  — applied to /api/* except billing webhook
agency-app/api/middleware/csp.js          — CSP headers
agency-app/api/middleware/requestLogger.js — request logging
agency-app/api/middleware/apiKeyAuth.js   — x-internal-api-key header auth

agency-app/api/middleware/meterCredits.js — NEW (E2-T3)
  export: meterCredits(actionType)  — factory
```

### agency-app/api/validation/
```
agency-app/api/validation/crmSchemas.js  — CRM entity Joi/Zod schemas (reuse in E6-T1 skillInvoker)
agency-app/api/validation/otherSchemas.js
```

---

## 4. DynamoDB — Tables and Keys

### Existing tables (env var → default table name)
| Env var | Default table name | PK | SK |
|---------|------------------|----|----||
| CRM_DYNAMODB_TABLE_NAME | cloudberry-real-estate-crm | PK (S) | SK (S) |
| SUBSCRIPTIONS_TABLE_NAME | Subscriptions | tenantId (S) | — |
| DYNAMODB_TABLE_NAME | real-estate-agencies | — | — |
| AGENCY_CONFIG_DYNAMODB_TABLE_NAME | (CFN param default) | TenantId (S) | — |
| KHATA_TABLE_NAME | (CFN param) | PK (S) | SK (S) |
| NOTIFICATIONS_TABLE_NAME | (CFN param) | PK (S) | SK (S) |
| B2B_LEADS_TABLE | (CFN param) | leadId (S) | — |
| ENQUIRIES_DYNAMODB_TABLE_NAME | (CFN param) | PK (S) | SK (S) |

### CRM table (cloudberry-real-estate-crm) — key patterns
```
Lead:    PK = TENANT#{tenantId}#LEAD#{leadId},    SK = PROFILE
Owner:   PK = TENANT#{tenantId}#OWNER#{ownerId},  SK = PROFILE
Tenant:  PK = TENANT#{tenantId}#CUSTOMER#{id},    SK = PROFILE
Property: PK = TENANT#{tenantId}#PROPERTY#{id},   SK = PROFILE
Contact: PK = TENANT#{tenantId}#CONTACT#{id},     SK = PROFILE
Buyer:   PK = TENANT#{tenantId}#BUYER#{id},       SK = PROFILE
Note:    PK = TENANT#{tenantId}#{ENTITY}#{id},    SK = NOTE#{ts}#{rand}
Agreement: PK = TENANT#{tenantId}#PROPERTY#{id},  SK = AGREEMENT#{id}
```

### CRM table GSIs
```
owner-property-index  — GSI1PK = TENANT#{t}#OWNER#{ownerId},           GSI1SK = PROPERTY#{id}
status-index          — GSI2PK = TENANT#{t}#PROPERTY_STATUS#{status},  GSI2SK = PROPERTY#{id}
search-index          — GSI3PK = TENANT#{t}#SEARCH,                    GSI3SK = searchable_text
```

### New tables to create (EPIC 2, add to cfn-backend.yaml)
```
cloudberry-real-estate-credits        — env: CREDITS_TABLE_NAME
  PK: tenantId (S)
  SK: BALANCE | LEDGER#{isoTs}#{rand}
  GSI: actionType-index (GSI1PK=tenantId, GSI1SK={actionType}#{isoTs})
  TTL: expiresAt
  DeletionPolicy: Retain

cloudberry-real-estate-credit-config  — env: CREDIT_CONFIG_TABLE_NAME
  PK: configKey (S)
  DeletionPolicy: Retain
```

---

## 5. Auth Microservice (reality-flow-authentication)

### Key files
```
platform/auth/src/models/usersModel.ts   — UserItem interface + DynamoDB ops
platform/auth/src/controllers/authController.ts
platform/auth/src/routes/auth.ts          — protected routes
platform/auth/src/routes/internal.ts      — internal service routes (x-internal-api-key)
```

### Endpoints called by server
```
GET  {AUTH_SERVICE_URL}/auth/me                       — validateToken.js (5s cache)
     Headers: Authorization: Bearer {userJwt}
     Returns: { userId, tenantId, displayName, email, role, agency }

GET  {AUTH_SERVICE_URL}/internal/users/count?tenantId= — seat count check in subscriptions.js
     Headers: x-internal-api-key: {INTERNAL_API_KEY}
     Returns: { count: number }

GET  {AUTH_SERVICE_URL}/users                          — list users for team analytics (E4-T1)
     Headers: Authorization: Bearer {adminUserJwt}  ← forward req.headers.authorization
     Returns: [ UserItem, ... ]
     NOTE: No internal endpoint for user LIST exists yet — forward the admin's token.
```

### UserItem schema (usersModel.ts)
```typescript
interface UserItem {
  userId: string;
  tenantId: string;              // PK in DynamoDB
  displayName: string;
  email?: string;
  phoneNumber?: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLoginAt?: string;
  authMethod?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  // New optional fields (E1-T4, Bailey):
  whatsAppPhoneNumber?: string;
  whatsAppBusinessAccountId?: string;
  whatsAppVerified?: boolean;
  whatsAppConnectedAt?: string;
}
```

---

## 6. Frontend (agency-app/web/src/)

### Environment variables (Vite, prefix VITE_)
```
VITE_API_URL or VITE_API_BASE_URL  — CRM backend base URL (used in api.ts)
VITE_AUTH_API_URL                  — Auth microservice URL (used in MemberManagement.tsx directly)
VITE_RAZORPAY_KEY_ID               — Razorpay publishable key
VITE_TENANT_ID                     — Fallback tenant ID
```

### Token and tenant
```
localStorage key:    'auth_id_token'
Tenant header:       'x-tenant-id' → getTenantHeaders() from src/config/tenant.ts
Auth header:         Authorization: Bearer {token} → built in ApiService.getHeaders()
```

### Key existing utilities
```typescript
// src/services/api.ts — ApiService class (singleton instance exported as apiService)
import { apiService } from '../services/api';
apiService.getLeads(filters)
apiService.createLead(data)
// etc — see api.ts for full method list

// src/config/tenant.ts
import { getTenantHeaders } from '../config/tenant';
// Returns { 'x-tenant-id': tenantId } or {}

// src/contexts/SubscriptionContext.tsx
import { useSubscriptionContext } from '../contexts/SubscriptionContext';
const { subscription, isPaying, isTrialing, trialDaysLeft, isTrialExpired, refetch } = useSubscriptionContext();
// SubscriptionStatus fields: plan, trialDaysLeft, trialEndsAt, isPaying, isTrialing, isTrialExpired, gracePeriodActive, paymentStatus

// src/utils/rbac.ts
import { isAdmin, isMember, hasPermission } from '../utils/rbac';
isAdmin()                // profile?.role === 'ADMIN'
hasPermission('delete')  // ADMIN=all; MEMBER=create/read/update only, no delete

// src/lib/razorpay.ts
import { openCheckout } from '../lib/razorpay';
openCheckout({ planId, name, email, phone?, onSuccess, onFailure, onDismiss? })
// planId for subscriptions: 'plan_solo_monthly', 'plan_team_monthly', etc.
// For one-time Orders (credit purchase), extend to accept orderId (E2-T8)
```

### Existing components to reuse (do NOT recreate)
```
src/components/PaywallModal.tsx         — Props: { forceOpen?, onClose? }. Opens tiered checkout.
src/components/TrialCountdownBanner.tsx — ALREADY EXISTS. Check before creating a new TrialBanner.
src/components/GlassDataTable.tsx       — Sortable/filterable table. No built-in Excel export.
src/components/SeatCounter.tsx          — Current seat usage display
src/components/SeatUpgradeModal.tsx     — Seat upgrade flow
src/components/PermissionGuard.tsx      — Role-based component guard
src/components/LoadingSpinner.tsx       — Standard loading indicator
src/components/Toast.tsx               — Notification toasts
src/components/ConfirmDialog.tsx        — Confirmation dialogs
```

### Existing pages (do NOT recreate)
```
src/pages/RegisterAdmin.tsx             — ALREADY EXISTS at this path; just missing route
src/pages/admin/MemberManagement.tsx    — Admin guard pattern to copy for TeamAnalytics
```

### Existing routes in App.tsx (confirmed)
```
/login, /phone-login, /auth/callback, /grievance, /nps         — public
/onboarding/role-selection, /onboarding/accept-invite          — onboarding
/admin/grievances, /admin/invites, /admin/members              — admin
/crm, /crm/tenants/*, /crm/owners/*, /crm/properties/*        — CRM core
/crm/buyers/*, /crm/leads/*, /crm/khata/*, /crm/analytics     — CRM extended
/crm/calendar, /crm/b2b-leads, /crm/hierarchy                 — CRM misc
/integrations/ai-employee                                       — integration
```

### New routes to add in App.tsx
```
/onboarding/register-admin          — E1-T1 (CRITICAL: currently missing, blocks signup)
/crm/settings/billing               — E1-T3
/onboarding/connect-whatsapp        — E1-T4 (optional, flagged)
/admin/team-analytics               — E4-T3
```

### Admin guard pattern (copy from MemberManagement.tsx)
```tsx
// In useEffect or at top of component
const profile = getUserProfile();
if (!profile) { navigate('/login'); return; }
if (profile.role !== 'ADMIN') { navigate('/member/no-access'); return; }
```

---

## 7. Deployment

### Lambda entry point
```
Handler: lambda-handler.handler
File:    agency-app/api/lambda-handler.js
Runtime: nodejs20.x
```

### Zip include list (confirmed at deploy.sh ~line 116)
```bash
zip -r function.zip node_modules package.json *.js routes/ middleware/ utils/ \
  validation/ public/ lib/ scripts/ \
  -x "node_modules/.cache/*" "node_modules/typescript/*" "node_modules/ts-node/*" \
     "deploy*.ps1" "deploy.ps1" "*.md" ".git*" "cfn/*" "infra/*"
```

**CHANGE REQUIRED (E6-T3):** Add `agents/` to the include list:
```bash
zip -r function.zip node_modules package.json *.js routes/ middleware/ utils/ \
  validation/ public/ lib/ scripts/ agents/ \
  -x "node_modules/.cache/*" "node_modules/typescript/*" "node_modules/ts-node/*" \
     "deploy*.ps1" "deploy.ps1" "*.md" ".git*" "cfn/*" "infra/*" "mcp-server/*"
```

### Syntax check gate
`agency-app/api/scripts/build.sh` — currently checks `routes/ middleware/ scripts/ lib/`.
Extend to also check root `*.js` and `agents/`.

### New cron stacks (each gets own CFN yaml in `cron/`)
All clone `cron/trial-reminder.yaml`. Handler `export` name = `handler`. Runtime `nodejs20.x`.
New cron yaml files: `credit-reset.yaml`, `incomplete-data.yaml`, `expiring-agreements.yaml`, `team-summary.yaml`, `lead-followup.yaml`, `whatsapp-processor.yaml`, `lead-qualifier.yaml`, `lead-router.yaml`.

---

## 8. Bedrock Client Reference

**Copy client setup from:** `agency-app/ai-calling/src/services/ragService.js`
- Uses `@aws-sdk/client-bedrock-agent-runtime` (v3, already installed in ai-calling-service)
- Region: `ap-south-1`
- Tenant-isolation pattern: inject `tenantId` into session/invocation metadata

For the API Lambda (`agency-app/api/agents/`):
```js
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
// (add @aws-sdk/client-bedrock-runtime to agency-app/api/package.json)
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
```

---

## 9. Cron Pattern Reference

**Template to clone:** `cron/trial-reminder.yaml`
**Handler reference:** `agency-app/api/scripts/trial-reminder-cron.js` (exports `handler` async function)

Schedule expressions (all UTC, IST = UTC+5:30):
```
09:00 IST = cron(30 3 * * ? *)
08:30 IST = cron(0 3 * * ? *)
18:00 IST = cron(30 12 * * ? *)
09:30 IST = cron(0 4 * * ? *)
00:30 IST = cron(0 19 * * ? *)  — midnight IST credit reset
```

---

## 10. Existing Subscription Routes (/api/subscriptions/)

```
GET  /current         — full subscription object (plan, seatsPaid, seatsUsed, trialEndsAt, etc.)
GET  /trial-status    — trial-specific fields; auto-creates trial if missing
POST /check-seat      — pre-invite seat check; returns 402 at limit
```

---

## 11. Known Billing Patterns (billing.js)

- Webhook route: `POST /webhook` (note: mounted at `/api/billing`, so full path is `POST /api/billing/webhook`)
- Raw body: `express.raw({ type: 'application/json' })` applied per-route before handler
- HMAC verify: timing-safe compare — **copy this pattern exactly** for Bailey webhook (E1-T5)
- Brevo email: inline `fetch('https://api.brevo.com/v3/smtp/email', ...)` — E3-T2 replaces with `emailService.sendEmail(...)`
- AiSensy WhatsApp: inline `sendAiSensyBroadcast(...)` — keep as-is (different from Bailey)

---

## 12. Environment Variables — Complete MVP Addition List

Add to `agency-app/api/.env.example` and CFN parameters:
```
# Credits (E2)
CREDITS_TABLE_NAME=cloudberry-real-estate-credits
CREDIT_CONFIG_TABLE_NAME=cloudberry-real-estate-credit-config

# Email (E3)
AWS_SES_FROM_EMAIL=noreply@realestateflow.in
EMAIL_PROVIDER_PRIMARY=ses
EMAIL_PROVIDER_FALLBACK=brevo

# Bailey WhatsApp (E1, optional)
BAILEY_ENABLED=false
BAILEY_API_KEY=
BAILEY_WEBHOOK_SECRET=
BAILEY_API_ENDPOINT=https://api.bailey.ai

# Agents (E6)
AGENTS_ENABLED=false
```

Frontend `.env.example` additions: none needed for E1-E5. For E6 (MCP local): documented in `agency-app/api/mcp-server/README.md`.
