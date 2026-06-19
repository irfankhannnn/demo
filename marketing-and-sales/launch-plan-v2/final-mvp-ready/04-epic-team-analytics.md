# EPIC 4 — Team Member Analytics (Admin) + Excel Export + WhatsApp Summary

**Outcome:** An agency owner (ADMIN) sees a dashboard of every team member with full details and performance, exports it to Excel, and receives a daily summary on WhatsApp.

**Frontend owner:** Zishan.

**Architecture anchors (cross-service join):**
- Team member identity → **auth microservice** `reality-flow-authentication`.
  - **Server-side (E4-T1):** No internal user-list endpoint exists. Forward the admin's Bearer token: `axios.get(\`${process.env.AUTH_SERVICE_URL}/users\`, { headers: { Authorization: req.headers.authorization } })`. Returns the tenant's user array.
  - **Frontend (reference):** `real-estate-crm-app/src/pages/admin/MemberManagement.tsx` calls `GET ${VITE_AUTH_API_URL}/users` directly. Mirror this pattern in `TeamAnalytics.tsx` if needed.
  - `UserItem` fields: `userId, tenantId, displayName, email, phoneNumber, role ('ADMIN'|'MEMBER'), status ('ACTIVE'|'INACTIVE'|'SUSPENDED'), lastLoginAt, authMethod`.
- Performance → **CRM** (`server/crmDynamodbService.js`): leads have `assignedTo` (userId string), `status` (`new|contacted|qualified|negotiating|converted|lost`), `convertedAt`, `createdAt`. Use existing CRM list/filter functions — do not scan raw.
- Admin gating: `real-estate-crm-app/src/utils/rbac.ts` → `isAdmin()`. Copy admin redirect from `real-estate-crm-app/src/pages/admin/MemberManagement.tsx`: `if (profile?.role !== 'ADMIN') { navigate('/member/no-access'); return; }`.
- Table UI: `real-estate-crm-app/src/components/GlassDataTable.tsx` — import and use directly (sort/filter built in; no built-in export button).
- Auth service URL server-side: `process.env.AUTH_SERVICE_URL` (already set in Lambda env via CFN).
- See `notes/codebase-reference.md` §5 for exact UserItem schema and endpoint details.

---

## E4-T1 — Backend: team analytics aggregation endpoint

**Goal:** One endpoint returns per-member metrics for the tenant.

**Files**
- NEW `server/routes/admin.js` (mount at `/api/admin` in `server/server.js`, after express.json(); chain `validateToken, extractTenantId, requireAdmin` — `requireAdmin` already exported from `server/middleware/requireRole.js`)
- NEW `server/teamAnalyticsService.js`
- MODIFY `server/server.js` (mount router)
- Reuse: an internal call to the auth service for the member list. There is already a server→auth call pattern in `validateToken.js` (axios to `AUTH_SERVICE_URL`). Add a helper to fetch `GET {AUTH_SERVICE_URL}/internal/users?tenantId=` OR reuse the existing seat-count internal endpoint referenced by subscriptions (`/internal/users/count`). Confirm the exact internal users endpoint; if only `/users` (token-based) exists, call it forwarding the admin's token.

**Endpoint**
- `GET /api/admin/team-analytics?startDate&endDate` → `{ items: [ memberMetrics ] }`

**`memberMetrics` per member**
```
userId, name, email, phone, role, status, lastLoginAt, whatsAppPhoneNumber?,
dealsClosed,          // leads.status==='converted' && convertedAt in range, assignedTo===userId
activeLeads,          // assignedTo===userId && status not in (converted,lost)
totalAssigned,        // assignedTo===userId in range
conversionRate,       // dealsClosed/totalAssigned
contactedRate,        // contacted+/totalAssigned  (responsiveness proxy)
lastActivityAt        // max(updatedAt) across records the member touched (createdBy/assignedTo)
```

**Detail**
- `teamAnalyticsService.getTeamAnalytics(tenantId, range)` in `server/teamAnalyticsService.js`:
  1. `members` = call `GET {AUTH_SERVICE_URL}/users` with forwarded Authorization header. Parse response as `UserItem[]`.
  2. `leads` = call existing CRM lead list functions from `server/crmDynamodbService.js` — pass `{ tenantId, startDate, endDate }` range filters. Do not re-query per member.
  3. Aggregate in memory keyed by `assignedTo` → metrics. Members with no leads still appear (zeros).
  4. `conversionRate = dealsClosed / totalAssigned` (guard division by zero with `|| 0`).
  5. `contactedRate = (leads where status !== 'new') / totalAssigned` as responsiveness proxy.
- Guard performance: query leads once, bucket by member, rather than per-member queries.

**Security**
- Admin-only. All keyed by `req.tenantId`. A member from another tenant can never appear (auth-service list is tenant-scoped; CRM query is `TENANT#`-scoped).

**Tests**
- Integration: seed leads across members → metrics correct (conversion math, range filter, members-with-zero appear).
- Security: non-admin → 403; tenant B cannot see tenant A.

**Acceptance**
- Endpoint returns accurate per-member metrics for the tenant within the date range.

**Depends on:** none (uses existing data).

---

## E4-T2 — Backend: Excel export endpoint

**Goal:** Download the same analytics as `.xlsx`.

**Files**
- NEW `server/utils/excel.js`
- MODIFY `server/routes/admin.js` — `GET /api/admin/team-analytics/export?startDate&endDate`
- MODIFY `server/package.json` — add `xlsx` dependency.
- MODIFY `server/infra/deploy.sh` zip include — `xlsx` is in `node_modules` (already zipped via `node_modules`), so no include-list change needed. Verify bundle size still within Lambda limits.

**Detail**
- `excel.js`: `buildTeamAnalyticsWorkbook(items)` → `XLSX.utils.json_to_sheet`, one sheet "Team Analytics", returns Buffer.
- Route sets `Content-Type` (spreadsheetml), `Content-Disposition: attachment; filename="team-analytics-{date}.xlsx"`, sends buffer.

**Security**
- Admin-only; same tenant scoping as E4-T1.

**Tests**
- Integration: response is a valid xlsx (parse back with `XLSX.read`, assert rows == members).

**Acceptance**
- Admin downloads a correct Excel file.

**Depends on:** E4-T1.

---

## E4-T3 — Frontend: Team Analytics page (Zishan)

**Goal:** Admin-only page with sortable table + filters + Excel download + member detail drawer.

**Files**
- NEW `real-estate-crm-app/src/pages/admin/TeamAnalytics.tsx`
- MODIFY `real-estate-crm-app/src/App.tsx` — `/admin/team-analytics` (ProtectedRoute + admin redirect like MemberManagement).
- Reuse `GlassDataTable` for the table; `apiService` for calls; lucide-react icons; Tailwind + brand `#2563EB`.

**Detail**
- Columns: Name, Mobile, Email, Role, Status, Deals Closed, Active Leads, Conversion %, Last Activity.
- Date-range filter (this month / 3 months / all) → re-fetch.
- Search by name (client-side via GlassDataTable).
- "Download Excel" → `GET /api/admin/team-analytics/export` (fetch blob → trigger download).
- Row click → drawer with member full details (name, mobile, email, role, last login, deals list, current active leads). Fetch member detail (reuse `/team-analytics` item, or add `GET /api/admin/team-analytics/:userId` if a deals list is needed — define in E4-T1 as optional sub-route).
- Admin gating: copy the `isAdmin` redirect effect from `MemberManagement.tsx`.

**Security**
- UI gating is convenience; server enforces admin (E4-T1/T2).

**Tests**
- Playwright: admin sees table from mocked endpoint; non-admin redirected; download triggers blob fetch; drawer opens with details.

**Acceptance**
- Admin views, sorts, filters, exports team analytics and inspects a member.

**Depends on:** E4-T1, E4-T2.

---

## E4-T4 — WhatsApp daily team summary (skill + cron)

**Goal:** Admin receives a daily team performance summary on WhatsApp.

**Files**
- NEW `server/scripts/team-summary-cron.js` (handler `handler`)
- NEW CFN `cron/team-summary.yaml` (clone `trial-reminder.yaml`; schedule daily 18:00 IST = `cron(30 12 * * ? *)`; env: CRM table, AUTH_SERVICE_URL, BAILEY env, CREDITS table)
- Reuse `teamAnalyticsService.getTeamAnalytics` and `server/bailey.js` (`sendWhatsAppMessage`).

**Detail**
- For each tenant with an ADMIN that has `whatsAppPhoneNumber` (and `BAILEY_ENABLED`): build a compact summary (top performers, totals) and send via Bailey.
- Deduct `whatsapp_send` credits per message (EPIC 2).
- If Bailey disabled → optionally email the summary via `emailService` instead (graceful degrade).

**Security**
- Only ADMIN recipients; tenant-scoped data.

**Tests**
- Unit: builds correct summary string; sends once per eligible admin; credit deduction called.

**Acceptance**
- At 18:00 IST, eligible admins get a daily summary (WhatsApp if enabled, else email).

**Depends on:** E4-T1, E1-T4 (Bailey), E2 (credits). Degrades gracefully without Bailey.

---

## EPIC 4 acceptance (whole)
- Admin dashboard shows every team member's details + performance, sortable/filterable, Excel-exportable; a daily WhatsApp/email summary is delivered. All strictly tenant-scoped and admin-gated.
