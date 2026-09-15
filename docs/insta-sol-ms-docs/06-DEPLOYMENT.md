# Deployment

Two deployable stacks. Both follow the repo's established pattern: the real work lives
in `<service>/infra/deploy.sh`, and `cfn-templates-cicd/<service>/deploy.sh` wraps it
with build tracking.

## Why no VPC

The Lambda talks to DynamoDB (a public AWS API endpoint) and over HTTPS to the auth
service, the CRM, Instagram and optionally Gemini. Nothing it touches is inside the
VPC, so it stays out of one: no ENI cold starts, no NAT dependency.

## Backend

```bash
cd backend_insta_sol_ms
cp .env.sample .env.dev        # fill in, see below
./infra/deploy.sh dev                                   # direct
../cfn-templates-cicd/backend_insta_sol_ms/deploy.sh dev # with build tracking (preferred)
```

The script refuses to run without an explicit `dev`/`prod` argument, sources
`.env.<env>`, then **forces** `ENVIRONMENT_NAME` from the CLI argument. It validates
required vars, asserts `STACK_NAME` and both table names start with
`<env>-realestateflow-`, checks the custom-domain variables and the Instagram app
variables (`META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
`INSTA_TOKEN_ENCRYPTION_KEY`, `INSTA_CONSOLE_URL`), prints the resolved AWS account,
and regenerates `cfn-params.json` from scratch. It hard-fails if it would pass a
parameter the template does not declare.

Creates:

| Resource | Name |
|---|---|
| Stack | `<env>-realestateflow-insta-stack` |
| Lambda | `<env>-realestateflow-insta-lambda` (nodejs20.x, 60s timeout) |
| EventBridge rule | `<env>-realestateflow-insta-worker` (default `rate(2 minutes)`) |
| API Gateway | `<env>-realestateflow-insta-api`, stage `v1` |
| Table | `<env>-realestateflow-insta-data` (Retain, PITR, GSI1) |
| Table | `<env>-realestateflow-insta-audit` (TTL only) |
| Role | `<env>-realestateflow-insta-lambda-role` |
| Log group | `/aws/lambda/<env>-realestateflow-insta-lambda`, 30-day retention |

One function serves both triggers: API Gateway requests go to Express, EventBridge
events run `services/worker.js` (DM polling, lead analysis, CRM hand-off, keyword
rules, media and profile snapshots, token refresh).

The IAM role reaches exactly the two tables and its own log group. No CRM table is
reachable from this service.

### Stack outputs to copy into the Meta app

`MetaOAuthRedirectUri`, `MetaWebhookCallbackUrl`, `MetaDeauthorizeCallbackUrl`,
`MetaDataDeletionRequestUrl` — see `07-META-APP-SETUP.md`.

### Secrets

`MetaAppSecret`, `MetaWebhookVerifyToken`, `TokenEncryptionKey`, `GeminiApiKey` and
`AdapterInternalApiKey` are `NoEcho` parameters that become Lambda environment
variables, the same pattern the CRM stack uses for its adapter key. They come from the
gitignored `.env.<env>` file and are never committed.

`TokenEncryptionKey` is deliberately **not** on the config-only deploy allowlist:
changing it makes every stored Instagram token undecryptable, so it takes a full,
deliberate deploy.

### Operational switches (config-only deploy)

| Parameter | Effect |
|---|---|
| `DryRunSends=true` | replies and rule DMs recorded, never sent |
| `KillSwitchEnabled=true` | nothing is sent at all; reads continue |
| `RulesEnabled=false` | keyword rules stop firing |
| `WorkerEnabled=false` | pauses the scheduled worker |
| `PromoteEnquiriesToLeads=false` | stops CRM hand-off |

## Frontend

```bash
cd frontend_insta_sol_ms
./infra/deploy.sh prod
```

Builds with Vite, deploys the bucket stack, syncs `dist/` to `s3://<bucket>/insta/`,
and invalidates `/insta/*` if a distribution is configured. Hashed assets get a
one-year immutable cache header; `index.html` gets `no-cache`.

CloudFront wiring is documented in `09-CLOUDFRONT-INTEGRATION.md`.

## Local development

```bash
cd backend_insta_sol_ms
cp .env.sample .env.local
# INSTA_STORE=memory             no AWS needed
# INSTA_DEV_AUTH_TENANT_ID=local skips the CRM login (refused outside a laptop)
# INSTA_LOCAL_WORKER_SECONDS=60  runs the worker inside the process
npm install && npm run dev       # http://localhost:3101

cd ../frontend_insta_sol_ms
cp .env.sample .env.local        # VITE_INSTA_API_DOMAIN_NAME=http://localhost:3101
npm install && npm run dev       # http://localhost:3100/insta/?token=local
```

For a real Instagram login from a laptop, Meta needs a redirect URI it accepts: use
the deployed dev stack, or an https tunnel to port 3101 with `META_REDIRECT_URI` and
`INSTA_API_DOMAIN_NAME` set to the tunnel URL.

## Build tracking and rollback

```bash
./deploy.sh list             # every recorded build
./deploy.sh show 0003        # manifest: env, stack, status, commit, deployer, code S3 key
./deploy.sh rollback prod 0002
```

Build numbers are global across environments. Each build archives its template,
params and manifest to `s3://<artifact-bucket>/<prefix>/builds/<build>/<env>/`.
`rollback` refuses to cross environments. The frontend wrapper also archives each
build's `dist.tar.gz`.

## Teardown

Both DynamoDB tables and both S3 buckets are `DeletionPolicy: Retain`. Deleting the
stacks leaves the data behind on purpose.
