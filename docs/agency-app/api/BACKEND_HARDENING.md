# CRM Backend Hardening — Security & Tenant Isolation

Last updated: 2026-07-22

This document reflects the **current** core CRM backend security model.
It does **not** cover AI Employee / WhatsApp SyncBot / MCP tool orchestration.

## Tenant isolation (mandatory)

| Path | How tenant is resolved |
|------|------------------------|
| Authenticated CRM APIs | JWT via `validateToken` → `req.tenantId` (server-derived). Client `x-tenant-id` is **ignored**. |
| Public property / enquiry / B2B submit | `apiKeyAuth` → tenant from `TenantApiKeys` row. Client `x-tenant-id` is **never** trusted. |
| Platform grievances | Platform-wide table (no tenant). List/update require **platform operator**. |
| Global credit config | Platform-wide. All routes require **platform operator**. |

`extractTenantId` fails closed if auth did not set `req.tenantId`.
`extractTenantIdOptional` only passes through an already-trusted `req.tenantId` (e.g. from API key).

## Platform operator auth

Middleware: `agency-app/api/middleware/requirePlatformOperator.js`

Granted when any of:

1. `req.user.role` is `PLATFORM_OPERATOR` or `SUPER_ADMIN`
2. `userId` is in `PLATFORM_OPERATOR_USER_IDS` (comma-separated)
3. `email` is in `PLATFORM_OPERATOR_EMAILS` (comma-separated)

Protected routes:

- `GET|PUT /api/credit-config/*`
- `GET|PATCH /api/admin/grievances*`

Tenant `ADMIN` / `OWNER` / `FOUNDER` **cannot** access these.

## RBAC summary (tenant-scoped)

| Area | Read | Write |
|------|------|-------|
| Leads / contacts / buyers / properties | Authenticated | `requireAdminOrManager` (existing) |
| Khata | `requireAdmin` | `requireAdmin` |
| Enquiries (CRM) | Authenticated | `requireAdminOrManager` |
| B2B leads (CRM) | Authenticated | `requireAdminOrManager` |
| Notification batch jobs / cleanup / test | — | `requireAdmin` |
| Notification settings update | — | `requireAdminOrManager` |

## CORS

Single source of truth: `agency-app/api/utils/corsOrigins.js`

- Express `cors()` allowlist + `credentials: true`
- Error handler and Lambda OPTIONS / response wrapper **echo allowlisted Origin**
- Never set `Access-Control-Allow-Origin: *` with credentials

Env: `ALLOWED_ORIGINS` (comma-separated). Empty allowlist blocks browser cross-origin calls.

## API keys

`agency-app/api/middleware/apiKeyAuth.js`

- Looks up `keyHash` via GSI `keyHash-index` when available
- Falls back to **paginated Scan without `Limit`** (Limit-before-filter bug fixed)
- Sets `req.tenantId` from the key row only

CFN: `agency-app/api/infra/launch-tables-cfn.yaml` defines `keyHash-index` on `TenantApiKeys`.

## DynamoDB hardening

- Main list getters in `crmDynamodbService.js` paginate via `collectAllPages` (`agency-app/api/utils/dynamoPagination.js`)
- Profile updates require `attribute_exists(PK)` (no silent upserts)
- `convertLead` runs as a single DynamoDB `TransactWriteItems` transaction (snapshot + entity + optional property + note moves + lead delete). There is no `convertingLockAt` / conversion-in-progress saga.
- Meeting summaries use `meetingDate` (not the obsolete `scheduledDate` field)
- `vacateProperty` clears `tenantCustomerId`

Developers / areas services are intentionally unchanged.

## API Gateway notes

- `/api/health/deep` is an explicit child of `/api/health`
- `/api/admin/{proxy+}` catch-all covers `team-analytics`, `agent-activity`, etc.
- Explicit `/api/admin/grievances` remains for grievance admin paths
- Lambda env: `SUBSCRIPTIONS_TABLE` and `NPS_TABLE` (not `*_TABLE_NAME`)

## Public form clients

Marketing / public sites must send:

```http
Authorization: Bearer <tenant-api-key>
Content-Type: application/json
```

Do **not** send `x-tenant-id` as the authority for tenant binding.

## Related files

- `agency-app/api/tenantMiddleware.js`
- `agency-app/api/middleware/requirePlatformOperator.js`
- `agency-app/api/middleware/apiKeyAuth.js`
- `agency-app/api/utils/corsOrigins.js`
- `agency-app/api/utils/dynamoPagination.js`
- `agency-app/api/expressError.js`
- `agency-app/api/lambda-handler.js`
- `agency-app/api/infra/apigw-explicit-routes.yaml`
- `agency-app/api/infra/cfn-backend.yaml`
- `agency-app/api/infra/launch-tables-cfn.yaml`
