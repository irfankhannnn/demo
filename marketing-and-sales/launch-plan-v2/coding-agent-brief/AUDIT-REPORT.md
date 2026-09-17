# Phase 2 Launch — Audit Report (auth_rbac_feature Integration Focus)

**Audit date:** 2026-06-11 (revised)  
**Comparison baseline:** `auth_rbac_feature` @ `b49c977` — **only branch used for this audit**  
**Skipped:** `main` branch (per founder request)  
**Scope:** Verify all `cursor/pr-*-8e67` PR code is present in `auth_rbac_feature`; identify post-merge testing gaps  

---

## Executive Summary

### Merge Verdict: **COMPLETE — No further PR merges required**

All 13 launch-plan PR branches are **fully contained** in `auth_rbac_feature`:

| Check | Result |
|---|---|
| Each PR is ancestor of `auth_rbac_feature` | ✅ 13/13 (`pr_ahead_of_auth = 0` for every branch) |
| Simulated re-merge conflict markers | ✅ 0 conflicts (PR-C, PR-F, PR-H, PR-M tested) |
| PR deliverable files on `auth_rbac_feature` | ✅ 41/42 files present |
| Merge commits on `auth_rbac_feature` | ✅ PR-A through PR-M all merged |

**Your stated goal — merge all PRs into `auth_rbac_feature` without conflicts — is already achieved.** You can proceed directly to testing on `auth_rbac_feature`.

### Testing Verdict: **Issues found — address during your test phase**

After merge integration, code review found **10 post-merge gaps** (tracked in `bugs/`). These are **not merge blockers** — they are defects/incomplete items inside the already-merged codebase that testing should validate and then fix on `auth_rbac_feature`.

| Phase | Count | Action |
|---|---|---|
| Merge complete | 13/13 PRs | No re-merge needed; close GitHub PRs #9–#20 as superseded |
| Post-merge testing gaps | 10 bugs | Fix on `auth_rbac_feature` after/between test runs |
| Manual infra (not PR code) | 7 DDB tables | Founder `pending-tasks/01-infra-setup.md` |

---

## PR → auth_rbac_feature Merge Matrix

Evidence: `git merge-base --is-ancestor origin/<pr> auth_rbac_feature` → YES for all; `git rev-list --count auth_rbac_feature..origin/<pr>` → 0.

| PR | Branch | Merged into auth_rbac | Merge commit (evidence) | Conflicts if re-merged | Deliverables on auth_rbac |
|---|---|---|---|---|---|
| PR-A | `cursor/pr-1a-demo-environment-8e67` | ✅ | `5f5a093`, local merges | None | ✅ All files |
| PR-B | `cursor/pr-1b-grievance-flow-8e67` | ✅ | `7bd6348` | None | ✅ All files |
| PR-C | `cursor/pr-1c-cookie-consent-8e67` | ✅ | `34af991` | None | ✅ All files |
| PR-D | `cursor/pr-1d-lp-build-pipeline-8e67` | ✅ | `dd47307` | None | ✅ All files |
| PR-E | `cursor/pr-2e-analytics-layer-8e67` | ✅ | `02a9a10` | None | ⚠️ No `analytics.spec.ts` (also absent on PR-E tip) |
| PR-F | `cursor/pr-2f-billing-webhook-8e67` | ✅ | `1a21fd5` | None | ✅ All files |
| PR-G | `cursor/pr-2g-security-audit-8e67` | ✅ | `1f8c022` | None | ✅ All files |
| PR-H | `cursor/pr-3h-seat-cap-8e67` | ✅ | `385af00` | None | ✅ All files (see BUG-002, BUG-009) |
| PR-I | `cursor/pr-3i-landing-pages-8e67` | ✅ | `d9bd837` | None | ✅ 14 LP pages + JSON-LD |
| PR-J | `cursor/pr-4j-paywall-trial-8e67` | ✅ | `3c16594` | None | ✅ All files |
| PR-K | `cursor/pr-4k-nps-modal-8e67` | ✅ | `da33d10` | None | ✅ All files |
| PR-L | `cursor/pr-5l-signup-brevo-8e67` | ✅ | `d7b34f9` | None | ✅ All files |
| PR-M | `cursor/pr-6m-analytics-final-ci-8e67` | ✅ | `b49c977` | None | ⚠️ CI workflow ✅; `analytics.spec.ts` missing on PR-M tip too |

### Why `auth_rbac_feature` differs from individual PR tips

`auth_rbac_feature` is **66–79 commits ahead** of each PR branch. It is the **integration superset**: later PR merges added routes to `agency-app/api/server.js`, LP pages from PR-I, paywall/NPS/Brevo layers, etc. Individual PR branches are **stale snapshots** — always treat `auth_rbac_feature` as canonical.

---

## PR Deliverable File Checklist (auth_rbac_feature only)

| File | PR | On auth_rbac |
|---|---|---|
| `agency-app/api/scripts/seed-demo-tenant.js` | A | ✅ |
| `agency-app/api/scripts/reset-demo-tenant.js` | A | ✅ |
| `cron/reset-demo.yaml` | A | ✅ |
| `agency-app/web/src/components/DemoBanner.tsx` | A | ✅ |
| `agency-app/api/routes/grievance.js` + service + UI + test | B | ✅ |
| `marketing-and-sales/creative/landing-pages/_partials/cookie-banner.html` | C | ✅ |
| `agency-app/web/src/components/CookieConsentBanner.tsx` | C | ✅ |
| `tests/cookie-consent.spec.ts` | C | ✅ |
| `marketing-and-sales/creative/landing-pages/build/*` | D | ✅ |
| `agency-app/web/src/lib/analytics.ts` | E | ✅ |
| `marketing-and-sales/creative/landing-pages/_partials/head-analytics.hbs` | E | ✅ |
| `agency-app/api/lib/posthog.js` | E | ✅ |
| `agency-app/api/routes/billing.js` + concierge stack | F | ✅ |
| `tests/cross-tenant-pentest.spec.ts` + audit docs | G | ✅ |
| `agency-app/api/subscriptionService.js` + seat UI + test | H | ✅ |
| 14 LP `index.html` + 12 JSON-LD schemas | I | ✅ |
| Paywall + trial cron + test | J | ✅ |
| NPS modal + feedback route + test | K | ✅ |
| `agency-app/api/routes/auth.js` post-registration (Brevo) | L | ✅ |
| `.github/workflows/playwright.yml` + event CSV | M | ✅ |
| **`tests/analytics.spec.ts`** | E + M | ❌ **Never delivered in any PR branch** |

---

## Epic / Story Status (auth_rbac_feature integration view)

| Story | Merge into auth_rbac | Post-merge quality |
|---|---|---|
| ZEE-001 Demo | ✅ Complete | Ready to test |
| ZEE-002 Grievance | ✅ Complete | ⚠️ PostHog stub remains (BUG-006) |
| ZEE-003 Analytics | ✅ Merged | ⚠️ Spec file missing; partial instrumentation (BUG-003, BUG-007) |
| ZEE-004 Billing | ✅ Merged | ⚠️ Webhook mount + seat stub (BUG-001, BUG-002) |
| ZEE-005 Seat cap | ✅ Merged | ⚠️ check-seat vs auth.js spec (BUG-009) |
| ZEE-006 Cookie consent | ✅ Merged | ⚠️ LP pages don't include partials (BUG-004) |
| ZEE-007 Paywall | ✅ Merged | ⚠️ Events not wired (BUG-007) |
| ZEE-008/009 LP + SEO | ✅ Merged | ⚠️ Build pipeline partials not in page source (BUG-004); /grievance 404 (BUG-008) |
| ZEE-010 Security | ✅ Complete | Ready to test |
| ZEE-012 Analytics CI | ✅ Merged | ⚠️ analytics.spec absent (BUG-003) |
| ZEE-013 Brevo | ✅ Merged | Ready to test Brevo path |
| ZEE-011 Day 2 fixes | N/A | Manual — after founder walkthrough |

---

## Post-Merge Testing Findings (fix after merge, on auth_rbac_feature)

These were validated **on `auth_rbac_feature` only**. They do **not** mean PRs need re-merging.

| Bug | Issue | Merge blocker? | Test priority |
|---|---|---|---|
| [BUG-001](bugs/BUG-001.md) | Billing webhook after `express.json()` | No | P0 — test Razorpay webhook first |
| [BUG-002](bugs/BUG-002.md) | `billing.js` seat increment stub | No | P0 — test seat purchase webhook |
| [BUG-003](bugs/BUG-003.md) | `analytics.spec.ts` missing | No | P0 — add during test hardening |
| [BUG-004](bugs/BUG-004.md) | LP pages lack partial includes | No | P0 — test LP cookie/analytics in `dist/` |
| [BUG-005](bugs/BUG-005.md) | DDB tables not in CFN | No (infra) | P0 — needed for API tests against real AWS |
| [BUG-006](bugs/BUG-006.md) | Grievance PostHog stub | No | P1 |
| [BUG-007](bugs/BUG-007.md) | Incomplete P10 events | No | P1 |
| [BUG-008](bugs/BUG-008.md) | LP `/grievance` 404 | No | P1 |
| [BUG-009](bugs/BUG-009.md) | Seat cap client-only | No | P1 |
| [BUG-010](bugs/BUG-010.md) | Lambda Sentry missing | No | P2 |

---

## Security Review (auth_rbac_feature)

| Finding | Severity | Notes |
|---|---|---|
| Cross-tenant (active routes) | OK | 0 P0 per `security-audit-report.md` |
| Grievance rate limit + honeypot | OK | Implemented |
| Billing webhook HMAC | **FAIL** | BUG-001 — verify in test |
| b2bLeads missing extractTenantId | P1 | Pre-existing; documented in audit report |
| Public endpoints without rate limit | P1 | b2bLeads, enquiries |

---

## Test Coverage (auth_rbac_feature)

| Spec | Present | Notes |
|---|---|---|
| `tests/grievance.spec.ts` | ✅ | 4 tests |
| `tests/cookie-consent.spec.ts` | ✅ | 7 tests |
| `tests/cross-tenant-pentest.spec.ts` | ✅ | 7 tests |
| `tests/seat-cap.spec.ts` | ✅ | 5 tests — needs API on :3001 |
| `tests/paywall.spec.ts` | ✅ | 6 tests |
| `tests/nps.spec.ts` | ✅ | 6 tests |
| `tests/analytics.spec.ts` | ❌ | BUG-003 |
| **Total** | **35 tests / 6 files** | |

CRM build: ✅ `npm run build` passes on `auth_rbac_feature`.

---

## Cursor Branch Recommendations (vs auth_rbac_feature only)

| Branch | vs auth_rbac_feature | Recommendation |
|---|---|---|
| `cursor/pr-1a` … `cursor/pr-6m` | Fully contained (0 commits ahead) | **Safe to close PRs #9–#20** — work lives on auth_rbac |
| `auth_rbac_feature` | Integration branch | **Use this for all testing** |
| `cursor/phase2-launch-plan-architecture-f0b9` | Not in auth_rbac | Obsolete — ignore |
| `cursor/ai-real-estate-os-blueprint-6865` | Not in auth_rbac | Unrelated — ignore |

**Do not re-merge PR branches** — `auth_rbac_feature` already contains their code plus integration fixes. Re-merging adds no new commits.

---

## GitHub PR Status (informational)

PRs #9–#20 remain OPEN on GitHub but their commits are **already in `auth_rbac_feature`**. After you finish testing, close them with: *"Superseded by integration on auth_rbac_feature @ b49c977."*

PR #4 (`auth_rbac_feature`) is the correct integration PR — merge to `main` only after your test phase (out of scope for this audit).

---

## Recommended Workflow (your stated plan)

```
1. ✅ DONE — All PRs merged into auth_rbac_feature (no conflicts)
2. YOU NOW — Test on auth_rbac_feature @ b49c977
3. Fix bugs from bugs/BUG-*.md on auth_rbac_feature as tests fail
4. Founder manual tasks (DDB tables, env vars) per pending-tasks/
5. When tests pass — merge auth_rbac_feature → main
```

### Suggested test order on auth_rbac_feature

1. `npm run build` in `agency-app/web/`
2. Start API + `npx vite preview` → `npx playwright test` (6 specs)
3. `cd marketing-and-sales/creative/landing-pages/build && npm run build:lps` → inspect `dist/` for analytics/cookie (BUG-004)
4. Razorpay webhook test with valid HMAC (BUG-001)
5. Seat purchase webhook → DDB `seatsPaid` increment (BUG-002)

---

## Audit Artifacts

- Report: `coding-agent-brief/AUDIT-REPORT.md` (this file)
- Bugs: `coding-agent-brief/bugs/BUG-001.md` – `BUG-010.md`
- Audited branch: `auth_rbac_feature` @ `b49c977`

*No production code modified. `main` branch not used in this audit.*
