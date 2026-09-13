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
2. **Frontend env files held raw invoke URLs** (`frontend_insta_sol_ms/.env.dev`, `real-estate-crm-app/.env.dev`,
   and `real-estate-crm-app/.env.prod` for auth). Dev had `ENABLE_CUSTOM_DOMAIN_MAPPING=false` for auth and insta, so
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

## Pending (low priority)

1. **reality-flow-mcp readiness gaps (blocks its deploy).** Until MCP is deployed, dev server and the CRM AI
   Integrations page point at `devrealestatemcp`, which does not exist yet, so MCP features are broken in dev.
   Gaps from the audit:
   - Resource names are service-first (`realestateflow-mcp-dev-*`); flipping to env-first replaces the Lambda and
     the REST API (new API id). Claude Desktop connectors must be re-added afterwards.
   - `infra/deploy.sh` does not validate the env argument and has no stack-name prefix guard.
   - Single `.env` for all environments; needs `.env.dev` / `.env.prod`.
   - The wrapper `cfn-templates-cicd/reality-flow-mcp/deploy.sh` is a bare `exec`: no build counter, S3 tagging or
     `rollback-code` / `rollback-full`.
   - `OAuthCodesTable` / `OAuthConnectionsTable` lack Retain and point-in-time recovery.
   - `.gitignore` lacks `.env.*.local`; `PARAM_OVERRIDES` and `DESIRED` param lists are duplicated.
2. **MCP OAuth discovery is broken on API Gateway regardless of base path.** API Gateway renames `WWW-Authenticate`
   to `x-amzn-Remapped-www-authenticate`, and RFC 8414 root-level `/.well-known/oauth-authorization-server/...`
   returns 403. Unpatched `mcp-remote` and claude.ai connectors fail (the team uses `patch_mcp_remote.py`).
   Recommended fix: dedicated host `mcp.cloudberrysolutions.in` / `mcp.realestateflow.in` with an empty base path
   mapping (needs ACM cert + DNS and an exception to the non-empty base path rule).
3. **CRM mobile apps.** `real-estate-crm-app/.env.mobile:29-30` uses base path `realestatecrm`, which is not mapped
   on either domain, and its auth vars are placeholders. The Android and iOS bundles still contain an old raw MCP
   URL; rebuild with `npm run mobile:build`.
4. **Existing bug in the CRM app.** `real-estate-crm-app/src/services/api.ts:2491-2558` builds
   `${API_BASE_URL}/api/whatsapp/...`, producing `/api/api/whatsapp`.
5. **Dev CRM Lambda has no adapter API key**, so insta enquiry promotion to leads returns
   "Adapter intake not configured" in dev.
6. **server test failures unrelated to this work:** 8 suites need `AWS_SES_FROM_EMAIL` set to load, and
   `services/embeddings/embeddings.test.js` has 8 failing tests covering an uncommitted `propertySearchService.js` change.
7. **whatsapp-platform:** `server/.env.dev` and `.env.prod` set `BAILEY_API_ENDPOINT=http://localhost:3003`, which the
   cloud CRM cannot reach.
8. **Stale docs** still show raw URLs or old var names: `AGENTS.md:521-693`, `OAUTH_MCP_INTEGRATION_ANALYSIS.md`,
   `docs/insta-sol-ms-docs/04-BACKEND-API.md`, `06-DEPLOYMENT.md`, `08-TESTING.md`,
   `docs/proposals/.../04-backend-deployment-runbook.md`, `cfn-templates-cicd/README.md:56,94`,
   `real-estate-crm-app/QUICKSTART.md`, `SETUP.md`, `SECURITY_AUDIT.md`.
9. **Rollback caution.** Archived builds under `cfn-templates-cicd/*/deploy-versions/*` use the old raw-URL params.
   `rollback-full` to a build from before 2026-09-14 brings the raw URLs back; roll forward instead.
10. **Local laptop agents** (`instagram-local-agent`): existing `~/.ig-agent/config.json` files must change
    `cloud.baseUrl` to `cloud.domainName` + `cloud.basePath`.
11. **Prod rollout.** Deploy the same changes to prod once dev is verified (auth, insta, server, pages, CRM web), and
    add prod MCP/pages stacks when they exist.
12. **Commit.** Nothing from this work is committed yet.
