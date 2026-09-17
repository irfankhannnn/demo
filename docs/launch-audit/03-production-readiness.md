# Phase 3 — Production Readiness

**Branch:** `auth_rbac_feature` @ `5890183`
**Scope:** infrastructure, CI/CD, observability. Distinguishes *code/IaC ready* (a coding agent can complete) from *operational* (founder/vendor action in a console).

> **NOTE:** This document reflects the state before cron jobs were merged into `cfn-backend.yaml` (2026-06-21). For current deployment, see `marketing-and-sales/launch-plan-v2/final-mvp-ready/zishan_docs/08-FINAL-IMPLEMENTATION-PLAN.md`. The cron files referenced here (`cron/*.yaml`) are now obsolete — all cron resources are in the unified template.

---

## Infrastructure

| Area | Status | Evidence | Owner | Criticality |
|---|---|---|---|---|
| Deployment scripts | ✅ READY | `agency-app/api/infra/deploy.sh`, `cfn-backend.yaml`, `launch-tables-cfn.yaml`, `apigw-explicit-routes.yaml`; `docs/agency-app/api/DEPLOYMENT-GUIDE.md` | Zeeshan | P0 |
| Launch DDB tables (IaC) | ✅ READY | `launch-tables-cfn.yaml` — 7 tables, PITR, GSIs, TTL | Zeeshan | P0 |
| Tables deployed to AWS | ❌ PENDING (human) | `pending-tasks/01-infra-setup.md` INFRA-01 marked AI-complete, deploy pending | Founder | P0 |
| Environment variables | ✅ DOCUMENTED | `.env.example` in `agency-app/api/`, `agency-app/web/`, `creative/landing-pages/`, `agency-app/ai-calling/`, `tests/playwright/` | Zeeshan | P0 |
| Env values populated | ❌ PENDING (human) | LP `.env` (DEPLOY-02), Netlify/Lambda env (DEPLOY-03+) require real keys from 1Password | Founder | P0 |
| Backup strategy | ⚠️ PARTIAL | PITR enabled in CFN (point-in-time recovery) = backup for DDB. No documented restore drill | Founder | P1 |
| Monitoring | ❌ PENDING (human) | BetterStack monitor spec at `launch-implement/week-1/day-05-*`; not provisioned | Founder | P1 |
| Alerting | ❌ PENDING (human) | CloudWatch alarms / WAF (INFRA-04/05) listed as human tasks | Founder | P1 |
| Demo cron deploy | ❌ PENDING (human) | `cron/reset-demo.yaml` IaC ready; EventBridge deploy pending (INFRA-03) | Founder | P1 |

---

## CI/CD

| Area | Status | Evidence | Criticality |
|---|---|---|---|
| Build (CRM) | ✅ | `playwright.yml` runs `npm ci` + `npm run build` for `real-estate-crm-app` | P0 |
| Build (LP) | ⚠️ | `build:lps` pipeline exists but not run in CI; after Phase 6 it produces consent-gated pages | P1 |
| Test | ✅ | `playwright.yml` runs `npx playwright test`; `tests/analytics.spec.ts` + `tests/playwright/**` specs present | P0 |
| Lint | ⚠️ | CRM has `eslint .` (`npm run lint`) but it is **not** a CI step; `agency-app/api/` has no lint config | P1 |
| Security scans | ❌ | No SAST/dependency-audit step (`npm audit`, CodeQL) in CI | P1 |
| Deployment workflow | ❌ | No CD workflow; deploys are manual (`deploy.sh` + Netlify). Acceptable for a beta launch but documented as a gap | P1 |

**CI note:** the workflow triggers on PRs into `main` and `cursor/*`. This audit PR targets `auth_rbac_feature`; confirm the branch pattern covers it (see PR notes) so checks actually run.

---

## Observability

| Area | Status | Evidence | Criticality |
|---|---|---|---|
| Logs | ✅ | `agency-app/api/logger.js` structured JSON logs; `requestLogger.js` correlation IDs; CloudWatch via Lambda | P0 |
| Health endpoints | ✅ | `GET /api/health` (liveness) + `GET /api/health/deep` (`deepHealthCheck`) | P0 |
| Metrics | ⚠️ | PostHog product analytics (`agency-app/api/lib/posthog.js`); no infra metrics dashboard wired | P1 |
| Tracing | ⚠️ | Request-ID correlation only; no distributed tracing (acceptable for single-Lambda) | P2 |
| Error tracking (CRM) | ✅ | Sentry in `src/main.tsx` (`VITE_SENTRY_DSN`, tracesSampleRate 0.1) | P0 |
| Error tracking (server) | ❌→✅ | **Was missing** in `lambda-handler.js` (BUG-010). Added env-guarded `@sentry/node` init in Phase 6 | P1 |

---

## Production-readiness verdict

- **Code/IaC:** ready after Phase 6 (LP consent/analytics + server Sentry + grievance redirect + key events).
- **Operational gating (human):** table deploy, env-value population, monitoring/alerting provisioning, and a CD pipeline remain. These are tracked in `pending-tasks/` and Phase 5.
- No production-readiness item is blocked by missing *code*; the residual P0 is the operational `cloudformation deploy` of the 7 tables + populating real env values.
