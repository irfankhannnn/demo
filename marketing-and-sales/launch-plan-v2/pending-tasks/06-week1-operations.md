# 06 — Week 1 Operations (Day 1–7)

---

## OPS-W1-01: Day 1 — Friction Walkthrough (Founder-as-User)
**Priority:** Critical — Produces backlog for Day 2 fixes

- Walk the complete product as a new Bandra broker: LP → signup → OTP → role selection → agency setup → first buyer → first property → first lead → AI Employee status → Khata entry → logout + re-login
- Record as Loom (private); do separately on iPhone + low-end Android (4G throttle)
- Log every friction point to `marketing-and-sales/launch-implement/week-1/day-01-friction-log.md`
- Run the Day-01 AI triage prompt (from `week-1-foundation/day-01-friction-walkthrough.md`) → produces `day-01-backlog.md` with P0/P1/P2 + ICE scores
- Target: <8 minutes desktop signup → first record
- Hand `day-01-backlog.md` to coding agent for Day 2 P0 fixes

**References:** `team-work/FOUNDER-tasks.md` FND-010 · `week-1-foundation/day-01-friction-walkthrough.md`

---

## OPS-W1-02: Day 2 — Ship P0 Friction Fixes
**Priority:** Critical

- Feed `day-01-backlog.md` P0 items to a coding agent
- Agent creates PR per `week-1-foundation/day-02-fix-friction-points.md` spec
- Founder smoke tests each fix after deploy; confirm re-walkthrough time ≤8 min desktop

**References:** `team-work/ZEESHAN-tasks.md` ZEE-011 · `week-1-foundation/day-02-fix-friction-points.md`

---

## OPS-W1-03: Day 3 — Razorpay Live Mode + ₹1 Test Transaction
**Priority:** Critical — First revenue gate

- Confirm Razorpay KYC = APPROVED
- Switch to live mode; clone test products → live
- Capture all live plan IDs → update `pricing.json.razorpayPlanIds.live` → redeploy Lambda
- Register live webhook + capture new `RAZORPAY_WEBHOOK_SECRET_LIVE`
- Execute ₹1 test: signup → upgrade → pay via UPI → confirm invoice PDF, CloudWatch logs, PostHog `subscription_started` event, DDB Subscriptions row
- Send invoice PDF to CA; wait for sign-off
- T+1 day: confirm bank settlement
- Refund the ₹1 test
- Log: "Razorpay live ₹1 invoice CA-approved YYYY-MM-DD" in `00-DECISIONS-LOG.md`

**References:** `team-work/FOUNDER-tasks.md` FND-011 · `week-1-foundation/day-03-payment-go-live.md`

---

## OPS-W1-04: Day 4 — Analytics Vendor Configuration (Conversion Events)
**Priority:** High — Required for paid ad tracking + funnel accuracy

- GA4 Admin → Events → mark `signup_completed` + `subscription_started` as conversions
- Meta Events Manager → mark `Lead`, `Subscribe`, `Purchase` as conversions in the ad account
- LinkedIn Campaign Manager → configure conversion tracking for `signup_completed` + `subscription_started`
- Manually verify cookie consent gating: incognito → reject cookies → network tab → confirm GA4/Pixel/LinkedIn scripts NOT loaded
- Run `npx playwright test tests/analytics.spec.ts` → 100% pass

**References:** `team-work/FOUNDER-tasks.md` FND-012 · `week-1-foundation/day-04-analytics-events-final.md`

---

## OPS-W1-05: Day 5 — Helpdesk + Status Page
**Priority:** High

- Sign up for Crisp + BetterStack (see ACCT-13, ACCT-14)
- Run MAD-010 AI prompt → configure 6 saved replies + BetterStack monitor spec
- Embed Crisp snippet in all 5 LP pages + CRM SPA `index.html` (update existing deployed versions or add to PR)
- Add CNAME `status.realestateflow.in` in Cloudflare → BetterStack target
- Test: 5-min deliberate downtime → incident raised + resolved on status page
- Test: send test message from mobile incognito → push arrives on founder phone within 30s

**References:** `team-work/MADHU-tasks.md` MAD-010 · `week-1-foundation/day-05-helpdesk-status.md`

---

## OPS-W1-06: Day 6 — LP Deploy + Welcome Drip Activation
**Priority:** Critical

- Run LP build + Netlify deploy (see DEPLOY-03)
- Activate Brevo welcome drip workflow (see CONTENT-10): Trigger → 4 email steps
- Smoke test: register test trial → confirm T+0 email arrives in <60s (check Gmail + Outlook + Yahoo)
- Submit sitemap to GSC + Bing + Brave (see DEPLOY-08)
- Verify all 12 URLs return 200 + Lighthouse ≥90

**References:** `team-work/MADHU-tasks.md` MAD-011 · `team-work/ZEESHAN-tasks.md` ZEE-013 · `week-1-foundation/day-06-landing-pages-deploy.md`

---

## OPS-W1-07: Day 7 — Go/No-Go Sign-off
**Priority:** Critical — Gate before Day 9 beta invites

- Read PR-G security audit results + Playwright pentest output (`launch-implement/pre-launch/13-security/security-audit-report.md`) → confirm zero P0
- Verify Razorpay test invoice CA-approved + bank settlement confirmed
- Test Crisp from mobile → push notification arrives
- Check BetterStack: all 6 monitors green 1h continuous
- Check Sentry: zero unresolved P0/P1 issues
- Write Go/No-Go verdict in `launch-implement/week-1/day-07-go-no-go.md`
- If GO: log in `00-DECISIONS-LOG.md` "Day 7 audit GO YYYY-MM-DD"; schedule Day 9 beta invites
- If NO-GO: list blockers + fix owners + re-evaluate Day 8

**References:** `team-work/FOUNDER-tasks.md` FND-013 · `week-1-foundation/day-07-final-audit.md`

---

## OPS-W1-08: Day 7 — Security Re-scan
**Priority:** Critical (runs same day as Go/No-Go)

- Re-run static route analysis diff vs T-1 baseline (any new routes added in Days 1-6)
- Run: `npx playwright test tests/cross-tenant-pentest.spec.ts` → 100% pass
- Run: all Playwright suites (analytics, paywall, seat-cap, grievance, cookie-consent)
- Document results in `day-07-go-no-go.md` security section

**References:** `team-work/ZEESHAN-tasks.md` ZEE-014 · `pre-launch-prep/P13-multitenancy-security-audit.md` §"Day 7 re-scan"
