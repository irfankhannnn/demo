# Agent Prompt — PR-B: Grievance Flow (DPDP Compliance)

**Branch to create:** `cursor/pr-1b-grievance-flow-8e67`
**Base branch:** `main`
**Batch:** 1 (Day 1) — runs in parallel with PR-A, PR-C, PR-D

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md`
2. `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md` (§1.1 Grievances table, §2 API routes)
3. `apps/crm/server/routes/leads.js` (route pattern to copy)
4. `apps/crm/server/crmDynamodbService.js` (lines 1-100 for DDB patterns)
5. `apps/crm/server/tenantMiddleware.js`
6. `apps/crm/server/server.js` (understand the import + mount pattern)
7. `apps/crm/real-estate-crm-app/src/App.tsx` (route + ProtectedRoute pattern)
8. `apps/crm/real-estate-crm-app/src/pages/admin/InviteManagement.tsx` (admin page pattern to match)
9. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P9-grievance-flow.md`

---

## What to Build

### 1. `apps/crm/server/grievanceDynamodbService.js`

Mirror the pattern of `apps/crm/server/crmDynamodbService.js`. Import DDB via `awsClientWrapper.js`.

Functions (all async):
```js
// Creates a new grievance. Returns { grievanceId, trackingId, createdAt }
export async function createGrievance({ name, email, phone, category, description, ip, userAgent })

// Gets one grievance by ID
export async function getGrievanceById(grievanceId)

// Lists grievances with optional filters (admin use)
export async function listGrievances({ status, category, fromDate, toDate, limit = 20, lastEvaluatedKey })

// Updates grievance status/resolution (admin use)  
export async function updateGrievance(grievanceId, { status, assignedTo, resolutionNotes, internalNotes, resolvedAt })
```

Schema notes from `01-SHARED-CONTRACTS.md §1.1`:
- `grievanceId` = ULID (use `import { v4 as uuidv4 } from 'uuid'` if ulid not installed)
- `trackingId` = `'GR-' + grievanceId.slice(0, 6).toUpperCase()`
- `status` defaults to `'new'`
- `tenantId` is explicitly `null` (this is a PUBLIC table — no tenant scoping)

### 2. `apps/crm/server/routes/grievance.js`

Three endpoints. Use `express-rate-limit` for the public POST.

```js
// POST /api/grievance — PUBLIC
// Rate limit: 5 requests per IP per hour
// hCaptcha verify: POST to https://hcaptcha.com/siteverify with secret from process.env.HCAPTCHA_SECRET_KEY
// Honeypot: reject if req.body.middle_name is non-empty (return 400)
// Validate: name 1-100 chars, email valid, phone optional 10-digit, category in enum, description 10-2000 chars
// On success: create grievance, send 2 Brevo emails (ack + notify founder), capture PostHog event
// Return: { trackingId, message: 'Received. Expect a response within 7 working days.' }

// GET /api/admin/grievances — validateToken + role check (founder/admin only)
// Returns paginated grievance list with optional status/category filters

// PATCH /api/admin/grievances/:id — validateToken + role check
// Updates status + resolutionNotes
```

**Important:** POST `/api/grievance` MUST NOT use `validateToken` or `extractTenantId`. It is fully public.

**Brevo email sending:** Use `axios.post('https://api.brevo.com/v3/transactional-emails', {...}, { headers: { 'api-key': process.env.BREVO_API_KEY } })`. Wrap in try/catch — email failure should NOT fail the grievance submission (return 200 even if email fails, but log the error).

**PostHog server event:** Call `serverTrack` from `apps/crm/server/lib/posthog.js` (this file is created by PR-E; for now, create a stub):
```js
// Stub — PR-E will implement the real module
async function serverTrack(distinctId, event, properties) {
  if (process.env.POSTHOG_KEY_SERVER) {
    // PR-E fills this in — for now just log
    console.log('[PostHog stub]', event, properties);
  }
}
```

### 3. `apps/crm/real-estate-crm-app/src/pages/public/Grievance.tsx`

Public page — NO `ProtectedRoute` wrapper in App.tsx.

Layout:
- Two-column on desktop (form left, info right); stacked on mobile
- Left: form with Name, Email, Phone (optional), Category (select with 8 options), Description (textarea 10-2000 chars), **honeypot field** (CSS hidden, tabindex=-1, name="middle_name"), hCaptcha widget, Submit
- Right: Grievance Officer block (placeholder values: `{{GO_NAME}}`, `info@realestateflow.in`, `Response within 7 working days per DPDP Act 2023`)
- On success: show tracking ID + green confirmation; hide form
- Error states: field validation inline, hCaptcha failure message
- Brand colors from `00-MASTER-BRIEF.md §8`
- Footer: links to `/legal/terms`, `/legal/privacy`, `/` (homepage)

**hCaptcha widget:** Use `@hcaptcha/react-hcaptcha` npm package OR inject vanilla JS hCaptcha via a script tag. Whichever is cleaner. Site key from `import.meta.env.VITE_HCAPTCHA_SITE_KEY`.

### 4. `apps/crm/real-estate-crm-app/src/pages/admin/GrievanceList.tsx`

Admin page — `ProtectedRoute` wrapper in App.tsx. Role check: only render content if user.role === 'founder' || user.role === 'admin'.

Layout:
- Table: Tracking ID | Date | Name | Email | Category | Status badge | Actions
- Status badges: new=red, acknowledged=yellow, in_progress=blue, resolved=green, escalated=red-outline
- Filters: status dropdown, date range, free-text search
- Click row → slide-in detail drawer (right side): full grievance detail, internal notes textarea, status dropdown, "Mark resolved" button
- "Mark resolved" → PATCH to `/api/admin/grievances/:id` → optimistic update
- Pagination via lastEvaluatedKey

### 5. `tests/grievance.spec.ts`

Playwright test. Read existing test config in `apps/crm/real-estate-crm-app/test/` for base URL setup.

Tests:
1. Visit `/grievance`, fill all fields, submit → assert success message + tracking ID GR-XXXXXX format
2. Submit 6 times from same IP in 1h → 6th returns 429
3. Submit with honeypot filled (`middle_name` = "anything") → assert 400
4. Admin logs in → visits `/admin/grievances` → sees new grievance in list

---

## apps/crm/server/server.js Modification

Find the `// === [LAUNCH ROUTES IMPORTS] ===` block and add:
```js
// PR-B
import grievanceRoutes from './routes/grievance.js';
```

Find the `// === [LAUNCH ROUTES MOUNTS] ===` block and add:
```js
// PR-B
app.use('/api', grievanceRoutes);
```

**Only add these 4 lines inside the tagged blocks. Do not touch anything else.**

---

## App.tsx Modification

Find the `{/* === [LAUNCH PUBLIC ROUTES] === */}` block and add:
```tsx
{/* PR-B */}
<Route path="/grievance" element={<Grievance />} />
```

Find the `{/* === [LAUNCH PROTECTED ROUTES] === */}` block and add:
```tsx
{/* PR-B */}
<Route path="/admin/grievances" element={<ProtectedRoute><GrievanceList /></ProtectedRoute>} />
```

Also add imports at top of App.tsx:
```tsx
import Grievance from './pages/public/Grievance';
import GrievanceList from './pages/admin/GrievanceList';
```

**Only add these lines inside the tagged blocks + imports. Do not touch anything else.**

---

## What NOT to Touch

- `apps/crm/server/lib/posthog.js` — leave as stub; PR-E creates the real version
- Any LP files
- Any existing CRM pages
- `apps/crm/server/crmDynamodbService.js` — create a separate `grievanceDynamodbService.js`

---

## Acceptance Criteria

- [ ] `POST /api/grievance` with valid data → 200 + tracking ID + DDB row created
- [ ] `POST /api/grievance` with honeypot filled → 400
- [ ] 6th request from same IP in 1h → 429
- [ ] `/grievance` page renders in incognito; form submits; tracking ID shown
- [ ] Admin at `/admin/grievances` sees submissions; can mark resolved
- [ ] Playwright tests 100% pass

---

## PR Description Template

```
PR-B: Grievance flow — DPDP-compliant public grievance portal

Batch 1 | Day 1 | Parallel with PR-A, PR-C, PR-D

Files created:
- apps/crm/server/routes/grievance.js — POST /api/grievance (public, rate-limited, hCaptcha) + admin GET/PATCH
- apps/crm/server/grievanceDynamodbService.js — Grievances DDB service
- apps/crm/real-estate-crm-app/src/pages/public/Grievance.tsx — public form page
- apps/crm/real-estate-crm-app/src/pages/admin/GrievanceList.tsx — admin triage UI
- tests/grievance.spec.ts — Playwright tests

Files modified:
- apps/crm/server/server.js — added grievanceRoutes to LAUNCH ROUTES blocks
- apps/crm/real-estate-crm-app/src/App.tsx — added /grievance + /admin/grievances to LAUNCH ROUTES blocks

Source task: ZEE-002 (pre-launch-prep/P9-grievance-flow.md)
```
