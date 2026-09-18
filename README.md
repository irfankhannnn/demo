# RealtyFlow / Cloudberry Real Estate

Full-stack real estate CRM platform (India + Dubai). See `CLAUDE.md` for the
full architecture, tech stack, and directory map.

## Repository layout

```
apps/                         product apps; a frontend and its backend share a folder
  crm/
    real-estate-crm-app/      CRM web + mobile frontend (React/Vite/Capacitor)
    server/                   CRM backend (Express on Lambda) + launch-tables stack
  instagram/
    frontend_insta_sol_ms/    Instagram lead console
    backend_insta_sol_ms/     Instagram lead API
  onboarding/                 onboarding page (web/ + server/)
  landing-pages/              marketing site (static, S3 + CloudFront)
  property-pages-ms/          public property pages (server-rendered)
  marketplace/                consumer AI property-matching portal
    marketplace-web/          buyer-facing SPA (Vite + React)
    marketplace-api/          portal API: AI search, threads, saved, visits (Express on Lambda)
services/                     standalone backend microservices
  reality-flow-authentication/
  reality-flow-mcp/
  whatsapp-platform/
  ai-calling-service/
  followup-agent-service/
infra/
  cicd/                       deploy wrappers (build tracking, rollback), one per service
docs/                         all project documentation; see docs/README.md
tests/playwright/             cross-app end-to-end tests
tools/                        dev tooling, agent skills, one-off scripts
marketing-and-sales/          marketing outputs, plans and video projects
```

Folders under `infra/cicd/` have the same names as the service folders they
deploy (`infra/cicd/server` deploys `apps/crm/server`). Each service keeps its
own `README.md`; everything else that is documentation lives in `docs/`.

Checkouts that existed before the 2026-09-17 reorganisation still have their
local-only files (`.env.<env>`, `deploy-versions/`, `auth_state/`,
`node_modules/`) in the old top-level folders. Move them with
`bash tools/scripts/migrate-local-files.sh` (dry run) and then `--apply`.

## `.gitignore` best practices for this repo

A few rules this repo has already been burned by, worth keeping in mind
whenever a new service, script, or deploy folder is added:

**A bare filename only matches that exact name.** `.env` in `.gitignore`
does **not** match `.env.dev`, `.env.prod`, or `.env.local` — each of those
is a different filename. If a service gains per-environment env files
(`.env.<env>` convention — see `apps/crm/server/`, `services/reality-flow-authentication/`),
its `.gitignore` needs an explicit `.env.*` pattern (with a `!.env.sample`
/ `!sample.env` exception for the checked-in template), not just `.env`.
This repo shipped with exactly that gap once already.

**Secrets never go in git, even "temporarily."** Real AWS keys, API keys,
Cognito/OAuth client secrets, and internal service tokens live only in
`.env.<env>` files, never in a template, a script, or a committed config.
`.env.sample` / `sample.env` files are the checked-in reference — they hold
placeholder values only.

**CI/CD build/release directories are local caches, not source.** A
`deploy-versions/` (or similar) folder that records build numbers, git
commit metadata, and template/param snapshots per deploy is genuinely
useful — but it's a per-machine deploy log, not project source, and it can
grow unbounded. Durable, shareable history for actual deployed artifacts
belongs in a versioned S3 bucket (see
`infra/cicd/common-infra/vpc-networking.yaml`'s `ArtifactBucket`),
not in git. Gitignore the whole directory at its own level
(`infra/cicd/<service>/.gitignore`) **and** add a repo-root
backstop pattern (see the root `.gitignore`'s CI/CD section) — a
service-local `.gitignore` protects that one service; the root pattern
protects any future service that copies the same convention.

**Auto-generated deploy artifacts aren't source either.** `cfn-params.json`
(regenerated fresh from `.env.<env>` on every `deploy.sh` run) and
`function.zip` (a packaging build artifact) are already gitignored —
don't hand-edit or commit either; treat them as build output.

**After a broad `git add`, check what actually got staged.** `git status`
before committing, especially after adding a new directory — a filename
that "looks like" a secret (`*-key*.json`, `*-credentials*`, `*-env*.json`)
is worth a second look even if it wasn't the file you meant to touch.
