# Deployment Steps — MVP Launch Runbook

## Prerequisites
- AWS CLI configured for `ap-south-1`
- Netlify or hosting for frontend (`real-estate-crm-app`)
- Razorpay live/test keys
- Brevo API key (fallback email)
- Access to auth microservice deploy pipeline

---

## Step 1: Backend dependencies

```bash
cd server
npm ci
# Syntax-check new files only (some legacy routes have pre-existing errors):
for f in credit*.js emailService.js teamAnalytics*.js dataQuality*.js skillInvoker.js agentAudit*.js bailey.js razorpayOrders.js agents/*.js; do
  node --check "$f" 2>/dev/null || node --check "$(echo $f | sed 's/agentAudit.*/agentAuditService.js/')"
done
```

## Step 2: Configure server `.env` / CFN parameters

Copy from `server/.env.example`. Critical new vars:

```
CREDITS_TABLE_NAME=cloudberry-real-estate-credits
CREDIT_CONFIG_TABLE_NAME=cloudberry-real-estate-credit-config
AWS_SES_FROM_EMAIL=noreply@realestateflow.in
EMAIL_PROVIDER_PRIMARY=ses
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
BAILEY_ENABLED=false
AGENTS_ENABLED=false
```

## Step 3: Deploy main CloudFormation stack

```bash
cd server/infra
# Ensure cfn-params.json includes new parameters (deploy.sh should generate them)
./deploy.sh
```

**Verify outputs:**
- Credits + CreditConfig tables created
- Lambda env has new variables
- IAM includes DynamoDB (credits), SES, EventBridge, Bedrock

## Step 4: Seed credit config

```bash
cd server
AWS_REGION=ap-south-1 node --input-type=module -e "
  import { seedDefaultConfig } from './creditConfig.js';
  await seedDefaultConfig();
  console.log('Config seeded');
"
```

## Step 5: Deploy frontend

```bash
cd real-estate-crm-app
npm ci
npm run build
# Deploy to Netlify per netlify.toml / existing pipeline
```

Env vars:
```
VITE_API_URL=https://api.realestateflow.in/api
VITE_AUTH_API_URL=https://auth.realestateflow.in
VITE_RAZORPAY_KEY_ID=rzp_live_xxx
```

## Step 6: SES setup (manual)

Follow `../notes/ses-aws-setup.md`:
1. Verify domain `realestateflow.in` in SES
2. Enable DKIM
3. Request production access
4. Until approved, Brevo fallback handles all mail

## Step 7: Razorpay webhook

- URL: `https://<api-domain>/api/billing/webhook`
- Events: `payment.captured`, `subscription.*`
- Secret must match `RAZORPAY_WEBHOOK_SECRET` in Lambda env

## Step 8: Deploy cron stacks

```bash
cd server/infra
./deploy-crons.sh credit-reset
# Repeat for each cron after adding S3 Code reference to templates
```

**Important:** Cron CFN templates need `Code.S3Bucket` + `Code.S3Key` pointing to the same `function.zip` as the API Lambda. Mirror `cron/trial-reminder.yaml` pattern if it includes code reference — current new cron YAMLs are rule-only stubs.

## Step 9: Auth microservice

Deploy `reality-flow-authentication` with updated `UserItem` WhatsApp fields.

## Step 10: Smoke test production

1. Register new admin → trial banner shows
2. Create lead → credits deduct
3. `/crm/settings/billing` → balance visible
4. Admin → `/admin/team-analytics` → table loads
5. Trigger 402 (exhaust credits) → Buy Credits modal

## Rollback

- Set `EMAIL_PROVIDER_PRIMARY=brevo` if SES fails
- Set `BAILEY_ENABLED=false`, `AGENTS_ENABLED=false` to disable optional features
- Credit tables have `DeletionPolicy: Retain` — safe to redeploy stack
