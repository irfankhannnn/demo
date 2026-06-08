# Day 7 — Final Technical Audit + Backup/DR Test

## Objective
Run a complete end-to-end production audit — visit landing, sign up, complete onboarding, try core features, pay, get invoice, cancel — and verify backups/disaster recovery work. If everything passes, RealtyFlow is ready for Day 8 soft launch.

## Why This Matters for RealtyFlow
This is your last full-stack sanity check before real users arrive. Any bug found tomorrow during a beta tester's onboarding call (Day 10) is a trust-damaging surprise. A clean audit today = confident beta launch tomorrow. Backup testing is non-negotiable: a corrupted DB without verified backups means losing every customer record permanently.

## User Story
As a founder, I want to execute a complete end-to-end audit of RealtyFlow in production (landing → signup → onboarding → core features → payment → invoice → cancellation) AND verify that DynamoDB Point-in-Time Recovery works by restoring a test table from yesterday, so that I have evidence-based confidence that RealtyFlow is ready for Week 2 soft launch.

## Acceptance Criteria
- [ ] End-to-end customer journey completes in <15 minutes with zero breaks
- [ ] All analytics events fire correctly during the audit
- [ ] Live payment + invoice + access provisioning all work
- [ ] Cancellation flow tested and verified
- [ ] Mobile audit passed on real device
- [ ] Performance: Lighthouse mobile score 85+ on all key pages
- [ ] DynamoDB PITR enabled and a test restore completed successfully
- [ ] Critical environment variables documented (rotation procedure noted)
- [ ] Production error rate <0.5% across all endpoints (last 7 days)
- [ ] Status page reports all components green
- [ ] Pre-launch-prep checklist 100% complete
- [ ] Week 2 readiness: "Yes, I'm ready to invite beta testers" — written self-affirmation

## Implementation Steps

### Step 1: Run the full customer journey
Fresh incognito + fresh email + your phone in hand. Time everything.

1. Visit `realtyflow.in` — note load time, hero clarity
2. Click "Start Free Trial" — note response time
3. Complete signup — note any friction
4. Verify email — note inbox placement (Gmail tab? Promotions?)
5. First login — note onboarding flow
6. Add a buyer — note steps required
7. Add a project — note steps required
8. Start an AI call (or simulate) — note experience
9. Send a WhatsApp message (or simulate)
10. View dashboard — note metrics displayed
11. Click "Upgrade" — flow to pricing
12. Subscribe to a paid tier (live mode, real card, ₹50 test plan)
13. Verify invoice email arrives
14. Use Tier-2 features post-payment
15. Cancel subscription — flow + access revocation
16. Verify refund (if real money)
17. Logout

Document the time for each step.

### Step 2: Mobile audit on real device
Repeat Steps 1-7 (signup + onboarding + add buyer) on your actual phone using mobile data (not WiFi — simulates real conditions).

Note any:
- Buttons too small to tap
- Forms not visible above keyboard
- Slow loads
- Visual glitches
- Tap zones overlapping

### Step 3: Analytics verification
Open PostHog → Live Events while running Step 1.

Verify each event fires when expected:
- [ ] PageView on landing
- [ ] `signup_started` on form view
- [ ] `signup_completed` on successful signup
- [ ] `onboarding_step_completed` for each step
- [ ] `buyer_added` after adding buyer
- [ ] Funnel chart updating

Check GA4 real-time → verify visits captured.

Check Meta Pixel Events Manager → verify Lead event fired.

### Step 4: Email deliverability spot-check
For each email triggered during the audit, verify:
- Welcome email 1 (immediate) — Inbox / Promotions / Spam?
- Invoice email — Inbox / Spam?
- Cancellation confirmation — Inbox?

Test on at least Gmail, Outlook, Yahoo. Use Mail-Tester for one transactional email — score 9+/10.

### Step 5: Performance audit
Run Chrome Lighthouse on:
- Landing page (target: 90+ mobile)
- Pricing page (target: 85+ mobile)
- Signup page (target: 85+ mobile)
- In-app dashboard (target: 80+ mobile — apps are heavier)

If scores are below target, do quick wins: compress images, defer non-critical JS, eliminate render-blocking resources.

### Step 6: Backup & disaster recovery test
**This is the most-skipped, highest-stakes Day 7 step. Do not skip.**

DynamoDB Point-in-Time Recovery (PITR):
1. AWS Console → DynamoDB → Tables → Select Buyers table → Backups tab
2. Verify PITR is ON (turn on if not — required for restore)
3. Click "Restore" → Choose "Point in time" → pick yesterday's timestamp
4. Restore to a new table: `Buyers-DR-Test-2026-05-15`
5. Wait for restore to complete (varies by table size)
6. Run a query against the restored table: verify items are there
7. Compare item count with current Buyers table — should be close (minus today's adds)
8. Delete the restored test table after verification (save AWS cost)

Repeat for at least:
- Buyers table
- Projects table
- Subscriptions / Users table

If restore fails or data is incomplete → critical issue. Fix or have AWS support look at it. DO NOT proceed to Week 2 without a verified DR procedure.

### Step 7: Environment variables + secrets audit
Open your `.env.example` files and verify:
- [ ] All required keys are documented
- [ ] No real secrets are committed (run `git grep -i "AKIA" or "sk_live" or "key=" to spot leaks)
- [ ] Production `.env` is in secrets manager (AWS Secrets Manager, Doppler, or 1Password)
- [ ] Rotation procedure documented for: AWS keys, Razorpay keys, ElevenLabs keys, Exotel keys
- [ ] Webhook secrets are unique per environment

If any secret is committed historically, rotate it.

### Step 8: Error rate review
Open CloudWatch (or your log aggregator):
- Last 7 days: count 4XX errors, count 5XX errors
- Error rate <0.5% is healthy
- Look at top 5 errors by frequency → are any preventable?

Also check Sentry (if installed) for unresolved frontend errors.

### Step 9: Status page green check
Visit `status.realtyflow.in` (from yesterday's setup).

All components should be green. If any are yellow/red → investigate before Day 8.

### Step 10: Pre-launch-prep completion check
Re-walk through:
- [ ] `01-legal-foundation.md` — all 4 docs published, signup checkbox live
- [ ] `02-pricing-strategy.md` — tiers finalized, displayed
- [ ] `03-email-deliverability.md` — domain warmed, deliverability score 9+
- [ ] `04-competitive-positioning.md` — wedge documented, on landing
- [ ] `05-demo-environment.md` — demo tenant populated and accessible
- [ ] `06-founder-branding.md` — LinkedIn complete, 5 posts published, 200+ connections
- [ ] `07-gst-invoicing-setup.md` — test invoices CA-approved

Any incomplete prep items → resolve today.

### Step 11: Day-7 audit log
Write a 1-page document:
```
# Day 7 Audit — RealtyFlow Production Readiness

Date: [today]
Auditor: [you]

## Customer Journey (15-min E2E test)
- Total time: X min
- Issues found: Y
- Critical issues: Z

## Performance
- Lighthouse landing: X/100
- Lighthouse pricing: Y/100
- Lighthouse app dashboard: Z/100

## Backup Test
- DynamoDB PITR: VERIFIED / FAILED
- Restored tables: [list]
- Data integrity: PASS / FAIL

## Email Deliverability
- Mail-Tester score: X/10
- Inbox placement: Gmail / Outlook / Yahoo

## Error Rate (Last 7d)
- 4XX rate: X%
- 5XX rate: Y%

## Pre-Launch-Prep
- 7/7 items complete: YES / NO
- Outstanding: [list]

## Verdict
[Choose one]
- READY for Week 2 soft launch ✅
- READY with caveats: [list]
- NOT READY — blockers: [list]
```

Save to `marketing-and-sales/launch-plan/week-1-foundation/assets/day-07-audit-log.md`.

### Step 12: Mental prep for Week 2
Take an hour off. Mentally close Week 1. Tomorrow you start talking to real customers.

## Tools / Stack Required
- Chrome incognito + your phone
- AWS Console for DynamoDB PITR
- CloudWatch / Sentry for error logs
- Chrome Lighthouse
- Mail-Tester.com
- PostHog / GA4 / Meta Events Manager

## Time Estimate
- Customer journey audit: 1-2 hours
- Mobile audit: 1 hour
- Performance + email audit: 2 hours
- Backup/DR test: 2 hours (waiting on restores)
- Pre-launch-prep check + log: 1-2 hours
- **Total: full day**

## Deliverables
- Day-7 audit log saved
- Backup verification screenshot saved
- All audit issues either fixed or filed in `friction-backlog.md`
- Written verdict: ready / ready-with-caveats / not-ready

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Audit reveals critical bugs you can't fix in a day | Delay Week 2 start by 1-3 days. Don't soft-launch broken. |
| DR test fails | DO NOT proceed without fix. Data loss without backups = company-ending event |
| You rationalize "good enough" on things that aren't | Set a hard standard: if a paying customer would email about it, fix it now |
| Performance is mediocre but "okay" | Mobile perf is critical for India. Below 80 score = fix today |

## India-Specific Notes
- Mobile audit weight is high — Indian usage is 50%+ mobile
- Tier-2/3 city users on slower networks — test with 3G throttling
- Check DPDP compliance: no PII in analytics, cookie consent works, ToS/Privacy linked
- GST invoice test must pass — Indian B2B critical

## Connected Days / Dependencies
- **Blocks:** Day 8 (Identify Beta Prospects — soft launch starts)
- **Depends on:** Days 1-6 + all 7 pre-launch-prep files

## Success Metric
- Audit log says "READY for Week 2 soft launch ✅"
- You feel calm about Day 8 invitations going out tomorrow
- DR test verified — you can sleep knowing data is recoverable
- Friction backlog has 0 Critical items remaining
