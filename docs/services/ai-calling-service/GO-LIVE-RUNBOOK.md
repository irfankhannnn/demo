# AI Calling Service — Go-Live Runbook & Handoff

**Written:** 2026-09-02 · **Branch:** `instagram-solution` · **State:** rebuilt, audited, uncommitted

This is a handoff brief. It assumes you are picking this up cold. Read it fully
before touching anything — several steps have ordering constraints that will
waste your time if you get them wrong.

---

## 1. What this service is, and what just happened to it

`services/ai-calling-service/` places outbound AI voice calls to real estate leads: the
CRM triggers a call, an ElevenLabs conversational agent talks to the customer in
Hinglish, fetches live property data mid-call via server tools, books site
visits, and writes a qualification score back to the lead.

**It was audited on 2026-09-02 and found to have never worked.** The original
design created an ElevenLabs conversation and separately dialled the customer
through Exotel, with **no audio bridge between them** — the phone would ring and
the AI would never join. It had also never been deployed to any AWS account, and
its deploy script passed CloudFormation parameters the template didn't declare,
so it would have hard-failed regardless.

It has since been **rebuilt on ElevenLabs' native Exotel integration**
(`POST /v1/convai/exotel/outbound-call`), which places the call *and* bridges
audio in one request. Personalization moved to dynamic variables on a single
shared agent; the old regex intent-classifier was replaced by ElevenLabs server
tools. Infra was rewritten to repo convention and passes the repo's own
`cfn-readiness-auditor` with no blocking findings.

**Key architectural rule: ONE shared ElevenLabs agent serves ALL tenants.** Do
not create an agent per agency. Agency-specific values arrive per call as
dynamic variables. There is one agent per *environment* (dev / prod), not per
customer.

---

## 2. Current state — what is done

| Area | State |
|---|---|
| App code rebuild | ✅ Done. 27/27 tests pass (`npm --prefix ai-calling-service test`) |
| Infra (CFN + deploy.sh) | ✅ Done, `infra/cfn-ai-calling.yaml`, passes readiness audit |
| CI/CD wrapper | ✅ Done, `infra/cicd/ai-calling-service/deploy.sh dev\|prod` |
| Leaked credentials | ✅ Purged from working tree (git history NOT rewritten — see §3) |
| Dev ElevenLabs agent | ✅ Created & published — see §4 |
| **Management API auth** | ✅ `src/middleware/internalAuth.js`, shared secret, fails closed |
| **CRM proxy routes** | ✅ 8 routes under `/api/crm/ai-calling`, credit pre-check enforced |
| **CRM frontend UI** | ✅ Built, gated behind `VITE_AI_CALLING_ENABLED` (currently `false`) |
| **Semantic property search** | ✅ Built — DynamoDB Vector Search, all 3 channels. Needs backfill + index creation |
| Credential rotation | ❌ **Pending — human only** |
| Exotel phone number import | ❌ **Pending — human only** |
| Prod ElevenLabs agent | ❌ Not created (dev one exists — do not reuse) |
| Prod deploy | ❌ Blocked on credentials (see §5) |
| Server tools + post-call webhook | ❌ Blocked until after deploy |
| End-to-end test call | ❌ Not attempted |

**Committed** as `bdff45e` (native Exotel rebuild) and `63a4982` (CRM UI,
semantic search, API auth). Repo rule: descriptive commits, **never force-push**.

Still uncommitted and deliberately left alone — unrelated in-progress work:
`apps/crm/server/leadIngestion.js`, `apps/crm/server/meetingReminderRecipients.js`,
`apps/crm/server/scripts/meeting-reminder-cron.js`.

---

## 3. ⚠️ Credential rotation — do this first

Live-looking Exotel and ElevenLabs credentials were committed to git in
`deploy-lambda.ps1` (commit `21bacd4`) and duplicated into the CI/CD wrapper
copy. Both files have been **deleted** and no leaked value remains in the working
tree (grep-verified).

**Git history was deliberately NOT rewritten** — the repo's CLAUDE.md forbids
force-push. That means the old values are still recoverable from history, so
**rotation is the only real mitigation**. Rotate before reusing anything:

- **Exotel** → dashboard → Settings → API credentials → rotate API Key + Token
- **ElevenLabs** → Developers → API keys → create new, revoke old

Do not paste old key values into any dashboard form. Do not commit new ones —
they belong in `.env.dev` / `.env.prod`, which are gitignored.

---

## 4. The dev ElevenLabs agent (already built)

**Name:** `[Dev] RealEstateFlow AI`
**Agent ID:** `agent_9701m1fm8dbme9cv9jya6nqc5tdw` (already written to `.env.dev`)
**Workspace:** CloudBerry's Workspace

Configured and published:

| Setting | Value | Why |
|---|---|---|
| System prompt | Full prompt from `elevenlabs-agent-prompt.md` (3,825 chars) | 7 dynamic variables, all recognised |
| First message | **Empty** | The prompt drives the opening so `{{lead_name}}` lands naturally |
| Voice | Kartik – English Indian Voice | Indian-English handles both halves of Hinglish |
| TTS model | Flash (fastest) | Phone-call latency |
| Languages | English (default) + Hindi | |
| **Hinglish Mode** | **ON** | Native ElevenLabs toggle, appears only once Hindi is added. Better than prompt-only instruction |
| LLM | Qwen3.5-397B-A17B | 330ms–1.47s, flagged for agentic use, ~$0.0083/min. Claude options start at 1.25s+ and cost 2–5× — matters at 3,000-lead volume |
| Test dynamic variables | Seeded from real DynamoDB agency record | Dashboard-test-only placeholders; real values come from the API per call |

**Not yet done on this agent:** the six server tools and the post-call webhook.
Both need the deployed API Gateway URL, so they come *after* the first deploy.
Definitions to paste are in `elevenlabs-agent-tools.md`.

### Creating the PROD agent later

Repeat the above in a **new** agent named `[Prod] RealEstateFlow AI`. Same
prompt, same settings. Put its id in `.env.prod` as `ELEVENLABS_AGENT_ID`. Use
a separately rotated prod API key. Do not point prod at the dev agent — the
server tools on each agent hardcode that environment's API Gateway URL.

---

## 5. Deploying to dev — blockers and sequence

### Artifact buckets

- **prod** — `prod-realestateflow-artifacts` in `532404260898` ✅ **verified to exist**
- **dev** — `dev-realestateflow-artifacts` in `730335176275` ❌ **does not exist**
  (`head-bucket` returns 404). Only matters if you later deploy dev; create it
  matching the prod bucket's settings.

### Blocker B — every credential in `.env.dev` is blank

`deploy.sh` hard-stops and names each missing one. That's by design. Required:

| Value | Where it comes from |
|---|---|
| `CRM_INTERNAL_API_KEY` | Must equal `AI_CALLING_INTERNAL_API_KEY` in `apps/crm/server/.env.dev` |
| `EXOTEL_API_KEY` / `_TOKEN` / `_SID` | Exotel dashboard, **after rotation** |
| `ELEVENLABS_API_KEY` | ElevenLabs → Developers, **after rotation** |
| `ELEVENLABS_AGENT_ID` | ✅ already filled |
| `ELEVENLABS_AGENT_PHONE_NUMBER_ID` | From the Exotel import (§6) — **without this, no call has audio** |
| `ELEVENLABS_WEBHOOK_SECRET` | Shown once when the post-call webhook is created (§7) |
| `SERVER_TOOL_API_KEY` | Generate: `openssl rand -hex 32`. Same value goes in ElevenLabs as the tools' secret header |
| `CRM_CALLER_API_KEY` | Generate: `openssl rand -hex 32`. **Same value required in both `services/ai-calling-service/.env.<env>` and `apps/crm/server/.env.<env>`** — it authenticates the CRM backend to the calling service's management API. Tenant-crossing credential, server-side only |
| `EXOTEL_WEBHOOK_IPS` | Exotel's documented webhook IP ranges. Blank is allowed in dev (warns); **blocks prod deploy** |

### The deploy is a single pass

`WEBHOOK_BASE_URL` is derived by the stack from the custom domain + base path
(`https://<AI_CALLING_API_DOMAIN_NAME>/<AI_CALLING_API_BASE_PATH>`, stack output
`AiCallingApiBaseUrl`), so it is known before the first deploy. There is no raw
execute-api URL to copy.

```bash
cd infra/cicd/ai-calling-service
./deploy.sh dev
```

---

## 6. Exotel phone number import

In ElevenLabs → **Phone Numbers → Import number → From Exotel**. Fields:

- **Label** — e.g. `RealEstateFlow Dev ExoPhone`
- **Phone number** (+91) — your ExoPhone virtual number
- **Exotel Account SID / API Key / API Token** — rotated values from §3
- **Region**

On success you get the **phone number id** → `ELEVENLABS_AGENT_PHONE_NUMBER_ID`.

⚠️ **The ExoPhone number is not recorded anywhere in this repo or in DynamoDB.**
The dev agency record (`realestate-flow-dev-agencies`, tenant
`85348a4e-b948-4588-9d5f-c638d2ca84e8`, "Acme Real Estate Agency") has **no
`exotelNumber` field**. You need to get it from the Exotel dashboard.

⚠️ **Check plan gating.** The ElevenLabs workspace shows an "Upgrade" prompt,
suggesting a free/limited tier. Confirm outbound calling and phone-number import
aren't gated before spending time here.

---

## 7. Post-deploy: server tools + webhook

Only possible once the stack (and its base path mapping) is deployed. Follow `elevenlabs-agent-tools.md`
exactly. Six webhook tools at `{WEBHOOK_BASE_URL}/api/ai-calling/tools`:
`search_properties`, `get_property_details`, `schedule_site_visit`,
`answer_policy_question`, `submit_qualification`, `request_human_handoff`.

**Security rule that must not be broken:** tenant scope comes from request
*headers* bound to `secret__` dynamic variables (`x-tenant-id`, `x-lead-id`,
`x-call-session-id`), never from a body parameter. `secret__` variables are
withheld from the LLM payload, so the model cannot forge another tenant's id.
**Do not add a `tenant_id` body parameter to any tool** — that reopens the exact
cross-tenant hole the old unauthenticated webhook had.

Also configure the workspace **post-call webhook** →
`{WEBHOOK_BASE_URL}/webhooks/elevenlabs/post-call`, event
`post_call_transcription`, with a generated secret stored as
`ELEVENLABS_WEBHOOK_SECRET`.

---

## 8. Known gaps, bugs, and unbuilt work

Ranked by how likely they are to bite you.

### 🔴 Blocking a real end-to-end test

1. **Two things must be switched on that currently are not.**
   - `VITE_AI_CALLING_ENABLED` is `false` — the CRM nav entry stays hidden until
     you flip it. Nothing ships visible by accident.
   - `CRM_CALLER_API_KEY` must hold the **same value** in
     `services/ai-calling-service/.env.<env>` and `apps/crm/server/.env.<env>`. If they disagree
     or either is blank, every call from the UI fails: 503 from the CRM proxy,
     401 from the service. The service fails closed by design.

2. **The vector index must be created and properties backfilled** before
   semantic search returns anything. The index is defined in
   `apps/crm/server/infra/cfn-backend.yaml`; existing properties need
   `node apps/crm/server/scripts/backfill-property-embeddings.js --tenant <id> --dry-run`
   first. See the prod-first risk note at the end of this section.

3. **No agent config row exists for any tenant.** `startAICall` calls
   `db.getAgentConfig(tenantId)` and fails with "Agent configuration missing"
   if absent. The table is created by the stack, so after the first deploy you
   must seed a config via `PUT /api/ai-calling/config/agent` for tenant
   `85348a4e-b948-4588-9d5f-c638d2ca84e8` before any call will start.

4. **Prod-first carries real cost for the vector index — an open decision.** The
   design proposal explicitly gates this behind a non-prod spike. Going straight
   to prod means adding the index triggers a **backfill on the live
   `prod-realestateflow-crm` table** (search returns incomplete results until it
   completes), and `DistanceFunction` plus the `NonKeyAttributes` projection are
   **immutable** — getting them wrong means delete, recreate, full re-embed. All
   range-filter fields (`rentAmount`, `price`, `bhk`, `status`) were projected
   deliberately for that reason. Existing flows are unaffected either way:
   `match_properties` is additive and `search_properties` is untouched.

### 🟠 Will misbehave, expect to fix

4. **The webhook HMAC scheme is an unverified assumption.** ElevenLabs documents
   signature verification only via their SDK, so `verifyWebhookSignature()`
   implements the standard `t=<ts>,v0=<hex-hmac-sha256>` over
   `${timestamp}.${rawBody}`. **Confirm on the first real delivery.** On rejection
   the service logs the header's *shape* with values redacted, so it's one-pass
   diagnosable — only `parseSignatureHeader()` and one signed-payload line need
   changing if the format differs.

5. ~~**`answer_policy_question` returns nothing useful.**~~ **BUILT.** Policy
   retrieval now runs on DynamoDB vector search, not Bedrock Knowledge Base —
   no second retrieval stack and no always-on vector-store bill. Agencies write
   their policies in the CRM under **Agency Policies**; the text is chunked one
   rule per paragraph, embedded with Titan v2 and searched with the same
   tenant-isolation guarantee as property search
   (`apps/crm/server/services/knowledge/`).

   Two things still to do before it answers anything:
   - create the index: `./server/infra/create-vector-index.sh prod policy`
   - have an agency save at least one policy document (or run
     `node apps/crm/server/scripts/reindex-policies.js`)

   File *upload* remains unimplemented and now returns 501 instead of falsely
   reporting documents as indexed.

### 🟡 Design gaps worth knowing

6. ~~**There is no vector/semantic property search.**~~ **BUILT.** `match_properties`
   runs DynamoDB vector search over Titan embeddings written on every property
   create and update. Needs its index created once:
   `./server/infra/create-vector-index.sh prod property`, then
   `node apps/crm/server/scripts/backfill-property-embeddings.js` for pre-existing rows.
   The plain filtered lookup stays for exact/structured queries.

7. **`exotelNumber` is no longer required** in agent config — the number now
   lives in ElevenLabs as `agentPhoneNumberId`. Anything still calling
   `PUT /config/agent` and expecting that requirement should be checked.

8. **`/config/intents` is a dead endpoint** — it stores config nothing reads,
   left in place rather than unilaterally deleting a CRM-facing route.

9. **No `VpcConfig` on the Lambda.** Advisory only per the repo checklist, but
   this function handles call recordings and transcripts — worth a human
   decision.

10. **`getLeads` does a full-table Scan** (documented in project memory). Not a
    blocker for testing, but it's the known bottleneck if AI calling is pointed
    at high-volume lead sources.

---

## 9. Testing the end-to-end flow

Once deployed and configured:

```bash
curl -X POST "{WEBHOOK_BASE_URL}/api/ai-calling/calls/start" \
  -H "Content-Type: application/json" \
  -H "<auth header per the deployed API Gateway auth>" \
  -d '{
    "tenantId": "85348a4e-b948-4588-9d5f-c638d2ca84e8",
    "leadId": "<a real lead id>",
    "leadName": "Test Lead",
    "leadPhone": "+91XXXXXXXXXX",
    "callPurpose": "lead_followup"
  }'
```

**What to verify on the call:**

- [ ] The phone actually rings **and the AI speaks** (this is the thing that never worked before)
- [ ] No `{{placeholder}}` is ever spoken aloud
- [ ] No `secret__` value is ever spoken aloud
- [ ] Hinglish code-switching follows the caller
- [ ] `search_properties` fires when the caller describes what they want
- [ ] On a `lead_qualification` call, `submit_qualification` fires and the agent
      does **not** say "hot"/"warm"/"cold" out loud
- [ ] Post-call webhook is accepted (watch for HMAC rejection — item 4 above)
- [ ] Transcript and qualification score land back on the lead in the CRM

Use the ElevenLabs dashboard **Conversations** view to inspect what actually
happened on the call, including tool invocations.

---

## 10. Reference

| Thing | Where |
|---|---|
| Agent system prompt (paste-ready) | `services/ai-calling-service/elevenlabs-agent-prompt.md` |
| Server tool definitions (paste-ready) | `services/ai-calling-service/elevenlabs-agent-tools.md` |
| CFN template | `services/ai-calling-service/infra/cfn-ai-calling.yaml` |
| Deploy | `infra/cicd/ai-calling-service/deploy.sh dev\|prod` |
| Env contract | `services/ai-calling-service/.env.example` |
| Architecture + known gaps | `services/ai-calling-service/README.md` |
| AWS accounts | dev `cloudberry-main` / `730335176275`; prod `cloudberry-prod-new` / `532404260898`. `cloudberry-prod` profile has expired credentials |

**Do not** re-derive the ElevenLabs API surface from pre-2026 knowledge — the
old `POST /convai/conversations` create-session model, `/add-context` and `/end`
endpoints do not exist. Transcript is `GET /v1/convai/conversations/:id`.
