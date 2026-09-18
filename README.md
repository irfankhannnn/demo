# RealtyFlow / Cloudberry Real Estate

Full-stack real estate CRM platform (India + Dubai). See `CLAUDE.md` for the
full architecture, tech stack, and directory map.

## Repository layout

Grouped by audience. A folder is a deployable unit; `infra/cicd/` and `docs/`
mirror the same paths.

```
platform/                     shared foundation ("common")
  auth/                       Cognito auth service (Express on Lambda)
  mcp/                        MCP server for external AI clients (OAuth2)
  whatsapp-platform/          Baileys WhatsApp workers (ECS Fargate)
  contracts/                  event JSON schemas + API contracts (shared by every unit)
  gateway/                    API Gateway layout by audience (design, target state)
  events/                     EventBridge bus, rules, DLQs (design, target state)
public-app/                   consumer marketplace
  property-pages/             public tenant-branded property pages (server-rendered)
  web/                        consumer marketplace SPA (Vite + React)
  api/                        marketplace API: AI search, chat threads, saved, visits (Express on Lambda)
  auth/                       consumer auth: own Cognito pool, phone OTP + Google (Express on Lambda)
agency-app/                   agency owners and agents
  web/                        CRM web + mobile frontend (React/Vite/Capacitor)
  api/                        CRM backend (Express on Lambda) + launch-tables stack
  instagram-web/, instagram-api/   Instagram lead console + API
  ai-calling/                 AI voice calling (Exotel + ElevenLabs)
  followup-agent/             follow-up agent (API + event worker)
  landing-pages/              marketing site for the agency product (static)
infra/
  cicd/<group>/<name>/        deploy wrapper (build tracking, rollback) per unit
  cicd/common-infra/          shared VPC / artifact bucket
docs/<group>/<name>/          design notes per unit; see docs/README.md
tests/playwright/             cross-app end-to-end tests
tools/                        dev tooling, agent skills, one-off scripts
marketing-and-sales/          marketing outputs, plans and video projects
```

Three rules hold the boundaries:

1. **Own your tables.** Every DynamoDB table has one owning unit; no other unit
   holds its name in an env var or an IAM policy.
2. **Sync reads go through the gateway.** Units call each other through the
   API Gateway custom domain, never a raw execute-api URL.
3. **Cross-product data flows as events.** Anything `public-app` needs from
   `agency-app` arrives as an event whose schema lives in
   `platform/contracts/events/`, and the consumer keeps its own read copy.

Each unit keeps its own `README.md`; everything else that is documentation
lives in `docs/`.

Checkouts from before the 2026-09-17 reorganisations still have their
local-only files (`.env.<env>`, `deploy-versions/`, `auth_state/`,
`node_modules/`) in the old folders. Move them with
`bash tools/scripts/migrate-local-files.sh` (dry run) and then `--apply`.

## `.gitignore` best practices for this repo

A few rules this repo has already been burned by, worth keeping in mind
whenever a new service, script, or deploy folder is added:

**A bare filename only matches that exact name.** `.env` in `.gitignore`
does **not** match `.env.dev`, `.env.prod`, or `.env.local` — each of those
is a different filename. If a service gains per-environment env files
(`.env.<env>` convention — see `agency-app/api/`, `platform/auth/`),
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
