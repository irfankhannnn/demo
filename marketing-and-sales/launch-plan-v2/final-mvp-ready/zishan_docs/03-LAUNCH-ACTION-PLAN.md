# MVP Launch Action Plan — Week-by-Week Execution
## For the Technical Founder (You)

**Start Date:** Today (2026-06-20)  
**Target Launch:** 2026-07-01 (11 days) — Realistic **after fixing 5 critical blockers**  
**Scope:** Fix blockers → Testing → Deployment → Go-live

---

## Week 1: Fix Blockers + Testing (Days 1-7)

### Day 1 (Today): Fix 5 Critical Deployment Blockers

**Morning (4 hours): Fix deploy.sh + CFN**

1. **Fix `apps/crm/server/infra/deploy.sh`** — add 8 missing parameters to `cfn-params.json` and `PARAM_OVERRIDES`:
   - `CreditsTableName`, `CreditConfigTableName`
   - `SesFromEmail`, `EmailProviderPrimary`
   - `BaileyEnabled`, `BaileyApiKey`, `BaileyWebhookSecret`
   - `AgentsEnabled`

2. **Fix `apps/crm/server/scripts/escalation-cron.js`** — add missing closing brace `}` at line 98.

3. **Cron jobs are now merged into cfn-backend.yaml** — all 10 cron jobs are now part of the main CloudFormation template. No separate cron/*.yaml files needed.

**Afternoon (4 hours): Verify Cron Merged Configuration**

4. **Verify all 10 cron jobs are in cfn-backend.yaml** — no separate cron templates needed anymore. All cron resources are merged into the main template.

**Verification at end of Day 1:**
```bash
set -e
# Validate syntax
node --check apps/crm/server/scripts/escalation-cron.js
# Validate CFN (all crons are now merged into cfn-backend.yaml)
aws cloudformation validate-template --template-body file://server/infra/cfn-backend.yaml
```

**End of Day 1:** Blockers fixed, syntax validated.

---

### Day 2: Code Verification + AWS Setup Kickoff

**Morning (2 hours): Code Verification**
```bash
set -e
# Verify server builds
cd server
npm ci
npm run build

# Verify frontend builds
cd ../real-estate-crm-app
npm ci
npm run build

# Check for TypeScript errors
npm run type-check
```

**Checklist:**
- [ ] Server builds with no errors
- [ ] Frontend builds with no TypeScript errors
- [ ] All imports are ESM (no require in server)
- [ ] No console errors in frontend

**Afternoon (2 hours): AWS Setup Kickoff**
- [ ] Start SES domain verification (AWS Console) — **takes 24-48 hours**
- [ ] Create Razorpay webhook in dashboard
- [ ] Document all env vars in `.env.example`
- [ ] Verify all secrets are in AWS Secrets Manager / Lambda env (not hardcoded)
- [ ] Keep `AGENTS_ENABLED=false` for launch
- [ ] Keep `BAILEY_ENABLED=false` for launch unless WhatsApp is critical

**End of Day 2:** Code verified, AWS setup in progress.

---

### Days 3-4: E2E Tests (Critical Path)

**Day 3 Morning (4 hours): Write Playwright Tests**

Create `tests/playwright/ui/mvp-critical-path.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('MVP Critical Path', () => {
  // Scenario 1: Signup → Trial → CRM
  test('should complete signup flow and show trial banner', async ({ page }) => {
    // 1. Google OAuth (mock)
    // 2. RegisterAdmin form
    // 3. Verify trial banner shows "14 days left"
    // 4. Verify credit balance shows "1000 / 1000"
  });

  // Scenario 2: Upgrade via Razorpay
  test('should upgrade subscription via Razorpay', async ({ page }) => {
    // 1. Login as trial user
    // 2. Click "Upgrade"
    // 3. Complete Razorpay checkout
    // 4. Verify subscription is active
    // 5. Verify credits reset to 5,000
  });

  // Scenario 3: Create Lead → Deduct Credit
  test('should deduct credits on lead creation', async ({ page }) => {
    // 1. Login with 500 credits
    // 2. Create lead (cost=10)
    // 3. Verify balance shows 490
    // 4. Verify ledger entry created
  });

  // Scenario 4: Out of Credits → Buy → Resume
  test('should handle insufficient credits and allow purchase', async ({ page }) => {
    // 1. Login with 5 credits
    // 2. Try to create lead (needs 10)
    // 3. Verify 402 error
    // 4. Click "Buy Credits"
    // 5. Complete Razorpay purchase
    // 6. Verify balance increased
    // 7. Lead creation succeeds
  });
});
```

**Day 3 Afternoon (4 hours): Run E2E Tests**
```bash
npm run test:e2e
```

**Expected outcome:** All 4 scenarios pass (or identify bugs to fix)

**Day 4: Fix E2E Test Failures**
- Debug any failures
- Fix bugs in code or tests
- Re-run until all 4 scenarios pass

**End of Days 3-4:** E2E tests are passing.

---

### Days 5-6: Security Tests

**Day 5 Morning (3 hours): Write Security Tests**

Create `tests/security/tenant-isolation.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Security Tests', () => {
  // Tenant isolation
  test('tenantB should not access tenantA data', async ({ page }) => {
    // 1. Login as tenantA
    // 2. Create lead
    // 3. Logout
    // 4. Login as tenantB
    // 5. Try to access tenantA's lead via API
    // 6. Verify 403 or empty response
  });

  // Webhook signature validation
  test('invalid webhook signature should return 401', async ({ page }) => {
    // 1. Send webhook with invalid signature
    // 2. Verify 401 response
  });

  // Rate limiting
  test('rate limiting should block after 20 requests/min', async ({ page }) => {
    // 1. Send 20 requests
    // 2. Verify all succeed
    // 3. Send 21st request
    // 4. Verify 429 response
  });
});
```

**Day 5 Afternoon (3 hours): Run Security Tests**
```bash
npm run test:security
```

**Day 6: Fix Security Test Failures**
- Debug any failures
- Fix bugs
- Re-run until all pass

**End of Days 5-6:** Security tests are passing.

---

### Day 7: Optional Unit Tests (Recommended)

**Day 7 (8 hours): Write + Run Unit Tests for Critical Services**

Create `tests/unit/creditService.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { deductCredits, grantCredits, getBalance } from '../../server/creditService';

describe('creditService', () => {
  // Atomic deduction
  it('should deduct credits atomically', async () => {
    // 1. Set balance to 100
    // 2. Deduct 30
    // 3. Verify balance is 70
    // 4. Verify ledger entry created
  });

  // Concurrency
  it('should handle concurrent deductions safely', async () => {
    // 1. Set balance to 40
    // 2. Deduct 30 (request 1)
    // 3. Deduct 30 (request 2) in parallel
    // 4. Verify 1 succeeds, 1 fails (TransactionCanceled)
  });

  // Insufficient credits
  it('should throw InsufficientCreditsError', async () => {
    // 1. Set balance to 5
    // 2. Try to deduct 10
    // 3. Verify error is thrown
    // 4. Verify balance unchanged
  });
});
```

**End of Week 1:** All tests are passing (E2E, security, unit).

---

## Week 2: Deployment & Go-Live (Days 8-11)

### Day 8: Infrastructure Deployment

**Morning (4 hours): Deploy CloudFormation Stack**

```bash
set -e

cd apps/crm/server/infra

# 1. Verify CFN template
aws cloudformation validate-template --template-body file://cfn-backend.yaml

# 2. Deploy stack
./deploy.sh

# 3. Verify tables created
aws dynamodb list-tables | grep cloudberry-real-estate

# 4. Seed credit config
npm run seed:credit-config

# Note: All 10 cron jobs are now deployed as part of cfn-backend.yaml - no separate cron deployment needed
```

**Checklist:**
- [ ] CloudFormation stack deployed (includes API + all 10 cron jobs)
- [ ] Credit tables created
- [ ] Credit config seeded
- [ ] All cron jobs scheduled in CloudFormation
- [ ] Lambda functions are live

**Afternoon (2 hours): Verify AWS Setup**
- [ ] SES domain verified (should be done by now)
- [ ] SES production access granted
- [ ] Razorpay webhook configured
- [ ] Bailey setup complete (if BAILEY_ENABLED=true)

**End of Day 8:** Infrastructure is live.

---

### Days 9-10: Smoke Tests on Production

**Day 9 Morning (4 hours): Run E2E Tests Against Production**

```bash
set -e

# Check API is reachable before tests
curl -f https://api.realestateflow.in/health || { echo "API not reachable"; exit 1; }

# Set env to production
export VITE_API_URL=https://api.realestateflow.in
export VITE_AUTH_API_URL=https://auth.realestateflow.in

# Run E2E tests
npm run test:e2e
```

**Expected outcome:** All 4 critical scenarios pass on production Lambda

**Day 9 Afternoon (2 hours): Manual Smoke Test**
- [ ] Signup → trial → CRM loads
- [ ] Trial banner shows "14 days left"
- [ ] Create lead → credit deducted
- [ ] Upgrade → Razorpay → payment captured
- [ ] Email sent (check SES logs)
- [ ] Cron executed (check CloudWatch logs)

**Day 10: Fix Production Issues**
- Debug any failures
- Fix bugs
- Re-test until everything works

**End of Days 9-10:** Everything works on production.

---

### Day 11: Go-Live

**Morning (2 hours): Final Checklist**

```
Code:
- [ ] All tests passing (E2E, security, unit)
- [ ] No console errors in browser
- [ ] No Lambda errors in CloudWatch

Infrastructure:
- [ ] CloudFormation stack deployed
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

**Afternoon (2 hours): Launch**
- [ ] Keep `AGENTS_ENABLED=false`
- [ ] Keep `BAILEY_ENABLED=false` unless tested
- [ ] Monitor CloudWatch for errors
- [ ] Be ready to rollback if needed

**End of Day 11:** MVP is live.

---

## Daily Standup Template

Use this to track progress:

```
Date: 2026-06-XX

COMPLETED:
- [ ] Item 1
- [ ] Item 2

BLOCKED:
- [ ] Item (reason)

NEXT:
- [ ] Item 1
- [ ] Item 2

RISKS:
- [ ] Risk (mitigation)
```

---

## Rollback Plan

### If E2E Tests Fail
1. Identify which scenario failed (signup, payment, credit, or 402)
2. Check CloudWatch logs for errors
3. Fix code or test
4. Re-run test
5. If code fix, re-deploy Lambda

### If Production Deployment Fails
1. Check CloudFormation events for errors
2. Fix CFN template or env vars
3. Re-run deploy.sh
4. Verify tables created

### If SES Fails
1. Check SES logs in CloudWatch
2. Verify domain is verified
3. Verify production access granted
4. Fallback to Brevo (already configured)

### If Razorpay Fails
1. Check Razorpay webhook logs
2. Verify webhook is configured
3. Verify HMAC secret is correct
4. Test webhook locally

### If Cron Fails
1. Check CloudWatch logs for cron execution
2. Verify EventBridge rule is active
3. Verify Lambda has correct permissions
4. Check DynamoDB for errors

---

## What NOT to Do

❌ **Don't skip fixing the 5 critical blockers.** They're deployment blockers.  
❌ **Don't skip E2E tests.** They're your safety net.  
❌ **Don't deploy without SES domain verified.** Email won't work.  
❌ **Don't enable AGENTS_ENABLED=true for launch.** Keep it disabled until tested.  
❌ **Don't enable BAILEY_ENABLED=true for launch unless tested.** Keep it disabled.  
❌ **Don't skip security tests.** Tenant isolation is critical.  
❌ **Don't deploy on Friday.** Deploy on Tuesday-Thursday so you can fix issues.  

---

## Success Criteria

**MVP is ready to launch when:**
1. ✅ 5 critical deployment blockers fixed
2. ✅ E2E tests pass (all 4 scenarios)
3. ✅ Security tests pass (tenant isolation, webhooks, rate limiting)
4. ✅ Infrastructure deployed (CloudFormation, crons, Lambda)
5. ✅ AWS setup complete (SES, Razorpay, Bailey)
6. ✅ Smoke tests pass on production
7. ✅ No critical bugs in CloudWatch logs

---

## If You Get Stuck

1. Check `01-TECHNICAL-READINESS-ANALYSIS.md` for context
2. Check `02-CODE-AUDIT-REPORT.md` for exact issues
3. Check `pending-mvp/known-issues-and-suggestions.md` for solutions
4. Check `09-error-handling-recovery.md` for error patterns
5. Check CloudWatch logs for actual errors

---

**Timeline:** 11 days (realistic, after fixing blockers)  
**Effort:** ~60-80 hours (6-8 hours/day × 10 days)  
**Risk:** Low (blockers are known; code is mostly done)

**You can do this. Start with Day 1 blockers right now.**

---

Generated: 2026-06-20  
Scope: Technical execution only  
Audience: You (the technical founder)
