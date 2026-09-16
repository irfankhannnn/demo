# Quick Reference — MVP Launch Checklist
## Print This. Use This. Check Off As You Go.

---

## 🚀 LAUNCH TIMELINE: 11 Days (After Blockers Fixed)

| Phase | Days | Status | Blocker? |
|-------|------|--------|----------|
| Fix 5 Critical Blockers | 1 | ⏳ TODO | ✅ YES |
| Code Verification | 1 | ⏳ TODO | ❌ No |
| E2E Tests | 2-3 | ⏳ TODO | ✅ YES |
| Security Tests | 1-2 | ⏳ TODO | ✅ YES |
| AWS Setup (parallel) | 3-5 | ⏳ TODO | ✅ YES |
| Infrastructure Deploy | 1 | ⏳ TODO | ✅ YES |
| Production Smoke Tests | 1 | ⏳ TODO | ✅ YES |
| **TOTAL** | **8-12** | | |

---

## 🚨 5 CRITICAL BLOCKERS — Fix These First

### Blocker 1: `deploy.sh` Missing 8 CFN Parameters
- `CreditsTableName`, `CreditConfigTableName`
- `SesFromEmail`, `EmailProviderPrimary`
- `BaileyEnabled`, `BaileyApiKey`, `BaileyWebhookSecret`
- `AgentsEnabled`

### Blocker 2: `escalation-cron.js` Syntax Error
- Missing closing brace `}` at line 98

### Blocker 3: Cron Jobs Configuration
- All 10 cron jobs are now merged into cfn-backend.yaml
- Verify SES env vars and IAM permissions are configured in the main template
- No separate cron/*.yaml files needed anymore

---

## 📋 DAY 1 CHECKLIST: FIX BLOCKERS + CODE VERIFY

### Fix Blockers (4 hours)
- [ ] Add 8 params to `apps/crm/server/infra/deploy.sh`
- [ ] Add `}` to `apps/crm/server/scripts/escalation-cron.js`
- [ ] Verify all 10 cron jobs are merged into cfn-backend.yaml
- [ ] Verify SES env vars and IAM permissions in main template

### Code Verification (2 hours)
```bash
set -e
cd server && npm run build
cd ../real-estate-crm-app && npm run build
npm run type-check
```
- [ ] Server builds ✅
- [ ] Frontend builds ✅
- [ ] No TypeScript errors ✅
- [ ] All imports are ESM ✅

### AWS Setup Kickoff (2 hours)
- [ ] Start SES domain verification (AWS Console) — **24-48 hours**
- [ ] Create Razorpay webhook in dashboard
- [ ] Document all env vars in `.env.example`
- [ ] Verify all secrets in AWS Secrets Manager

**End of Day 1:** Blockers fixed, code verified, AWS setup in progress.

---

## 🧪 DAYS 2-3: E2E TESTS (CRITICAL)

### Write Tests (4 hours)
Create `tests/playwright/ui/mvp-critical-path.spec.ts`:
- [ ] Scenario 1: Signup → trial → CRM loads
- [ ] Scenario 2: Upgrade → Razorpay → paid subscription
- [ ] Scenario 3: Create lead → credit deducted
- [ ] Scenario 4: Out of credits → 402 → buy → resume

### Run Tests (4 hours)
```bash
npm run test:e2e
```
- [ ] All 4 scenarios pass ✅
- [ ] Fix any failures
- [ ] Re-run until all pass

**End of Days 2-3:** E2E tests passing.

---

## 🔒 DAYS 4-5: SECURITY TESTS (CRITICAL)

### Write Tests (3 hours)
Create `tests/security/tenant-isolation.spec.ts`:
- [ ] Tenant isolation (tenantB cannot access tenantA)
- [ ] Webhook signature validation
- [ ] Rate limiting (20 req/min per IP)
- [ ] HMAC timing-safe compare

### Run Tests (3 hours)
```bash
npm run test:security
```
- [ ] All security tests pass ✅
- [ ] Fix any failures
- [ ] Re-run until all pass

**End of Days 4-5:** Security tests passing.

---

## ☁️ DAYS 6-7: INFRASTRUCTURE DEPLOY

### Deploy CloudFormation (2 hours)
```bash
set -e
cd apps/crm/server/infra
./deploy.sh
```
- [ ] CloudFormation deployed ✅ (includes API + all 10 cron jobs)
- [ ] Credit tables created ✅
- [ ] All cron jobs scheduled ✅
- [ ] Lambda functions live ✅

### Verify AWS Setup (2 hours)
- [ ] SES domain verified ✅ (should be done by now)
- [ ] SES production access granted ✅
- [ ] Razorpay webhook configured ✅
- [ ] Bailey setup complete (if needed) ✅

**End of Days 6-7:** Infrastructure live.

---

## 🔥 DAYS 8-10: PRODUCTION SMOKE TESTS

### Run E2E Tests on Production (2 hours)
```bash
set -e
curl -f https://api.realestateflow.in/health || { echo "API not reachable"; exit 1; }
export VITE_API_URL=https://api.realestateflow.in
export VITE_AUTH_API_URL=https://auth.realestateflow.in
npm run test:e2e
```
- [ ] All 4 scenarios pass on production ✅
- [ ] Fix any production issues

### Manual Smoke Test (2 hours)
- [ ] Signup → trial → CRM loads ✅
- [ ] Trial banner shows "14 days left" ✅
- [ ] Create lead → credit deducted ✅
- [ ] Upgrade → Razorpay → payment captured ✅
- [ ] Email sent (check SES logs) ✅
- [ ] Cron executed (check CloudWatch) ✅

**End of Days 8-10:** Everything works on production.

---

## 🎉 DAY 11: GO-LIVE

### Final Checklist (2 hours)
```
Code:
- [ ] All tests passing
- [ ] No console errors
- [ ] No Lambda errors in CloudWatch

Infrastructure:
- [ ] CloudFormation deployed
- [ ] All Lambda functions live
- [ ] All DynamoDB tables created
- [ ] All crons scheduled

AWS:
- [ ] SES domain verified
- [ ] SES production access granted
- [ ] Razorpay webhook configured
- [ ] Bailey setup complete (if enabled)

Observability:
- [ ] CloudWatch dashboards deployed (optional)
- [ ] SNS alerts configured (optional)
- [ ] Log groups created

Documentation:
- [ ] deployment-steps.md complete
- [ ] pending-tasks.md complete
- [ ] .env.example complete
- [ ] Runbook for on-call engineer
```

### Launch (2 hours)
- [ ] Keep `AGENTS_ENABLED=false`
- [ ] Keep `BAILEY_ENABLED=false` unless tested
- [ ] Monitor CloudWatch for errors
- [ ] Be ready to rollback if needed

**End of Day 11:** MVP is live 🚀

---

## 🚨 BLOCKERS (Cannot Ship Without)

1. **5 deployment blockers fixed** — deploy.sh, escalation-cron.js, cron configuration in cfn-backend.yaml
2. **E2E tests failing** — Scenario 1-4 must pass
3. **SES domain not verified** — Email won't work (24-48 hours)
4. **Razorpay webhook not configured** — Payments won't work
5. **Tenant isolation broken** — Cross-tenant data leak risk
6. **Webhook signature validation failing** — Bailey/Razorpay won't work

---

## ✅ NON-BLOCKERS (Can Ship Without)

- Unit tests (E2E tests exercise same code)
- Agent testing (disabled by default)
- CloudWatch dashboards (can deploy post-launch)
- Bailey setup (optional; keep disabled)
- Lead router/followup agents (optional; keep disabled)
- Member notifications for expiring agreements (admin alerts work)
- Performance optimization (acceptable for MVP)

---

## 🔧 CRITICAL COMMANDS

### Code Verification
```bash
set -e
npm run build      # Build
npm run type-check # TypeScript check
```

### Testing
```bash
npm run test:e2e       # E2E tests
npm run test:security  # Security tests
npm run test:unit      # Unit tests (optional)
```

### Deployment
```bash
set -e
cd apps/crm/server/infra
./deploy.sh            # Deploy main stack (includes API + all 10 cron jobs)
```

### Validation
```bash
node --check apps/crm/server/scripts/escalation-cron.js
aws cloudformation validate-template --template-body file://server/infra/cfn-backend.yaml
# Note: All cron jobs are now merged into cfn-backend.yaml - no separate cron templates to validate
```

### Monitoring
```bash
# Check API health
curl -f https://api.realestateflow.in/health

# Check CloudWatch logs
aws logs tail /aws/lambda/realestateflow-api --follow

# Check DynamoDB tables
aws dynamodb list-tables | grep cloudberry-real-estate

# Check Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `realestateflow`)]'
```

---

## 📞 IF YOU GET STUCK

1. Check `01-TECHNICAL-READINESS-ANALYSIS.md` for context
2. Check `02-CODE-AUDIT-REPORT.md` for exact issues
3. Check `pending-mvp/known-issues-and-suggestions.md` for solutions
4. Check `09-error-handling-recovery.md` for error patterns
5. Check CloudWatch logs for actual errors

---

## 🎯 SUCCESS CRITERIA

✅ 5 deployment blockers fixed  
✅ E2E tests pass (all 4 scenarios)  
✅ Security tests pass (tenant isolation, webhooks, rate limiting)  
✅ Infrastructure deployed (CloudFormation, crons, Lambda)  
✅ AWS setup complete (SES, Razorpay, Bailey)  
✅ Smoke tests pass on production  
✅ No critical bugs in CloudWatch logs  

---

## 📊 PROGRESS TRACKER

```
Week 1 (Days 1-7):
- [ ] Day 1: Fix 5 blockers + code verification + AWS kickoff
- [ ] Days 2-3: E2E tests
- [ ] Days 4-5: Security tests
- [ ] Day 6-7: Infrastructure deploy

Week 2 (Days 8-11):
- [ ] Days 8-10: Production smoke tests
- [ ] Day 11: Go-live
```

---

## 🚀 YOU'VE GOT THIS

- Code is ~80% done
- 5 critical blockers are known and fixable in 1-2 days
- Testing is the blocker after that (2-3 days)
- AWS setup is parallel (3-5 days)
- Infrastructure deploy is 1 day
- Total: 8-12 days to launch

**Start with the 5 critical blockers right now.**

---

**Generated:** 2026-06-20  
**Scope:** Quick reference for technical execution  
**Audience:** You (the technical founder)

Print this. Bookmark this. Check off as you go.
