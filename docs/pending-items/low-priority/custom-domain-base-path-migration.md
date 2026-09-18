# Custom domain + base path migration: state and pending work

Last updated: 2026-09-14. Branch: `feat/property-pages-ms` (all changes uncommitted).

## Why this exists

`https://app.realestateflow.in/insta/devices` showed "Cannot reach the Instagram service", and the CRM
Assistant (`/crm`) was calling `https://see5j61tuh.execute-api.ap-south-1.amazonaws.com/dev/api/crm/agent-chat`.
Every frontend and most service-to-service calls used raw API Gateway invoke URLs.

Rule agreed on 2026-09-14: nothing may call or publish a raw `https://<id>.execute-api.<region>.amazonaws.com/<stage>`
URL. Every API is reached through the environment's custom domain plus a base path mapping defined in CloudFormation,
enabled in dev as well as prod.

## Root causes found

1. **`app.realestateflow.in` is the dev stack.** CloudFront `E1I7OL5ISBMIBV` lives in `cloudberry-main`
   (730335176275) because the prod account (532404260898) cannot create CloudFront distributions yet. Decision: the
   dev frontends call the nonprod domain `services-api.cloudberrysolutions.in`.
2. **Frontend env files held raw invoke URLs** (`agency-app/instagram-web/.env.dev`, `agency-app/web/.env.dev`,
   and `agency-app/web/.env.prod` for auth). Dev had `ENABLE_CUSTOM_DOMAIN_MAPPING=false` for auth and insta, so
   no dev mapping existed.
3. **Insta 401 on OPTIONS.** The dev `ALLOWED_ORIGINS` was only `http://localhost:5173`. With cors@2.8.x, a
   disallowed origin makes the middleware call `next()` without answering the preflight, so OPTIONS fell into JWT auth
   and returned 401 with no CORS headers. API Gateway was not involved (no authorizer, no WAF).
4. **Insta DynamoDB is empty** in both `dev-realestateflow-insta-data` and `prod-realestateflow-insta-data`
   (0 items). Decision: do not seed; pair a real laptop.

## Conventions now in place

| Env  | Domain                                | AWS profile           |
|------|---------------------------------------|-----------------------|
| dev  | `services-api.cloudberrysolutions.in` | `cloudberry-main`     |
| prod | `services-api.realestateflow.in`      | `cloudberry-prod-new` |

| API                         | Dev base path          | Prod base path          |
|-----------------------------|------------------------|-------------------------|
| server public API           | `devrealestateagency`  | `prodrealestateagency`  |
| server CRM API              | `devrealestatecrm`     | `prodrealestatecrm`     |
| reality-flow-authentication | `devrealestateauth`    | `prodrealestateauth`    |
| backend_insta_sol_ms        | `devrealestateinsta`   | `prodrealestateinsta`   |
| reality-flow-mcp            | `devrealestatemcp`     | `prodrealestatemcp`     |
| property-pages-ms           | `devrealestatepages`   | `prodrealestatepages`   |
| ai-calling-service          | `devrealestateagencyai` | `prodrealestateagencyai` (existing value kept) |

- Config is always a pair, never a URL. Backend: `<STEM>_DOMAIN_NAME` + `<STEM>_BASE_PATH`
  (e.g. `AUTH_SERVICE_URL` became `AUTH_SERVICE_DOMAIN_NAME` / `AUTH_SERVICE_BASE_PATH`). Frontend:
  `VITE_<X>_API_DOMAIN_NAME` + `VITE_<X>_API_BASE_PATH`.
- One config module per app builds the URL (`buildServiceBaseUrl`) and throws on an execute-api host. App prefixes
  such as `/api`, `/api/insta` and `/mcp` are added in code, never in env values.
- Deploy scripts reject an empty domain, a domain containing `://`, or an execute-api value.
- Each API-owning template has an `AWS::ApiGateway::BasePathMapping` gated on `EnableCustomDomainMapping`, and its
  Lambda strips its own base path (`ENABLE_BASE_PATH_STRIP`), because AWS_PROXY does not strip it.
- `.claude/agents/cfn-readiness-auditor.md` check 7 now fails a deploy if the mapping is switched off or any raw
  execute-api URL is found.

## Deploy status (dev)

| Service                     | Code done | Dev deploy | Notes |
|-----------------------------|-----------|------------|-------|
| reality-flow-authentication | yes | **deployed, build 0014** | `devrealestateauth` live; `/health` 200 |
| backend_insta_sol_ms        | yes | **deployed, build 0006** | `devrealestateinsta` live; preflight from app origin 204 with CORS |
| server                      | yes | **not deployed** | audit cut off by usage limit; re-run gate, then full `./deploy.sh dev` (config-deploy refuses: new params) |
| property-pages-ms           | yes | **not deployed** | audit cut off; CloudFront origin moves to custom domain; check mapping-before-origin ordering |
| frontend_insta_sol_ms       | yes | **not deployed** | audit cut off; live site still calls raw `xjmtq7jke4` URL until this deploys |
| real-estate-crm-app (web)   | yes | **not deployed** | audit cut off; deploy with `content-deploy dev` |

**Resume here:** run `/cfn-cicd-deploy <service> dev` for server, property-pages-ms, frontend_insta_sol_ms and
real-estate-crm-app (they are independent; all mappings they need except MCP are live). Then open
`https://app.realestateflow.in/insta/devices` and `/crm` with DevTools Network and confirm every request goes to
`services-api.cloudberrysolutions.in/<basePath>/...`. Until the insta frontend deploys, the live page still fails:
the old bundle calls the raw URL, whose preflight now passes, but `/api/insta/*` without the base path still works
there, so it may partly load. Verify rather than assume.
| reality-flow-mcp            | yes | **skipped (user decision)** | failed readiness gate on pre-existing gaps, see below |
| ai-calling-service          | yes | not deployable | no dev stack; blocked on Exotel ticket DCA20260909838392 |
| whatsapp-platform           | n/a | n/a | ECS Fargate, no API Gateway, no raw URLs |
| onboarding-page, landing-pages | n/a | n/a | no API base URLs |

No prod deploys were made. Prod env files were updated to the new shape and will apply on the next prod deploy.

## Working agreement (2026-09-14)

Build and test locally together → Kalim approves → commit to `main` → CI/CD pipeline from `main` deploys to dev →
re-test on `https://app.realestateflow.in` (dev). No more `deploy.sh` runs from a local dirty tree. The main-branch
pipeline does not exist yet and has to be built.

Later dev deploys on 2026-09-14: `frontend_insta_sol_ms` build 0004 (verified live: `/insta/devices` calls
`devrealestateinsta`, shows the empty state), `property-pages-ms` build 0005 (`devrealestatepages` live, `/health` 200;
`.env.dev` had gone missing and was rebuilt from build 0004's params, `.env.prod` created from sample with blank
secrets). CRM frontend content-deploy build 0010 **failed** (npm EPERM on esbuild.exe held by a local vite server; the
failed `npm ci` wiped node_modules, restored since) so the live `/crm` still calls raw URLs. `server` not deployed:
gate flags `DEMO_TENANT_ID=DEMO_YOUR_TENANT` (`agency-app/api/.env.dev:180`), awaiting Kalim's real value; the audit also
noticed plaintext AWS keys at `agency-app/api/.env.dev:176-177`.

## Onboarding / choose-plan work (local only, uncommitted, awaiting review)

Why new agencies never saw onboarding or pricing:
1. Auth race: `ProtectedRoute` bounced freshly logged-in users to `/login` because `auth-changed` re-ran `initAuth`
   without entering `loading`; Google signups never set the onboarding flag, so `/auth/me` 404 logged them out.
2. No plans step after `RegisterAdmin`; `?plan=` from the marketing site was ignored.
3. "Buy" in `PaywallModal` passes a plan name as a Razorpay `subscription_id`; no server route creates Razorpay
   subscriptions. `apps/onboarding/` was a local operator tool (deleted in the 2026-09-17 regroup), not the user flow.

Changes in `real-estate-crm-app` (local): `App.tsx` (loading on auth-changed unless already authenticated; tenant-less
onboarding users redirected to `/onboarding/role-selection`; new `/onboarding/choose-plan` route),
`pages/AuthCallback.tsx` (sets onboarding flag for new Google users), `pages/RegisterAdmin.tsx` (clears flag, goes to
choose-plan), `pages/PhoneLogin.tsx` (stores `?plan=`), new `pages/onboarding/ChoosePlan.tsx` (tiers, monthly/annual,
Buy shows "payment coming soon", Start 14-day free trial calls trial-status then dashboard), new `lib/plans.ts` (tiers
shared with `PaywallModal`), `SubscriptionContext` refetch typed as a promise, two analytics event names.
Next after approval: Razorpay checkout (server route + Razorpay test plans) to make Buy real.

## Pending (low priority)

1. **reality-flow-mcp readiness gaps (blocks its deploy).** Until MCP is deployed, dev server and the CRM AI
   Integrations page point at `devrealestatemcp`, which does not exist yet, so MCP features are broken in dev.
   Gaps from the audit:
   - Resource names are service-first (`realestateflow-mcp-dev-*`); flipping to env-first replaces the Lambda and
     the REST API (new API id). Claude Desktop connectors must be re-added afterwards.
   - `infra/deploy.sh` does not validate the env argument and has no stack-name prefix guard.
   - Single `.env` for all environments; needs `.env.dev` / `.env.prod`.
   - The wrapper `infra/cicd/platform/mcp/deploy.sh` is a bare `exec`: no build counter, S3 tagging or
     `rollback-code` / `rollback-full`.
   - `OAuthCodesTable` / `OAuthConnectionsTable` lack Retain and point-in-time recovery.
   - `.gitignore` lacks `.env.*.local`; `PARAM_OVERRIDES` and `DESIRED` param lists are duplicated.
2. **MCP OAuth discovery is broken on API Gateway regardless of base path.** API Gateway renames `WWW-Authenticate`
   to `x-amzn-Remapped-www-authenticate`, and RFC 8414 root-level `/.well-known/oauth-authorization-server/...`
   returns 403. Unpatched `mcp-remote` and claude.ai connectors fail (the team uses `tools/mcp-oauth-debug/patch_mcp_remote.py`).
   Recommended fix: dedicated host `mcp.cloudberrysolutions.in` / `mcp.realestateflow.in` with an empty base path
   mapping (needs ACM cert + DNS and an exception to the non-empty base path rule).
3. **CRM mobile apps.** `agency-app/web/.env.mobile:29-30` uses base path `realestatecrm`, which is not mapped
   on either domain, and its auth vars are placeholders. The Android and iOS bundles still contain an old raw MCP
   URL; rebuild with `npm run mobile:build`.
4. **Existing bug in the CRM app.** `agency-app/web/src/services/api.ts:2491-2558` builds
   `${API_BASE_URL}/api/whatsapp/...`, producing `/api/api/whatsapp`.
5. **Dev CRM Lambda has no adapter API key**, so insta enquiry promotion to leads returns
   "Adapter intake not configured" in dev.
6. **server test failures unrelated to this work:** 8 suites need `AWS_SES_FROM_EMAIL` set to load, and
   `services/embeddings/embeddings.test.js` has 8 failing tests covering an uncommitted `propertySearchService.js` change.
7. **whatsapp-platform:** `agency-app/api/.env.dev` and `.env.prod` set `BAILEY_API_ENDPOINT=http://localhost:3003`, which the
   cloud CRM cannot reach.
8. **Stale docs** still show raw URLs or old var names: `AGENTS.md:521-693`, `docs/platform/mcp/OAUTH_MCP_INTEGRATION_ANALYSIS.md`,
   `docs/agency-app/instagram/04-BACKEND-API.md`, `06-DEPLOYMENT.md`, `08-TESTING.md`,
   `docs/proposals/.../04-backend-deployment-runbook.md`, `infra/cicd/README.md:56,94`,
   `docs/agency-app/web/QUICKSTART.md`, `SETUP.md`, `SECURITY_AUDIT.md`.
9. **Rollback caution.** Archived builds under `infra/cicd/*/deploy-versions/*` use the old raw-URL params.
   `rollback-full` to a build from before 2026-09-14 brings the raw URLs back; roll forward instead.
10. **Local laptop agents** (`instagram-local-agent`): existing `~/.ig-agent/config.json` files must change
    `cloud.baseUrl` to `cloud.domainName` + `cloud.basePath`.
11. **Prod rollout.** Deploy the same changes to prod once dev is verified (auth, insta, server, pages, CRM web), and
    add prod MCP/pages stacks when they exist.
12. **Commit.** Nothing from this work is committed yet.
