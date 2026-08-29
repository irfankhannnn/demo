# WhatsApp Platform — CI/CD entry point

This folder does not hold its own copy of the CloudFormation template or
params. `deploy.sh` here delegates the actual build/packaging/CFN work to the
real script:

```
whatsapp-platform/infra/deploy.sh
```

Everything — `cfn-platform.yaml`, `cfn-params.example.json`, the Docker
build, the ECR push, VPC auto-detection, secret generation, and the
`aws cloudformation deploy` call itself — lives there now. What this wrapper
adds on top: **build/release tracking and rollback.**

## Running it

```
cd cfn-templates-cicd/whatsapp-platform
./deploy.sh dev                        # deploy — records a new numbered build
./deploy.sh staging
./deploy.sh prod
./deploy.sh list                       # list every recorded build (any env)
./deploy.sh list prod                  # list only prod builds
./deploy.sh show 0003                  # print one build's manifest.json
./deploy.sh rollback-code prod 0007    # fast: redeploy pinned to that build's image
./deploy.sh rollback-full prod 0007    # full: redeploy that build's CFN template + params
./deploy.sh start prod                 # ECS desired count = 1 (no build recorded)
./deploy.sh stop prod                  # ECS desired count = 0 (no build recorded)
./deploy.sh status prod                # current task counts (no build recorded)
./deploy.sh endpoint prod              # current task public IP (no build recorded)
```

`dev`/`staging`/`prod` is required for a deploy — the script refuses to run
without it. `start`/`stop`/`status`/`endpoint` are pure ECS service control:
they don't change what image or template is deployed, so they pass straight
through to `infra/deploy.sh` without recording a build.

## Why this looks different from `reality-flow-authentication`/`server`

Those two are Lambda services deploying a zip through S3. This one is a
Docker/ECS/Fargate service deploying an image through ECR. Same design
philosophy (delegate to `infra/deploy.sh`, global build counter, a rollback
is a new forward build, never an edit to history), three concrete
differences:

1. **No S3 code artifact.** The "code" is a Docker image in ECR. Every
   deploy is pushed under a unique, immutable tag — git short SHA + UTC
   timestamp, e.g. `a1b2c3d-20260828143012` — never a floating `latest`.
   That tag is computed inside `infra/deploy.sh`, at a point this wrapper
   can't independently reconstruct, so — exactly like `server/deploy.sh`
   does for its timestamped S3 key — `infra/deploy.sh` writes the exact
   identity it resolved to `infra/.last-deploy-artifacts.json` (gitignored,
   a build artifact) right after resolving it, and this wrapper reads that
   file back to build the manifest.
2. **No S3 object tagging.** ECR has no per-image equivalent of S3 object
   tags (only whole-repository resource tags), so there's no `Branch` /
   `DeployDate` / `Status` / `CommitId` tagging step here — the immutable
   image tag itself is the historical marker, the same way server's
   timestamped S3 key needs no additional versioning to stay unique and
   addressable.
3. **No Lambda-style code-only rollback.** ECS/Fargate task definitions are
   CloudFormation-managed, so there's no `update-function-code` equivalent.
   Both `rollback-code` and `rollback-full` go through
   `aws cloudformation deploy`; `rollback-code` is still the fast path — it
   just skips the docker build/push step via `infra/deploy.sh`'s own
   `SKIP_BUILD=true` + `IMAGE_TAG=<old tag>` support, pinning the task
   definition at the already-pushed old image instead of building a new one.

One more difference worth calling out even though it isn't CI/CD-specific:
this service also supports a third environment, `staging`, not just
`dev`/`prod`.

**`dev`'s stack name is a deliberate historical exception.** Every other
service in this account uses `${env}-realestateflow-*`; this service's live
dev stack (`dev-realestate-flow-whatsapp-platform`, hyphenated, deployed
2026-07-04) predates that convention. Changing the name formula for `dev`
would target a stack that doesn't exist instead of updating the running
one, so `dev` keeps its literal old name — `staging`/`prod` (no live stack
yet, as of this writing) use the corrected convention from the start. See
`stack_name_for_env()` in `deploy.sh` and the matching comment in
`infra/deploy.sh`.

**`whatsapp-platform` has no ALB** — the ECS task gets a direct public IP
(`AssignPublicIp: ENABLED`) on port 3003, gated only by the
`DirectIngressCidr` CFN parameter (`DIRECT_INGRESS_CIDR` env var). This
means the subnets it's placed in must actually route to an Internet
Gateway — the CFN parameter is misleadingly named `PrivateSubnetIds`, but
for prod it's fed `prod-realestateflow-networking-common`'s
**`PublicSubnetIds`** output, not `PrivateAppSubnetIds` (the latter has no
IGW route and would leave the task unreachable). `infra/deploy.sh` also
now hard-refuses to deploy any non-`dev` env with `DIRECT_INGRESS_CIDR`
unset or `0.0.0.0/0` — there's no ALB/TLS in front of this service, so that
CIDR is the only thing standing between port 3003 and the internet.

## Build numbers are global, not per-environment

One counter across dev, staging, **and** prod — build #7 is unambiguous by
itself. Which env a build targeted is recorded *inside* it
(`manifest.json`'s `env` field), not implied by which counter produced it.
`rollback-code`/`rollback-full` double-check this: if you ask to roll back
`prod` using a build that was actually a `dev` build, they refuse rather
than silently touching the wrong environment.

## Build/release tracking (`deploy-versions/`)

Every deploy records locally under `deploy-versions/<build>/` (gitignored —
see the root `.gitignore`). Unlike auth/server, there is **no separate
durable S3 archive** backing this up — ECR already gives the image itself
permanent, addressable storage under its immutable tag, and the CFN
template/params have no equivalent AWS-side archive here, so this local
snapshot is the *only* historical copy. Never delete `deploy-versions/` if
you might need `rollback-full` later.

- `manifest.json` — build number, env, status, UTC timestamp, git
  commit/branch/dirty-flag, deployer, the CFN stack name, and the ECR
  repo/image tag/URI/digest that build deployed.
- `cfn-platform.yaml`, `cfn-params-<env>.json` — local snapshots of the
  exact template + params used, so `rollback-full` never depends on
  reconstructing them from anything else.

A **failed** deploy is still recorded (status `failed`) — worth keeping for
debugging, never a valid rollback target.

`deploy-versions/LATEST` holds the current global build number;
`deploy-versions/history.jsonl` is an append-only, one-line-per-build log of
every manifest ever written, across all three envs.

## Rollback

**`rollback-code <env> <build>`** — the fast path. Re-invokes
`infra/deploy.sh` with `SKIP_BUILD=true IMAGE_TAG=<that build's tag>`, so it
skips the docker build/push and every other regenerable step, and just runs
`aws cloudformation deploy` with `ContainerImageUri` pinned at the old,
already-in-ECR image. Fails fast if that build has no recorded image tag, or
if the tag somehow isn't in ECR any more.

**`rollback-full <env> <build>`** — redeploys that build's saved CFN
template + params directly (a normal `aws cloudformation deploy`, using the
local snapshot). Since that params snapshot's `ContainerImageUri` already
points at the same build's exact image, one CFN deploy restores both the
infrastructure and the code — there's no separate code-rollback step
afterward the way auth/server's `rollback-full` needs one.

Either way, a rollback is recorded as **a new build**, tagged
`rollbackOf: "<original build>"` — a rollback is a new forward release, not
an edit to history.

## What the env argument actually does

There is **one CloudFormation template** (`cfn-platform.yaml`), used
unchanged for `dev`/`staging`/`prod` — only the *parameter values* passed
into it differ, and `infra/deploy.sh` builds those fresh every run from
`.env`, `infra/.generated-<env>.env`, and per-env task-sizing defaults (see
`infra/deploy.sh`'s own header comment). It deploys against
`STACK_NAME = ${env}-realestate-flow-whatsapp-platform` — three distinct
stacks; a `prod` run never touches dev's or staging's resources.

Note this service does **not** use a `.env.dev` / `.env.prod` split like
auth/server — it uses a single `whatsapp-platform/.env` for shared config
plus a per-env `infra/.generated-<env>.env` (gitignored) for the
auto-generated secrets and auto-detected VPC/subnet values each environment
actually ends up with. That's the existing, working convention for this
service and this reconciliation didn't change it — see
`whatsapp-platform/README.md` for the full picture.
