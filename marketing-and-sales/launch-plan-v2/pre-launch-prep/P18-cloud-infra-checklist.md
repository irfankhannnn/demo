# P18 — Cloud Infrastructure Checklist (AWS · Cloudflare · Razorpay · S3)

> **Type:** 🧍 MANUAL (with 🤝 hybrid where IaC drafts help)
> **Phase:** Pre-launch
> **Day / Block:** T-21 → T-1 (parallel ongoing)
> **Skill(s):** none direct (founder-led)
> **Estimated time:** 4-6h founder, spread over 21 days

## Objective
Set up and verify all cloud infrastructure dependencies — AWS Mumbai region, Cloudflare DNS, Razorpay live KYC, S3 launch artefact bucket, Cognito user pools, DDB tables with PITR, IAM least-privilege — so by T-1 there are zero "but I haven't created X yet" blockers.

## Why This Matters for RealEstateFlow
Most launch slips are infra slips: KYC pending, DNS not propagated, IAM denied, S3 bucket name conflict. P18 is the master tracker — every infra item gets a checkbox + an owner + a status. The founder reviews this daily during pre-launch.

## User Story
As a founder running multiple parallel pre-launch tracks, I want a single checklist of cloud infra items with owners + status, so I can see at-a-glance what's blocking launch and where to push.

## Acceptance Criteria
- [ ] AWS account confirmed in `ap-south-1` (Mumbai); IAM users created (founder + service roles)
- [ ] DynamoDB tables created with PITR enabled: CRM tables (existing) + `Grievances` (P9) + `AIEmployeeProvisioning` (P11) + `Subscriptions` (P12) + `WebhookLog` (P11) + `TenantApiKeys` (P11) + `NPSResponses` (Day-28) + `BetaInvites` (Week-2 use)
- [ ] Cognito user pools: production + demo (P5) — both with MFA optional, password policy ≥10 chars
- [ ] S3 bucket `cloudberry-real-estate-launch` created in ap-south-1, BlockPublicAccess=true, versioning enabled, lifecycle rule (move to Glacier after 90 days for archive folder)
- [ ] Lambda functions deployed for: API handler (existing), demo-reset cron (P5), trial-reminder cron (P14), escalation cron (P11), seed scripts (one-off)
- [ ] EventBridge rules created for the 3 crons
- [ ] API Gateway throttling: 1000 req/min/IP default + per-route overrides (P13 spec)
- [ ] WAF rules: cross-tenant 403 spike auto-block (P13)
- [ ] CloudWatch alarms (P13 spec): 5xx rate, Lambda errors, DDB throttles, Cognito brute-force
- [ ] Cloudflare DNS records published (P3): SPF/DKIM/DMARC/MX + A/CNAME for `realestateflow.in`, `www`, `demo`, `api`
- [ ] Cloudflare zone settings: SSL/TLS Full (strict), Always Use HTTPS, HSTS enabled, Bot Fight Mode on
- [ ] Razorpay live KYC submitted + approved (settlement bank linked)
- [ ] Razorpay GST settings configured (P7)
- [ ] Razorpay 4 Products + 9 Plans created (P7)
- [ ] Razorpay webhook URL registered + secret captured (P11)
- [ ] Sentry projects created (SPA + server)
- [ ] PostHog project created
- [ ] All env vars added to: SPA `.env`, server Lambda config, GitHub Actions secrets (if CI used)
- [ ] Founder runs `aws sts get-caller-identity` + `aws s3 ls s3://cloudberry-real-estate-launch` + `aws dynamodb describe-table --table-name Grievances` to smoke-test access

## Manual Steps (🧍)

### Track A — AWS (T-21 → T-7)
1. Login to AWS Console → confirm region picker = `ap-south-1` (Mumbai).
2. **IAM**: create founder admin user; create service roles for Lambda (least-privilege per function); enable MFA on root + founder.
3. **DynamoDB**: create the 7 new tables (Grievances, AIEmployeeProvisioning, Subscriptions, WebhookLog, TenantApiKeys, NPSResponses, BetaInvites). For each: PITR enabled, on-demand billing, encryption at rest (AWS-owned key OK for M1).
4. **Cognito**: confirm production user pool exists; create `realestateflow-demo` pool for P5.
5. **S3**: create bucket `cloudberry-real-estate-launch` (region ap-south-1, BPA=on, versioning=on). Add lifecycle: archive/* → Glacier 90d.
6. **Lambda**: deploy existing API handler. Reserve naming for cron Lambdas (P5/P11/P14).
7. **EventBridge**: create rules for the 3 crons (one per cron Lambda).
8. **API Gateway**: confirm domain mapping `api.realestateflow.in`. Apply throttling + per-route overrides.
9. **WAF**: attach to API Gateway. Add managed rule sets (Common, Bad inputs, IP reputation). Custom rule: rate-limit 100 req/5min per IP on `/api/grievance` and `/api/auth/phone-login`.
10. **CloudWatch alarms**: create per P13 spec. Subscribe SNS to founder email + WhatsApp (via SNS-to-WhatsApp bridge or Crisp webhook).

### Track B — Cloudflare (T-21)
1. Add `realestateflow.in` zone if not already. Update registrar nameservers.
2. Apply DNS records from P3 `dns-records.md`.
3. Settings: SSL/TLS = Full (strict), Always Use HTTPS = on, Min TLS = 1.2, HSTS = on (max-age=31536000, include subdomains, preload after 14 days clean).
4. Page Rules / Cache Rules: bypass cache for `/api/*`, aggressive cache for static `/assets/*`.
5. Bot Fight Mode = on.
6. Email DNS proxy = OFF (mail records must be DNS-only).

### Track C — Razorpay (T-14 → T-1)
1. Sign up at `https://dashboard.razorpay.com` if not already.
2. Submit KYC docs: PAN, GSTIN, CIN, Pvt Ltd certificate, bank account, signatory PAN+Aadhaar+selfie. Average SLA 3-7 days.
3. While KYC pending: complete Test mode setup (P7 products + plans + webhook URL).
4. KYC approved → switch live mode → repeat product/plan creation in live (Razorpay copies test → live with one click).
5. Capture live plan IDs into `pricing.json.razorpayPlanIds` (P14 dependency).
6. Settlement bank verified via test ₹1 transfer.

### Track D — Vendor signups (T-14 → T-7)
1. PostHog signup → project ID + API key
2. GA4 → measurement ID
3. Meta Business Manager Pixel → Pixel ID + Conversion API token
4. LinkedIn Insight Tag → partner ID
5. Sentry → 2 DSNs (SPA + server)
6. Brevo → API key + verified domain
7. Instantly → connected mailbox
8. AiSensy → BSP onboarding + WhatsApp number
9. Crisp → workspace + embed code
10. BetterStack → status page + uptime monitors
11. Cal.com → handle (`cal.com/{HANDLE}`) + 15-min booking type
12. ElevenLabs → voice clone of founder (optional)
13. Higgsfield (Nano-Banana-Pro) → subscription
14. hCaptcha (P9) → site key + secret

### Track E — Env vars distribution (T-3)
- Compile master `.env.example` listing every required variable
- Distribute via 1Password / Bitwarden / encrypted secrets manager
- Sync to: SPA `.env.production`, Lambda `aws lambda update-function-configuration --environment Variables=...`, GitHub Actions secrets

### Track F — Smoke tests (T-1)
1. `aws sts get-caller-identity` → returns founder ARN
2. `aws s3 ls s3://cloudberry-real-estate-launch` → no error
3. `aws dynamodb describe-table --table-name Grievances` → ACTIVE
4. `dig realestateflow.in` → resolves correctly via Cloudflare
5. `curl https://api.realestateflow.in/health` → 200
6. Razorpay test ₹1 → invoice generated + settled
7. Sentry test event → appears in dashboard
8. PostHog test event → appears in Live Events

### Track G — Documentation (T-1)
- Update `cross-cutting/vendor-urls.md` with actual logged-in URLs (not just signup URLs)
- Update `00-DECISIONS-LOG.md` with KYC approval date, settlement bank, etc.
- Save 1Password vault link in founder's personal notes

## AI Prompt (🤝 — minor IaC drafts)

```
Read `infra/dynamodb/*.tf` (or any existing IaC) and produce 7 new Terraform/CloudFormation files for: Grievances, AIEmployeeProvisioning, Subscriptions, WebhookLog, TenantApiKeys, NPSResponses, BetaInvites tables. PK + sort + GSI as documented in P9, P11, P12. PITR enabled. PAY_PER_REQUEST. Encryption at rest. Output to `infra/dynamodb/{TableName}.tf` (or .yaml).

Also produce `infra/cloudwatch-alarms.yaml` with the 5 alarm rules from P13 spec.

Also produce `infra/eventbridge-rules.yaml` with the 3 cron rules: demo-reset (cron(30 21 * * ? *)), trial-reminder (cron(30 3 * * ? *)), escalation (rate(6 hours)).

Stop. Do not deploy.
```

## Inputs
- AWS account credentials
- Domain registrar credentials
- Razorpay account
- All vendor signup pages (see `cross-cutting/vendor-urls.md`)
- P3 (DNS spec), P5 (cron), P7 (Razorpay), P11 (cron), P14 (cron)

## Outputs
- All cloud resources live in ap-south-1
- `infra/dynamodb/*.tf` (7 new files)
- `infra/cloudwatch-alarms.yaml`
- `infra/eventbridge-rules.yaml`
- `marketing-and-sales/launch-implement/pre-launch/18-infra/checklist-status.md` (founder updates daily)
- Master `.env.example` checked into repo (without actual secrets)

## Success Criterion
By T-1: every checkbox above ticked + smoke tests green + KYC live. T-1 go/no-go gate (Day 7 audit) confirms infra ready.

## Fallback / Plan B
If KYC slips past T-1: launch trial-only on Day 1 (no paid tier yet); paid tier opens whenever KYC clears. Don't delay launch over KYC. If a vendor signup blocks (e.g., AiSensy onboarding lag), defer that vendor to Week 2.

## Risks
| Risk | Mitigation |
|---|---|
| KYC delay | Track daily; have backup payment processor (Cashfree) as Plan B |
| DNS propagation lag | Plan T-21 publish; verify globally via `dnschecker.org` daily |
| S3 bucket name conflict | "cloudberry-real-estate-launch" reserved early in P18 — alt: append `-prod` or `-mumbai` |
| IAM over-permissive in haste | Use AWS managed policies as baseline; tighten per Lambda role pre-Day 7 audit |
| Cloudflare misconfig breaks email | Mail records DNS-only (proxy off); verify with `dig` |

## India / Mumbai-Specific Notes
- All AWS resources strictly in `ap-south-1` per DPDP data-residency commitment in P1
- Razorpay India-only; settlement to Indian bank
- AiSensy India-based BSP for WhatsApp
- All vendors disclosed in P1 sub-processor table

## Dependencies
- **Blocks:** P3 (DNS), P5 (demo deploy), P7 (Razorpay live), P11 (webhook + cron), P14 (cron), P9 (DDB table), P12 (DDB table), Day 1 launch
- **Depends on:** Founder availability (manual track, no AI substitute)

## Connected Skills
- `codebase-analysis` — for IaC drafts
- `revops` — Razorpay setup
- `security-audit` — P13 cross-references infra checklist
