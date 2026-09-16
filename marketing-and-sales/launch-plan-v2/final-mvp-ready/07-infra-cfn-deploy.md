# 07 — Infrastructure: CFN + Deploy Changes (Consolidated)

All infra changes in one place so an implementer touches `cfn-backend.yaml` and `deploy.sh` consistently. **Pattern: match the existing files exactly.** No Terraform/CDK/SAM — CloudFormation only (per project standard).

**IMPORTANT:** All 10 cron jobs are now merged into the main `cfn-backend.yaml` template. One-click deployment via `./deploy.sh` deploys the API + all crons in a single CloudFormation stack. The separate `cron/*.yaml` files and `deploy-crons.sh` are obsolete.

References:
- Main stack: `apps/crm/server/infra/cfn-backend.yaml` (DynamoDB tables, `ApiLambdaExecutionRole`, `ApiLambdaFunction`, two API Gateways, and all 10 cron jobs).
- Deploy: `apps/crm/server/infra/deploy.sh` (npm ci → zip `function.zip` incl. `scripts/` → S3 → `cloudformation deploy` → force API GW deploy). Handler `lambda-handler.handler`. Syntax gate `apps/crm/server/scripts/build.sh`.

---

## 1. New DynamoDB tables (add to `cfn-backend.yaml`, clone the `CrmTable` block)

| Logical | TableName param default | Keys | GSIs | Notes |
|---------|------------------------|------|------|-------|
| `CreditsTable` | `cloudberry-real-estate-credits` | PK `tenantId` (S), SK `sk` (S) | `actionType-index` (GSI1PK,GSI1SK) | PAY_PER_REQUEST; TTL `expiresAt` on ledger rows; `DeletionPolicy: Retain` |
| `CreditConfigTable` | `cloudberry-real-estate-credit-config` | PK `configKey` (S) | — | small; PAY_PER_REQUEST |

For each: add `AttributeDefinitions`, `KeySchema`, GSI (credits only), `BillingMode: PAY_PER_REQUEST`, `DeletionPolicy: Retain`, `UpdateReplacePolicy: Retain` — exactly like `CrmTable`.

**Parameters** (add near the other `*TableName` params): `CreditsTableName`, `CreditConfigTableName` with the defaults above.

## 2. IAM — extend `ApiLambdaExecutionRole`

In `RealEstateApiDynamoAndS3Access`:
- Add `!GetAtt CreditsTable.Arn`, `!GetAtt CreditConfigTable.Arn` (and their `/index/*`) to the DynamoDB `Resource` list.
- Add a statement for SES:
  ```yaml
  - Effect: Allow
    Action: [ 'ses:SendEmail', 'ses:SendRawEmail' ]
    Resource: '*'   # or the verified identity ARN
  ```
- Add EventBridge publish (for `lead.created`/`lead.qualified`/whatsapp events):
  ```yaml
  - Effect: Allow
    Action: [ 'events:PutEvents' ]
    Resource: '*'
  ```
- If agents call Bedrock from the API Lambda: add `bedrock:InvokeModel` (scope to model ARNs). For cron/handler Lambdas, add to their own roles.

## 3. `ApiLambdaFunction` env additions

Add under `Environment.Variables`:
```
CREDITS_TABLE_NAME: !Ref CreditsTableName
CREDIT_CONFIG_TABLE_NAME: !Ref CreditConfigTableName
AWS_SES_FROM_EMAIL: !Ref SesFromEmail
EMAIL_PROVIDER_PRIMARY: !Ref EmailProviderPrimary
BAILEY_ENABLED: !Ref BaileyEnabled
BAILEY_API_KEY: !Ref BaileyApiKey
BAILEY_WEBHOOK_SECRET: !Ref BaileyWebhookSecret
AGENTS_ENABLED: !Ref AgentsEnabled
```
Add matching `Parameters` (`SesFromEmail`, `EmailProviderPrimary`, `BaileyEnabled`, `BaileyApiKey` [NoEcho], `BaileyWebhookSecret` [NoEcho], `AgentsEnabled`).

## 4. Cron Jobs (merged into cfn-backend.yaml)

All 10 cron jobs are now defined within the main `cfn-backend.yaml` template. Each cron includes EventBridge Rule (schedule or pattern) + Lambda + Permission + its own execution role.

| Cron Name | Trigger | Handler | Needs |
|-----------|---------|---------|-------|
| Credit Reset | `cron(30 18 * * ? *)` daily | `credit-reset-cron.handler` | Credits, CreditConfig, Subscriptions |
| Incomplete Data | `cron(30 3 * * ? *)` 09:00 IST | `incomplete-data-cron.handler` | CRM, AUTH_SERVICE_URL, SES, Bailey |
| Expiring Agreements | `cron(0 3 * * ? *)` 08:30 IST | `expiring-agreements-cron.handler` | CRM, SES, Bailey |
| Team Summary | `cron(30 12 * * ? *)` 18:00 IST | `team-summary-cron.handler` | CRM, AUTH, Credits, SES, Bailey |
| Trial Reminder | `cron(0 9 * * ? *)` 14:30 IST | `trial-reminder-cron.handler` | CRM, Subscriptions, SES |
| Escalate OpenClaw | `cron(0 10 * * ? *)` 15:30 IST | `escalate-openclaw-cron.handler` | CRM, SES |
| Lead Followup | `cron(0 4 * * ? *)` 09:30 IST | `lead-followup-cron.handler` | CRM, Bedrock, Credits, Bailey/SES |
| WhatsApp Processor | EventBridge pattern `whatsapp.incoming`/`message.received` | `whatsapp-message-processor.handler` | CRM, Credits, Bedrock, Bailey |
| Lead Qualifier | EventBridge pattern `crm.leads`/`lead.created` | `lead-qualifier-handler.handler` | CRM, Bedrock, Credits |
| Lead Router | EventBridge pattern `crm.leads`/`lead.qualified` | `lead-router-handler.handler` | CRM, AUTH, Bedrock, Credits |

**Note:** All handlers live in `apps/crm/server/scripts/` so they are already in `function.zip`. Each cron Lambda points its `Code` at the same artifact (S3 bucket/key) the deploy uploads, with a distinct `Handler`.

**Cron roles need SES + (where used) Bedrock + EventBridge** — these Lambdas don't use the API role.

## 5. `apps/crm/server/server.js` mount additions

- `webhooksRoutes` mounted **before** `express.json()` with `express.raw()` (like billing). (E1-T5)
- After json + auth: mount `admin.js` (`/api/admin`), `creditAdmin.js` (`/api/credit-config`). (E2/E4)

## 6. `deploy.sh` changes

- Add the new params to `cfn-params.json` generation: `CreditsTableName`, `CreditConfigTableName`, `SesFromEmail`, `EmailProviderPrimary`, `BaileyEnabled`, `BaileyApiKey`, `BaileyWebhookSecret`, `AgentsEnabled`.
- **CONFIRMED current zip line** (`deploy.sh` ~line 116):
  ```bash
  zip -r function.zip node_modules package.json *.js routes/ middleware/ utils/ \
    validation/ public/ lib/ scripts/ \
    -x "node_modules/.cache/*" "node_modules/typescript/*" "node_modules/ts-node/*" \
       "deploy*.ps1" "deploy.ps1" "*.md" ".git*" "cfn/*" "infra/*"
  ```
- **REQUIRED change:** Add `agents/` to include list and `mcp-server/*` to exclude list:
  ```bash
  zip -r function.zip node_modules package.json *.js routes/ middleware/ utils/ \
    validation/ public/ lib/ scripts/ agents/ \
    -x "node_modules/.cache/*" "node_modules/typescript/*" "node_modules/ts-node/*" \
       "deploy*.ps1" "deploy.ps1" "*.md" ".git*" "cfn/*" "infra/*" "mcp-server/*"
  ```
- **File-placement convention (match existing code):** backend services live at the **server root** as `server/<name>Service.js` (e.g. existing `crmDynamodbService.js`, `subscriptionService.js`, `agencyConfigService.js`). There is **no `apps/crm/server/services/` or `apps/crm/server/config/` directory** — do not invent them. New modules `creditService.js`, `creditConfig.js`, `emailService.js`, `teamAnalyticsService.js`, `dataQualityService.js`, `skillInvoker.js`, `agentAuditService.js`, `bailey.js`, `razorpayOrders.js`, `whatsappAuditService.js` go at **server root** and ship automatically via `*.js` glob.
- `InsufficientCreditsError`: define inline in `apps/crm/server/creditService.js` — match the error class style in `apps/crm/server/expressError.js` (no `errors/` dir).
- `apps/crm/server/agents/` is the **only new directory** (agent runtimes go here). Its handlers are not in scripts/ — they're in agents/. Lambda handlers for agents go in `apps/crm/server/scripts/` (already included).
- `apps/crm/server/mcp-server/` is a separate stdio process; **exclude** from the API zip.
- New deps (`@aws-sdk/client-sesv2`, `@aws-sdk/client-eventbridge`, `xlsx`, `@aws-sdk/client-bedrock-runtime`) install via `npm ci` and ship in `node_modules`. Verify Lambda package size ≤ 250MB (uncompressed) before shipping; if close, consider Lambda layers.
- All 10 cron jobs are now deployed as part of the main `cfn-backend.yaml` stack — no separate cron deployment needed.

## 7. Build gate
- `apps/crm/server/scripts/build.sh` currently runs `find routes middleware scripts lib -name "*.js" -exec node --check`. Extend it to also check the server root `*.js` and the new `agents` dir, e.g. `find . -maxdepth 1 -name "*.js"` plus `agents`. (Root services are not currently syntax-checked — fix this.)

---

## Implementer checklist (infra)

**Status:** ✅ IMPLEMENTED in code (2026-06-19) — all cron jobs now merged into cfn-backend.yaml

- [x] Tables added + params + IAM ARNs + role statements (DynamoDB/SES/EventBridge/Bedrock) in `cfn-backend.yaml`.
- [x] Env vars added to `ApiLambdaFunction.Environment` + matching `Parameters` in `cfn-backend.yaml`.
- [x] `deploy.sh` zip include: `agents/` added, `mcp-server/*` excluded, new params wired to `cfn-params.json`.
- [x] `build.sh` extended: check root `*.js` files + `agents/` directory.
- [x] All 10 cron jobs merged into cfn-backend.yaml with correct handler paths + execution roles + S3 Code.
- [x] `cloudformation validate-template` passes for main stack (includes all crons).
- [x] `apps/crm/server/server.js` mount additions: `webhooksRoutes` before `express.json()`, `adminRoutes` + `creditAdminRoutes` after.
- [x] One-click deployment: `./deploy.sh` deploys API + all 10 cron jobs in single stack.
