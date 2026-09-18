# Pending MVP — Manual Tasks & Release Gate

**Branch:** `mvp-readiness-launch`  
**Generated:** 2026-06-19  
**Purpose:** Everything that still requires human action before production MVP launch.

---

## Quick Status

| EPIC | Code Status | Deploy/Config Status |
|------|-------------|---------------------|
| E1 Onboarding + WhatsApp | ✅ Implemented | ⚠️ Bailey needs vendor setup |
| E2 Credit System | ✅ Implemented | ⚠️ Seed config table + Razorpay keys |
| E3 Email SES | ✅ Implemented | ⚠️ SES domain verify + production access |
| E4 Team Analytics | ✅ Implemented | ✅ Ready after backend deploy |
| E5 Data Quality Crons | ⚠️ Partial | ⚠️ Cron handlers need tenant iteration |
| E6 MCP + Agents | ⚠️ Partial | ⚠️ AGENTS_ENABLED=false; MCP needs local setup |
| Infra CFN/Deploy | ✅ Implemented | ⚠️ Run deploy (includes all 10 cron jobs) |

---

## Document Index

1. [pending-tasks.md](pending-tasks.md) — Task-by-task what remains
2. [deployment-steps.md](deployment-steps.md) — Full deployment runbook
3. [manual-configurations.md](manual-configurations.md) — Env vars, AWS, Razorpay, Bailey
4. [testing-guide.md](testing-guide.md) — E2E, integration, security tests
5. [known-issues-and-suggestions.md](known-issues-and-suggestions.md) — Bugs, gaps, recommendations

---

## Critical Path to Launch

1. Deploy `agency-app/api/infra/cfn-backend.yaml` with new credit + SES params (includes all 10 cron jobs)
2. Seed `cloudberry-real-estate-credit-config` table (run seed script once)
3. Verify SES sender domain (see `../notes/ses-aws-setup.md`)
4. Configure Razorpay webhook + `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`
5. Run Playwright E2E scenarios from `../08-testing-and-acceptance.md`
6. (Optional) Enable `BAILEY_ENABLED` + `AGENTS_ENABLED` for pilot tenants only
