# Manual Configurations Reference

## AWS Lambda / CloudFormation Parameters

| Parameter | Default | Required | Notes |
|-----------|---------|----------|-------|
| `CreditsTableName` | `cloudberry-real-estate-credits` | Yes | Created by CFN |
| `CreditConfigTableName` | `cloudberry-real-estate-credit-config` | Yes | Seed after deploy |
| `SesFromEmail` | `noreply@realestateflow.in` | Yes | Must be SES-verified |
| `EmailProviderPrimary` | `ses` | Yes | Set `brevo` to skip SES |
| `BaileyEnabled` | `false` | No | `true` only after WABA approval |
| `BaileyMode` | `hosted` | No | `hosted` or `selfhosted` |
| `BaileyApiKey` | — | If hosted | NoEcho in CFN |
| `BaileyWebhookSecret` | — | If Bailey | HMAC verify inbound |
| `AgentsEnabled` | `false` | No | `true` for pilot only |
| `RAZORPAY_KEY_ID` | — | Yes | Orders + subscriptions |
| `RAZORPAY_KEY_SECRET` | — | Yes | Server-side only |
| `RAZORPAY_WEBHOOK_SECRET` | — | Yes | Webhook HMAC |

## Credit Config Table (owner-editable via API)

Seeded defaults in `server/creditConfig.js`:

| Key | Purpose |
|-----|---------|
| `FREE_TIER.monthlyFreeCredits` | 1000 |
| `PACKS.starter` | ₹1999 / 5000 credits |
| `PACKS.professional` | ₹4999 / 15000 credits |
| `COSTS.lead_add` | 10 credits |
| `COSTS.agent_action` | 15 credits |

Admin API: `PUT /api/credit-config/costs` (requires ADMIN role)

## Razorpay

### Subscription plans (existing)
- `plan_solo_monthly`, `plan_team_monthly`, `plan_teamplus_monthly`
- Annual variants with 20% discount

### Credit packs (Orders API — new)
- `pack_500`: ₹499 / 500 credits
- `pack_2000`: ₹1799 / 2000 credits
- `pack_5000`: ₹3999 / 5000 credits

Webhook must pass `notes: { tenantId, credits }` on payment capture.

## SES (see `../notes/ses-aws-setup.md`)

1. AWS Console → SES → Verified identities → Add `realestateflow.in`
2. Add DKIM CNAME records to DNS
3. Request production access (use case: transactional CRM emails)
4. Lambda role needs `ses:SendEmail` (added in CFN)

## Bailey WhatsApp

### Option 1: Hosted Bailey.ai

```
BAILEY_ENABLED=true
BAILEY_MODE=hosted
BAILEY_API_KEY=<from Bailey dashboard>
BAILEY_WEBHOOK_SECRET=<random 32+ char secret>
BAILEY_API_ENDPOINT=https://api.bailey.ai
```

### Option 2: Self-hosted Baileys library

```
BAILEY_ENABLED=true
BAILEY_MODE=selfhosted
BAILEY_WEBHOOK_SECRET=<random 32+ char secret>
BAILEY_API_ENDPOINT=https://your-baileys-service.example.com
BAILEY_API_KEY=<random 32+ char secret>  # must match baileys-service BAILEYS_API_KEY
```

Deploy the separate `baileys-service/` project. See `baileys-service/README.md`.

Frontend (optional):
```
VITE_BAILEY_ENABLED=true
```

## MCP Local Development

```bash
cd server/mcp-server && npm install
export MCP_TENANT_ID=<your-tenant-id>
export CRM_DYNAMODB_TABLE_NAME=cloudberry-real-estate-crm
export AWS_REGION=ap-south-1
node index.js
```

Registered in `.mcp.json` as `nabi-crm` stdio server.

## Bedrock Agents

```
AGENTS_ENABLED=true  # only after testing
AWS_REGION=ap-south-1
```

Model: `anthropic.claude-3-haiku-20240307-v1:0`  
Requires Bedrock model access enabled in AWS account.

## Cron Schedules (UTC → IST)

| Cron | UTC | IST | Handler |
|------|-----|-----|---------|
| credit-reset | `cron(0 19 * * ? *)` | 00:30 | `credit-reset-cron.handler` |
| incomplete-data | `cron(30 3 * * ? *)` | 09:00 | `incomplete-data-cron.handler` |
| expiring-agreements | `cron(0 3 * * ? *)` | 08:30 | `expiring-agreements-cron.handler` |
| team-summary | `cron(30 12 * * ? *)` | 18:00 | `team-summary-cron.handler` |
| trial-reminder | `cron(30 3 * * ? *)` | 09:00 | `trial-reminder-cron.handler` |

## Feature Flags Summary

| Flag | Default | When to enable |
|------|---------|----------------|
| `BAILEY_ENABLED` | false | Self-hosted Baileys ready OR WABA approved + webhook URL live |
| `AGENTS_ENABLED` | false | Bedrock access + credit system verified |
| `EMAIL_PROVIDER_PRIMARY=ses` | ses | After SES domain verified |
