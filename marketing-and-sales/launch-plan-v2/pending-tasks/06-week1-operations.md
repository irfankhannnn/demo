# 06 — Week 1 Operations (Day 1–7)

> **Scope:** Post-deploy operational runbook for the first 7 days. All items are **pending** (they happen after launch) and are human-run; no code ships here except the Day-2 friction fixes.
> **Owner files to read:** `team-work/FOUNDER-tasks.md` (`FND-010…013`), `team-work/MADHU-tasks.md` (`MAD-010/011`), `team-work/ZEESHAN-tasks.md` (`ZEE-011/014`).

---

## OPS-W1-01: Day 1 — Friction Walkthrough (Founder-as-User)
**Why:** Produces the Day-2 fix backlog; the founder experiencing the real signup→first-record flow surfaces blockers no audit catches.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-010`
- Walk the full product as a new Bandra broker: LP → signup → OTP → role → agency setup → first buyer → property → lead → AI-Employee → Khata → re-login. Do it on iPhone + a low-end Android (4G throttle).
- Log every friction point; run the Day-01 triage prompt → `day-01-backlog.md` (P0/P1/P2 + ICE). Target < 8 min signup → first record.

## OPS-W1-02: Day 2 — Ship P0 Friction Fixes
**Why:** Closes the Day-1 blockers before any real customer touches the product.
**Priority:** Critical (P0) · **Read:** `team-work/ZEESHAN-tasks.md` → `ZEE-011`
- Feed `day-01-backlog.md` P0 items to a coding agent → fix PR → founder re-tests; confirm re-walkthrough ≤ 8 min.

## OPS-W1-03: Day 3 — Razorpay Live Mode + ₹1 Test Transaction
**Why:** First revenue gate — proves the full payment → invoice → webhook → DDB → analytics chain works with real money.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-011`
- Confirm KYC APPROVED; switch to live; clone products to live; capture live plan IDs → `pricing.json…live` → redeploy Lambda.
- Register live webhook → `RAZORPAY_WEBHOOK_SECRET_LIVE`. Run ₹1 test: signup → upgrade → UPI pay → confirm invoice PDF + `subscription_started` event + DDB row. Send invoice to CA (LEGAL-03); confirm bank settlement T+1; refund the ₹1.

## OPS-W1-04: Day 4 — Analytics Conversion-Event Config
**Why:** Without marking conversions in each ad platform, paid-ad optimization + funnel accuracy are broken.
**Priority:** High (P1) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-012`
- GA4 / Meta / LinkedIn → mark `signup_completed` + `subscription_started` (and `Lead`/`Subscribe`/`Purchase`) as conversions.
- Verify consent gating: incognito → reject cookies → confirm GA4/Pixel/LinkedIn scripts do **not** load. Run `npx playwright test tests/analytics.spec.ts`.

## OPS-W1-05: Day 5 — Helpdesk + Status Page
**Why:** Gives Week-1 testers an instant support channel and a public uptime page before traffic ramps.
**Priority:** High (P1) · **Read:** `team-work/MADHU-tasks.md` → `MAD-010`
- Configure Crisp (ACCT-13) saved replies + BetterStack (ACCT-14) monitors; embed Crisp in LPs + CRM; CNAME `status.realestateflow.in`.
- Test: 5-min deliberate downtime → incident raised/resolved; mobile push arrives < 30s.

## OPS-W1-06: Day 6 — LP Deploy + Welcome-Drip Activation
**Why:** Marketing site goes live + new signups start getting nurtured — the launch-day milestone.
**Priority:** Critical (P0) · **Read:** `team-work/ZEESHAN-tasks.md` → `ZEE-013`, `team-work/MADHU-tasks.md` → `MAD-011`
- Run LP build + Netlify deploy (DEPLOY-03); activate the Brevo welcome drip (CONTENT-10).
- Smoke: register test trial → T+0 email < 60s; submit sitemap (DEPLOY-08); all 12 URLs 200 + Lighthouse ≥ 90.

## OPS-W1-07: Day 7 — Go/No-Go Sign-off
**Why:** Gate before Day-9 beta invites — consolidates security, billing, support, and monitoring evidence into one decision.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-013`
- Confirm: zero P0 in security audit (LEGAL-04); CA-approved test invoice + settlement; Crisp push works; 6 BetterStack monitors green 1h; zero unresolved Sentry P0/P1.
- Write the verdict in `day-07-go-no-go.md`; log GO/NO-GO in `00-DECISIONS-LOG.md`.

## OPS-W1-08: Day 7 — Security Re-scan
**Why:** Catches any new routes added during Days 1–6 that might have skipped tenant isolation.
**Priority:** Critical (P0) · **Read:** `team-work/ZEESHAN-tasks.md` → `ZEE-014`
- Diff static route analysis vs the T-1 baseline; run `npx playwright test tests/cross-tenant-pentest.spec.ts` + all suites (analytics, paywall, seat-cap, grievance, cookie-consent); document in the Day-7 security section.
