# 01 — Infrastructure Setup

> **Scope:** AWS + Cloudflare provisioning the founder must run by hand. Code/IaC for these is already merged (PR #24); what remains is clicking "deploy" and pasting real values.
> **Owner file to read:** `team-work/FOUNDER-tasks.md` (every task here maps to an `FND-0xx` item).
>
> **Already done — no action needed (removed from this list):**
> - CloudFormation template for the 7 launch tables — `server/infra/launch-tables-cfn.yaml` (only the `deploy` run below is left).
> - Sentry/PostHog server wiring, analytics events, cookie banner — shipped + env-guarded (no-op until keys are set).

---

## INFRA-01: Deploy the 7 DynamoDB Tables
**Why:** The shipped backend (`grievance`, `subscriptions`, `billing webhook`, NPS) reads/writes these 7 tables at runtime — without them every launch route 500s. IaC is written; only the deploy is pending.
**Priority:** Critical (P0)
**Read:** `team-work/FOUNDER-tasks.md` → `FND-002`

**Steps**
1. Confirm AWS CLI points at the prod account + `ap-south-1` (`aws sts get-caller-identity`).
2. Run the deploy from repo root.
3. Verify all 7 tables go `ACTIVE` and PITR is on.

**Example**
```bash
aws cloudformation deploy \
  --template-file server/infra/launch-tables-cfn.yaml \
  --stack-name realestateflow-launch-tables \
  --region ap-south-1
# verify
aws dynamodb describe-table --table-name Grievances --query 'Table.TableStatus'
```
Tables created: `Grievances`, `AIEmployeeProvisioning`, `WebhookLog`, `TenantApiKeys`, `Subscriptions`, `NPSResponses`, `BetaInvites`.

---

## INFRA-02: Create the Demo Cognito User Pool
**Why:** `demo.realestateflow.in` (the public sales demo) logs in against a separate Cognito pool so demo data is isolated from real tenants. The demo SPA build won't authenticate without these IDs.
**Priority:** High (P1)
**Read:** `team-work/FOUNDER-tasks.md` → `FND-007`

**Steps**
1. AWS Console → Cognito → create user pool `realestateflow-demo` in `ap-south-1` (SRP auth, MFA optional, password ≥10 chars).
2. Create user `demo@realestateflow.in` with a permanent password.
3. Capture `DEMO_USER_POOL_ID`, `DEMO_CLIENT_ID`; set `DEMO_TENANT_ID` to a fixed string (e.g. `DEMO_REALESTATEFLOW`).
4. Add all three to Lambda env (never commit). Seed once: `node server/scripts/seed-demo-tenant.js --reset`.

**Example** — demo SPA build flag: `VITE_IS_DEMO=true` + the three `DEMO_*` IDs above.

---

## INFRA-03: Deploy the 3 Lambda Cron Functions
**Why:** Three scheduled jobs keep the product honest — nightly demo reset, OpenClaw escalation sweep, and trial-expiry reminders. The handler code + YAML are merged; the EventBridge schedules must be created.
**Priority:** High (P1)
**Read:** `team-work/FOUNDER-tasks.md` → `FND-002`

**Steps**
1. AWS Console → Lambda → create a function per YAML (or `sam deploy`).
2. Attach the EventBridge schedule from each YAML.
3. Manually invoke each once; confirm zero errors in CloudWatch.

**Example** — schedules:
| Cron | Schedule | IST |
|---|---|---|
| `cron/reset-demo.yaml` | `cron(30 21 * * ? *)` | 2:00 AM |
| `cron/escalate-openclaw.yaml` | `rate(6 hours)` | — |
| `cron/trial-reminder.yaml` | `cron(30 3 * * ? *)` | 9:00 AM |

---

## INFRA-04: API Gateway Rate-Limiting + WAF
**Why:** The in-app limiter is per-Lambda-instance, so it can't stop a distributed flood. Edge throttling + WAF protect the abuse-prone public routes (grievance, phone-login, billing webhook).
**Priority:** High (P1)
**Read:** `team-work/FOUNDER-tasks.md` → `FND-002`

**Steps**
1. API Gateway → add per-route throttling: 100 req / 5 min on `/api/grievance`, `/api/auth/phone-login`, `/api/billing/webhook`.
2. Create + attach a WAF WebACL: enable `CommonRuleSet` + `KnownBadInputsRuleSet` + `AmazonIpReputationList`.
3. Add a custom rate rule: >100 req/5 min per IP on grievance + phone-login → `BLOCK`.

---

## INFRA-05: CloudWatch Alarms + SNS
**Why:** Sentry catches app exceptions, but infra-level failures (DDB throttling, 5xx spikes, brute-force sign-ins) need CloudWatch alarms so the founder is paged before customers notice.
**Priority:** High (P1)
**Read:** `team-work/FOUNDER-tasks.md` → `FND-002`

**Steps** — create 5 alarms, each → SNS email/WhatsApp:
- Lambda 5xx rate > 1% / min
- Lambda error count > 5 / 5 min
- DDB `ThrottledRequests` > 0 for 3 periods
- Cognito sign-in failures > 10 / 5 min (same IP)
- API Gateway 4xx rate > 5% / min

---

## INFRA-06: Cloudflare DNS + Zone Security
**Why:** Nothing resolves and no email is deliverable until DNS is live. This is the gate for both the websites (Netlify) and the API (API Gateway), plus SPF/DKIM/DMARC for inbox placement.
**Priority:** Critical (P0)
**Read:** `team-work/FOUNDER-tasks.md` → `FND-003`

**Steps**
1. Add the `realestateflow.in` zone; point the registrar's nameservers at Cloudflare.
2. Add records: SPF (single merged TXT), DKIM (Google Workspace + Brevo + Instantly), DMARC, MX (Google Workspace).
3. A/CNAME: `realestateflow.in` → Netlify LP · `app` → Netlify CRM · `api` → API Gateway · `demo` → Netlify demo · `status` → BetterStack.
4. Zone settings: SSL/TLS **Full (strict)**, Always-HTTPS, Bot Fight Mode ON. Email records = DNS-only (grey cloud).

---

## INFRA-07: Populate All Production Env Vars
**Why:** Every integration (analytics, payments, email, captcha, WhatsApp, error-tracking) reads its key from env. The code degrades gracefully when a key is missing, so the app "works" but silently does nothing until these are filled.
**Priority:** Critical (P0)
**Read:** `team-work/FOUNDER-tasks.md` → `FND-005`, `FND-006`

**Steps** — after the vendor accounts exist (see `02-external-accounts.md`), fill three places (consolidated template: `launch-audit/06-env-and-vendor-setup.md`):
- `creative/landing-pages/.env` → `GA4_ID`, `META_PIXEL_ID`, `LINKEDIN_PARTNER_ID`, `HOTJAR_ID`, `POSTHOG_KEY`
- `real-estate-crm-app/.env` → `VITE_POSTHOG_KEY`, `VITE_SENTRY_DSN`, `VITE_RAZORPAY_KEY_ID`, `VITE_HCAPTCHA_SITE_KEY`, `VITE_IS_DEMO=false`
- Lambda env → `POSTHOG_KEY_SERVER`, `SENTRY_DSN_SERVER`, `RAZORPAY_WEBHOOK_SECRET`, `BREVO_API_KEY` (+ template IDs), `HCAPTCHA_SECRET_KEY`, `AISENSY_API_KEY`, `AISENSY_BROADCAST_LIST_ID`

Store raw values in 1Password/Bitwarden — never commit to git.
