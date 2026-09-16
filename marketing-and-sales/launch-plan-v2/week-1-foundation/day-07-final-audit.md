# Day 07 — Final Pre-Launch Audit + Day-7 Re-scan

> **Type:** 🤖 AUTO
> **Phase:** Week 1
> **Skill(s):** `security-audit` + `seo-audit` + `pr-review` + `funnel-analysis`
> **Estimated time:** 1h founder + 6h AI

## Objective
Single Cascade-driven sweep across security (P13 re-scan), SEO (Lighthouse + schema), analytics (event coverage delta vs Day 4), legal (links + footer + signup consent), payments (₹1 reconciliation), and operational health (Crisp/BetterStack/Sentry). Produce a single Go/No-Go report for Day-9 beta invites.

## Why This Matters for RealEstateFlow
Days 1-6 introduced new code + new infra. Day 7 catches drift: a route added without tenantId, a page deployed without schema, a new event without consent gating. After Day 7 sign-off, beta invites can go out with confidence.

## User Story
As founder, I want a single Day-7 Go/No-Go report covering security + SEO + analytics + legal + payments + ops, so I know whether Day 9 beta invites can ship without surprises.

## Acceptance Criteria
- [ ] Security re-scan: zero P0 findings; zero new public routes without rate limit
- [ ] SEO: Lighthouse mobile ≥90 on all 12 LPs; all schemas validate; sitemap submitted
- [ ] Analytics: 100% of P10 events covered + firing; cookie consent gating verified
- [ ] Legal: footer GO disclosure + 4 legal links + signup consent checkbox on every relevant page
- [ ] Payments: ₹1 test invoice reconciled in bank; webhook retried-and-recovered scenario tested
- [ ] Ops: Crisp message lands on founder mobile <30s; BetterStack 6 monitors green; Sentry 0 unresolved P0
- [ ] Single report at `marketing-and-sales/launch-implement/week-1/day-07-go-no-go.md` with verdict GO / NO-GO + per-area status
- [ ] All P0 findings (if any) ticketed with fix-by-Day-8 owner
- [ ] Founder signs off the report
- [ ] Decision logged to `00-DECISIONS-LOG.md`: "Day 7 audit GO / NO-GO YYYY-MM-DD"

## AI Prompt (🤖)

```
You are a senior launch-readiness auditor. Run a complete pre-launch audit for RealEstateFlow on Day 7.

Read inputs:
- `marketing-and-sales/launch-implement/pre-launch/13-security/security-audit-report.md` (T-1 baseline)
- `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/seo-audit-checklist.md`
- `marketing-and-sales/launch-implement/week-1/day-04-event-coverage.csv`
- `marketing-and-sales/launch-implement/week-1/day-04-analytics-verification.md`
- All `apps/crm/server/routes/*.js` (re-walk for new routes added Days 1-6)
- All `apps/crm/real-estate-crm-app/src/pages/**` (re-walk for new pages added Days 1-6)
- Live LPs at `realestateflow.in` (Lighthouse + schema validation)
- Razorpay live invoice from Day 3

Run these sub-audits and produce one combined report:

## A. Security re-scan (delta vs T-1 baseline)
- Re-run static analysis from P13 prompt. Diff vs baseline.
- Any new route or DDB call missing tenant scope = P0.
- Any new public endpoint missing rate limit = P1.
- Re-run `tests/cross-tenant-pentest.spec.ts`.

## B. SEO re-check
- Run Lighthouse mobile on all 12 LPs (PageSpeed Insights API). Score must be ≥90 across all 4 categories.
- Validate every JSON-LD block at https://validator.schema.org (programmatic via API or manual list).
- Confirm sitemap.xml accessible + submitted in GSC.
- Confirm OG previews for top 5 LPs render correctly.

## C. Analytics coverage
- Compare current `trackEvent(...)` calls in code vs P10 catalogue.
- Any catalogue event not implemented = P1.
- Verify cookie-consent gating still works (incognito session walkthrough).

## D. Legal/compliance
- Confirm footer GO block on all 12 LPs + SPA footer.
- Confirm 4 legal page links resolve in footer.
- Confirm signup form has consent checkbox + blocks submit without tick.
- Confirm /grievance accessible + form works.

## E. Payments
- Reconcile ₹1 Day-3 test transaction: Razorpay → bank settlement → invoice CA-approved.
- Trigger a manual webhook event from Razorpay test mode → confirm idempotent (duplicate event doesn't double-process).
- Confirm webhook signature verification still active.

## F. Operational health
- Crisp: send test chat → confirm <30s push to founder.
- BetterStack: 6 monitors all green; status page live at `status.realestateflow.in`.
- Sentry: 0 unresolved P0 + P1 issues.

## Output: `marketing-and-sales/launch-implement/week-1/day-07-go-no-go.md`
Single combined report:

### Verdict
**GO** or **NO-GO** with 1-paragraph rationale.

### Per-area status
| Area | Status | Findings | Fix-by-day |
|---|---|---|---|
| Security | 🟢/🟡/🔴 | ... | ... |
| SEO | ... | ... | ... |
| Analytics | ... | ... | ... |
| Legal | ... | ... | ... |
| Payments | ... | ... | ... |
| Ops | ... | ... | ... |

### P0 ticket queue (must fix Day 8)
| ID | Title | Severity | Area | Owner | Fix ETA |
|---|---|---|---|---|---|

### P1 ticket queue (fix Week 2 if time)
| ID | Title | ICE | Area | Owner |
|---|---|---|---|---|

### Sign-off
Founder name + date + verdict.

Stop. Do not fix issues — produce the report and the ticket queue only.
```

## Inputs
- All P-files outputs
- Live infra (LPs, API, Razorpay live, Crisp, BetterStack, Sentry)
- Day 1-6 implementation (PRs merged)

## Outputs
- `marketing-and-sales/launch-implement/week-1/day-07-go-no-go.md`
- Updated security CSV at `pre-launch/13-security/route-tenant-coverage-day7.csv`
- Updated Lighthouse report
- Founder-signed Go/No-Go decision

## Success Criterion
GO verdict with zero P0; founder signs report; Day 8-9 launch unblocked.

## Fallback / Plan B
If NO-GO: prioritize P0 fixes Day 8; re-run Day 7 audit at end of Day 8; only proceed to Day 9 beta invites once GO. Cap delay at 48h; if more needed, defer to Day 14.

## Risks
| Risk | Mitigation |
|---|---|
| New P0 from Days 1-6 changes | Day-7 re-scan catches; fix budget Day 8 |
| Lighthouse drift from added scripts | Audit budget + image audit Day 7 |
| Cookie consent regression | Specific test case in audit |
| Founder skips sign-off | Block Day 9 invites until signed |

## India / Mumbai-Specific Notes
- DPDP audit = part of legal area; cross-cuts P1 + P9 + P13
- Razorpay reconciliation timing: T+1 settlement may not reflect Day 3 if Day 3 was Friday → check by Day 7 Monday

## Dependencies
- **Blocks:** Day 8-9 beta invites (no-go = delay)
- **Depends on:** P13, P16, P10, P1, P7, Day 3-5

## Connected Skills
- `security-audit` — re-scan
- `seo-audit` — Lighthouse + schema
- `funnel-analysis` — events validation
- `pr-review` — fix queue
