# Backend deployment runbook — CloudFormation stacks + local frontend

**Target:** deploy the backend to AWS account `730335176275`, region `ap-south-1`, and drive it from a Vite dev server on `localhost:3000`.

**Verified against the live account on 2026-08-26.** Every template below was run through `aws cloudformation validate-template` and passed.

---

## 1. Template inventory

Eleven files carry `AWSTemplateFormatVersion`. Only **five** are stacks you create directly; three are nested children CloudFormation pulls in for you, one is the frontend (not needed — you are running Vite locally), and one is dead.

| # | Template | Kind | Deploy for backend? |
|---|---|---|---|
| 1 | `server/infra/launch-tables-cfn.yaml` | root | ✅ **yes** — Subscriptions, Grievances, WebhookLog, TenantApiKeys, NPSResponses, BetaInvites |
| 2 | `reality-flow-authentication/infra/cfn-backend.yaml` | root | ✅ **yes** — Cognito + auth Lambda + API GW. Login does not work without it |
| 3 | `server/infra/cfn-backend.yaml` | root | ✅ **yes** — the CRM API, 17 tables, 10 crons, call-intel SQS pipeline, the agent |
| 4 | `reality-flow-mcp/infra/cfn-backend.yaml` | root | ⚠️ **already deployed** as `dev-realestate-flow-mcp-stack`; redeploy only to ship the Phase 6 generated tool definitions |
| 5 | `ai-calling-service/cfn-template.yaml` | root | ⬜ optional — needs Exotel + ElevenLabs keys. See §6 |
| 6 | `whatsapp-platform/infra/cfn-platform.yaml` | root | ⬜ optional — needs an ECR image + a VPC. See §6 |
| 7 | `server/infra/apigw-explicit-routes-part1.yaml` | **nested** | auto — `deploy.sh` uploads it and passes the URL |
| 8 | `server/infra/apigw-explicit-routes-part2.yaml` | **nested** | auto — same |
| 9 | `reality-flow-authentication/infra/auth-explicit-routes.yaml` | **nested** | auto — same |
| 10 | `real-estate-crm-app/infra/cfn-frontend.yaml` | root | ❌ skip — S3 + CloudFront hosting; you are testing locally |
| 11 | `server/infra/apigw-explicit-routes.yaml` | **dead** | ❌ the 738 KB pre-split monolith. `deploy.sh` references only part1/part2. Nothing loads this file |

Each root stack has a matching `infra/deploy.sh` that packages the Lambda, uploads the artifact and nested templates to S3, generates `cfn-params.json` from `.env`, and calls `cloudformation deploy`. **Use the scripts** — the parameter list is 115 entries long for the server stack and hand-assembling it is not realistic.

---

## 2. What is actually in the account today

```
Stacks           dev-realestate-flow-mcp-stack (UPDATE_COMPLETE)   ← the only one
DynamoDB         realestate-flow-dev-oauth-codes
                 realestate-flow-dev-oauth-connections             ← that's all. 2 tables.
REST APIs        i1un5y6xjl  realestate-flow-mcp-dev
Custom domain    services-api.cloudberrysolutions.in  →  d-byt1gte0qi.execute-api.ap-south-1.amazonaws.com
                 REGIONAL, TLS 1.3, DNS resolves. Base-path mappings: NONE (both paths free)
S3               realestate-flow-lambda-packages
                 realestate-flow-cfn-templates-dev
                 realestate-flow-dev-ai-calling-knowledge(-recordings)
                 realestate-flow-dev-whatsapp-sessions
                 realestate-flow-prod-frontend
                 cf-templates-is9jfkeptbem-ap-south-1
```

Two consequences worth internalising:

**This is effectively a green-field deploy.** Everything except MCP is being created, not updated.

**That is good news for the two new GSIs.** `connectedWhatsAppPhone-index` and `instagramWebhookToken-index` both sit on `AgencyConfigTable`. CloudFormation permits only **one** GSI change per update to an existing table — but permits any number at table **creation**. Since `cloudberry-real-estate-agencies` does not exist yet, both indexes are created in one shot. No staged deploy needed. (Keep this in mind for any *future* GSI: it will have to go in alone.)

---

## 3. Fix these six things first

These will each fail a deploy or produce a Lambda that runs but is quietly broken.

### B1 — `AIEmployeeProvisioning` is declared in two templates ❗ blocks the deploy

`server/infra/launch-tables-cfn.yaml:56` and `server/infra/cfn-backend.yaml:972` both create a table literally named `AIEmployeeProvisioning`, with identical keys and the same `status-createdAt-index` GSI. Whichever stack goes second fails with `Table already exists`.

**Fix — give it one owner: the server stack.** It already wires `AI_EMPLOYEE_PROVISIONING_TABLE` into nine Lambda environments and grants IAM on it, and it is the stack you will redeploy most often. The launch-tables copy is referenced by nothing but its own output.

Delete from `server/infra/launch-tables-cfn.yaml`:
- the `AIEmployeeProvisioningTable:` resource (lines 56–88)
- the `AIEmployeeProvisioningTableArn:` output (lines 253–254)

The launch-tables copy enables point-in-time recovery and the server copy does not. Carry that over — add to `server/infra/cfn-backend.yaml` right under `BillingMode` at line 978:

```yaml
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
```

Every server-stack reference is a `!Sub` ARN string, never a `!GetAtt`, so nothing else moves.

### B2 — `ARTIFACT_BUCKET` points at a bucket that does not exist ❗ blocks the deploy

`server/.env` has `ARTIFACT_BUCKET=rewaro-cicd-artifacts`. There is no such bucket in this account. The `s3 cp` on step 3 of `deploy.sh` dies.

**Fix:** `ARTIFACT_BUCKET=realestate-flow-lambda-packages` (exists, and is what auth and MCP already use).

### B3 — OAuth table names do not match what MCP deployed ⚠️ silent runtime breakage

`server/.env` says `realtyflow-oauth-codes` / `realtyflow-oauth-connections`. The live MCP stack created `realestate-flow-dev-oauth-codes` / `realestate-flow-dev-oauth-connections`.

The stack deploys fine — the names only appear in IAM ARNs and env vars — and then every OAuth/AI-integration route 500s against a table that isn't there. `deploy.sh` prints a warning at step 6 that is easy to scroll past.

**Fix in `server/.env`:**
```
OAUTH_CODES_TABLE_NAME=realestate-flow-dev-oauth-codes
OAUTH_CONNECTIONS_TABLE=realestate-flow-dev-oauth-connections
```

### B4 — `AUTH_SERVICE_URL` is stale ⚠️ silent runtime breakage

`server/.env` points at `https://61usipojvl.execute-api.ap-south-1.amazonaws.com/dev`. That API ID does not exist in this account — the only REST API here is `i1un5y6xjl` (MCP). It is a leftover from a different account or a deleted stack.

**Fix:** deploy auth **before** the server stack and paste in its real `AuthApiEndpoint`. The ordering in §4 handles this.

The live MCP stack carries the same stale value in its `AuthServiceUrl` parameter — update it in the same pass.

### B5 — the auth service has no `.env` at all ❗ blocks the deploy

`reality-flow-authentication/` ships `sample.env` only. `deploy.sh` hard-fails on nine required vars. You need to supply, at minimum, a **Google OAuth client ID + secret** from the Google Cloud console — there is no way around that one, Cognito is configured with Google as an identity provider.

```bash
cp reality-flow-authentication/sample.env reality-flow-authentication/.env
```

Then set:

| Key | Value |
|---|---|
| `AWS_REGION` | `ap-south-1` |
| `SERVICE_NAME` | `reality-flow-auth` |
| `ENV` | `dev` |
| `LAMBDA_PACKAGES_BUCKET_NAME` | `realestate-flow-lambda-packages` |
| `COGNITO_DOMAIN_PREFIX_V2` | `reality-flow-auth-v2-dev` — must be globally unique across all of AWS; if it collides, add a suffix |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud console |
| `IDENTITY_CALLBACK_URL` | `http://localhost:3000/auth/callback` |
| `IDENTITY_LOGOUT_URL` | `http://localhost:3000/logout` |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` |
| `SUBSCRIPTIONS_TABLE` | `Subscriptions` |
| `SERVER_STACK_NAME` | **leave blank** — setting it makes auth import from the server stack, which would force auth to deploy second, and the server stack doesn't create `Subscriptions` anyway |
| `TEST_OTP_ENABLED` | `true` for local testing — skips real SMS and accepts `TEST_OTP_VALUE` |

In the Google console, add this authorized redirect URI:
`https://reality-flow-auth-v2-dev.auth.ap-south-1.amazoncognito.com/oauth2/idpresponse`

### B6 — the auth stack pins four Lambdas to end-of-life Node runtimes ❗ blocks the deploy

`reality-flow-authentication/infra/cfn-backend.yaml` is the only template still on old runtimes. Everything else in the repo is `nodejs20.x`.

| Line | Function | Runtime | Uses the runtime's SDK? |
|---|---|---|---|
| 604 | `dev-reality-flow-auth-define-auth-challenge` | `nodejs16.x` | no — pure logic |
| 641 | `dev-reality-flow-auth-create-auth-challenge` | `nodejs16.x` | **yes** — `require('aws-sdk')` at line 653 |
| 759 | `dev-reality-flow-auth-verify-auth-challenge` | `nodejs16.x` | **yes** — `require('aws-sdk')` at line 769 |
| 951 | `dev-reality-flow-auth-lambda` (the API) | `nodejs18.x` | no — `aws-sdk@^2.1692.0` is a declared dependency, so v2 ships inside `function.zip` |

`nodejs16.x` is long past Lambda's block-create date; CloudFormation will reject the three trigger functions with `InvalidParameterValueException: The runtime parameter of nodejs16.x is no longer supported`. `nodejs18.x` is also past end-of-support and is likely blocked too. Bump all four to `nodejs20.x` — it matches the rest of the repo and is confirmed live in this account (the MCP Lambda runs it).

**The two triggers need a code change, not just a runtime bump.** The `aws-sdk` v2 package is only preinstalled on `nodejs16.x` and earlier. From `nodejs18.x` onward the runtime ships **v3** instead, so `require('aws-sdk')` throws `Cannot find module` at cold start and every phone login fails at the OTP challenge.

Rewrite the two inline `ZipFile` bodies against v3, which is preinstalled on `nodejs20.x`. Three clients are in play:

| v2 | v3 replacement |
|---|---|
| `new AWS.DynamoDB.DocumentClient()` | `DynamoDBDocumentClient.from(new DynamoDBClient({}))` from `@aws-sdk/lib-dynamodb` |
| `new AWS.CognitoIdentityServiceProvider()` | `CognitoIdentityProviderClient` from `@aws-sdk/client-cognito-identity-provider` |
| `new AWS.SNS()` | `SNSClient` from `@aws-sdk/client-sns` |

and drop every `.promise()` — v3 commands are already promises: `await ddb.send(new PutCommand({...}))`.

Do **not** jump to `nodejs22.x` to sidestep this. That runtime ships only a subset of the v3 clients — DynamoDB is in it, but Cognito and SNS are not, so you would have to bundle them and these are `ZipFile` inline functions with no bundling step.

The main API Lambda at line 951 needs the runtime bump only; it carries its own SDK.

### Minor — `USER_CATEGORIES_TABLE_NAME` drift

`server/.env` says `cloudberry-dev-real-estate-user-categories`; the CFN parameter default is `cloudberry-real-estate-user-categories` and `deploy.sh` never passes the override, so **the deployed table and Lambda will both use the CFN default**. The stack is self-consistent — only a local `node server.js` run against AWS would look at the wrong table. Align the `.env` value to match.

---

## 4. Deploy order

Auth first (the server stack needs its URL); tables any time before traffic; server last.

### Step 0 — preflight

```bash
aws sts get-caller-identity                                    # expect 730335176275
aws s3 ls s3://realestate-flow-lambda-packages                 # artifact bucket reachable
which zip && node --version && npm --version                   # deploy.sh needs all three
```

Apply B1–B6 above before going further.

### Step 1 — launch tables

Seven tables, no Lambda, no dependencies. ~2 min.

```bash
cd server/infra
aws cloudformation deploy \
  --template-file launch-tables-cfn.yaml \
  --stack-name realestate-flow-launch-tables-dev \
  --parameter-overrides EnvironmentName=dev \
  --region ap-south-1 \
  --no-fail-on-empty-changeset
```

Verify:
```bash
aws dynamodb list-tables --region ap-south-1
# expect Subscriptions, Grievances, WebhookLog, TenantApiKeys, NPSResponses, BetaInvites
# and NOT AIEmployeeProvisioning — the server stack creates that one (B1)
```

### Step 2 — auth service

Creates the Cognito user pool, the auth Lambda, its own API Gateway, and four tables. ~8 min (Cognito domains are slow).

```bash
cd reality-flow-authentication
./infra/deploy.sh
```

Capture the outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name dev-reality-flow-auth-stack --region ap-south-1 \
  --query "Stacks[0].Outputs[?OutputKey=='AuthApiEndpoint'||OutputKey=='CognitoClientIdV2'||OutputKey=='CognitoHostedUIDomainV2'].{K:OutputKey,V:OutputValue}" \
  --output table
```

Put `AuthApiEndpoint` into `server/.env` as `AUTH_SERVICE_URL` (**B4**). Keep the Cognito values — the frontend needs them in §5.

### Step 3 — server stack (the big one)

17 tables, the API Lambda, 10 cron Lambdas, the call-recording SQS worker + DLQ, two REST APIs, and the two nested route stacks. **First create takes 20–35 minutes.** The two base-path mappings attach to `services-api.cloudberrysolutions.in`, whose paths are currently free.

```bash
cd server
./infra/deploy.sh
```

The script does the whole sequence: `npm ci --omit=dev` → zip → S3 → upload nested templates → generate `cfn-params.json` → `cloudformation deploy` with 3× retry → force an API Gateway deployment on both stages → print outputs.

It also runs a route-split migration check. On a **fresh** stack `route_split_migration_required` returns true (no part-2 resources exist), so it deploys twice — once with `DeployApiRoutePart2=false`, once with `true`. That is expected on first create and roughly doubles the wall time. Let it run.

Resulting URLs:
```
CRM API     https://services-api.cloudberrysolutions.in/devrealestatecrm/api
Public API  https://services-api.cloudberrysolutions.in/devrealestateagency/api
```

### Step 4 — point MCP at the new auth service

The deployed MCP stack still holds the stale `AuthServiceUrl`. Its `CrmApiUrl` is already correct.

```bash
cd reality-flow-mcp
# set AUTH_SERVICE_URL in .env to the Step 2 endpoint, then:
./infra/deploy.sh --skip-package dev
```

`--skip-package` updates parameters without rebuilding. Drop the flag when you want to ship the Phase 6 generated tool definitions.

---

## 5. Frontend, running locally against the deployed backend

CORS is already correct: the server stack receives `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://app.realestateflow.in`, and the auth stack gets the same. No change needed.

```bash
cd real-estate-crm-app
cp .env.sample .env
```

Set these:

```bash
VITE_PORT=3000

VITE_API_URL=https://services-api.cloudberrysolutions.in/devrealestatecrm/api
VITE_API_BASE_URL=https://services-api.cloudberrysolutions.in/devrealestatecrm/api

VITE_AUTH_API_URL=<AuthApiEndpoint from Step 2>
VITE_COGNITO_DOMAIN=<CognitoHostedUIDomainV2 from Step 2>
VITE_COGNITO_CLIENT_ID=<CognitoClientIdV2 from Step 2>
VITE_AUTH_REDIRECT_URI=http://localhost:3000/auth/callback
VITE_AUTH_LOGOUT_URI=http://localhost:3000/login

VITE_BAILEY_ENABLED=true
VITE_AI_CALLING_ENABLED=false      # leave off unless you deploy §6
```

`VITE_PORT=3000` is not cosmetic — `IDENTITY_CALLBACK_URL` and the Cognito app-client callback are both pinned to port 3000. Vite on 5173 will fail the OAuth redirect.

```bash
npm install
npm run dev
```

Both `src/services/api.ts:19` and `src/services/agentChatApi.ts:18` read `VITE_API_URL || VITE_API_BASE_URL`, so the AI chat panel follows the same base URL automatically.

### The agent chat endpoint

`/api/crm/agent-chat` (mounted at `server/server.js:139`) is **not** in the explicit-routes templates. It is served by the `{proxy+}` catch-all under `/api` (`apigw-explicit-routes-part1.yaml:41`), which is `AuthorizationType: NONE` at the gateway — authentication happens inside Express, so your JWT flows straight through. Nothing extra to configure.

It streams SSE frames over an authenticated POST. API Gateway REST buffers the response, so frames arrive as one batch rather than incrementally. The client parser handles both and the reply is complete either way; only the typing effect is missing. That is open item **O5**.

---

## 6. Optional stacks, and what blocks each

### AI calling — `ai-calling-service/cfn-template.yaml`

Needs `ExotelApiKey`, `ExotelApiToken`, `ExotelSid`, `ElevenLabsApiKey` — all `NoEcho`, no defaults.

**Bucket collision:** the template creates `${AICallingKnowledgeBucket}` and `${AICallingKnowledgeBucket}-recordings`. The buckets `realestate-flow-dev-ai-calling-knowledge` and `-recordings` already exist in the account, retained from a deleted stack. Passing those names fails with `BucketAlreadyOwnedByYou`. Either choose a new name, or `aws cloudformation import` the existing pair.

`AI_CALLING_INTERNAL_API_KEY` and `AI_CALLING_SERVICE_URL` are empty in `server/.env`; fill them and redeploy the server stack afterwards.

### WhatsApp platform — `whatsapp-platform/infra/cfn-platform.yaml`

ECS Fargate running Baileys workers. Needs, before anything:
- a container image pushed to ECR (`ContainerImageUri`)
- an existing VPC — `VpcId`, `PrivateSubnetIds`, `VpcCidr` are all required with no defaults, and the template creates no networking

`whatsapp-platform/.env` targets `devrealestate-flow-whatsapp-session-state`, which does **not** collide with the orphaned `realestate-flow-dev-whatsapp-sessions`.

The CRM works without this — `BAILEY_MODE=selfhosted` simply has nothing to talk to, so WhatsApp inbound/outbound is inert.

---

## 7. Calling API Gateway directly

Health check needs no auth:

```bash
curl -i https://services-api.cloudberrysolutions.in/devrealestatecrm/api/health
```

Everything else needs a bearer token. The auth service mounts its routers at the **root**, not under `/api` — the paths are `/auth/phone/start` and `/auth/phone/confirm` (`src/app.ts:54`).

It is a two-call Cognito custom-auth flow: `start` returns a `session` string that `confirm` must echo back. With `TEST_OTP_ENABLED=true` the challenge Lambda accepts the fixed `TEST_OTP_VALUE` and sends no SMS. Rate limits (3 starts / 15 min) are skipped when `ENV=dev`.

```bash
AUTH=<AuthApiEndpoint>
PHONE='+919876543210'

SESSION=$(curl -s -X POST "$AUTH/auth/phone/start" \
  -H 'Content-Type: application/json' \
  -d "{\"phoneNumber\":\"$PHONE\"}" | jq -r '.session')

TOKEN=$(curl -s -X POST "$AUTH/auth/phone/confirm" \
  -H 'Content-Type: application/json' \
  -d "{\"phoneNumber\":\"$PHONE\",\"otp\":\"123456\",\"session\":\"$SESSION\"}" \
  | jq -r '.tokens.idToken')
```

Note the field names: `phoneNumber` (not `phone`), and the token is nested at `.tokens.idToken`. A brand-new number comes back with `needsOnboarding: true` and needs `POST /auth/phone/onboard` (bearer token, `{displayName, role: "ADMIN", agencyName}`) before it has a tenant.

Then hit the CRM API:

```bash
API=https://services-api.cloudberrysolutions.in/devrealestatecrm/api

curl -s "$API/crm/leads?limit=5" -H "Authorization: Bearer $TOKEN" | jq

# the agent, same path the browser panel uses
curl -N -X POST "$API/crm/agent-chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"aaj ke naye leads dikhao","history":[]}'
```

Bypass the custom domain entirely when you want to isolate a base-path-stripping problem:

```bash
CRM_API_ID=$(aws cloudformation describe-stack-resources \
  --stack-name cloudberry-dev-real-estate-agency --region ap-south-1 \
  --logical-resource-id RealEstateCrmRestApi \
  --query "StackResources[0].PhysicalResourceId" --output text)

curl -i "https://$CRM_API_ID.execute-api.ap-south-1.amazonaws.com/dev/api/health"
```

Note the path difference. `ENABLE_BASE_PATH_STRIP=true` makes the Lambda strip `/devrealestatecrm` when the request arrives through the custom domain. On the raw `execute-api` URL there is no base path to strip, so routes sit directly under `/api/...`. If the custom domain 404s but the raw URL works, base-path stripping is the culprit.

### Tailing logs

```bash
aws logs tail /aws/lambda/dev-real-estate-api --follow --region ap-south-1

# the agent's own events
aws logs tail /aws/lambda/dev-real-estate-api --follow --region ap-south-1 \
  --filter-pattern 'agent.invoke'
```

`agent.invoke.refunded`, `agent.invoke.refund_skipped` and `agent.invoke.refund_failed` are the credit-refund events from [`02-credit-refund.md`](./02-credit-refund.md). A rising `refunded` rate means turns are charging and delivering nothing — a pipeline-health signal, not a billing one.

---

## 8. After the stacks are up

| | |
|---|---|
| **Both GSIs `ACTIVE`** | `aws dynamodb describe-table --table-name cloudberry-real-estate-agencies --region ap-south-1 --query "Table.GlobalSecondaryIndexes[].{Name:IndexName,Status:IndexStatus,Backfilling:Backfilling}"` — needs `ACTIVE` **and** `Backfilling: false` on both before the querying code runs (open item **O6**) |
| **`AgentToolLoopEnabled`** | Ships `false`. Single-tool turns work either way. Flip it in staging and watch cost-per-turn and p95 — it has never run against the real Gemini model (open item **O2**) |
| **`AGENTS_ENABLED`** | Already `true` in `server/.env`, with `LLM_PROVIDER=gemini`, `GEMINI_MODEL=gemini-2.5-pro`, and a populated `GEMINI_API_KEY` |
| **Seed a tenant** | See `server/scripts/seed-demo-tenant-deploy.md` — an empty CRM makes every agent turn look broken |

---

## 9. One-line summary

Fix **B1–B6**, then:

```bash
cd server/infra && aws cloudformation deploy --template-file launch-tables-cfn.yaml \
  --stack-name realestate-flow-launch-tables-dev --parameter-overrides EnvironmentName=dev \
  --region ap-south-1 --no-fail-on-empty-changeset
cd ../../reality-flow-authentication && ./infra/deploy.sh          # → copy AuthApiEndpoint into server/.env
cd ../server && ./infra/deploy.sh                                  # 20–35 min on first create
cd ../real-estate-crm-app && npm run dev                           # localhost:3000
```
