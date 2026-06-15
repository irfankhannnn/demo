# Phase 4 — Pending Tasks Cleanup

Reviewed every file under `marketing-and-sales/launch-plan-v2/pending-tasks/`. Each task is classified as **already completed**, **partially completed**, **obsolete**, or **must implement before launch**, with the four required fields and a launch priority.

`P0` = must ship · `P1` = should ship · `P2` = post-launch.

> **Key finding:** Nearly all `pending-tasks/` items are **human/vendor-dependent operational tasks** (AWS console, vendor signups, legal sign-off, DNS, deploys). The AI-completable subset was already executed in `cursor/pending-tasks-consolidation-492f`. The only *code* items that must ship before launch are the open bugs from `coding-agent-brief/bugs/`, addressed in Phase 6.

---

## 01-infra-setup.md

| Task | Classification | Why needed | Where used | Implementation approach | Priority |
|---|---|---|---|---|---|
| INFRA-01 7 DDB tables | already completed (IaC) | Code reads these tables at runtime | grievance, billing, subscriptions, NPS | `launch-tables-cfn.yaml` ready; founder runs `aws cloudformation deploy` | P0 (deploy = human) |
| INFRA-02 Demo Cognito pool | must implement (human) | Demo tenant login | `demo.realestateflow.in` | AWS Console — create user pool, set `DEMO_*` env | P1 |
| INFRA-03 Lambda cron deploy | must implement (human) | Demo reset + trial expiry crons | `cron/reset-demo.yaml`, trial cron | EventBridge rules after PR merge | P1 |
| INFRA-04 API GW rate-limit + WAF | must implement (human) | Global throttling (app limiter is per-instance) | Public API edge | API Gateway usage plan + AWS WAF | P1 |
| INFRA-05 CloudWatch alarms | must implement (human) | Alerting | Lambda/DDB metrics | CloudWatch alarms + SNS | P1 |
| INFRA-06 Cloudflare DNS | must implement (human) | Domain + email deliverability | All domains | DNS records per `03-deliverability` docs | P0 |
| INFRA-07 Populate env vars | must implement (human) | App cannot run without keys | Lambda + Netlify | Fill from 1Password into env | P0 |

## 02-external-accounts.md (ACCT-01…15)

| Classification | Tasks | Why needed | Implementation approach | Priority |
|---|---|---|---|---|
| must implement (human/vendor) | PostHog, Razorpay, Brevo, hCaptcha, Google Workspace, Cloudflare-linked | Analytics, payments, email, captcha, inbox — all read from env by shipped code | Vendor signup → copy keys → env | P0 for PostHog/Razorpay/Brevo/hCaptcha/Workspace |
| should implement (human/vendor) | GA4, Meta Pixel, LinkedIn, Sentry, Hotjar, AiSensy, Instantly, Cal.com, Crisp, BetterStack | Marketing analytics, error tracking, outreach, support, status | Vendor signup → env / embed IDs | P1 |

All ACCT tasks are **non-code**; the consuming code (LP analytics partial, billing, grievance, Sentry) already exists and is env-gated, so it degrades gracefully when a key is absent.

## 03-legal-and-compliance.md

| Task | Classification | Why needed | Priority |
|---|---|---|---|
| LEGAL-01 founder/company details | must implement (human) | Inputs for legal docs + LP copy | P0 |
| LEGAL-02 lawyer review | must implement (human) | DPDP + Razorpay live gate | P0 |
| LEGAL-03 GST CA sign-off | must implement (human) | B2B ITC + Razorpay live | P0 |
| LEGAL-04 security audit sign-off | must implement (human) | No-go gate if P0 findings | P0 |
| LEGAL-05 consent checkbox | already completed | DPDP consent at signup | done (`RegisterAdmin.tsx` + `consentSignedAt`) |
| LEGAL-06 Glockapps inbox test | must implement (human) | Email warm-up validation | P1 |

## 04-content-and-brand.md (CONTENT-01…10)

| Classification | Tasks | Notes | Priority |
|---|---|---|---|
| already completed (AI drafts) | CONTENT-01/02/03/04/08/09/10 | Legal drafts, pricing, deliverability, positioning, GST, cookie copy, drip — generated in consolidation | review = human |
| must implement (human) | CONTENT-05 logo/favicons/OG, CONTENT-06 LinkedIn posts, CONTENT-07 SEO meta (partial) | Brand assets + founder profile; CONTENT-05 blocked on Higgsfield MCP auth | P1 |

## 05-deployment.md (DEPLOY-01…09)

| Task | Classification | Why needed | Priority |
|---|---|---|---|
| DEPLOY-01 tagged blocks | already completed | Conflict-free route injection | done (verified in `server.js`/`App.tsx`) |
| DEPLOY-02 LP `.env` values | must implement (human) | Build injects analytics IDs | P0 |
| DEPLOY-03…09 Netlify/Lambda deploys, smoke tests | must implement (human) | Ship the apps | P0 |

## 06-week1-operations.md / 07-week2 / 08-week3 / 09-week4

| Classification | Notes | Priority |
|---|---|---|
| must implement (human ops) — partly obsolete pre-launch | OPS/SOFT/PUB/CONV tasks are post-launch operational runbooks (onboarding calls, soft/public launch, conversion). **No code.** Week-3/4 items are not launch-day blockers | P2 (post-launch) |

---

## Cleanup actions taken in this PR

- Re-verified BUG-001/002/003/005 as resolved; corrected the `team-work` trackers and bug files where checkboxes were ahead of code (see Phase 6 doc updates).
- Implemented the remaining launch-critical **code** items (BUG-004 P0; BUG-006/007/008/010 P1) so the only residual launch blockers are **operational** (deploys, env values, vendor accounts, legal sign-off) — none of which a coding agent can or should perform.
- BUG-009 (invite seat enforcement) left as documented remaining work (cross-service, not safely testable here).
