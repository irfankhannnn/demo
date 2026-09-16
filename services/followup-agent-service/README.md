# followup-agent-service

Schedules, retries and escalates AI follow-up calls for the RealtyFlow CRM.

It does not talk to a phone itself. It decides **when** to call and **what to do
with the outcome**; `ai-calling-service` places the call through ElevenLabs +
Exotel, and the CRM (`apps/crm/server/`) owns leads, meetings, notifications and tenant
settings.

## What it does

| Trigger | Job | Agent goal |
|---|---|---|
| CRM `lead.created` with a `followUp` hint (Instagram DM asked for a call / agreed a meeting), the CRM "Schedule AI follow-up" button, or, if the tenant opts in, any new Instagram lead with a phone | `site_visit_confirmation` | Confirm the site-visit slot, answer questions from live CRM inventory |
| CRM `meeting.completed` for a `site_visit` meeting | `post_visit_feedback` (default 2 h later) | Ask about the visited property, issues, open questions, token timeline |

Each job: `scheduled -> calling -> done | needs_human`, or `-> not reached ->
scheduled (retry) -> escalated`. Up to 2 attempts, 45 minutes apart, inside the
tenant's business hours. Escalations (max attempts, customer asked for a human,
open issues from feedback) go to the lead's assignee and the agency admins via
the CRM (in-app + email + WhatsApp best-effort) with a lead note.

Full contracts: [docs/CONTRACTS.md](../../docs/services/followup-agent-service/CONTRACTS.md). Design and findings:
[docs/APPROVAL-PLAN.md](../../docs/services/followup-agent-service/APPROVAL-PLAN.md). Deploy order and ElevenLabs
dashboard steps: [docs/RUNBOOK.md](../../docs/services/followup-agent-service/RUNBOOK.md).

## Layout

```
src/
  lambda-api.js         API Gateway entry (Express via serverless-http)
  lambda-worker.js      EventBridge entry (schedule tick + event rules)
  server.js             Express app
  routes/jobs.js        POST/GET /api/followup/jobs, cancel, run-now
  handlers/worker.js    routes one invocation to tick / event handler
  handlers/eventHandlers.js   lead.created, meeting.completed/cancelled, call.ended
  domain/jobEngine.js   schedule, dispatch, classify, retry, escalate, watchdog
  services/dynamodbService.js jobs + attempts + dedupe guards (single table)
  services/crmApiService.js   snapshot / escalations / notes
  services/callingApiService.js  ai-calling-service /calls/start
  utils/time.js         business-hours window in the tenant's timezone
infra/
  cfn-followup.yaml     table, secret, 2 Lambdas, DLQ, 4 EventBridge rules, API
  deploy.sh             full deploy (tests -> zip -> S3 -> params -> cfn deploy)
  config-deploy.sh      parameter-only deploy (allowlisted)
```

## Auth model

- CRM -> this service: `x-api-key: CRM_CALLER_API_KEY` + `x-tenant-id` (tenant-crossing credential; CRM server-side only).
- This service -> CRM: `CRM_INTERNAL_API_KEY` (== CRM's `FOLLOWUP_INTERNAL_API_KEY`).
- This service -> ai-calling-service: `AI_CALLING_CALLER_API_KEY` (== that service's `CRM_CALLER_API_KEY`).

Secrets are NoEcho CloudFormation parameters that populate one Secrets Manager
secret; the Lambdas hydrate `process.env` from it at cold start.

## Local

```bash
cp .env.example .env   # fill CRM / ai-calling values (a dev stack works)
npm install
npm test
npm start              # http://localhost:3004/api/health
```

Manual tick: `curl -X POST` is not needed; invoke the worker Lambda with
`{"action":"tick"}` or wait for the 5-minute schedule.

## Deploy

```bash
cp .env.example .env.dev   # fill in
npm run deploy:dev         # via infra/cicd/followup-agent-service/deploy.sh
```
