# CFN Templates & Deploy Scripts — CI/CD Registry

This folder consolidates every CloudFormation template and its deploy script from across the repo, one subfolder per service. It was assembled from a read-only audit of the live AWS account (`aws cloudformation describe-stacks` / `get-template` / `describe-stack-events`, `aws dynamodb list-tables`) run against account `730335176275` (region `ap-south-1`) on 2026-08-12. No AWS resources were changed by that audit or by this reorganization.

**2026-08-12 update:** the branch this folder was built from was 4 PRs behind `main` (missing PR #37–#40). Pulled in from `main`'s merge commit for PR #40 (`f6b557e`, which contains #37–#40 cumulatively, confirmed via `git merge-base` to be a strict ancestor relationship with no divergent local edits to reconcile):
- A brand-new service, `agency-app/web/` (S3 + CloudFront static frontend hosting), added in PR #37 — was completely absent from this folder until now.
- The "Call Intelligence" feature from PR #40 (call recording transcription + AI analysis: SQS queue + DLQ, worker Lambda, ~15 new CFN parameters) — added to `server/cfn-backend.yaml`, `server/cfn-params.sample.json`, `server/deploy.sh`.
- AI-calling env var wiring from PR #39 (`AiCallingInternalApiKey`, `AiCallingServiceUrl`) — same 3 `agency-app/api/` files.

**None of this new infrastructure has been deployed to AWS yet** (confirmed via `describe-stack-resources` — no `CallRecordingQueue` resource on the live stack, and no `crm-frontend` stack exists at all). See Discrepancy 7 below.

## Layout

Wrappers mirror the service tree one level down: `infra/cicd/<group>/<name>/` deploys `<group>/<name>/`.

```
infra/cicd/                        (was cfn-templates-cicd/ until 2026-09-17; regrouped by audience the same day)
├── platform/
│   ├── auth/                      # Auth microservice (Cognito + Lambda)                 -> platform/auth
│   ├── mcp/                       # MCP server (Claude/ChatGPT integration)              -> platform/mcp
│   └── whatsapp-platform/         # Baileys WhatsApp workers on ECS Fargate              -> platform/whatsapp-platform
├── public-app/
│   ├── property-pages/            # Public tenant-branded property pages                 -> public-app/property-pages
│   ├── api/                       # Consumer marketplace API (AI search, chat, visits)   -> public-app/api
│   ├── web/                       # Consumer marketplace SPA (S3 + CloudFront)           -> public-app/web
│   └── auth/                      # Consumer auth (own Cognito pool, phone OTP + Google) -> public-app/auth
├── agency-app/
│   ├── api/                       # CRM backend + API Gateway routes + Call Intelligence -> agency-app/api
│   ├── web/                       # CRM frontend static hosting (S3 + CloudFront)        -> agency-app/web
│   ├── launch-tables/             # Grievances/Subscriptions/NPS/... tables              -> agency-app/api (launch-tables stack)
│   ├── instagram-api/             # Instagram lead service API                           -> agency-app/instagram-api
│   ├── instagram-web/             # Instagram lead console                               -> agency-app/instagram-web
│   ├── landing-pages/             # Marketing site (S3 + CloudFront)                     -> agency-app/landing-pages
│   ├── ai-calling/                # AI voice calling Lambda (Exotel + ElevenLabs)        -> agency-app/ai-calling
│   └── followup-agent/            # Follow-up agent Lambda                               -> agency-app/followup-agent
└── common-infra/                  # Shared VPC / artifact bucket template
```

Each `deploy.sh` resolves its service with `SERVICE_DIR="$(cd "$SCRIPT_DIR/../../../../<group>/<name>" && pwd)"` and the repo root with `REPO_ROOT="$SCRIPT_DIR/../../../.."`; see the comment block at the top of each script for the rest of the resolution logic. The `SERVICE_NAME` used for S3 artifact prefixes and stack names is set explicitly inside each script, so renaming a wrapper folder does not change where builds are stored. Run each script from inside its own subfolder, e.g.:

```
cd infra/cicd/agency-app/api && ./deploy.sh
cd infra/cicd/platform/whatsapp-platform && ./deploy.sh dev
```

**2026-08-28 update:** `platform/whatsapp-platform/deploy.sh` here was a standalone
duplicate of `platform/whatsapp-platform/infra/deploy.sh`, not a delegate — unlike
`platform/auth/` and `agency-app/api/`, which already followed the
"this folder holds no copies, `deploy.sh` delegates to `infra/deploy.sh`"
pattern. Reconciled to match: this folder's `cfn-platform.yaml`,
`cfn-params.example.json`, `start-service.sh`, and `stop-service.sh` are
removed (the canonical copies live only in `platform/whatsapp-platform/infra/` now),
and `deploy.sh` is rewritten as a thin wrapper with the same build/release
tracking and rollback design as auth/server — see
`infra/cicd/platform/whatsapp-platform/README.md` for the full design and the
concrete differences (ECR image, not S3 zip; no S3 object tagging; CFN-only
rollback since ECS has no code-only update path; three envs including
`staging`). The command syntax below and in the "Redeploying from this
location" table reflects the new interface.

## Stack ↔ Template Mapping

| Local template | Deployed AWS stack | Match status |
|---|---|---|
| `agency-app/api/infra/cfn-backend.yaml` | `cloudberry-dev-real-estate-agency` | ⚠️ Ahead of live stack — Call Intelligence resources (SQS queue/DLQ, worker Lambda, ~15 params) from PR #40 + #39's AI-calling params not yet deployed. See Discrepancy 7 |
| `agency-app/api/infra/apigw-explicit-routes-part1.yaml` | nested `PublicApiResourcesStack` + `CrmApiResourcesStackV2` | ✅ identical |
| `agency-app/api/infra/apigw-explicit-routes-part2.yaml` | nested `PublicApiResourcesStackPart2` + `CrmApiResourcesStackPart2` | ✅ identical |
| `agency-app/ai-calling/infra/cfn-ai-calling.yaml` | `cloudberry-dev-ai-calling-service` | ✅ identical |
| `platform/mcp/infra/cfn-backend.yaml` | `dev-realestate-flow-mcp-stack` | ✅ identical |
| `platform/auth/infra/cfn-backend.yaml` | `dev-reality-flow-auth-stack` | ✅ identical |
| `platform/auth/infra/auth-explicit-routes.yaml` | nested `ApiGatewayRoutesStack` (under `dev-reality-flow-auth-stack`) | ✅ identical |
| `platform/whatsapp-platform/infra/cfn-platform.yaml` | `dev-realestate-flow-whatsapp-platform` | ✅ identical |
| `agency-app/api/infra/launch-tables-cfn.yaml` | *(none — see Discrepancy 1)* | ❌ no live stack |
| `agency-app/api/infra/apigw-explicit-routes.yaml` | *(none directly — superseded by the part1/part2 split)* | ℹ️ source file for `split-apigw-routes.py`, not deployed on its own |
| `agency-app/web/infra/cfn-frontend.yaml` | *(none)* | ❌ no live stack — never deployed (new in PR #37, see Discrepancy 7) |

"Identical" means a full structural diff (Parameters block, Resources block, and every resource's properties, normalized through a CFN-aware YAML parser) found zero differences between the checked-in template and the template CloudFormation is currently running.

## Discrepancies Found

### 1. `launch-tables-cfn.yaml` has never successfully deployed
The only stack that ever attempted it, **`realestate-flow-tables-stacl`** (note the typo — "stacl", not "stack"), has been stuck in `ROLLBACK_COMPLETE` since **2026-06-28**.

**Root cause** (from `describe-stack-events`): the stack tried to create a DynamoDB table named `AIEmployeeProvisioning`, but that table is already owned by the `cloudberry-dev-real-estate-agency` stack (as resource `AiEmployeeProvisioningTable`). The naming collision failed that resource creation and cancelled the other 6 table creations in the same stack (`Grievances`, `Subscriptions`, `NPSResponses`, `TenantApiKeys`, `WebhookLog`, `BetaInvites`).

**Fallout:**
- `Grievances`, `Subscriptions`, `NPSResponses`, `TenantApiKeys`, `WebhookLog` **do exist** in the AWS account (confirmed via `aws dynamodb list-tables`) and are actively referenced by name from `cloudberry-dev-real-estate-agency`'s Lambda environment variables — but they are **not owned by any live CloudFormation stack**. This is unmanaged infrastructure drift, most likely created out-of-band (manually or by a stack that was later deleted).
- `BetaInvites`, the 7th table the template declares, **does not exist in AWS at all**.

**Recommendation:** decide whether `AIEmployeeProvisioningTable` should be removed from `launch-tables-cfn.yaml` (since the agency stack already owns it) or removed from `cfn-backend.yaml` (if ownership should move to the tables stack), then either import the 5 orphaned tables into a corrected stack or recreate the stack cleanly with retention in mind. Create the missing `BetaInvites` table.

### 2. A stale duplicate stack: `cloudberry-real-estate-agency`
A second live stack, `cloudberry-real-estate-agency` (no `-dev` suffix), carries the exact same template description as `cfn-backend.yaml` but was last updated **2026-01-07** — over six months stale versus the `-dev` stack's **2026-08-05** update. Nothing in this repo's params files targets it.

**Recommendation:** confirm whether this is a legacy/orphaned duplicate safe to decommission, or an intentional second environment (e.g. a pre-`-dev`-naming-convention prod stack) that should be documented and tracked going forward.

### 3. `server/cfn-params.json` is missing 5 parameters
The template and live stack both declare `RazorpayPlanAiEmployee`, `GrievancesTableName`, `SubscriptionsTableName`, `NpsResponsesTableName`, and `UserCategoriesTableName`, but the checked-in `cfn-params.json` (the deploy-time overrides file) doesn't set any of them. Currently harmless — the live values happen to equal the template defaults — but a future deploy relying solely on this file would silently fall back to defaults instead of explicit values if those ever need to diverge.

### 4. `platform/auth/cfn-params.sample.json` is stale
- **Missing** 6 parameters the live stack actually has: `TestOtpValue`, `TestOtpEnabled`, `ApiGatewayRoutesTemplateUrl`, `AllowedOrigins`, `CognitoDomainPrefixV2`, `InternalApiKey`.
- **Contains** 2 parameters that no longer exist in the template/stack: `CognitoUserPoolId`, `CognitoClientId`.

### 5. `platform/whatsapp-platform/cfn-params.example.json` is missing `SessionTableName`
Present on both the template and the live stack, absent from the example params file.

### 6. `platform/mcp/cfn-params.sample.json` is missing `FrontendUrl`
Present on both the template and the live stack, absent from the sample params file.

### 7. Merged PR #40 (and #37–#39) content is checked in but not deployed
Confirmed via `git merge-base` that this folder's source branch was a strict ancestor of `main`'s PR #40 merge commit (`f6b557e`) — i.e. 4 PRs behind with zero conflicting local edits, so everything below was pulled in as a clean superset:

- **`server/cfn-backend.yaml`** gained a whole new "Call Intelligence" section: `CallRecordingDlq` + `CallRecordingQueue` (SQS), a worker Lambda, supporting IAM policies, and ~15 new parameters (`AsrProvider`, `TranscribeLanguageOptions`, `CallIntelWorkerMemorySize`, etc. — full list in the file), plus `AiCallingInternalApiKey`/`AiCallingServiceUrl` from PR #39. **Verified via `describe-stack-resources`: `CallRecordingQueue` does not exist on the live `cloudberry-dev-real-estate-agency` stack** — this feature has never been deployed.
- **`server/cfn-params.sample.json`** and **`server/deploy.sh`** gained matching entries for all the same new parameters, plus `deploy.sh` now also refreshes a `<env>-real-estate-call-recording-worker` Lambda (if it exists) on code-only deploys, and includes `workers/` in the Lambda zip.
- **`agency-app/web/`** (S3 + CloudFront static frontend hosting — `cfn-frontend.yaml`, `deploy.sh`, `README.md`) is entirely new to this registry; it didn't exist in the source branch at all. **Verified via `list-stacks`: no `crm-frontend` stack exists in the account** — never deployed. Its deploy script had the same self-relative-path fragility as the others; the wrapper now resolves `SERVICE_DIR` to `../../../../agency-app/web`.
- `agency-app/web/package.json` on `main` wires `npm run deploy:nonprod`/`deploy:prod` to the old `infra/deploy.ps1` path — this repo's copy of `package.json` predates that PR and doesn't have the scripts yet, so there was nothing to fix here, but it will need the same path update once `main` is merged into this branch.

**Recommendation:** before running `server/deploy.sh` against the live `cloudberry-dev-real-estate-agency` stack again, be aware it will now also create the Call Intelligence SQS queues, IAM policies, and worker Lambda — review the new resources and required env vars (`AI_CALLING_INTERNAL_API_KEY`, `AI_CALLING_SERVICE_URL`, `ASR_PROVIDER`, etc.) first. Deploy `agency-app/web/cfn-frontend.yaml` separately/independently whenever frontend hosting is ready to go live.

## Live Stack Inventory (for reference)

| Stack name | Status | Last updated |
|---|---|---|
| `cloudberry-dev-real-estate-agency` | UPDATE_COMPLETE | 2026-08-05 |
| `cloudberry-dev-real-estate-agency-CrmApiResourcesStackV2-*` | UPDATE_COMPLETE | 2026-08-05 |
| `cloudberry-dev-real-estate-agency-CrmApiResourcesStackPart2-*` | CREATE_COMPLETE | — |
| `cloudberry-dev-real-estate-agency-PublicApiResourcesStack-*` | UPDATE_COMPLETE | 2026-08-05 |
| `cloudberry-dev-real-estate-agency-PublicApiResourcesStackPart2-*` | CREATE_COMPLETE | — |
| `cloudberry-dev-ai-calling-service` | UPDATE_COMPLETE | 2026-01-29 |
| `dev-realestate-flow-mcp-stack` | UPDATE_COMPLETE | 2026-06-30 |
| `dev-realestate-flow-whatsapp-platform` | UPDATE_COMPLETE | 2026-07-04 |
| `dev-reality-flow-auth-stack` | UPDATE_COMPLETE | 2026-06-22 |
| `dev-reality-flow-auth-stack-ApiGatewayRoutesStack-*` | UPDATE_COMPLETE | 2026-06-20 |
| `cloudberry-real-estate-agency` | UPDATE_COMPLETE | 2026-01-07 (stale — Discrepancy 2) |
| `realestate-flow-tables-stacl` | **ROLLBACK_COMPLETE** | — (broken — Discrepancy 1) |

## Redeploying from this location

| Service | Command | Notes |
|---|---|---|
| agency-app/api | `cd infra/cicd/agency-app/api && ./deploy.sh <dev\|prod>` | Reads `.env` from `agency-app/api/`; toggle `DEPLOY_LAMBDA`/`DEPLOY_INSTALL`/`DEPLOY_ZIP`/`DEPLOY_CFN` at top of script. Now also provisions the Call Intelligence SQS/Lambda resources — see Discrepancy 7 before running against a live stack |
| agency-app/ai-calling | `cd infra/cicd/agency-app/ai-calling && ./deploy.sh <dev\|prod>` | Packages source from `agency-app/ai-calling/` via the new `-SourceDir` param (auto-resolved); pass CLI params for secrets rather than relying on the hardcoded defaults in the script |
| agency-app/web | `cd infra/cicd/agency-app/web && ./deploy.sh <dev\|prod>` | Builds + deploys the frontend from `agency-app/web/`; reads `.env.<Environment>` there; never deployed yet — see Discrepancy 7 |
| platform/auth | `cd infra/cicd/platform/auth && ./deploy.sh <dev\|prod>` | Reads `.env` from `platform/auth/` |
| platform/mcp | `cd infra/cicd/platform/mcp && ./deploy.sh [dev\|test\|prod]` | Reads `.env` from `platform/mcp/`; supports `--skip-package` / `--skip-cfn` |
| platform/whatsapp-platform | `cd infra/cicd/platform/whatsapp-platform && ./deploy.sh [dev\|staging\|prod]` | Delegates to `platform/whatsapp-platform/infra/deploy.sh`; records a numbered build. `start\|stop\|status\|endpoint [env]` pass through without recording a build; `list`/`show`/`rollback-code`/`rollback-full` manage build history. `.generated-<env>.env` (secrets) stays in `platform/whatsapp-platform/infra/` |
| public-app/property-pages | `cd infra/cicd/public-app/property-pages && ./deploy.sh <dev\|prod>` | Delegates to `public-app/property-pages/infra/deploy.sh`; records a numbered build and invalidates CloudFront (`/*`) when the stack has a distribution. Reads `.env.<env>` from `public-app/property-pages/`; `list`/`show`/`rollback-code`/`rollback-full` manage build history |
| public-app/api | `cd infra/cicd/public-app/api && ./deploy.sh <dev\|prod>` | Delegates to `public-app/api/infra/deploy.sh`; numbered builds, CloudFront invalidation when enabled, `list`/`show`/`rollback-code`/`rollback-full` |
| public-app/web | `cd infra/cicd/public-app/web && ./deploy.sh <dev\|prod>` | Delegates to `public-app/web/infra/deploy.sh` (Vite build → S3 → CloudFront invalidation); numbered builds and rollbacks |
| public-app/auth | `cd infra/cicd/public-app/auth && ./deploy.sh <dev\|prod>` | Delegates to `public-app/auth/infra/deploy.sh`; own Cognito pool + tables; numbered builds and rollbacks |
