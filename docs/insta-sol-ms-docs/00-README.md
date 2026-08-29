# Instagram Solution — Documentation Index

Branch: `instagram-solution`. All documentation for this feature lives in this folder.

An Instagram automation and analytics system for real estate agencies. The agency owner
installs an agent on their own laptop; it talks to Meta's official Instagram APIs with
their own token, keeps a local SQLite copy of their account, reel and DM data, drafts and
sends window-safe DM replies, and pushes structured results to RealtyFlow as a
tenant-scoped feed the agency sees in a web app.

## Read in this order

| Doc | What it covers |
|---|---|
| [01-PLAN.md](01-PLAN.md) | The 14 technical modules (A1–A14), scope rules, phases, decisions |
| [02-FEATURES.md](02-FEATURES.md) | The 64-feature catalogue, grouped, with benefits and flows |
| [03-ARCHITECTURE.md](03-ARCHITECTURE.md) | **The binding contract** — auth, DynamoDB, HTTP API, SQLite, Meta endpoints, rate limits |
| [04-BACKEND-API.md](04-BACKEND-API.md) | Endpoint reference for `backend_insta_sol_ms` |
| [05-LOCAL-AGENT.md](05-LOCAL-AGENT.md) | Installing, configuring and running the laptop agent |
| [06-DEPLOYMENT.md](06-DEPLOYMENT.md) | Stacks, deploy scripts, build tracking, rollback, known gaps |
| [07-META-APP-SETUP.md](07-META-APP-SETUP.md) | Creating the Meta app in Development Mode, scopes, testers |
| [08-TESTING.md](08-TESTING.md) | What is tested, how to run it, what was verified live |
| [09-CLOUDFRONT-INTEGRATION.md](09-CLOUDFRONT-INTEGRATION.md) | Serving the app at `/insta/*` on the CRM distribution |

If you only read one, read **03-ARCHITECTURE.md**. The three codebases were built
independently against it.

## Code layout

| Folder | What |
|---|---|
| `instagram-local-agent/` | The laptop agent. Node 20 ESM, SQLite, local console on `127.0.0.1:7317` |
| `backend_insta_sol_ms/` | The microservice. Express on Lambda, API Gateway, two DynamoDB tables |
| `frontend_insta_sol_ms/` | The web app. React 18 + TS + Vite, served at `/insta/` |
| `cfn-templates-cicd/backend_insta_sol_ms/` | CI/CD wrapper with build tracking and rollback |
| `cfn-templates-cicd/frontend_insta_sol_ms/` | Same, plus per-build `dist/` archives |

## The decisions this was built on

| # | Decision | Chosen |
|---|---|---|
| D0 | Isolation | **New feature, additive only.** No changes to existing CRM flows |
| D1 | Meta app model | **Development Mode** first; move to a shared App-Reviewed app later |
| D2 | Realtime transport | Polling for now; cloud webhook relay in a later phase |
| D3 | Stack | Node/TS — JS ESM for backend and agent (matches `server/`), TS for the frontend (matches the CRM app) |
| D4 | Competitor/market data | Deferred; the interface is stubbed |
| — | CDN topology | `/insta/*` behavior on the existing CRM distribution, not a separate one |
| — | Build scope | Phases 1–3 working, Phases 4–5 stubbed |

## What "additive only" means in practice

Two existing files were touched, both minimally:

- `real-estate-crm-app/infra/cfn-frontend.yaml` — a conditional origin, OAC, SPA rewrite
  function and `/insta/*` behavior. Entirely inert unless the new parameter is set.
- `.gitignore` — patterns for the new folders' env files and build artifacts.

Plus two lines in `server/server.js` **only if** you later choose to mount the API on the
existing backend. The default deployment does not: the microservice has its own API
Gateway, so `server/` is untouched.

Not touched: `server/routes/webhooks.js` (the ManyChat Instagram lead webhook keeps
running in parallel), `AgencyConfig`, the `Leads` table, `createLead`, `notifyNewLead`,
the `lead.created` EventBridge flow, or `server/infra/cfn-backend.yaml`.

Instagram enquiries land in this feature's own table and its own page. Promoting one into
a real CRM lead is a deliberate later step, not a dependency of this work.

## The three corrections that shaped the design

1. **No Facebook Page is required.** *Instagram API with Instagram Login* (2024+)
   authenticates the professional account directly. Most Indian agents have no Page.
2. **Reading old DMs is not window-limited — only sending is.** Full thread history is
   available at any age, so the analytics ask is satisfiable on day one. The 24-hour rule
   only blocks outbound messages to a cold thread.
3. **The send window is 24h plus two extensions.** Comment private replies reach 7 days
   and are the real lead engine; `HUMAN_AGENT` also reaches 7 days but Meta restricts it
   to a human resolving an issue, so it is implemented as human-click-to-send only.
