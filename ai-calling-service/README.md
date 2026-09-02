# AI Calling Service

Multi-tenant AI voice calling agent for the Real Estate CRM. Places outbound
calls to leads through **ElevenLabs' native Exotel integration** and lets the
agent pull live CRM data mid-conversation through server tools.

## Architecture

```
                       ┌─────────────────────────┐
                       │      CRM Frontend       │
                       │   (AI Calling module)   │
                       └────────────┬────────────┘
                                    │ POST /api/ai-calling/calls/start
                                    ▼
                       ┌─────────────────────────┐
                       │   AI Calling Lambda     │
                       │  - call orchestration   │
                       │  - server tools         │
                       │  - webhook verification │
                       └────────────┬────────────┘
                                    │ POST /v1/convai/exotel/outbound-call
                                    ▼
                       ┌─────────────────────────┐
                       │       ElevenLabs        │
                       │   Agents Platform       │
                       └────────────┬────────────┘
                                    │ dials + bridges audio
                                    ▼
                       ┌─────────────────────────┐
                       │   Exotel  →  customer   │
                       └─────────────────────────┘

   mid-call, the agent calls back in for data:
      ElevenLabs ──► POST /api/ai-calling/tools/*        (SERVER_TOOL_API_KEY)
                        └─► CRM internal API / Bedrock knowledge base

   after the call:
      ElevenLabs ──► POST /webhooks/elevenlabs/post-call (HMAC verified)
      Exotel     ──► POST /webhooks/exotel/status        (IP allowlisted)
```

**One ElevenLabs request places the call and bridges the audio.** There is no
separate dial step and no audio bridge for this service to maintain. An earlier
version of this service created an ElevenLabs conversation and dialled via
Exotel's `/Calls/connect.json` as two independent operations that were never
connected to each other — the customer's phone rang but no audio ever reached
the agent. That is what the native integration replaces.

## Call flow

1. **CRM starts a call** → `POST /api/ai-calling/calls/start`
2. **Input is validated up front** — phone normalized to E.164, agent config
   resolved. Bad input returns 400 before anything external is touched.
3. **Session is created** in DynamoDB, scoped `TENANT#{tenantId}#CALL#{id}`
4. **Lead context is fetched** from the CRM (best-effort — a CRM hiccup
   degrades the agent's background, it doesn't block the call)
5. **One request to ElevenLabs** dials the customer and bridges them to the
   agent, carrying per-call `dynamic_variables`
6. **The agent talks.** When it needs data it calls a server tool
   (`search_properties`, `schedule_site_visit`, …) — its own model decides
   when, we no longer classify intent from transcript text
7. **Exotel status webhooks** track ringing → in progress → completed
8. **A signed post-call webhook** delivers the transcript; the outcome, summary
   and any qualification verdict are written back to the CRM lead

## Multi-tenancy

**One shared agent serves every tenant.** Per-call personalization travels as
`dynamic_variables` (`agency_name`, `lead_name`, `lead_context`, `rubric`, …)
referenced as `{{placeholders}}` in a single persistent system prompt. There is
no need for a per-tenant ElevenLabs agent; `agentId` / `agentPhoneNumberId` on
the tenant's agent config exist as optional overrides only.

Isolation is enforced throughout:

- DynamoDB keys prefixed `TENANT#{tenantId}#…`
- S3 knowledge paths `/{tenantId}/{category}/`
- Bedrock knowledge base queries filtered on `tenant_id` metadata
- Server tools take their tenant from a `secret__tenant_id` dynamic variable
  bound to a request header — **never** from a model-supplied parameter, so the
  agent cannot widen its own scope

## Configuration

### Plain Lambda environment variables

`ENVIRONMENT`, `AI_CALLING_TABLE_NAME`, `AI_CALLING_KNOWLEDGE_BUCKET`,
`AI_CALLING_RECORDINGS_BUCKET`, `CRM_INTERNAL_API_URL`, `EXOTEL_SUBDOMAIN`,
`EXOTEL_WEBHOOK_IPS`, `ELEVENLABS_AGENT_ID`,
`ELEVENLABS_AGENT_PHONE_NUMBER_ID`, `WEBHOOK_BASE_URL`,
`API_BASE_PATH_PREFIX`, `ENABLE_BASE_PATH_STRIP`, `ALLOWED_ORIGINS`,
`BEDROCK_KNOWLEDGE_BASE_ID`, `LOG_LEVEL`, `SECRETS_ARN`

`AWS_REGION` is **not** set by the template — it's a reserved Lambda variable
that CloudFormation rejects. The runtime provides it, so `process.env.AWS_REGION`
works as-is.

### Secrets (JSON keys in the Secrets Manager secret at `SECRETS_ARN`)

`CRM_INTERNAL_API_KEY`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_SID`,
`ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET`, `SERVER_TOOL_API_KEY`

`src/config/secretsBootstrap.js` fetches the secret once per container at cold
start and assigns its keys onto `process.env`, mirroring the SSM hydration
pattern in `server/config/ssmBootstrap.js`. `lambda-handler.js` defers importing
the Express app behind that hydration, because ES module imports are hoisted and
would otherwise read `process.env` before it is populated. Values set directly
on the Lambda always win over the secret.

## Dashboard setup

Two files hold the content a human pastes into the ElevenLabs dashboard:

- **`elevenlabs-agent-prompt.md`** — the shared agent's system prompt, the
  dynamic variables it expects, and recommended voice/language settings
- **`elevenlabs-agent-tools.md`** — all six server tools (paths, parameters,
  the four required headers) and the post-call webhook

Both require a deployed API Gateway URL, so deploy before configuring.

## API

### Calls
- `POST /api/ai-calling/calls/start` — start a call
- `GET  /api/ai-calling/calls/:id/status`
- `GET  /api/ai-calling/calls/:id/transcript`
- `POST /api/ai-calling/calls/:id/end`
- `GET  /api/ai-calling/calls` · `GET /api/ai-calling/calls/metrics/summary`

### Server tools (called by the agent, `SERVER_TOOL_API_KEY`)
- `POST /api/ai-calling/tools/search-properties`
- `POST /api/ai-calling/tools/property-details`
- `POST /api/ai-calling/tools/schedule-site-visit`
- `POST /api/ai-calling/tools/policy-answer`
- `POST /api/ai-calling/tools/qualification`
- `POST /api/ai-calling/tools/human-handoff`

### Webhooks
- `POST /webhooks/elevenlabs/post-call` — HMAC verified
- `POST /webhooks/exotel/status` — IP allowlisted

### Knowledge / Config
- `POST /api/ai-calling/knowledge/upload-url` · `GET|DELETE /knowledge/:id`
- `GET|PUT /api/ai-calling/config/agent`

## Lead qualification

A `lead_qualification` call is capped at 180 seconds. The agent classifies the
lead HOT / WARM / COLD against the rubric passed in as a dynamic variable, then
calls `submit_qualification` — silently, so the verdict never reaches the
customer's ear. The result is written to the session and pushed to the CRM.

`qualificationStatus` distinguishes `succeeded` / `failed` / `pending` /
`not_applicable`, so a qualification call that produced no verdict is visibly a
data-quality problem rather than silently indistinguishable from a call that was
never meant to qualify anyone.

## Deployment

Infrastructure lives in `ai-calling-service/infra/cfn-ai-calling.yaml` and is
deployed through the CI/CD wrapper, not by invoking `aws cloudformation deploy`
by hand:

```bash
cfn-templates-cicd/ai-calling-service/deploy.sh dev
cfn-templates-cicd/ai-calling-service/deploy.sh prod
```

The Lambda handler path is `src/lambda-handler.handler`; `deploy.sh` hard-fails
if `src/lambda-handler.js` is missing from the package.

Secret values are supplied to the stack, never committed. If you find
credentials in a deploy script, treat them as leaked and rotate them.

## Development

```bash
npm install
npm test          # node:test, no AWS or network required
npm run dev       # local server on :3002
```

Tests cover webhook signature verification, phone normalization, dynamic
variable construction, and post-call payload parsing — the pure logic where a
silent wrong answer would be expensive.

## Known gaps

- **Webhook signature scheme is unconfirmed against a live delivery.**
  ElevenLabs documents verification through their SDK and doesn't publish the
  raw scheme, so `verifyWebhookSignature()` implements the standard
  `t=…,v0=…` / HMAC-SHA256-over-`${timestamp}.${rawBody}` construction. On a
  rejection the header's *shape* is logged with values redacted, so a format
  mismatch is diagnosable in one pass. Only `parseSignatureHeader()` and the
  signed-payload line would need to change.
- **Knowledge base ingestion is a stub.** `routes/knowledge.js` marks uploaded
  documents `INDEXED` after a `setTimeout` without extracting, chunking or
  embedding anything, so `answer_policy_question` has nothing to retrieve.
  Predates this rewrite and is untouched by it.
- **`/api/ai-calling/config/intents`** stores a per-tenant intent config that
  nothing reads any more, now that the agent's model does intent detection.
  Left in place rather than removing a CRM-facing endpoint unilaterally.
