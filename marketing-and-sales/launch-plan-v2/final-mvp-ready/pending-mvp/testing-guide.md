# Testing Guide — MVP Acceptance

## Automated Tests

### Playwright (frontend)
```bash
cd tests/playwright
npx playwright test ui/onboarding-register-admin.spec.ts
npx playwright test ui/crm/paywall.spec.ts
```

New test added: `tests/playwright/ui/onboarding-register-admin.spec.ts`

### Server syntax (new files)
```bash
cd server
node --check creditService.js creditConfig.js emailService.js
node --check teamAnalyticsService.js dataQualityService.js skillInvoker.js
node --check agents/agentRuntime.js middleware/meterCredits.js
```

**Note:** Full `bash scripts/build.sh` fails on pre-existing errors in legacy route files unrelated to this MVP work.

---

## Manual E2E Scenarios (from `08-testing-and-acceptance.md`)

### Scenario 1: Onboarding → Trial
1. Google OAuth login as new user
2. Select Admin role → `/onboarding/register-admin` loads (not redirect to `/crm`)
3. Submit agency name + consent
4. Trial banner shows days remaining
5. `GET /api/subscriptions/credits` returns balance ≈ 1000

### Scenario 2: Upgrade via Razorpay
1. Click Upgrade on trial banner
2. Complete Razorpay checkout (test mode)
3. Webhook updates subscription `isPaying=true`
4. Banner disappears

### Scenario 3: Create Lead → Deduct Credit
1. Note balance via `/crm/settings/billing`
2. Create lead via UI or API
3. Response includes `creditsRemaining` decreased by 10
4. Ledger row in credits table

### Scenario 4: Out of Credits → Buy → Resume
1. Reduce balance below 10 (or use test tenant)
2. Attempt lead create → 402 response
3. Buy Credits modal opens automatically
4. Complete Razorpay order → webhook grants credits
5. Lead create succeeds

### Scenario 5: Team Analytics
1. Login as ADMIN
2. Navigate to `/admin/team-analytics`
3. Table shows all members with metrics
4. Download Excel → valid `.xlsx` file

### Scenario 6: Email delivery
1. Trigger grievance submission or trial reminder cron
2. Check CloudWatch logs for `email.sent` with `provider=ses` or `provider=brevo`

### Scenario 7: Credit reset cron
1. Set subscription `lastCreditResetAt` to yesterday
2. Invoke `credit-reset-cron` Lambda manually
3. Balance resets to plan allotment
4. Second invoke same day → no-op

---

## Security Checklist

| Check | How to verify |
|-------|---------------|
| Tenant isolation | Tenant B cannot read Tenant A credits (`GET /subscriptions/credits`) |
| Admin-only purchase | MEMBER role gets 403 on `POST /credits/purchase` |
| Admin-only analytics | Non-admin redirected from `/admin/team-analytics` |
| Webhook HMAC | Invalid Razorpay signature → 401 |
| Bailey signature | Invalid `x-bailey-signature` → 401 |
| No tenant in body | Credit routes use `req.tenantId` only |

---

## API Smoke Tests (curl)

```bash
# Credits balance (needs valid JWT + x-tenant-id)
curl -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  https://api.example.com/api/subscriptions/credits

# Team analytics (admin only)
curl -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-tenant-id: $TENANT" \
  https://api.example.com/api/admin/team-analytics

# Credit config (admin only)
curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lead_add": 10}' \
  https://api.example.com/api/credit-config/costs
```

---

## Performance Targets (MVP gate)

| Path | Target |
|------|--------|
| Lead create P99 | < 500ms |
| Team analytics | < 2s for < 50 members |
| Agent qualification | < 2s (when enabled) |

---

## Regression Areas

- Existing Razorpay subscription webhook flow (must not break)
- AiSensy broadcasts in billing webhook (unchanged)
- Brevo marketing list in `auth.js` post-registration (unchanged — not SES scope)
- Member invite seat check (`POST /check-seat`)
