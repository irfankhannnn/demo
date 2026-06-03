# EPIC-2 COMPLETION — PR-B: Grievance Flow (ZEE-002 / P9)

**Epic:** 2 of Batch 1
**Story:** ZEE-002 — Grievance Flow (Backend + Frontend)
**Source of truth:** `coding-agent-brief/prompts/PR-B-grievance-flow.md` + `01-SHARED-CONTRACTS.md §1.1`
**Branch:** `cursor/pr-1b-grievance-flow-8e67` (base: `cursor/launch-plan-v2-architecture-updates-8e67`)

## Implemented Features
- Public DPDP Act 2023 grievance portal at `/grievance` (no auth): form with name, email, phone (optional), category (8-value enum), description (10–2000 chars), hidden honeypot, hCaptcha widget, success state showing `GR-XXXXXX` tracking ID.
- Admin triage UI at `/admin/grievances` (ProtectedRoute + founder/admin role gate): table (Tracking ID, Date, Name, Email, Category, Status badge, Actions), status/category/date filters, free-text search, slide-in detail drawer with status dropdown + internal/resolution notes, "Mark resolved" with optimistic update, key-based pagination.

## APIs Added
- `POST /api/grievance` — PUBLIC. Rate-limited 5 req/IP/hour (`express-rate-limit`), honeypot (`middle_name`) → 400, hCaptcha verify (skipped when `HCAPTCHA_SECRET_KEY` unset), field validation, creates row, sends 2 Brevo emails (ack + officer notify), fires PostHog `grievance_received`. Returns `{ trackingId, message }`.
- `GET /api/admin/grievances` — `validateToken` + role gate. Filters: status, category, fromDate, toDate, limit, lastEvaluatedKey. Returns `{ items, lastEvaluatedKey }`.
- `PATCH /api/admin/grievances/:id` — `validateToken` + role gate. Updates status/assignedTo/resolutionNotes/internalNotes/resolvedAt (auto-stamps `resolvedAt` on resolve).

## Database Changes
- New service `server/grievanceDynamodbService.js` against the **public** `Grievances` table (table provisioned by founder per shared-contracts).
  - PK `grievanceId` (UUID); user-facing `trackingId = GR-{first 6 hex, uppercased}`.
  - GSIs used: `status-createdAt-index`, `email-createdAt-index`.
  - `tenantId` always `null` (intentionally NOT tenant-scoped). Default `status = 'new'`.
- No migrations required.

## Infrastructure Changes
- Added dependency `express-rate-limit` to `server/package.json`.
- `server/server.js`: introduced tagged `// === [LAUNCH ROUTES IMPORTS] ===` and `// === [LAUNCH ROUTES MOUNTS] ===` blocks (first epic to need them) and mounted `grievanceRoutes` at `/api`.
- `real-estate-crm-app/src/App.tsx`: introduced tagged `LAUNCH COMPONENT IMPORTS` / `LAUNCH PUBLIC ROUTES` / `LAUNCH PROTECTED ROUTES` blocks and added the `/grievance` + `/admin/grievances` routes.

## Security Enhancements
- Public endpoint hardened: IP rate limiting (5/hr), honeypot, hCaptcha verification.
- Admin endpoints require Cognito token (`validateToken`) **and** a founder/admin role check (`requireAdmin`).
- Email/PostHog side effects run via `Promise.allSettled` so they can never fail or block a valid submission.
- No tenant ID required or accepted on the public path; admin path does not leak across tenants (table is global by design).

## Testing Performed
- `node --check` on all new/modified server files — pass.
- DynamoDB Local smoke test (table + GSIs created, router mounted in-process):
  - service create → `GR-` tracking ID format OK; getById OK; update→resolved stamps `resolvedAt`; list-by-status OK.
  - `POST /api/grievance` valid → 200 + tracking ID; honeypot → 400; short description → 400; 6th request → 429; `GET /api/admin/grievances` without token → 401.
- Frontend `vite build` — pass; `tsc --noEmit` — zero errors in PR-B files.
- `tests/grievance.spec.ts` (Playwright) added covering UI submit, honeypot 400, rate-limit 429, admin page; UI/admin specs auto-skip when the full stack isn't reachable.

## Known Constraints / Documented Discrepancies
- **Brevo endpoint:** spec text shows `…/v3/transactional-emails`; used the correct Brevo path `https://api.brevo.com/v3/smtp/email`.
- **Admin route naming / rate limit:** followed PR-B coding-agent-brief (`/api/admin/grievances`, PATCH, 5/hr). The older `ZEESHAN-tasks.md` draft listed `/api/grievance` (GET/PUT) and 6/hr — brief is the declared source of truth.
- **ID format:** brief mentions ULID; used UUID v4 (already a repo dependency) with the same `GR-{6}` tracking-ID derivation. No functional difference for the contract.
- **Out of PR-B scope (left unchecked in P9):** static-HTML mirror of the grievance page for landing-page footers, LP/CRM footer + Privacy Policy links, and Schema.org `ContactPoint` JSON-LD — these belong to the landing-page/SEO PRs.
- hCaptcha/Brevo/PostHog activate only when their env vars are set; absent keys are logged and skipped so local/dev stays testable.

## Rollback Notes
Remove the PR-B lines inside the tagged blocks in `server/server.js` and `App.tsx`, delete the 5 new files, and drop `express-rate-limit` from `server/package.json`. No DB migrations to revert (the `Grievances` table is managed out-of-band).
