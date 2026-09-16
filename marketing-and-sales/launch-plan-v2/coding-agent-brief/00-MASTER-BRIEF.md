# RealEstateFlow — Multi-Agent Coding Master Brief

**Read this entire document before writing any code. It is the single source of truth for all agents.**

---

## 1. Project Summary

RealEstateFlow is an Indian real-estate CRM SaaS with an AI Employee add-on. This brief covers the pre-launch engineering sprint (P9–P17, Day 1–7 Week 1) that must be complete before the Mumbai beta launch.

---

## 2. Two-Codebase Architecture (Critical)

There are **two completely separate web applications** in this monorepo:

| App | Directory | Domain | Stack | Auth |
|---|---|---|---|---|
| **CRM SPA** | `apps/crm/real-estate-crm-app/` | `app.realestateflow.in` | React + TypeScript + Vite + Tailwind | Cognito via `validateToken` middleware |
| **Landing Pages** | `creative/landing-pages/` | `realestateflow.in` | Static HTML + Vite build pipeline | None (public) |

**Both deploy to Netlify independently.** They share the same backend API (`apps/crm/server/`).

---

## 3. Backend Architecture

```
apps/crm/server/
├── server.js              — Express entry point; mounts all routes
├── lambda-handler.js      — AWS Lambda entry wrapping Express
├── tenantMiddleware.js    — extractTenantId() middleware
├── middleware/
│   └── validateToken.js   — Cognito token validation (calls auth microservice)
├── crmDynamodbService.js  — Main DDB service (108KB) — read for patterns
├── awsClientWrapper.js    — DDB client wrapper — always use this
├── routes/                — Each file = one feature domain
└── scripts/               — One-off + cron scripts
```

**Every authenticated route must have:**
```js
router.get('/path', validateToken, extractTenantId, async (req, res) => {
  const { tenantId } = req;  // from extractTenantId
  // ALL DDB queries must include tenantId in key condition
});
```

**Public routes (no auth):** Only `/api/grievance` POST, `/api/billing/webhook` POST, `/api/auth/*`. Must have rate limiting.

---

## 4. Frontend Architecture

```
apps/crm/real-estate-crm-app/src/
├── App.tsx                — React Router + auth state machine + ProtectedRoute
├── main.tsx               — Vite entry; PostHog + Sentry init goes here
├── pages/
│   ├── PhoneLogin.tsx     — Signup/login entry (reads UTM params)
│   ├── crm/               — Authenticated CRM pages
│   ├── admin/             — Founder/admin-only pages
│   └── public/            — Zero-auth pages (/grievance etc.)
├── components/            — Shared Tailwind components
├── hooks/                 — Custom React hooks
├── lib/                   — Pure utility modules (analytics.ts, razorpay.ts)
├── contexts/              — React contexts (AuthContext etc.)
└── types/                 — TypeScript types
```

**Route pattern in App.tsx:**
```tsx
// Public (no auth)
<Route path="/grievance" element={<Grievance />} />

// Protected (requires auth)
<Route path="/integrations/ai-employee" element={<ProtectedRoute><AIEmployeeStatus /></ProtectedRoute>} />

// Admin-only (requires auth + role check inside the component)
<Route path="/admin/grievances" element={<ProtectedRoute><GrievanceList /></ProtectedRoute>} />
```

---

## 5. Analytics Architecture (Non-Negotiable)

**Rule:** GA4, Meta Pixel, LinkedIn Insight Tag, Hotjar NEVER go in the CRM SPA. Only PostHog goes in the CRM.

| Tracker | LP HTML (`_partials/head-analytics.hbs`) | CRM (`analytics.ts`) | Server |
|---|---|---|---|
| PostHog | ✅ anonymous | ✅ identified post-login | ✅ Node SDK |
| GA4, Pixel, LinkedIn, Hotjar | ✅ | ❌ | ❌ |
| Sentry | ❌ | ✅ (`main.tsx`) | ✅ (`lambda-handler.js`) |

**PostHog bridge pattern:**
1. LP: anonymous `posthog.capture('page_view', {utm_source})` 
2. CRM `/signup`: read UTM from URL, store in `sessionStorage`
3. CRM post-signup: `posthog.identify(userId, {utm_source, ...traits})` — links sessions

---

## 6. Cookie Consent Architecture

Two different banner variants:
- **LP** (`_partials/cookie-banner.html`): 4 toggles (Essential, Functional/Hotjar, Analytics/PostHog+GA4, Marketing/Pixel+LinkedIn)
- **CRM** (`CookieConsentBanner.tsx`): 2 toggles (Essential + Analytics/PostHog only — no Marketing)

Both store to `localStorage.cookieConsent = {essential, analytics, marketing?, functional?, version, timestamp}`.

---

## 7. DynamoDB Conventions

All code must use `awsClientWrapper.js`. Never import DynamoDB client directly.

```js
import { wrapAwsClient } from '../awsClientWrapper.js';
const dynamodb = wrapAwsClient();
```

**Multi-tenancy:** Every CRM table query must have `tenantId` in the key condition. Non-tenant tables (public/cross-tenant): `Grievances`, `AIEmployeeProvisioning`, `WebhookLog`, `TenantApiKeys`, `NPSResponses`, `BetaInvites`.

**ID generation:** Use `import { ulid } from 'ulid'` for all primary keys (check if ulid already installed in package.json; if not, use `import { v4 as uuidv4 } from 'uuid'` which is already installed).

---

## 8. Coding Conventions

### Backend
- ES Modules (`import`/`export`) — already configured
- Pattern to copy: `apps/crm/server/routes/leads.js` + `apps/crm/server/tenantMiddleware.js`
- Error responses: `res.status(4xx).json({ error: 'string', details?: 'string' })`
- All routes go in `apps/crm/server/routes/`; all DDB operations in `apps/crm/server/*DynamodbService.js`
- Rate limiting: use `express-rate-limit` (check if installed)

### Frontend
- TypeScript strict mode — no `any`
- Tailwind only for styling — no inline style unless Tailwind can't do it
- Brand colors: `#22C55E` (primary green), `#0F3A66` (navy), `#07111E` (dark)
- Mobile-first — all components must work on 375px width
- Auth pattern: use `useContext(AuthContext)` for user/tenantId
- Copy pattern from existing pages: `src/pages/crm/BuyerList.tsx` or `src/pages/admin/InviteManagement.tsx`

### Testing
- Playwright for E2E tests — existing config in `apps/crm/real-estate-crm-app/test/`
- All test files in `tests/` at repo root
- Run: `npx playwright test tests/{spec-file}.spec.ts`

---

## 9. ENV Variables Reference

All agents should use placeholder values for env vars they haven't been given. Never hardcode credentials.

### Backend Lambda (`apps/crm/server/.env`)
```
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_KEY_SECRET=
AISENSY_API_KEY=
AISENSY_BROADCAST_LIST_ID=
HCAPTCHA_SECRET_KEY=
BREVO_API_KEY=
BREVO_TRIAL_LIST_ID=
POSTHOG_KEY_SERVER=
SENTRY_DSN_SERVER=
DEMO_TENANT_ID=
AUTH_SERVICE_URL=         # already exists
```

### CRM SPA (`apps/crm/real-estate-crm-app/.env`)
```
VITE_API_URL=             # already exists
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://eu.posthog.com
VITE_SENTRY_DSN=
VITE_RAZORPAY_KEY_ID=
VITE_HCAPTCHA_SITE_KEY=
VITE_IS_DEMO=false
```

### LP Build (`creative/landing-pages/.env`)
```
POSTHOG_KEY=
GA4_ID=
META_PIXEL_ID=
LINKEDIN_PARTNER_ID=
HOTJAR_ID=
HOTJAR_SV=6
```

---

## 10. Shared Contracts (Read Before Writing DDB Code)

See `01-SHARED-CONTRACTS.md` for all new DynamoDB table schemas, API route specs, and TypeScript interface definitions. Every agent must read this before writing any code that touches these entities.

---

## 11. How to Add Routes to apps/crm/server/server.js

Add your import in the `// === [LAUNCH ROUTES IMPORTS] ===` block and your mount in the `// === [LAUNCH ROUTES MOUNTS] ===` block. These are tagged comment sections. Use your PR-ID as the tag so merges are conflict-free:

```js
// === [LAUNCH ROUTES IMPORTS] ===
// PR-B
import grievanceRoutes from './routes/grievance.js';
// PR-F
import billingRoutes from './routes/billing.js';
// === [/LAUNCH ROUTES IMPORTS] ===
```

```js
// === [LAUNCH ROUTES MOUNTS] ===
// PR-B
app.use('/api', grievanceRoutes);
// PR-F — must be BEFORE auth middleware
app.use('/api/billing', billingRoutes);
// === [/LAUNCH ROUTES MOUNTS] ===
```

Each PR only adds its own tagged lines. Never remove or reorder existing lines.

---

## 12. How to Add Routes to App.tsx

Add imports at the top and routes inside the `{/* === [LAUNCH ROUTES] === */}` block:

```tsx
{/* === [LAUNCH ROUTES PUBLIC] === */}
{/* PR-B */}
<Route path="/grievance" element={<Grievance />} />
<Route path="/admin/grievances" element={<ProtectedRoute><GrievanceList /></ProtectedRoute>} />
{/* === [/LAUNCH ROUTES PUBLIC] === */}
```

Each PR only adds its own tagged block. Never reorder or remove existing routes.

---

## 13. Existing Files That Agents May Modify (Allowed Targets)

| Agent | File | Allowed modification |
|---|---|---|
| PR-B | `apps/crm/server/server.js` | Add tagged import + mount block |
| PR-B | `src/App.tsx` | Add tagged route block (public + admin/grievances) |
| PR-C | `src/App.tsx` | Add `<CookieConsentBanner />` inside authenticated layout |
| PR-D | `creative/landing-pages/netlify.toml` | Add redirects for new pages; remove enterprise redirect |
| PR-F | `apps/crm/server/server.js` | Add tagged import + mount block (billing webhook BEFORE auth) |
| PR-F | `src/App.tsx` | Add tagged route block (/integrations/ai-employee) |
| PR-H | `apps/crm/server/server.js` | Add tagged import + mount block (subscriptions) |
| PR-H | `apps/crm/server/routes/auth.js` | Add seat-cap check in the invite-creation handler ONLY |
| PR-H | `src/App.tsx` | Add tagged route block (/admin/invites, /admin/members updates) |
| PR-J | `apps/crm/server/server.js` | Add tagged import + mount block (subscriptions trial-status) |
| PR-J | `src/App.tsx` | Add `<TrialCountdownBanner />` + `<PaywallModal />` to authenticated layout |
| PR-K | `apps/crm/server/server.js` | Add tagged import + mount block (feedback) |
| PR-K | `src/App.tsx` | Add tagged route block (/nps) |
| PR-L | `apps/crm/server/routes/auth.js` | Add Brevo contact addition in the register handler ONLY |

**Rule:** Any file not in your allowed modification list — create a new file instead.

---

## 14. PR Naming Convention

All branches: `cursor/pr-{batch}-{name}-8e67`
Examples:
- `cursor/pr-1a-demo-environment-8e67`
- `cursor/pr-1b-grievance-flow-8e67`
- `cursor/pr-2e-analytics-layer-8e67`

---

## 15. Source Files to Read for Patterns

Before writing any code, read these files to understand existing patterns:
- `apps/crm/server/routes/leads.js` — route pattern
- `apps/crm/server/crmDynamodbService.js` (first 200 lines) — DDB service pattern
- `apps/crm/server/tenantMiddleware.js` — tenant scoping
- `apps/crm/server/awsClientWrapper.js` — DDB client wrapper
- `apps/crm/real-estate-crm-app/src/pages/admin/InviteManagement.tsx` — admin page pattern
- `apps/crm/real-estate-crm-app/src/pages/crm/BuyerList.tsx` — CRM page pattern
- `apps/crm/real-estate-crm-app/src/App.tsx` — route + ProtectedRoute pattern
