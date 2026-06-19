# 07 — Infrastructure: CFN + Deploy Changes (Consolidated)

All infra changes in one place so an implementer touches `cfn-backend.yaml`, the `/cron/*.yaml` set, and `deploy.sh` consistently. **Pattern: match the existing files exactly.** No Terraform/CDK/SAM — CloudFormation only (per project standard).

References:
- Main stack: `server/infra/cfn-backend.yaml` (DynamoDB tables, `ApiLambdaExecutionRole`, `ApiLambdaFunction`, two API Gateways).
- Deploy: `server/infra/deploy.sh` (npm ci → zip `function.zip` incl. `scripts/` → S3 → `cloudformation deploy` → force API GW deploy). Handler `lambda-handler.handler`. Syntax gate `server/scripts/build.sh`.
- Cron template reference: `cron/trial-reminder.yaml` (EventBridge Rule + Lambda + `AWS::Lambda::Permission`).

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

## 4. New cron / event CFN templates (clone `cron/trial-reminder.yaml`)

Each gets its own `*.yaml` with EventBridge Rule (schedule or pattern) + Lambda + Permission + its own execution role (DynamoDB to the needed tables, SES, Bedrock/EventBridge as required).

| File | Trigger | Handler | Needs |
|------|---------|---------|-------|
| `cron/credit-reset.yaml` | `cron(30 18 * * ? *)` daily | `credit-reset-cron.handler` | Credits, CreditConfig, Subscriptions |
| `cron/incomplete-data.yaml` | `cron(30 3 * * ? *)` 09:00 IST | `incomplete-data-cron.handler` | CRM, AUTH_SERVICE_URL, SES, Bailey |
| `cron/expiring-agreements.yaml` | `cron(0 3 * * ? *)` 08:30 IST | `expiring-agreements-cron.handler` | CRM, SES, Bailey |
| `cron/team-summary.yaml` | `cron(30 12 * * ? *)` 18:00 IST | `team-summary-cron.handler` | CRM, AUTH, Credits, SES, Bailey |
| `cron/lead-followup.yaml` | `cron(0 4 * * ? *)` 09:30 IST | `lead-followup-cron.handler` | CRM, Bedrock, Credits, Bailey/SES |
| `cron/whatsapp-processor.yaml` | EventBridge pattern `whatsapp.incoming`/`message.received` | `whatsapp-message-processor.handler` | CRM, Credits, Bedrock, Bailey |
| `cron/lead-qualifier.yaml` | EventBridge pattern `crm.leads`/`lead.created` | `lead-qualifier-handler.handler` | CRM, Bedrock, Credits |
| `cron/lead-router.yaml` | EventBridge pattern `crm.leads`/`lead.qualified` | `lead-router-handler.handler` | CRM, AUTH, Bedrock, Credits |

**Note:** All handlers live in `server/scripts/` so they are already in `function.zip`. Each cron Lambda points its `Code` at the same artifact (S3 bucket/key) the deploy uploads, with a distinct `Handler`. Mirror exactly how `trial-reminder.yaml` references code/runtime (`nodejs20.x`).

**Cron roles need SES + (where used) Bedrock + EventBridge** — these Lambdas don't use the API role.

## 5. `server/server.js` mount additions

- `webhooksRoutes` mounted **before** `express.json()` with `express.raw()` (like billing). (E1-T5)
- After json + auth: mount `admin.js` (`/api/admin`), `creditAdmin.js` (`/api/credit-config`). (E2/E4)

## 6. `deploy.sh` changes

- **CONFIRMED zip line** (`deploy.sh:116`): `zip -r function.zip node_modules package.json *.js routes/ middleware/ utils/ validation/ public/ lib/ scripts/`.
- **File-placement convention (match existing code):** backend services live at the **server root** as `server/<name>Service.js` (e.g. existing `crmDynamodbService.js`, `subscriptionService.js`, `agencyConfigService.js`). There is **no `server/services/` or `server/config/` directory** — do not invent them. New modules `creditService.js`, `creditConfig.js`, `emailService.js`, `teamAnalyticsService.js`, `dataQualityService.js`, `skillInvoker.js`, `agentAuditService.js`, `bailey.js` go at **server root** and ship automatically via `*.js`. Define the `InsufficientCreditsError` class inline (root `creditService.js`) — no `errors/` dir.
- **Only `server/agents/` is a new directory** (agent runtimes). Add `agents/` to the `zip -r function.zip ...` include line. (Agent Lambda handlers themselves go in `server/scripts/` which is already included.)
- `server/mcp-server/` is a separate process; **exclude** it from the API zip (add to the `-x` list) to avoid bloating the Lambda.
- New deps (`@aws-sdk/client-sesv2`, `@aws-sdk/client-eventbridge`, `xlsx`, optionally `@aws-sdk/client-bedrock-runtime`) install via `npm ci` and ship in `node_modules` — verify Lambda package size stays under limits; if close, consider Lambda layers (follow-up).
- Cron stacks deploy individually: `aws cloudformation deploy --template-file cron/<name>.yaml --stack-name <name> ...` — document each in a `deploy-crons.sh` helper (NEW) mirroring the existing single trial-reminder deploy.

## 7. Build gate
- `server/scripts/build.sh` currently runs `find routes middleware scripts lib -name "*.js" -exec node --check`. Extend it to also check the server root `*.js` and the new `agents` dir, e.g. `find . -maxdepth 1 -name "*.js"` plus `agents`. (Root services are not currently syntax-checked — fix this.)

---

## Implementer checklist (infra)
- [ ] Tables added + params + IAM ARNs + role statements (DynamoDB/SES/EventBridge/Bedrock).
- [ ] Env vars added to `ApiLambdaFunction` + params.
- [ ] `deploy.sh` zip include list extended (`agents`), mcp-server excluded, params wired.
- [ ] `build.sh` checks root + new dirs.
- [ ] Each cron/event template created from `trial-reminder.yaml`, correct handler + role.
- [ ] `cloudformation validate-template` passes for main + every cron template.
- [ ] `server.js` mounts (raw webhook before json; admin/credit-config after).
