# Risks & Mitigations Register

Top risks across the launch + pre-defined mitigations + escalation owner. Reviewed weekly.

---

## P0 — Launch-blockers

| ID | Risk | Probability | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|---|---|
| R1 | Razorpay live KYC delayed past T-1 | Medium | High | Track daily; backup processor (Cashfree) ready; trial-only soft launch on Day 1 if KYC pending | Founder | KYC not approved by T-3 |
| R2 | DNS misconfig blocks email send | Medium | High | DNS verified at T-21 + T-7 via MXToolbox/dig; Glockapps test T-7 | Founder | Glockapps <70% inbox |
| R3 | Cross-tenant data leak | Low | Critical (legal + reputation) | P13 audit at T-1 + Day 7 re-scan + Playwright pen-test in CI | Cascade + Founder | Any P0 finding |
| R4 | Demo tenant data leaks to prod | Low | High | Strict tenantId filter + separate Cognito pool | Cascade | Banner missing or tenantId mismatch |
| R5 | Cookie consent missing → DPDP non-compliance | Medium | Medium | P17 banner + audit before Day 1 | Founder | Banner not blocking trackers |
| R6 | Lawyer review slips | Medium | Medium | Termly fallback (P1 plan B) | Founder | No sign-off by T-3 |
| R7 | Founder mailbox lands in spam | Medium | High | 21-day warm-up + Glockapps test + DKIM/SPF/DMARC verified | Founder | Glockapps <85% by T-7 |

## P1 — Conversion-impacting

| ID | Risk | Probability | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|---|---|
| R8 | LP Lighthouse <90 on mobile | Medium | Medium | Tailwind CDN → built CSS (P15); image preload; CDN | Cascade | Lighthouse run <90 |
| R9 | Cold reply rate <3% Day 17-19 | Medium | High | A/B subject lines; founder-personal vs templated; pause ifc reply <3% Day 18 → reset Day 22 | Founder | Day 17 metrics |
| R10 | Trial-to-paid conversion <10% | Medium | High | P14 trial countdown + paywall + 3 reminder emails + Day-26 follow-up | Founder | Day 25 metrics |
| R11 | Beta testers don't activate | Medium | High | Day 11-12 critical-fix loop; 1:1 onboarding calls; ICE backlog | Founder | <5/8 testers active by Day 11 |
| R12 | Demo loads >5s on 4G | Low | Medium | LCP preload + image compression + S3 acceleration | Cascade | Lighthouse mobile perf <80 |
| R13 | Trial users don't see paywall (TZ bug) | Low | High | Server-side compute UTC; SPA reads server | Cascade | Paywall not appearing for active trials |

## P2 — Operational

| ID | Risk | Probability | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|---|---|
| R14 | OpenClaw concierge 24h SLA missed | Medium | Medium | Auto-escalation + ₹500 credit + founder direct WA | Support | 1 row exceeds SLA |
| R15 | Founder burnout | Medium | High | 6-day week, Sunday off; mood ≤4 for 3d → defer non-blocking work | Founder | Daily standup mood signal |
| R16 | Vendor outage (Brevo / AiSensy / Razorpay) | Low | Medium | BetterStack uptime monitors; SES fallback for Brevo; manual invoicing fallback for Razorpay | Founder | Vendor status page red |
| R17 | Legal threat (defamation in /vs/* pages) | Low | High | Battle cards cite public sources only; founder review before publish | Founder | Legal notice received |
| R18 | Cap of 3 AI Employee/week breached | Low | Medium | aiEmployeeAvailable flag (P11) | Support | 3rd signup in 7d |
| R19 | DPDP regulator complaint | Low | High | Grievance flow live (P9); 7-day SLA documented; sub-processors disclosed (P1) | Founder + GO | Complaint received |
| R20 | Founder LinkedIn post low engagement | Medium | Low | Cross-share to broker WhatsApp groups + Indian SaaS Slack; comment-engage 2h post-publish | Founder | <10 reactions in 24h |

## P3 — Strategy

| ID | Risk | Probability | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|---|---|
| R21 | PMF gate missed by Day 30 | Medium | Critical | Iterate beta cycle 14 more days; hold paid spend; talk-to-customer calls | Founder | Day 30 review |
| R22 | Mumbai market saturation faster than expected | Low | Medium | Pune ramp at Day 60 instead of Day 90 | Founder | Day 30 reply rate >25% |
| R23 | Competitor (Sell.do) launches AI Employee feature | Low | Medium | Anti-positioning sharpens (Mumbai-built + price + 24h SLA); founder content speed advantage | Founder | Public competitor launch |
| R24 | Hiring decision rushed | Low | Medium | No hire until MRR ≥₹2L (decision logged) | Founder | MRR threshold |

---

## Weekly review process

Every Monday in standup:
1. Read this register top-to-bottom
2. Update Probability column based on last 7d signals
3. For any P0 with raised Probability, file a focused mitigation task in current week
4. Append new risks discovered

---

## Escalation routing

- **Cascade-detected P0**: alert founder via Slack/WhatsApp + create issue + halt downstream tasks
- **Founder-detected P0**: log in `00-DECISIONS-LOG.md` + adjust this register + reroute current week's plan
- **Vendor outage (R16)**: BetterStack alerts → founder → execute fallback per task file
- **Legal/regulator (R17, R19)**: pause LP changes; engage Vakilsearch/lawyer; respond within SLA

---

## Owner legend

- **Founder** = solo founder
- **Cascade** = AI agent (default Cascade in IDE)
- **Support** = OpenClaw concierge support team (founder + 1 contractor M2+)
- **GO** = Grievance Officer (founder by default)

---

## Append-only changes

When a new risk is added or a probability is bumped:

| Date | Risk ID | Change | By |
|---|---|---|---|
| YYYY-MM-DD | RNN | Added / probability low→medium / mitigation updated | name |
