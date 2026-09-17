# Config Update Guide — What, Where, and How
## Short & Complete Reference for All Configuration Changes Needed

**Scope:** Only config changes required for MVP launch. Code changes are covered in `06-PHASED-FIX-PLAN.md`.

---

## 1. Local Environment Config (`agency-app/api/.env`)

✅ **Already done.** These are now in `agency-app/api/.env`:

```bash
# Credits (E2)
CREDITS_TABLE_NAME=cloudberry-real-estate-credits
CREDIT_CONFIG_TABLE_NAME=cloudberry-real-estate-credit-config

# Email SES (E3)
AWS_SES_FROM_EMAIL=no-reply@realestateflow.in
EMAIL_PROVIDER_PRIMARY=ses

# Bailey WhatsApp (E1, optional — keep false for launch)
BAILEY_ENABLED=false
BAILEY_API_KEY=
BAILEY_WEBHOOK_SECRET=

# Agents (E6 — keep disabled for launch)
AGENTS_ENABLED=false
```

**Where:** `agency-app/api/.env` (copied from `agency-app/api/.env.example`)  
**How:** Plain text key=value. No quoting needed unless value has spaces.  
**Impact:** `deploy.sh` reads these and passes them to CloudFormation.

---

## 2. CloudFormation Main Stack (`agency-app/api/infra/cfn-backend.yaml`)

### Parameters Already Added (Verify They Exist)
These parameters should already be in the `Parameters` section:

```yaml
CreditsTableName:
  Type: String
  Default: 'cloudberry-real-estate-credits'
CreditConfigTableName:
  Type: String
  Default: 'cloudberry-real-estate-credit-config'
SesFromEmail:
  Type: String
  Default: 'noreply@realestateflow.in'
EmailProviderPrimary:
  Type: String
  Default: 'ses'
BaileyEnabled:
  Type: String
  Default: 'false'
BaileyApiKey:
  Type: String
  Default: ''
  NoEcho: true
BaileyWebhookSecret:
  Type: String
  Default: ''
  NoEcho: true
AgentsEnabled:
  Type: String
  Default: 'false'
```

### Lambda Environment Variables Already Added (Verify)
These should be in `ApiLambdaFunction.Environment.Variables`:

```yaml
CREDITS_TABLE_NAME: !Ref CreditsTableName
CREDIT_CONFIG_TABLE_NAME: !Ref CreditConfigTableName
AWS_SES_FROM_EMAIL: !Ref SesFromEmail
EMAIL_PROVIDER_PRIMARY: !Ref EmailProviderPrimary
BAILEY_ENABLED: !Ref BaileyEnabled
BAILEY_API_KEY: !Ref BaileyApiKey
BAILEY_WEBHOOK_SECRET: !Ref BaileyWebhookSecret
AGENTS_ENABLED: !Ref AgentsEnabled
```

### IAM Already Added (Verify)
These should be in `ApiLambdaExecutionRole`:
- DynamoDB access to `CreditsTable` and `CreditConfigTable` ARNs
- `ses:SendEmail`, `ses:SendRawEmail`
- `events:PutEvents`
- `bedrock:InvokeModel` (if agents enabled)

**Where:** `agency-app/api/infra/cfn-backend.yaml`  
**How:** YAML edits. Use `aws cloudformation validate-template` after changes.

---

## 3. Deployment Script (`agency-app/api/infra/deploy.sh`)

✅ **Already done.** The 8 parameters are now added to `deploy.sh` in both:
- The `cfn-params.json` heredoc (lines ~198-205)
- The `PARAM_OVERRIDES` array (lines ~247-254)

**Current state:** `deploy.sh` has been restructured with deployment toggles (`DEPLOY_LAMBDA`, `DEPLOY_INSTALL`, `DEPLOY_ZIP`, `DEPLOY_CFN`).

**Important:** `deploy.sh` now defaults to `DEPLOY_CFN=false`. This means it will update the Lambda function directly but **not** run CloudFormation. To pass the 8 parameters to CloudFormation, you must set `DEPLOY_CFN=true` for the first deployment.

```bash
# Set these before running
DEPLOY_LAMBDA=true
DEPLOY_CFN=true
./deploy.sh
```

**Where:** `agency-app/api/infra/deploy.sh`  
**How:** Bash heredoc + array edits.  
**Impact:** Without these, CloudFormation uses defaults and secrets are empty.

---

## 4. Cron Jobs Configuration

**Note:** All 10 cron jobs are now merged into the main `cfn-backend.yaml` template. No separate cron/*.yaml files are needed anymore. The cron configuration includes:

- Credit reset cron
- Trial reminder cron
- Escalate OpenClaw cron
- Incomplete data cron
- Expiring agreements cron
- Team summary cron
- Lead qualifier cron
- Lead followup cron
- Lead router cron
- WhatsApp processor cron

All cron resources (Lambda functions, IAM roles, EventBridge rules) are defined within the main CloudFormation stack.

**Where:** `agency-app/api/infra/cfn-backend.yaml`  
**How:** Verify cron resources are in the main template. Validate with `aws cloudformation validate-template`.

---

## 5. AWS Console Manual Config

### SES (Simple Email Service)
1. Go to AWS Console → SES → Domains
2. Add domain `realestateflow.in` (or your domain)
3. Add DNS TXT records in your DNS provider (Route 53 / Cloudflare)
4. Wait 24-48 hours for verification
5. Request production access:
   - SES → Account Dashboard → Request production access
   - Select "Transactional" use case
   - Provide website URL and sample email
   - Usually approved within 24 hours

### Razorpay
1. Go to Razorpay Dashboard → Settings → API Keys
2. Generate webhook secret
3. Go to Settings → Webhooks
4. Add webhook URL: `https://api.realestateflow.in/api/billing/webhook`
5. Select events: `payment.captured`, `subscription.activated`, `subscription.charged`
6. Save secret in `agency-app/api/.env` as `RAZORPAY_WEBHOOK_SECRET`

### Bailey (Optional — Keep Disabled for Launch)
Only if `BAILEY_ENABLED=true`:
1. Sign up at Bailey.ai
2. Get API key and webhook secret
3. Configure webhook URL: `https://api.realestateflow.in/api/webhooks/whatsapp`
4. Add DNS records for WhatsApp Business API if using Meta directly

**Where:** AWS Console, Razorpay Dashboard, Bailey Dashboard  
**How:** Web UI configuration.  
**Impact:** These are external vendor configs; cannot be automated via CFN.

---

## 6. Frontend Config (`agency-app/web/.env`)

```bash
VITE_API_URL=https://api.realestateflow.in
VITE_AUTH_API_URL=https://auth.realestateflow.in
VITE_BAILEY_ENABLED=false
VITE_RAZORPAY_KEY_ID=your_key_id
```

**Where:** `agency-app/web/.env` (production build)  
**How:** Plain text key=value.  
**Impact:** Frontend needs these to call the right backend.

---

## 7. Config Verification Checklist

Before deploying:
- [x] `agency-app/api/.env` has all 8 new parameters
- [x] `deploy.sh` passes all 8 parameters to CFN
- [x] `cfn-backend.yaml` defines all 8 parameters and Lambda env vars
- [x] All 10 cron jobs are merged into cfn-backend.yaml
- [x] SES env vars and IAM permissions configured for crons in main template
- [ ] SES domain verification started (24-48 hours)
- [ ] Razorpay webhook configured
- [x] `AGENTS_ENABLED=false` and `BAILEY_ENABLED=false` in `.env`

---

## 8. Quick Config Map

| Config | File/Source | What to Update | Done? |
|--------|-------------|----------------|-------|
| Credit tables | `agency-app/api/.env` | `CREDITS_TABLE_NAME`, `CREDIT_CONFIG_TABLE_NAME` | [x] |
| Email SES | `agency-app/api/.env` | `AWS_SES_FROM_EMAIL`, `EMAIL_PROVIDER_PRIMARY` | [x] |
| Bailey | `agency-app/api/.env` | `BAILEY_ENABLED=false`, keys blank | [x] |
| Cron jobs | `agency-app/api/infra/cfn-backend.yaml` | All 10 cron jobs merged into main template | [x] |
| Agents | `agency-app/api/.env` | `AGENTS_ENABLED=false` | [x] |
| CFN params | `agency-app/api/infra/deploy.sh` | Add 8 parameters to both sections | [x] |
| Cron SES | `cron/trial-reminder.yaml`, `cron/escalate-openclaw.yaml` | Add env + IAM | [ ] |
| Lead qualifier | `cron/lead-qualifier.yaml` | Add Code/Role/Env | [ ] |
| Missing crons | `cron/` | Create 3 templates | [ ] |
| SES verify | AWS Console | Domain verification + production access | [ ] |
| Razorpay | Razorpay Dashboard | Webhook URL + secret | [ ] |
| Frontend | `agency-app/web/.env` | API URLs, Razorpay key | [ ] |

---

**Generated:** 2026-06-20  
**Scope:** Configuration only  
**Audience:** Technical founder
