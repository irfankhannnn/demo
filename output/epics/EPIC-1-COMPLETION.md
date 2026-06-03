# EPIC 1 — Demo Environment (PR-A / ZEE-001) — Completion Report

**Branch:** `cursor/pr-1a-demo-environment-8e67`
**Source of truth:** `coding-agent-brief/prompts/PR-A-demo-environment.md` (ZEE-001, `pre-launch-prep/P5-demo-environment.md`)

## Implemented Features
- Self-contained, idempotent demo-tenant seeder (`server/scripts/seed-demo-tenant.js`) — deterministic IDs so re-running overwrites instead of duplicating.
- Seeds 65 rows for tenant `DEMO_REALESTATEFLOW`: 20 buyers, 15 owners, 10 Mumbai properties (one per locality), 8 pipeline leads, 2 team members, 5 Khata entries, 5 AI WhatsApp transcripts.
- Mumbai-realistic data (Andheri/Bandra/Powai/Thane/Borivali/Goregaon/Lower Parel/Worli/Juhu/Vashi), ₹50L–₹4Cr budgets, synthetic-only PII (`9XXXXXXXXX` phones, `demo+{type}-{n}@realestateflow.in` emails).
- `--reset` flag purges every demo row across all CRM tables, then re-seeds.
- Lambda cron wrapper (`server/scripts/reset-demo-tenant.js`) exporting `resetDemo()` + `handler()` for EventBridge.
- `DemoBanner.tsx` — sticky yellow banner gated on `VITE_IS_DEMO==='true'`, dismissable per-session via `sessionStorage`, `role="alert"`, keyboard-accessible dismiss; mounted in `App.tsx` inside the `LAUNCH LAYOUT COMPONENTS` tagged block.

## APIs Added
- None. PR-A is CLI/script + UI only; no `server/server.js` routes added (per anti-conflict rules).

## Database Changes
- No schema/table changes. Writes only to existing tables (CRM single-table, Khata table, Notifications table) scoped by `tenantId`. All data is namespaced to the demo tenant and fully reversible via `--reset`.

## Infrastructure Changes
- `cron/reset-demo.yaml` — EventBridge rule `realestateflow-demo-daily-reset`, schedule `cron(30 20 * * ? *)` (UTC) = **2:00 AM IST daily**, target Lambda `realestateflow-demo-reset` (handler `server/scripts/reset-demo-tenant.handler`, Node 22.x, 60s timeout, 256 MB) + `lambda:InvokeFunction` permission for `events.amazonaws.com`.
- `server/scripts/seed-demo-tenant-deploy.md` — deployment runbook (env vars, local testing, Lambda packaging, cron wiring, CloudWatch alarm, demo frontend build).
- `server/.gitignore` — ignores the seeder's `scripts/node-trace.json` runtime artifact.

## Security Enhancements
- No real PII: all phone numbers and emails are synthetic demo values.
- Demo data isolated by `tenantId`; reset is idempotent and reversible, preventing demo-data leakage into real tenants.
- `DemoBanner` is build-gated (`VITE_IS_DEMO`) → it is a no-op in production/local, so the warning only appears on the demo deployment.

## Testing Performed
Validated against DynamoDB Local (Docker `amazon/dynamodb-local`) with the three CRM tables created:
1. `seed-demo-tenant.js --tenant=DEMO_TEST` → exit 0, logged counts (20/15/10/8/2/5/5 = **65 rows**). ✅
2. `seed-demo-tenant.js --reset --tenant=DEMO_TEST` → purged 65 (crm=55, khata=5, notifications=5), re-seeded 65, same counts. ✅
3. Idempotency: ran seed twice with no `--reset` → total stayed **65** (no duplicates). ✅
4. `reset-demo-tenant.js` wrapper → purge + re-seed, exit 0. ✅
5. Frontend `npm run build` (vite) → success; `tsc --noEmit` adds **zero** new errors from `DemoBanner.tsx` / `App.tsx` / `vite-env.d.ts`.

DemoBanner render/dismiss behaviour (AC 3 & 4) verified by implementation (env-gated render + `sessionStorage` dismissal); recommended to confirm via browser test mode before demo go-live.

## Known Constraints
- **Documented time discrepancy (resolved):** older `P5-demo-environment.md` text and `pending-tasks/01-infra-setup.md` mention 03:00 IST / `cron(30 21 ...)`; PR-A prompt + `ZEESHAN-tasks.md` ZEE-001 specify **2:00 AM IST / `cron(30 20 ...)`**. Implemented per the coding-agent-brief (declared single source of truth) = 2:00 AM IST.
- **Env var name:** PR-A uses `VITE_IS_DEMO`; the older P5 story referenced `VITE_DEMO_MODE`. Implemented `VITE_IS_DEMO` per PR-A.
- Pre-existing repo issues unrelated to this PR: many `tsc` errors across the codebase, and `npm run lint` fails repo-wide (ESLint v9 installed but no `eslint.config.js`). Not introduced or fixed here (out of PR-A scope).
- Founder/infra deploy items remain pending (separate tasks): demo Cognito pool, `demo.realestateflow.in` deployment, Lambda+EventBridge wiring, PostHog `demo_tenant_reset` event, slow-4G verification.
