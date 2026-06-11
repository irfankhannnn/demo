# Phase 2 Launch — Independent Audit Report

**Audit date:** 2026-06-11  
**Audited branch:** `auth_rbac_feature` @ `b49c977`  
**Source of truth:** `marketing-and-sales/launch-plan-v2/` + `coding-agent-brief/`  
**Auditor role:** Principal Engineer / QA / Security / Release Manager  
**Method:** Document inventory → file existence → code review → build/test execution → branch/PR cross-check  

---

## Executive Summary

### Verdict: **NOT FULLY COMPLIANT** — Partially Complete (~75% code present, ~55% launch-ready)

`auth_rbac_feature` has merged all 13 coding PR branches (PR-A through PR-M) via local merge commits. **Most launch-plan code files exist** and the CRM frontend **builds successfully**. However, **critical integration gaps** block a safe Phase 2 launch:

| Severity | Count | Examples |
|---|---|---|
| **P0** | 5 | Billing webhook HMAC broken; seat increment stub; missing analytics tests; LP analytics not in build output; DDB tables not in IaC |
| **P1** | 5 | PostHog stub in grievance; incomplete event instrumentation; LP /grievance 404; seat-cap bypass risk |
| **P2** | 1 | Lambda Sentry missing |

**Bottom line:** The branch is a strong integration sandbox but **must not be treated as launch-complete**. Fix BUG-001 through BUG-005 before any production deploy. See `bugs/BUG-001.md` through `BUG-010.md`.

### What works (evidence-backed)
- CRM `npm run build` — pass (Vite, 1897 modules, 3.4s)
- 13/13 PR file sets largely present (routes, services, components, crons, 6 Playwright specs)
- Tagged `LAUNCH ROUTES` blocks in `server/server.js` and `App.tsx` — correctly structured
- `analytics.ts` — PostHog-only, no GA4/Pixel (architecture rule satisfied in CRM)
- Security static audit — 0 P0 findings (`security-audit-report.md`)
- UTM capture in `PhoneLogin.tsx` + `identifyUser` in `App.tsx` — implemented
- Brevo post-registration hook in `server/routes/auth.js` — implemented

---

## Epic Completion Matrix

| Epic | Story | PR | Status | Evidence |
|---|---|---|---|---|
| EPIC 1 | ZEE-001 Demo Environment | PR-A | **COMPLETE** | `seed-demo-tenant.js`, `reset-demo-tenant.js`, `cron/reset-demo.yaml`, `DemoBanner.tsx` |
| EPIC 2 | ZEE-002 Grievance Flow | PR-B | **PARTIAL** | Routes + UI + tests exist; PostHog stub remains (BUG-006) |
| EPIC 3 | ZEE-006 Cookie Consent | PR-C | **PARTIAL** | CRM banner + LP partial exist; LP pages don't include partial (BUG-004) |
| EPIC 4 | ZEE-008-T1 LP Build Pipeline | PR-D | **PARTIAL** | Pipeline builds; pages don't use partials/Tailwind compile (BUG-004) |
| EPIC 5 | ZEE-003 Analytics Layer | PR-E | **PARTIAL** | `analytics.ts`, `posthog.js`, `head-analytics.hbs` exist; tests missing; grievance stub (BUG-003, BUG-006, BUG-007) |
| EPIC 6 | ZEE-004 Billing + Concierge | PR-F | **PARTIAL** | Files exist; webhook HMAC broken (BUG-001); seat stub (BUG-002) |
| EPIC 7 | ZEE-010 Security Audit | PR-G | **COMPLETE** | `cross-tenant-pentest.spec.ts`, audit report, route CSV — 0 P0 |
| EPIC 8 | ZEE-005 Seat Cap | PR-H | **PARTIAL** | Service + UI exist; billing stub; auth-layer bypass (BUG-002, BUG-009) |
| EPIC 9 | ZEE-008/009 Landing Pages | PR-I | **PARTIAL** | 12 HTML pages + 12 JSON-LD; no partial integration; Lighthouse not run |
| EPIC 10 | ZEE-007 Paywall + Trial | PR-J | **PARTIAL** | Components + cron exist; events not instrumented (BUG-007) |
| EPIC 11 | ZEE-028 NPS | PR-K | **PARTIAL** | Modal + feedback route + tests; no `nps_response` trackEvent (BUG-007) |
| EPIC 12 | ZEE-013 Signup → Brevo | PR-L | **PARTIAL** | Brevo + UTM wired; no `signup_completed` server event (BUG-007) |
| EPIC 13 | ZEE-012 Analytics CI | PR-M | **NOT IMPLEMENTED** | CI workflow exists; `analytics.spec.ts` missing (BUG-003) |
| EPIC 14 | ZEE-011 Day 2 Friction | — | **NOT IMPLEMENTED** | Requires founder Day 1 walkthrough (manual) |
| EPIC 15 | ZEE-013 Deploy | — | **NOT IMPLEMENTED** | LP deploy, Lighthouse, smoke test — manual (ZEE-013-T2–T6 open) |

---

## Story Completion Matrix (ZEE-001 – ZEE-013)

| Story | Status | Notes |
|---|---|---|
| ZEE-001 | **COMPLETE** | All 5 tasks; files verified |
| ZEE-002 | **PARTIAL** | PostHog stub in grievance route |
| ZEE-003 | **PARTIAL** | T1–T6 done; T7 analytics spec missing |
| ZEE-004 | **PARTIAL** | Webhook mount order + seat stub |
| ZEE-005 | **PARTIAL** | check-seat vs auth.js spec deviation |
| ZEE-006 | **PARTIAL** | T3 LP injection not done |
| ZEE-007 | **PARTIAL** | Code complete; event instrumentation missing |
| ZEE-008 | **PARTIAL** | T1–T6 done; T7 Lighthouse not run |
| ZEE-009 | **PARTIAL** | T1–T5 done; T6 schema validation not done |
| ZEE-010 | **COMPLETE** | Audit docs + pentest spec |
| ZEE-011 | **NOT IMPLEMENTED** | Blocked on founder friction walkthrough |
| ZEE-012 | **PARTIAL** | CSV done; analytics spec falsely marked complete |
| ZEE-013 | **PARTIAL** | T1 Brevo done; T2–T6 deploy tasks open |

---

## Acceptance Criteria Matrix (Key PR Gates)

| Criterion | Source | Status | Evidence |
|---|---|---|---|
| Grievance form public + rate limit + honeypot | PR-B | **PASS** | `grievance.js:171+`, `tests/grievance.spec.ts` |
| Grievance PostHog server event | PR-B + PR-E | **FAIL** | Stub at `grievance.js:25` — BUG-006 |
| Billing webhook HMAC verify | PR-F | **FAIL** | `express.json()` before billing mount — BUG-001 |
| Billing seat increment on webhook | PR-F + PR-H | **FAIL** | Stub in `billing.js:10` — BUG-002 |
| CRM analytics PostHog-only | PR-E | **PASS** | `analytics.ts` — no gtag/fbq |
| LP analytics consent-gated | PR-E + PR-C | **FAIL** | Not in built `dist/` — BUG-004 |
| `tests/analytics.spec.ts` 100% pass | PR-E + PR-M | **FAIL** | File missing — BUG-003 |
| Seat 402 at cap | PR-H | **PARTIAL** | `check-seat` works; auth bypass risk — BUG-009 |
| 12 LP pages with UTM CTAs | PR-I | **PASS** | e.g. `main/index.html:45` |
| 12 LP pages use build pipeline CSS | PR-D + PR-I | **FAIL** | Tailwind CDN still in source + dist — BUG-004 |
| Cross-tenant 0 P0 | PR-G | **PASS** | `security-audit-report.md` |
| NPS modal 14-day trigger | PR-K | **PASS** | `NpsModal.tsx:9,22+` |
| Signup → Brevo contact | PR-L | **PASS** | `auth.js:16-66` |
| Signup → PostHog identify + UTM | PR-L + PR-E | **PASS** | `App.tsx:162-169`, `PhoneLogin.tsx:37-43` |
| 7 DDB tables provisioned | INFRA-01 | **UNKNOWN** | Not in CFN; requires AWS console verification |
| Playwright CI gate | PR-M | **PARTIAL** | Workflow runs 6 specs; analytics spec absent |

---

## Required APIs — Implementation Status

| Endpoint | Spec | Implemented | Auth | Notes |
|---|---|---|---|---|
| `POST /api/grievance` | PR-B | ✅ | Public | Rate limit 5/hr |
| `GET /api/admin/grievances` | PR-B | ✅ | Admin | Matches spec |
| `PATCH /api/admin/grievances/:id` | PR-B | ✅ | Admin | Matches spec |
| `POST /api/billing/webhook` | PR-F | ⚠️ | Public | HMAC broken — BUG-001 |
| `GET /api/ai-employee/status` | PR-F | ✅ | Auth | |
| `GET /api/subscriptions/current` | PR-H | ✅ | Auth | |
| `GET /api/subscriptions/trial-status` | PR-J | ✅ | Auth | |
| `POST /api/subscriptions/check-seat` | PR-H | ✅ | Auth | Not in original spec; replaces auth.js |
| `POST /api/feedback/nps` | PR-K | ✅ | Auth | |
| `GET /api/nps` | PR-K | ✅ | Public HMAC | |
| `POST /api/auth/post-registration` | PR-L | ✅ | Auth | Brevo only; no PostHog |

---

## Required UI — Implementation Status

| Component / Page | Path | Status |
|---|---|---|
| DemoBanner | `components/DemoBanner.tsx` | ✅ |
| CookieConsentBanner (CRM) | `components/CookieConsentBanner.tsx` | ✅ |
| cookie-banner (LP partial) | `_partials/cookie-banner.html` | ⚠️ Not included in pages |
| Grievance public | `pages/public/Grievance.tsx` | ✅ |
| Grievance admin | `pages/admin/GrievanceList.tsx` | ✅ |
| AIEmployeeStatus | `pages/crm/AIEmployeeStatus.tsx` | ✅ |
| SeatCounter | `components/SeatCounter.tsx` | ✅ |
| SeatUpgradeModal | `components/SeatUpgradeModal.tsx` | ✅ |
| TrialCountdownBanner | `components/TrialCountdownBanner.tsx` | ✅ |
| PaywallModal | `components/PaywallModal.tsx` | ✅ |
| NpsModal | `components/NpsModal.tsx` | ✅ |
| 12 LP HTML pages | `creative/landing-pages/*/index.html` | ✅ content; ⚠️ no partials |
| LP grievance page | `grievance/index.html` | ❌ BUG-008 |

---

## Database & Infrastructure Findings

| Item | Status | Evidence |
|---|---|---|
| Grievances table schema in code | ✅ | `grievanceDynamodbService.js` |
| Subscriptions table schema in code | ✅ | `subscriptionService.js` |
| AIEmployeeProvisioning in code | ✅ | `aiEmployeeProvisioningService.js` |
| WebhookLog idempotency | ✅ | `webhookLogService.js` |
| NPSResponses in code | ✅ | `feedback.js` route |
| **CFN table resources** | ❌ | No matches in `server/infra/` — BUG-005 |
| Lambda cron YAMLs | ✅ | `cron/{reset-demo,escalate-openclaw,trial-reminder}.yaml` |
| Cron deployed to AWS | **UNKNOWN** | Manual INFRA-03 — blocked on deploy |
| Demo Cognito pool | **UNKNOWN** | Manual INFRA-02 |

---

## Security Findings

| Finding | Severity | Status |
|---|---|---|
| Cross-tenant isolation (active routes) | — | 0 P0 per audit report |
| b2bLeads missing extractTenantId | P1 | Open — `security-audit-report.md` P1-1 |
| Public b2bLeads no rate limit | P1 | Open — P1-2 |
| Public enquiries no rate limit | P1 | Open — P1-3 |
| Billing webhook HMAC | **P0** | Broken mount order — BUG-001 |
| Grievance rate limit + honeypot + hCaptcha | — | Implemented |
| Secrets in code | — | None found; env-var pattern used |
| CORS `origin: '*'` on API | P2 | Pre-existing; not launch-plan scope |
| Tenant isolation in new routes | — | Subscriptions, feedback use extractTenantId |

---

## Quality Findings

| Check | Result |
|---|---|
| CRM `npm run build` | ✅ Pass |
| CRM TypeScript (build) | ✅ Pass (via Vite) |
| Server `node --check` | Not run on all files; spot-check grievance/billing — syntax OK |
| LP `npm run build:lps` | ✅ Pass but output lacks analytics (BUG-004) |
| Playwright tests (no server) | 7/9 API tests fail — `ECONNREFUSED :3001` (expected without backend) |
| Dead code — billing seat stub | ❌ BUG-002 |
| Dead code — grievance PostHog stub | ❌ BUG-006 |
| Tracker doc vs code drift | ZEE-012 marked complete while analytics.spec missing |

---

## Test Coverage Findings

| Test File | Exists | Coverage Area | Status |
|---|---|---|---|
| `tests/grievance.spec.ts` | ✅ | Grievance UI + API + admin | Present |
| `tests/cookie-consent.spec.ts` | ✅ | LP + CRM consent (7 tests) | Present; LP tracker network tests deferred |
| `tests/cross-tenant-pentest.spec.ts` | ✅ | Tenant isolation + webhook sig | Present |
| `tests/seat-cap.spec.ts` | ✅ | check-seat + subscription GET | Present; needs running API |
| `tests/paywall.spec.ts` | ✅ | Banner colors + paywall modal | Present |
| `tests/nps.spec.ts` | ✅ | NPS modal eligibility + submit | Present |
| `tests/analytics.spec.ts` | ❌ | Full analytics architecture | **MISSING — BUG-003** |
| Unit tests (server services) | ❌ | DDB services | Not Covered |
| RBAC unit tests | ❌ | Role gates | Partially in E2E only |
| LP build verification tests | ❌ | Partial expansion | Not Covered |

**Overall test posture:** E2E specs exist for 6/7 planned areas; analytics gate is the critical gap. No unit test suite for new DynamoDB services.

---

## Cursor Branch Findings

| Branch | Merged into `auth_rbac_feature` | Merged to `main` | GitHub PR | Recommendation |
|---|---|---|---|---|
| `cursor/pr-1a-demo-environment-8e67` | ✅ | ✅ (#7) | MERGED | Safe to delete after auth_rbac merges to main |
| `cursor/pr-1b-grievance-flow-8e67` | ✅ | ✅ (#8) | MERGED | Safe to delete |
| `cursor/pr-1c-cookie-consent-8e67` | ✅ | ❌ | OPEN (#9) | **Needs merge via auth_rbac** — do not delete |
| `cursor/pr-1d-lp-build-pipeline-8e67` | ✅ | ❌ | OPEN (#10) | Needs merge via auth_rbac |
| `cursor/pr-2e-analytics-layer-8e67` | ✅ | ❌ | OPEN (#11) | Needs merge via auth_rbac |
| `cursor/pr-2f-billing-webhook-8e67` | ✅ | ❌ | OPEN (#13) | Needs merge via auth_rbac |
| `cursor/pr-2g-security-audit-8e67` | ✅ | ❌ | OPEN (#14) | Needs merge via auth_rbac |
| `cursor/pr-3h-seat-cap-8e67` | ✅ | ❌ | OPEN (#15) | Needs merge via auth_rbac |
| `cursor/pr-3i-landing-pages-8e67` | ✅ | ❌ | OPEN (#16) | Needs merge via auth_rbac |
| `cursor/pr-4j-paywall-trial-8e67` | ✅ | ❌ | OPEN (#17) | Needs merge via auth_rbac |
| `cursor/pr-4k-nps-modal-8e67` | ✅ | ❌ | OPEN (#18) | Needs merge via auth_rbac |
| `cursor/pr-5l-signup-brevo-8e67` | ✅ | ❌ | OPEN (#19) | Needs merge via auth_rbac |
| `cursor/pr-6m-analytics-final-ci-8e67` | ✅ | ❌ | OPEN (#20) | Needs merge via auth_rbac |
| `cursor/launch-plan-v2-architecture-updates-8e67` | ✅ | ✅ (#12) | MERGED | Safe to delete |
| `cursor/launch-plan-v2-master-prompt-update-1e5a` | ✅ | ✅ (#5) | MERGED | Safe to delete |
| `cursor/phase2-launch-plan-architecture-f0b9` | ❌ | ❌ | — | **Obsolete** — superseded by architecture-updates branch |
| `cursor/ai-real-estate-os-blueprint-6865` | ❌ | ❌ | OPEN (#6) | Unrelated to launch-plan-v2 — keep separate |

**Note:** All PR-A–M work was **locally merged** into `auth_rbac_feature` but GitHub PRs #9–#20 remain **OPEN** — they were not merged through GitHub to `main`. The integration branch `auth_rbac_feature` (PR #4) is the effective integration point.

---

## PR Findings

| PR | Ready to Merge? | Blockers |
|---|---|---|
| #4 `auth_rbac_feature` → `main` | **NO** | P0 bugs BUG-001–005; fix before merge |
| #9–#20 cursor PRs | **SUPERSEDED** | Content already in auth_rbac_feature; close after auth_rbac merges with attribution |
| #7, #8 (PR-A, PR-B) | ✅ Already on main | — |

---

## Safe To Merge List

**None** for production launch until P0 bugs resolved.

**Safe to merge to main after P0 fixes:**
1. `auth_rbac_feature` (single integration PR) — preferred over merging #9–#20 individually since local merges already done

---

## Safe To Delete List (after `auth_rbac_feature` merges to `main`)

- `cursor/pr-1a-demo-environment-8e67` (already on main)
- `cursor/pr-1b-grievance-flow-8e67` (already on main)
- `cursor/launch-plan-v2-architecture-updates-8e67`
- `cursor/launch-plan-v2-master-prompt-update-1e5a`
- `cursor/phase2-launch-plan-architecture-f0b9` (obsolete)
- All `cursor/pr-*-8e67` branches after auth_rbac merge (duplicate of integrated work)

**Do NOT delete until merge confirmed:**
- `auth_rbac_feature`

---

## Missing Implementations (Bug Index)

| Bug | Title | Priority |
|---|---|---|
| [BUG-001](bugs/BUG-001.md) | Billing webhook after express.json — HMAC broken | P0 |
| [BUG-002](bugs/BUG-002.md) | billing.js incrementSeatsPaid stub | P0 |
| [BUG-003](bugs/BUG-003.md) | tests/analytics.spec.ts missing | P0 |
| [BUG-004](bugs/BUG-004.md) | LP pages don't include analytics/cookie partials | P0 |
| [BUG-005](bugs/BUG-005.md) | 7 DDB tables not in CloudFormation | P0 |
| [BUG-006](bugs/BUG-006.md) | grievance.js PostHog stub | P1 |
| [BUG-007](bugs/BUG-007.md) | Incomplete P10 event instrumentation | P1 |
| [BUG-008](bugs/BUG-008.md) | LP /grievance 404 | P1 |
| [BUG-009](bugs/BUG-009.md) | Seat-cap not on auth invite API | P1 |
| [BUG-010](bugs/BUG-010.md) | Lambda Sentry missing | P2 |

---

## Manual Tasks Still Required (from `pending-tasks/`)

These are **not code gaps** but remain launch blockers:

| Group | Examples | Parallel with coding? |
|---|---|---|
| **A — Start now** | 7 DDB tables (INFRA-01), vendor accounts (PostHog, GA4, Razorpay KYC), Cloudflare DNS | ✅ Yes |
| **B — After YAML merge** | Deploy 3 Lambda crons (INFRA-03) | After auth_rbac deploy |
| **C — Human only** | Lawyer review, Day 1 friction walkthrough, Day 3 ₹1 payment, beta outreach | ❌ No |

76 manual tasks documented in `pending-tasks/` — unchanged by this audit.

---

## Recommended Next Actions

### Immediate (before any deploy)
1. Fix **BUG-001** (webhook mount order) and **BUG-002** (seat increment import) — billing is completely non-functional without these.
2. Fix **BUG-004** (LP partial integration) — marketing site has no analytics or cookie consent.
3. Create **BUG-003** (`tests/analytics.spec.ts`).
4. Execute **INFRA-01** (create 7 DDB tables) or add CFN (**BUG-005**).

### Before merge to `main`
5. Fix BUG-006, BUG-007, BUG-008, BUG-009.
6. Run full Playwright suite with API server + preview server running.
7. Run `build:lps` and deploy `dist/` to Netlify staging; verify 12 URLs + grievance path.
8. Close superseded GitHub PRs #9–#20 with note pointing to `auth_rbac_feature` merge.

### Post-merge (Week 1)
9. Founder Day 1 friction walkthrough → ZEE-011.
10. Lighthouse mobile on all LPs (ZEE-008-T7).
11. Day 7 security re-scan (ZEE-010-T5).

---

## Audit Artifacts

- This report: `coding-agent-brief/AUDIT-REPORT.md`
- Bug tracker: `coding-agent-brief/bugs/BUG-001.md` – `BUG-010.md`
- Audited commit: `b49c977` on `auth_rbac_feature`
- Audit branch: `cursor/launch-plan-v2-audit-report-6c18`

---

*This audit did not modify production code. All findings are evidence-backed from repository inspection on 2026-06-11.*
