# Exotel + ElevenLabs PROD Setup — Brief for a Browser Session

**Hand this file to the agent driving the browser.** Target environment is
**PRODUCTION**. Everything here is dashboard work that cannot be done from code.

---

## What you are collecting

Ten values. Everything downstream is blocked until these exist. Write them
straight into `ai-calling-service/.env.prod` (gitignored) — **never paste secret
values into a chat transcript, a commit, or any file that isn't `.env.prod`.**

| # | Value | Env var | Source |
|---|---|---|---|
| 1 | Exotel Account SID | `EXOTEL_SID` | Exotel dashboard |
| 2 | Exotel API Key | `EXOTEL_API_KEY` | Exotel dashboard (**rotate — see ⚠️**) |
| 3 | Exotel API Token | `EXOTEL_API_TOKEN` | Exotel dashboard (**rotate — see ⚠️**) |
| 4 | Exotel subdomain | `EXOTEL_SUBDOMAIN` | Usually `api.exotel.com`; check your account's region |
| 5 | **ExoPhone number** | *(not an env var — needed for step B)* | Exotel → Numbers |
| 6 | Exotel webhook IP ranges | `EXOTEL_WEBHOOK_IPS` | Exotel docs/support (comma-separated) |
| 7 | ElevenLabs API key (prod) | `ELEVENLABS_API_KEY` | ElevenLabs → Developers (**rotate — see ⚠️**) |
| 8 | Prod agent id | `ELEVENLABS_AGENT_ID` | Created in step C |
| 9 | Phone number id | `ELEVENLABS_AGENT_PHONE_NUMBER_ID` | Created in step D |
| 10 | Webhook signing secret | `ELEVENLABS_WEBHOOK_SECRET` | Created **after** the prod deploy |
| 11 | Server-tool key | `SERVER_TOOL_API_KEY` | Generate — step E |
| 12 | CRM caller key | `CRM_CALLER_API_KEY` | Generate — step E. **Same value in BOTH `ai-calling-service/.env.prod` and `server/.env.prod`** |

⚠️ **Rotation is mandatory, not optional.** The previous Exotel API key/token and
ElevenLabs API key were committed to this repo's git history (commit `21bacd4`).
The files were deleted but history was deliberately not rewritten, so the old
values must be assumed compromised. **Generate new ones; do not reuse the old
values anywhere.**

---

## Step A — Exotel: get the number and credentials

1. Log in to the Exotel dashboard (**the human does the login — the agent must
   never enter passwords or credentials**).
2. **Find or purchase an ExoPhone.** Exotel → Numbers / ExoPhones. If none
   exists, buy one — an Indian virtual number. Record the number in full E.164
   form (`+91XXXXXXXXXX`).
   - ⚠️ Purchasing costs money. The human must approve and complete any payment.
   - Note: this number is **not recorded anywhere in the repo or DynamoDB** —
     the prod agency record has no `exotelNumber` field — so it has to come from
     the dashboard.
3. **Get API credentials.** Exotel → Settings → API credentials (sometimes under
   Developers/API). Record **Account SID**, **API Key**, **API Token**. Rotate/
   regenerate the key and token rather than reusing what's shown.
4. **Get the webhook IP ranges.** Exotel publishes the source IPs its webhooks
   originate from. Find them in Exotel's docs or ask Exotel support. Record as a
   comma-separated list.
   - **Do not guess or invent these.** A wrong allowlist either silently blocks
     every legitimate webhook or creates a false sense of security. The prod
     deploy is deliberately blocked while this is blank.
5. Confirm whether your account/plan permits **outbound calls via the Connect
   API** — that's what ElevenLabs uses under the hood.

## Step B — check ElevenLabs plan gating first

Before spending time: the ElevenLabs workspace (CloudBerry's Workspace) showed
an "Upgrade" prompt, suggesting a free/limited tier. **Confirm that outbound
calling and phone-number import are available on the current plan** before
proceeding — otherwise steps C and D will dead-end.

## Step C — create the PROD ElevenLabs agent

A **dev** agent already exists (`[Dev] RealEstateFlow AI`,
`agent_9701m1fm8dbme9cv9jya6nqc5tdw`). Create a **separate prod agent** — do not
reuse the dev one, because each agent's server tools hardcode that environment's
API Gateway URL.

1. ElevenLabs → Agents → **+** → **Blank Agent**
2. Name: `[Prod] RealEstateFlow AI`
3. **System prompt:** paste the entire block from
   `ai-calling-service/elevenlabs-agent-prompt.md` (the fenced block under
   "## System prompt"). It contains `{{placeholders}}` — the editor is TipTap/
   ProseMirror and pops a variable picker when you type `{{`, so **paste, don't
   type**. After pasting, verify the old default text ("You are a helpful
   assistant.") was replaced and not left appended at the end — this happens.
4. **First message:** clear it, leave **empty**. The prompt drives the opening.
5. **Language:** English (default), then **add Hindi** → a **"Hinglish Mode"**
   toggle appears → **turn it ON**. It only appears once Hindi is added.
6. **Voice:** an Indian-English voice. Dev uses `Kartik - English Indian Voice`;
   `Muskaan - Casual Hindi Voice` is the alternative. TTS model family: **Flash**
   (lowest latency — this is a phone call).
7. **LLM:** `Qwen3.5-397B-A17B` — 330ms–1.47s, flagged for agentic use,
   ~$0.0083/min. Claude options start at 1.25s+ and cost 2–5× more, which is a
   noticeable pause on a call and material at volume.
8. **Publish.** Record the `agent_...` id from the URL → `ELEVENLABS_AGENT_ID`.

## Step D — import the ExoPhone into ElevenLabs

ElevenLabs → **Phone Numbers → Import number → From Exotel**. Fields:

- **Label:** `RealEstateFlow Prod ExoPhone`
- **Phone number:** the ExoPhone from step A (country +91)
- **Exotel Account SID / API Key / API Token:** the rotated values from step A
  — **the human enters these; the agent must not type credentials into forms**
- **Region:** match your Exotel account

On success, record the phone number id → `ELEVENLABS_AGENT_PHONE_NUMBER_ID`.
**Without this, calls have no audio.**

## Step E — generate the two shared secrets

```bash
openssl rand -hex 32   # SERVER_TOOL_API_KEY
openssl rand -hex 32   # CRM_CALLER_API_KEY  (a DIFFERENT value)
```

- **`SERVER_TOOL_API_KEY`** → `ai-calling-service/.env.prod`. The same value goes
  into ElevenLabs later as the server tools' secret header.
- **`CRM_CALLER_API_KEY`** → the same value in **both**
  `ai-calling-service/.env.prod` **and** `server/.env.prod`. This is what lets
  the CRM backend call the calling service's management API. If the two sides
  disagree, every call from the CRM UI fails — 503 on the CRM side, 401 on the
  service side.

  It is a **tenant-crossing credential**: anything holding it can act for any
  tenant. Server-side config only — never a browser bundle, mobile app, or
  webhook registration. Keep it distinct from `CRM_INTERNAL_API_KEY`, which is
  the opposite direction (service → CRM).

`deploy.sh` now refuses to deploy while either is blank.

---

## What happens after this brief

Steps below are **not** part of this browser session — they need the prod deploy
to have happened first, because everything depends on the API Gateway URL.

1. Fill `.env.prod`, then deploy prod once. `WEBHOOK_BASE_URL` is derived from
   the custom domain + base path (stack output `AiCallingApiBaseUrl`):
   ```bash
   cd cfn-templates-cicd/ai-calling-service
   ./deploy.sh prod
   ```
2. Add the **six server tools** to the prod agent per
   `ai-calling-service/elevenlabs-agent-tools.md`, pointing at
   `{WEBHOOK_BASE_URL}/api/ai-calling/tools`.
3. Configure the **post-call webhook** →
   `{WEBHOOK_BASE_URL}/webhooks/elevenlabs/post-call`, event
   `post_call_transcription`. It shows a signing secret **once** → that's
   `ELEVENLABS_WEBHOOK_SECRET`. Redeploy after adding it.
4. Seed an **agent config row** for the tenant (no row exists yet; calls fail
   with "Agent configuration missing" without one).

---

## Rules for the agent doing this

- **Never enter passwords, API keys, or tokens into any form.** The human does
  that. You may fill non-sensitive fields (labels, names) and drive navigation.
- **Never paste secret values into chat, logs, or any file except `.env.prod`.**
- Decline cookie/consent banners (choose the privacy-preserving option).
- Purchasing a phone number spends money — the human approves and completes it.
- If the ElevenLabs prompt editor mangles the `{{variables}}`, stop and re-paste
  rather than hand-typing them.

## Reference values already known

| Thing | Value |
|---|---|
| Prod AWS account | `532404260898`, profile `cloudberry-prod-new`, `ap-south-1` |
| Prod stack name | `prod-realestateflow-aicalling-stack` |
| Prod artifact bucket | `prod-realestateflow-artifacts` (verified to exist) |
| Prod CRM API base | `https://services-api.realestateflow.in/prodrealestatecrm` |
| Dev agent (do not reuse for prod) | `agent_9701m1fm8dbme9cv9jya6nqc5tdw` |

Full context on the service: `ai-calling-service/GO-LIVE-RUNBOOK.md`.
