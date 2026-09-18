# marketplace-authentication — CI/CD entry point

`deploy.sh` here delegates the packaging/CFN work to the real scripts:

```
services/marketplace-authentication/infra/deploy.sh          (full deploy)
services/marketplace-authentication/infra/config-deploy.sh   (config-only)
```

`cfn-backend.yaml`, `infra/lib/params.sh`, `config-only-allowed-params.json`
and `sample.env` all live in the service. What this wrapper adds:
**build/release tracking, S3 object tagging, and rollback.** It is the
same design as `infra/cicd/reality-flow-authentication/` minus the nested
routes template (this service has a single `{proxy+}` route in the main
template, so there is no second artifact to track).

## Running it

```
cd infra/cicd/marketplace-authentication
./deploy.sh dev                        # deploy — records a new numbered build
./deploy.sh prod
./deploy.sh list [dev|prod]            # recorded builds
./deploy.sh show 0003                  # one build's manifest.json
./deploy.sh rollback-code prod 0007    # fast: point the Lambda at old code
./deploy.sh rollback-full prod 0007    # full: redeploy that build's CFN + code

./deploy.sh config-deploy dev          # CFN params only, no build/upload
./deploy.sh list-config [dev|prod]
./deploy.sh show-config 0002
./deploy.sh rollback-config prod 0002  # reapply an old config revision's params
```

Requires `services/marketplace-authentication/.env.<env>` (copy
`sample.env`). `dev`/`prod` is mandatory — nothing runs without it, and the
service script forces `ENV`/`ENVIRONMENT_NAME` from that argument regardless
of what the file says.

## Build numbers, S3 layout, tags

One global counter across dev and prod (`deploy-versions/0001`, `0002`, …);
the env is recorded inside each manifest and rollback refuses a build that
targeted the other env. Config revisions are a separate track
(`config-versions/`), each recording `appliedToBuild` and the changed
parameters plus a full `params-snapshot.json` for `rollback-config`.

In `<env>-realestateflow-artifacts`:

```
realestateflow-marketplace-auth/function.zip                       "latest" key the Lambda reads
realestateflow-marketplace-auth/builds/<build>/<env>/cfn-backend.yaml
realestateflow-marketplace-auth/builds/<build>/<env>/cfn-params.json
realestateflow-marketplace-auth/builds/<build>/<env>/code/function.zip
```

Every object gets S3 tags `Branch`, `DeployDate`, `Status`
(`deployed|failed`), `CommitId`, applied after the delegate script returns.

## Config-only deploy

`infra/config-only-allowed-params.json` in the service is a fail-closed
allowlist: a parameter not named there cannot be changed via
`config-deploy`, and the script refuses to run if a `.env.<env>` value
differs from the live stack for a non-allowlisted key. NoEcho keys
(`GoogleClientId`, `GoogleClientSecret`, `InternalApiKey`,
`AuthCallerApiKey`) are always forwarded from the env file. Both deploy
paths compute values through `infra/lib/params.sh`, which also cross-checks
its key list against the template's `Parameters` block.

## Important values in `.env.dev` / `.env.prod`

| Variable | dev | prod | Why |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` / `_SECRET` | dev consumer client | separate prod client | Google redirect URI is bound to the Cognito domain, which differs per env |
| `LAMBDA_PACKAGES_BUCKET_NAME` | `dev-realestateflow-artifacts` | `prod-realestateflow-artifacts` | deploy.sh refuses anything else for that env |
| `TEST_OTP_ENABLED` | `true` (fixed OTP, no SMS) | **must be `false`** | deploy.sh refuses `true` in `.env.prod` |
| `MARKETPLACE_AUTH_DOMAIN_NAME` / `_BASE_PATH` | empty (placeholder) | empty until the domain exists | with `ENABLE_CUSTOM_DOMAIN_MAPPING=false` empty is allowed; a scheme or an `execute-api` host is always refused |
| `ENABLE_CUSTOM_DOMAIN_MAPPING` / `ENABLE_BASE_PATH_STRIP` | `false`/`false` | `false`/`false` for now | flip both together once the domain is mapped |
| `MARKETPLACE_API_DOMAIN_NAME` / `_BASE_PATH` / `AUTH_CALLER_API_KEY` | placeholder / matches marketplace-api's `AUTH_CALLER_API_KEY` | same | empty host means the deletion purge call is skipped (logged) |
| `INTERNAL_API_KEY` | random | different random | inbound key for `/internal/users/:id` |
| `IDENTITY_CALLBACK_URL` / `IDENTITY_LOGOUT_URL` / `ALLOWED_ORIGINS` | `localhost:5173` | marketplace-web's real origin only | managed-login redirects + CORS |
| `SUBNET_IDS` / `SECURITY_GROUP_IDS` | blank | private app subnets from `prod-realestateflow-networking-common` | only the API Lambda is VPC-placed |
