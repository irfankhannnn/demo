# Deployment Steps — MVP Launch Runbook

## Complete Deployment Checklist

### Phase 1: Pre-deployment validation

```bash
# 1. Install backend dependencies
cd server
npm ci

# 2. Syntax check (skip legacy routes with pre-existing errors)
npm run build
# Note: Some legacy routes have pre-existing syntax issues; the build script handles these gracefully
```

### Phase 2: Configuration & Environment Setup

#### 2.1 Backend environment variables

Create `apps/crm/server/.env` with these critical additions:

```bash
# Database tables (new)
CREDITS_TABLE_NAME=cloudberry-real-estate-credits
CREDIT_CONFIG_TABLE_NAME=cloudberry-real-estate-credit-config
CRM_TABLE_NAME=cloudberry-real-estate-crm
SUBSCRIPTIONS_TABLE=Subscriptions

# Email (E3)
AWS_SES_FROM_EMAIL=noreply@realestateflow.in
EMAIL_PROVIDER_PRIMARY=ses
BREVO_API_KEY=<optional, fallback>

# Payment (E2)
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=<webhook secret>

# Features (MVP: both disabled)
BAILEY_ENABLED=false
AGENTS_ENABLED=false
CLOUDWATCH_METRICS_ENABLED=true

# Bailey (when enabling E1 WhatsApp)
BAILEY_MODE=hosted                  # or selfhosted
BAILEY_API_KEY=<credentials>        # required for hosted mode
BAILEY_WEBHOOK_SECRET=<webhook secret>
BAILEY_API_ENDPOINT=https://api.bailey.ai  # or your self-hosted Baileys service URL

# Internal API (service-to-service auth for crons)
INTERNAL_API_KEY=<strong-random-key>
AUTH_SERVICE_URL=https://auth.realestateflow.in
```

#### 2.2 Update CFN parameters file

Edit `apps/crm/server/infra/cfn-params.json`:

```json
{
  "ParameterKey": "CreditsTableName",
  "ParameterValue": "cloudberry-real-estate-credits"
},
{
  "ParameterKey": "CreditConfigTableName",
  "ParameterValue": "cloudberry-real-estate-credit-config"
},
{
  "ParameterKey": "SesFromEmail",
  "ParameterValue": "noreply@realestateflow.in"
},
{
  "ParameterKey": "EmailProviderPrimary",
  "ParameterValue": "ses"
},
{
  "ParameterKey": "BaileyEnabled",
  "ParameterValue": "false"
},
{
  "ParameterKey": "AgentsEnabled",
  "ParameterValue": "false"
},
{
  "ParameterKey": "CloudwatchMetricsEnabled",
  "ParameterValue": "true"
},
{
  "ParameterKey": "InternalApiKey",
  "ParameterValue": "<generated-key>"
}
```

#### 2.3 Frontend environment variables

Create `.env.production` or configure in `apps/crm/real-estate-crm-app/.env`:

```bash
VITE_API_URL=https://api.realestateflow.in/api
VITE_AUTH_API_URL=https://auth.realestateflow.in
VITE_RAZORPAY_KEY_ID=rzp_live_xxx
VITE_BAILEY_ENABLED=false  # Enable only after Bailey credentials obtained
```

### Phase 3: AWS Infrastructure Deployment

#### 3.1 Deploy main CloudFormation stack

```bash
cd apps/crm/server/infra

# Ensure cfn-params.json is updated (see Phase 2.2)
./deploy.sh

# Expected outputs:
# - CreditsTable DynamoDB table created
# - CreditConfigTable DynamoDB table created  
# - Lambda functions updated with new env vars
# - IAM roles include: DynamoDB (credits), SES SendEmail, EventBridge PutEvents, Bedrock InvokeModel
```

**Verification:**
```bash
# Verify tables exist
aws dynamodb list-tables --region ap-south-1 | grep -E "cloudberry-real-estate-credits|cloudberry-real-estate-credit-config"

# Check Lambda env vars
aws lambda get-function-configuration --function-name cloudberry-api --region ap-south-1 | jq '.Environment.Variables | keys[]' | grep -i credit
```

#### 3.2 Verify cron deployment

```bash
# Note: All 10 cron jobs are now deployed as part of the main cfn-backend.yaml stack
# No separate cron deployment needed. The ./deploy.sh command in section 3.1 deploys everything.

# Verify cron Lambda functions exist
aws lambda list-functions --region ap-south-1 | jq '.Functions[] | select(.FunctionName | contains("cron")) | .FunctionName'

# Check EventBridge rules
aws events list-rules --region ap-south-1 | jq '.Rules[] | .Name' | grep -i cron
```

#### 3.3 API Gateway redeploy

After Lambda updates (code or environment variables):

```bash
aws apigateway update-rest-api \
  --rest-api-id <api-id> \
  --patch-operations op=replace,path=/*,value=NONE \
  --region ap-south-1

# Redeploy stage
aws apigateway create-deployment \
  --rest-api-id <api-id> \
  --stage-name prod \
  --region ap-south-1
```

### Phase 4: AWS Services Configuration

#### 4.1 SES setup (EMAIL — E3)

Follow `../notes/ses-aws-setup.md`:

```bash
# 1. Verify sender domain
aws ses verify-domain-identity --domain realestateflow.in --region ap-south-1

# 2. Enable DKIM (auto-generated)
aws ses verify-domain-dkim --domain realestateflow.in --region ap-south-1

# 3. Request production access
# Console: https://console.aws.amazon.com/ses/home?region=ap-south-1#/account
# - Fill out request form (business details, use cases)
# - Verify sender email (noreply@realestateflow.in)
# - AWS reviews (typically 24h, may require callback verification)

# Until approved: EMAIL_PROVIDER_PRIMARY=brevo (fallback works)
```

**Lambda IAM role needs:**
```json
{
  "Effect": "Allow",
  "Action": ["ses:SendEmail", "ses:SendRawEmail"],
  "Resource": "arn:aws:ses:ap-south-1:ACCOUNT_ID:identity/*"
}
```

#### 4.2 CloudWatch setup (OBSERVABILITY)

```bash
# Create SNS topic for alerts
aws sns create-topic \
  --name RealEstateFlow-MVP-Alerts \
  --region ap-south-1 \
  --tags Key=Environment,Value=production Key=Purpose,Value=mvp-alerts

# Subscribe operations email
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-south-1:ACCOUNT_ID:RealEstateFlow-MVP-Alerts \
  --protocol email \
  --notification-endpoint ops@realestateflow.in
```

**Create CloudWatch dashboards:**
- Use AWS Console or CloudFormation to deploy dashboards from `observability-dashboard-spec.md`
- Business Metrics dashboard
- Infrastructure Health dashboard  
- Security & Audit dashboard

**Create log metric filters:**
```bash
aws logs put-metric-filter \
  --log-group-name /aws/lambda/credit-reset-cron \
  --filter-name CreditResetErrors \
  --filter-pattern "[time, request_id, level = ERROR*, ...]" \
  --metric-transformations metricName=CreditResetErrors,metricNamespace=RealEstateFlow/MVP,metricValue=1 \
  --region ap-south-1
```

#### 4.3 Razorpay webhook registration

```bash
# Register webhook at: https://dashboard.razorpay.com/app/webhooks

# Settings:
# - URL: https://api.realestateflow.in/api/billing/webhook
# - Events: payment.captured, subscription.activated, subscription.failed, subscription.halted
# - Secret: Must match RAZORPAY_WEBHOOK_SECRET in Lambda env
# - Active: Yes
```

**Handler already implemented:** `apps/crm/server/routes/billing.js`
- `payment.captured` → grant credits if `notes.credits` present
- `subscription.activated` → persist `billingAnniversaryDay` from `subscription.start_at`

### Phase 5: Data Initialization

#### 5.1 Seed credit configuration

```bash
cd server

# Run seed script (creates default credit plans + costs)
AWS_REGION=ap-south-1 node --input-type=module -e "
  import { seedDefaultConfig } from './creditConfig.js';
  await seedDefaultConfig();
  console.log('✅ Credit config seeded successfully');
"
```

**Verification:**
```bash
# Check CreditPlans table has entries
aws dynamodb scan \
  --table-name cloudberry-real-estate-credit-config \
  --select COUNT \
  --region ap-south-1
```

#### 5.2 Verify Subscriptions table schema

```bash
# Ensure these attributes exist (added at runtime by cron/webhook):
# - lastCreditResetAt (ISO timestamp)
# - billingAnniversaryDay (day of month, 1-31)
# - contactEmail (for alerts)
# - adminEmail (for alerts)

aws dynamodb describe-table \
  --table-name Subscriptions \
  --region ap-south-1 | jq '.Table.AttributeDefinitions'
```

### Phase 6: Auth Microservice Deployment

#### 6.1 Deploy reality-flow-authentication

Add WhatsApp fields to UsersTable schema:

```typescript
// In usersModel.ts, add to UserItem interface:
whatsAppPhoneNumber?: string;
whatsAppBusinessAccountId?: string;
whatsAppVerified?: boolean;
whatsAppConnectedAt?: string;
GSI_WhatsAppPK?: string;  // WHATSAPP#<normalized-phone>
```

#### 6.2 Create WhatsAppIndex GSI

```bash
# In auth service CFN template, add GSI:
aws dynamodb update-table \
  --table-name UsersTable \
  --attribute-definitions \
    AttributeName=GSI_WhatsAppPK,AttributeType=S \
  --global-secondary-indexes \
    "IndexName=WhatsAppIndex,Keys=[{AttributeName=GSI_WhatsAppPK,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=10,WriteCapacityUnits=5}" \
  --region ap-south-1
```

#### 6.3 Deploy internal API endpoints

Verify these endpoints are live:

```bash
# Endpoint 1: Get user by WhatsApp phone (for Bailey webhook tenant resolution)
curl -H "x-internal-api-key: $INTERNAL_API_KEY" \
  "https://auth.realestateflow.in/internal/users/by-whatsapp?phone=%2B919876543210"

# Response: { tenantId: "...", userId: "...", role: "ADMIN" }

# Endpoint 2: List users by tenant (for per-member cron stats)
curl -H "x-internal-api-key: $INTERNAL_API_KEY" \
  "https://auth.realestateflow.in/internal/users/list?tenantId=tenant-xyz"

# Response: { users: [{ userId, displayName, email, ... }] }
```

### Phase 7: Frontend Deployment

#### 7.1 Build frontend

```bash
cd real-estate-crm-app

npm ci
npm run build
# Output: dist/

# Verify build size and assets
ls -lh dist/
```

#### 7.2 Deploy to hosting

```bash
# Via Netlify (existing pipeline):
# Push to main branch or run manual deploy from Netlify dashboard
# URL: https://realestateflow.in

# Verify .env variables set in Netlify UI:
# - VITE_API_URL
# - VITE_AUTH_API_URL
# - VITE_RAZORPAY_KEY_ID
# - VITE_BAILEY_ENABLED (false for MVP)
```

### Phase 8: Production Validation

#### 8.1 Smoke test checklist

Run through this flow as a new user:

```
1. Navigate to https://realestateflow.in/login
2. Google OAuth signup
3. Select role: "Agent"
4. RegisterAdmin form:
   - Agency name: "Test Agency"
   - Display name: "Test Admin"
   - Submit
5. Redirected to `/crm/dashboard`
   - See trial banner: "14 days remaining"
   - See credits: "1000 / 1000"
6. Navigate to `/crm/settings/billing`
   - See current plan
   - See credit balance card
   - See AgentActivityLog at bottom
7. Create lead:
   - `/crm/leads` → "+ Add Lead"
   - Fill form: Name, Phone, Type=Buyer
   - Submit → See "Lead created" toast
   - Check balance: Should be "995 / 1000" (5 credits deducted)
8. Admin tools:
   - Navigate to `/admin/team-analytics`
   - See table with team members
   - Click "Download Excel" → File downloads
9. Trigger 402 (insufficient credits):
   - Create 200 more leads (or configure lower credit cost)
   - Next lead → See 402 error + "Buy Credits" modal
   - Complete Razorpay payment flow
   - Modal closes → Balance updates
10. WhatsApp (if Bailey enabled):
    - Navigate to `/onboarding/connect-whatsapp`
    - Select Bailey provider
    - Scan QR code with phone
    - Verify WhatsAppPhoneNumber saved in auth service
```

#### 8.2 API verification

```bash
# Test team analytics endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.realestateflow.in/api/admin/team-analytics"

# Test credit balance
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.realestateflow.in/api/subscriptions/credits"

# Expected response: { creditsAvailable: 995, plan: "free", resetDate: "...", creditCosts: {...} }

# Test incomplete data cron
curl -X POST \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  "https://api.realestateflow.in/api/webhooks/events/incomplete-data-trigger"
```

#### 8.3 CloudWatch monitoring

- Open CloudWatch Dashboard (Business Metrics)
- Create a few leads, check `creditService.deductCredits.count` metric
- Send test email via SES, verify `emailService.sent_via_ses` metric
- If SES fails, verify `emailService.fallback_to_brevo` metric

### Phase 9: Optional Features Enablement

#### 9.1 Bailey WhatsApp (when credentials ready)

**Option A — Hosted Bailey.ai:**

```bash
# 1. Obtain Bailey account + WABA approval
# 2. Set in Lambda env:
BAILEY_ENABLED=true
BAILEY_MODE=hosted
BAILEY_API_KEY=<credentials>
BAILEY_WEBHOOK_SECRET=<webhook-secret>

# 3. Register webhook with Bailey
# URL: https://api.realestateflow.in/api/webhooks/whatsapp
# Events: messages.incoming

# 4. Deploy auth service changes (WhatsAppIndex GSI + internal endpoints)
```

**Option B — Self-hosted Baileys library:**

```bash
# 1. Deploy whatsapp-platform (see services/whatsapp-platform/README.md)
# 2. Set in Lambda env:
BAILEY_ENABLED=true
BAILEY_MODE=selfhosted
BAILEY_API_PREFIX=/v1
BAILEY_WEBHOOK_SECRET=<same secret as BAILEYS_WEBHOOK_SECRET on platform>
BAILEY_API_KEY=<same secret as BAILEYS_API_KEY on platform>
BAILEY_ADMIN_API_KEY=<same secret as BAILEYS_ADMIN_API_KEY on platform>
BAILEY_API_ENDPOINT=http://whatsapp.realtyflow.com:3003

# 3. Point whatsapp-platform CRM_WEBHOOK_URL to (local dev only; ECS uses EventBridge):
# https://api.realestateflow.in/api/webhooks/whatsapp

# 4. Deploy auth service changes (WhatsAppIndex GSI + internal endpoints)

# 5. Test webhook
# Send WhatsApp message → Should arrive at /api/webhooks/whatsapp
# Check logs for successful tenant lookup + EventBridge publish
```

#### 9.2 Agents (when Bedrock access confirmed)

```bash
# 1. Confirm Bedrock model access in ap-south-1
aws bedrock list-foundation-models --region ap-south-1 | grep -i haiku

# 2. Set in Lambda env:
AGENTS_ENABLED=true

# 3. Deploy updated agentRuntime.js (with native tool-use loop)

# 4. Test lead qualification agent:
# Create lead → EventBridge triggers lead-qualifier → Agent invokes
# Check CloudWatch logs for tool_use blocks and agent output
```

### Phase 10: Rollback Procedures

**If SES fails:**
```bash
# Temporarily disable SES, use Brevo
aws lambda update-function-configuration \
  --function-name cloudberry-api \
  --environment Variables={EMAIL_PROVIDER_PRIMARY=brevo,...}
```

**If Bailey causes issues:**
```bash
# Disable Bailey, webhook returns { ok: true, skipped: true }
aws lambda update-function-configuration \
  --function-name cloudberry-api \
  --environment Variables={BAILEY_ENABLED=false,...}
```

**If agents cause issues:**
```bash
# Disable agents, lead.created event is not published
aws lambda update-function-configuration \
  --function-name cloudberry-api \
  --environment Variables={AGENTS_ENABLED=false,...}
```

**Database safety:**
- CreditsTable has `DeletionPolicy: Retain`
- CreditConfigTable has `DeletionPolicy: Retain`
- Safe to redeploy CFN stack without data loss

---

## Post-Deployment Checklist

- [ ] All Lambda functions have correct env vars (use `aws lambda get-function-configuration`)
- [ ] CloudWatch metrics flowing (check dashboard 5 min after first action)
- [ ] SNS alert topic subscribed and tested
- [ ] SES verified domain + DKIM enabled
- [ ] Razorpay webhook registered + events arriving
- [ ] Auth service internal endpoints responding
- [ ] Frontend loads without console errors
- [ ] Cron functions trigger on schedule (check EventBridge rules)
- [ ] Credit seed config exists in DynamoDB
- [ ] Smoke test flow completes end-to-end
