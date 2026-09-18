# Day-7 Security Rescan

Run on Day 7 (after Week 1 code changes). Diff vs T-1 baseline.

## Scope
All routes added in Days 1-6 that weren't in the T-1 baseline scan.

## Process
1. Re-run static analysis CSV for any new route files
2. Re-run Playwright pen-test suite
3. Compare new routes against T-1 coverage CSV
4. Note any new P0 findings
5. Founder sign-off required before Day 9 beta invites

## Checklist
- [ ] Re-run route-tenant-coverage.csv for new files
- [ ] `npx playwright test tests/cross-tenant-pentest.spec.ts`
- [ ] Zero new P0 findings
- [ ] Report appended to security-audit-report.md with "Day 7 rescan" section
- [ ] Verify all P1 items from T-1 audit have been addressed or accepted
- [ ] Review new DDB tables for PITR enablement
- [ ] Confirm WAF rules are active and logging
- [ ] Verify Sentry + CloudWatch alarms are firing on test errors

## New Route Files to Scan (expected by Day 7)
- `agency-app/api/routes/billing.js` (PR-F)
- `agency-app/api/routes/aiEmployeeStatus.js` (PR-F)
- `agency-app/api/routes/subscriptions.js` (PR-H)
- `agency-app/api/routes/feedback.js` (PR-K)

## Expected P0-check Focus Areas
1. Billing webhook HMAC verification still intact after any changes
2. Subscription routes properly gated with `validateToken + extractTenantId`
3. NPS feedback route authenticated
4. No new public routes without rate limiting

## Rescan Report Template

```markdown
## Day 7 Rescan — {DATE}

### New routes since T-1
| file | method | path | severity |
|------|--------|------|----------|
| ... | ... | ... | ... |

### P0 findings: {count}
{details or "None"}

### P1 findings: {count}
{details or "None"}

### T-1 P1 remediation status
| P1 ID | Status | Notes |
|-------|--------|-------|
| P1-1 | Fixed / Accepted / Open | ... |

### Conclusion
{GO / FIX-AND-RESCAN / HOLD}

### Sign-off
Auditor: ___________ Date: ___________
Founder: ___________ Date: ___________
```
