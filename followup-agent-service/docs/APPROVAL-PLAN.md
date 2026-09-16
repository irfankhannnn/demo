# Follow-up Agent Microservice: Understanding and Implementation Plan (for approval)

Date: 2026-09-14 · Repo: `nabi-app-git-bkp`, branch `feat/property-pages-ms` (ported 2026-09-15 from `claude/followup-agent-microservice-df68b2`) · Prepared by Claude for Kalim Qureshi

This document records what was found in the codebase, what already exists, what is missing, and exactly what will be built. Please review **Section 5 (Decisions and defaults)** and **Section 6 (Open questions)**, then mark Section 8.

---

## 1. What you asked for (my understanding)

1. A new **follow-up microservice** in its own folder with its own CloudFormation template and a `cfn-templates-cicd/` wrapper, matching the repo's service conventions.
2. When a lead in the Instagram DM pipeline asks for a call or agrees to a meeting, an **ElevenLabs voice agent calls the lead** to confirm the site-visit timing for the property discussed, and can answer questions about **available properties from the CRM (DynamoDB)**.
3. After the site visit, the agent **calls again** to ask about the property visited, any issues, anything needing clarity, and when the customer can proceed with the token.
4. If the agent lacks information or the customer needs an action, it **informs the team member who handled the meeting and the agency owner**.
5. The agent **retries at least twice** when the call does not connect, then **escalates** to the lead's responsible team member and the owner.
6. **Phone-number privacy**: the agency owner sees mobile numbers of leads, owners, tenants and property contacts; **team members do not**. When a team member needs to call, it goes through **Exotel** click-to-call and the number is never shown.

---

## 2. What already exists (research findings)

### 2.1 Voice calling: `ai-calling-service/` (reusable for dialing)

- An outbound call is one request to ElevenLabs' native Exotel integration, `POST /v1/convai/exotel/outbound-call` (`src/services/elevenlabsService.js:153`). No SIP or Twilio work is needed.
- Entry path: CRM `POST /api/crm/ai-calling/calls/start` (`server/routes/aiCalling.js:121`) → service `POST /api/ai-calling/calls/start` (`src/routes/calls.js:19`) → `startAICall()` (`src/handlers/callOrchestration.js:34`). Only `leadId, leadName, leadPhone, callPurpose` are accepted; purpose is clamped to `lead_qualification | lead_followup`.
- Personalisation is passed as **dynamic variables** into one shared agent prompt (`elevenlabs-agent-prompt.md`), never per-tenant agents.
- **Agent tools already exist** (`src/handlers/serverTools.js`, `src/routes/tools.js`): `search_properties` (semantic plus exact filters against CRM inventory via `server/routes/aiCallingInternal.js`), `get_property_details`, `schedule_site_visit`, `answer_policy_question`, `submit_qualification`, `request_human_handoff`. "Answer based on available properties in DynamoDB" is therefore mostly solved and reused.
- Post-call: signed ElevenLabs webhook → transcript stored → `PATCH /api/internal/leads/:id/call-outcome` on the CRM (`aiCallingInternal.js:425`), which already tolerates non-qualification purposes.
- Gaps confirmed in code: no scheduling, no retry on `no_answer`/`busy`/`failed`, no escalation delivery (`request_human_handoff` only writes a log line), ElevenLabs `data_collection` results ignored, `ttl` declared on the table but never written.
- **Bug A**: `POST /api/internal/site-visits` (`aiCallingInternal.js:349`) calls `createMeeting()` with `entityType/entityId`, but `createMeeting` requires `relatedEntityType/relatedEntityId` (`crmDynamodbService.js:2455`). Every AI-booked site visit throws 500 today. `propertyId`, `meetingType`, `source` are also dropped and `notifySiteVisitBooked` is never called.
- **Bug B**: `GET /api/internal/properties/available` (`aiCallingInternal.js:223`) filters on `bedrooms`, `rent`, `deposit`, `squareFeet`, none of which exist on a PROPERTY item (real names: `bhk`, `rentAmount`, `rentalInfo.securityDeposit`, `carpetArea`). It also reads status `available` literally while real listings are `for-sale`/`for-rent`. The fallback path of the voice agent's property search returns empty or half-empty results.
- **Bug C**: `GET /api/internal/properties/search` (`aiCallingInternal.js:321`) returns raw property items including `ownerPhone`, `ownerSnapshot` and legal document keys to the calling service.
- Stray file `ai-calling-service/--version` is an accidental empty zip; it will be removed.

### 2.2 Instagram lead pipeline: three separate paths, none emits a trigger

| Path | Ingest | Storage | Reaches CRM |
|---|---|---|---|
| A. `kalim-sessions/kalim-automations/hp-insta-lead-automation/` | Chrome DOM scrape or pasted export → Claude analyst | Excel `master/hp-insta-leads.xlsx` | No (fully offline) |
| B. `instagram-local-agent/` → `backend_insta_sol_ms/` | Graph API on the agency laptop | DynamoDB `<env>-realestateflow-insta-data` | Yes, via `POST /api/internal/adapters/leads` |
| C. ManyChat webhook `server/routes/webhooks.js:245` | ManyChat External Request | CRM Leads table | Yes (direct) |

- Path A's analyst already produces `action_channel ∈ {dm, call, whatsapp, meeting, none}`, `meeting_schedule` (free text), `mobile_number`, `lead_score ∈ {very_hot, hot, cold}`. The workbook computes `dm_can_be_closed = mobile + requirement_complete + meeting`. That is the best existing "ready to move to phone" signal, and it is never sent anywhere.
- All three paths converge on the CRM `ingestLead()` (`server/leadIngestion.js`), which emits EventBridge `crm.leads` / `lead.created` (`{tenantId, leadId, leadType, name, phone}`) on the default bus. The event has no `sourceAdapter` and no "call requested" flag.
- Property references in DM data are free text (locality, building name). Only the CRM Meeting entity can carry a `propertyId`.

### 2.3 CRM (`server/`) hooks that will be reused

- Leads: `TENANT#{t}#LEAD#{id}` with `phone`, `assignedTo`, `source`, `sourceAdapter`, `status ∈ {new, contacted, qualified, site_visit, negotiating, converted, lost, spam}`.
- Meetings: `createMeeting/updateMeeting` (`crmDynamodbService.js:2448/2714`) with status transitions incl. `completed`; GSI2 lets meetings be queried by lead. No event is emitted on completion today.
- Notifications: `createNotification` with `targetUserIds` plus push (`notificationDynamodbService.js:81`), `leadNotifications.js` (in-app plus email to assignee, team lookup via the auth-service internal route), WhatsApp via Baileys.
- Scheduling precedents: EventBridge cron/rate rules plus Lambdas in `server/infra/cfn-backend.yaml` (e.g. `meeting-reminder-cron` every 5 min); SQS plus DLQ for the call-recording worker.
- Tenant settings: `agencyConfig` (`aiEmployeeEnabled`, `followupAgentMode`, `businessHoursStart/End`, `timezone`) editable at `PATCH /api/crm/config/ai-employee` (admin only).
- Existing daily `lead-followup-cron.js` drafts WhatsApp/email nudges for stale leads. It does not call anyone; it stays untouched and complementary.
- The CRM's API Gateway enumerates routes explicitly (`server/infra/apigw-explicit-routes-part*.yaml`). Every new `/api/crm/...` path needs a template entry (helper: `server/scripts/generate-missing-cfn-routes.js`).

### 2.4 Roles, phone visibility, Exotel

- Roles actually issued by the auth service: **`ADMIN` and `MEMBER` only** (`reality-flow-authentication/src/models/usersModel.ts:31`). `FOUNDER/OWNER/MANAGER` are accepted by the CRM middleware but never minted. So "agency owner" = `ADMIN`, "team member" = `MEMBER`. Role arrives via `/auth/me`, not as a JWT claim (`server/middleware/validateToken.js:89-118`).
- **There is no phone masking anywhere.** Every list/detail route returns `phone` in full to every role: customers, owners, buyers, contacts/sellers, leads, properties (`ownerPhone`, `ownerSnapshot.phone`, `tenant.phone` at `crm.js:699-707` and `875-882`), meetings (`attendeePhone`, `relatedEntityPhone`). Reads have no role guard at all.
- Frontend renders phones inline at about 30 sites with no shared component; `tel:` links at `Calendar.tsx:240` and `EnquiryList.tsx:1063,1425`.
- **Bug D**: `GET /api/crm/properties/public/list` (`crm.js:756`) leaks `ownerName`, `ownerPhone`, `ownerSnapshot` to API-key callers; the sibling detail route strips them correctly.
- **Exotel click-to-call does not exist.** The CRM has no Exotel code. Exotel credentials live only in `ai-calling-service` (Secrets Manager), which uses Exotel for CDRs/recordings/hang-up, not dialing. `Calls/connect.json` is not implemented.
- Team-member phone: `/auth/me` already returns the user's `phoneNumber` (`authController.ts:501`), so the caller leg of click-to-call has a source.
- Precedent to copy: `server/routes/aiCalling.js:121-162` (browser sends an entity id, server resolves the number, number never returns to the client) and `publicListingService.js:206` (allowlist serializer).

### 2.5 Infra conventions the new service must meet (from the `cfn-readiness-auditor` checklist)

- Env-first naming `<env>-realestateflow-<service>-<resource>`; stack `<env>-realestateflow-<service>-stack`.
- `infra/deploy.sh <dev|prod>` forcing env from the CLI arg, validating the `STACK_NAME` prefix, refusing raw execute-api hosts, requiring custom-domain mapping and base-path strip.
- `.env.example` committed; `.env.dev/.env.prod`, `cfn-params.json`, `.last-*.json` gitignored.
- `infra/config-deploy.sh` with `config-only-allowed-params.json` allowlist; a shared `lib/generate-cfn-params.js`.
- Wrapper `cfn-templates-cicd/<same-folder-name>/deploy.sh` with global 4-digit builds, `manifest.json`, `builds/<build>/<env>/` archive, 4 S3 tags, `rollback-code/full/config` with env guards.
- Secrets via NoEcho params → Secrets Manager → hydrated at cold start (the ai-calling-service pattern).

---

## 3. Proposed design

### 3.1 New service `followup-agent-service/`

Physical prefix `<env>-realestateflow-followup-`; base path `devrealestatefollowup` / `prodrealestatefollowup`; artifact prefix `followup`.

```
[Instagram DM → CRM lead]                          [CRM UI / API]
 ManyChat webhook ─┐                                "Schedule AI follow-up" button
 insta-agent MS ───┼→ ingestLead() → EventBridge      │
 Excel pipeline ───┘   crm.leads/lead.created ────┐   │  CRM → POST /api/followup/jobs
 (new push script)     (+ sourceAdapter, followUp) │   │
                                                  ▼   ▼
 CRM meeting → completed ──→ crm.meetings/     ┌───────────────────────────────┐
                             meeting.completed →│  followup-agent-service       │
                                               │  • API Lambda (Express)       │
 ai-calling-service ──→ aicalling.calls/        │  • Worker Lambda              │
   post-call / Exotel status   call.ended ─────→│    - event handlers           │
                                               │    - dispatcher (rate 5 min)  │
                                               │  • Jobs table (DynamoDB)      │
                                               │  • DLQ (SQS)                  │
                                               └───────┬─────────────┬─────────┘
                      POST /api/ai-calling/calls/start  │             │ POST /api/internal/followups/escalations
                      (purpose + context + jobId)       ▼             ▼ POST /api/internal/followups/notes
                                             ai-calling-service     CRM → in-app + email + WhatsApp to
                                             (ElevenLabs + Exotel)  assignee + owner/admins; lead note
```

**Job types**

| Job | Trigger | Agent goal | Tools |
|---|---|---|---|
| `site_visit_confirmation` | Instagram lead with a call request or agreed meeting (hint), the CRM button, or (opt-in) any new Instagram lead with a phone | Greet by name, reference the DM, confirm or lock the site-visit slot, answer property questions from live CRM inventory | `search_properties`, `get_property_details`, `schedule_site_visit`, `confirm_site_visit` (new), `answer_policy_question`, `request_callback` (new) |
| `post_visit_feedback` | Meeting with `meetingType = site_visit` marked `completed` in the CRM | Ask about the visited property, issues, open questions, token or booking timeline | `record_visit_feedback` (new), `get_property_details`, `answer_policy_question`, `request_callback` (new) |

**Job state machine**

`scheduled → calling → connected → done | needs_human` and `calling → not_reached → scheduled (retry) → escalated`, plus `cancelled`.

- Attempt classification from `call.ended`: connected = `completed` with duration ≥ 20 s; not reached = `no_answer | busy | failed | cancelled | call_initiation_failed`, or `completed` under 20 s.
- Retry: up to `maxAttempts` (default 2) with `retryGapMinutes` (default 45), always inside the tenant's business hours (`businessHoursStart/End`, `timezone` from agency config; default 10:00 to 19:00 Asia/Kolkata). Outside hours the job moves to the next window.
- Escalation when attempts are exhausted, when the agent invoked `request_callback`, or when feedback contains an open action: in-app notification with `targetUserIds` = lead `assignedTo` plus tenant admins, email to both, WhatsApp best-effort, and a lead note with the transcript summary and reason.
- Watchdog: a job in `calling` for more than 20 minutes without a terminal event counts as a failed attempt.
- Idempotency: dedupe key per `(tenant, lead, jobType, meetingId)`, DynamoDB conditional writes, `ttl` on finished jobs (90 days).

**Data model**: table `<env>-realestateflow-followup-data` (PAY_PER_REQUEST, PITR, SSE, TTL, Retain)

- `PK=TENANT#{t}#JOB#{jobId}`, `SK=JOB` (job); `SK=ATTEMPT#{n}` (attempt with `callSessionId`, outcome, duration, summary).
- `GSI1 due-index`: `GSI1PK=DUE#{yyyy-mm-dd}`, `GSI1SK={dueAtIso}#{jobId}`; the dispatcher reads today's and yesterday's buckets for `status=scheduled`.
- `GSI2 tenant-index`: `GSI2PK=TENANT#{t}#JOBS`, `GSI2SK=createdAt`.
- `GSI3 call-index`: `GSI3PK=CALL#{callSessionId}` to resolve `call.ended` → job.
- `PK=TENANT#{t}#DEDUPE#{key}` guard items with TTL.

**API** (Express via `serverless-http`, single `{proxy+}`). All routes need `x-api-key` = `FOLLOWUP_CALLER_API_KEY` and `x-tenant-id` (the ai-calling-service trust model):

- `POST /api/followup/jobs` create or schedule `{leadId, jobType, dueAt?, context?, requestedBy}`
- `GET /api/followup/jobs?leadId=&status=`, `GET /api/followup/jobs/:id` (with attempts)
- `POST /api/followup/jobs/:id/cancel`, `POST /api/followup/jobs/:id/run-now`
- `GET /api/health`

**Infra** (`infra/cfn-followup.yaml`): DynamoDB table; Secrets Manager secret; two Lambdas (api, worker) from one zip; API Gateway REST plus base-path mapping; three EventBridge pattern rules (`crm.leads/lead.created`, `crm.meetings/meeting.completed`, `aicalling.calls/call.ended`) and one `rate(5 minutes)` rule; SQS DLQ as the worker's async failure destination; optional CloudWatch alarms to the existing `<env>-realestateflow-alerts` topic; tight IAM (own table, own secret, own log groups).

### 3.2 Changes to `ai-calling-service/` (backward compatible)

1. `POST /calls/start` accepts optional `context` (`meeting`, `property`, `visitedProperty`, `instructions`) and `metadata` (`followupJobId`, `source`). New purposes `site_visit_confirmation`, `post_visit_feedback`, `click_to_call`.
2. `buildDynamicVariables` adds `meeting_details`, `property_details`, `visit_details`, `assigned_agent_name` (strings with "not known" fallbacks). Prompt doc gets two new purpose sections.
3. New server tools and routes: `confirm_site_visit` (confirm or reschedule an existing meeting via new CRM internal `PATCH /api/internal/meetings/:id`), `record_visit_feedback` (structured feedback on the session plus a CRM lead note), `request_callback` (marks the session `needsHuman` with a reason).
4. Post-call and Exotel terminal webhooks publish EventBridge `aicalling.calls` / `call.ended` with `{tenantId, leadId, callSessionId, callPurpose, status, outcome, duration, followupJobId, needsHuman, feedback, transcriptSummary, dataCollection}`. `call_initiation_failure` is published too. Template gets `events:PutEvents`.
5. New `POST /api/ai-calling/calls/connect` for click-to-call: Exotel `POST /v1/Accounts/{sid}/Calls/connect.json` (`From` = team member, `To` = contact, `CallerId` = ExoPhone, `StatusCallback` = existing Exotel status webhook). New param `ExotelCallerId`. A `click_to_call` session is recorded so the status webhook has somewhere to land.
6. Removes the stray `--version` file.

### 3.3 Changes to CRM `server/`

1. Fix Bug A (site visits), Bug B (available properties), Bug C (search projection), Bug D (public list leak).
2. `updateMeeting()` publishes `crm.meetings` / `meeting.completed` (and `meeting.cancelled`) on the default bus; `lead.created` detail gains `sourceAdapter` and optional `followUp` hint. `createMeeting` persists `meetingType`, `propertyId`, `propertyName`, `source`.
3. `POST /api/internal/adapters/leads` items accept optional `followUp: {type, meetingSchedule, propertyHint, note}`. After ingest (created or matched by phone) the CRM forwards a job to the follow-up service, so the Excel pipeline needs only the adapter key. The ManyChat webhook accepts optional `callRequested` and `meetingSchedule` fields.
4. New `routes/followupInternal.js` (key `FOLLOWUP_INTERNAL_API_KEY`): `GET /api/internal/followups/leads/:leadId/snapshot` (lead, assignee, upcoming or last site-visit meeting, property, agency follow-up settings, escalation contacts), `POST /api/internal/followups/escalations`, `POST /api/internal/followups/notes`. `PATCH /api/internal/meetings/:id` is added to `aiCallingInternal.js` for the agent tool.
5. Proxy routes for the UI: `POST /api/crm/leads/:id/followup-call`, `GET /api/crm/leads/:id/followups`, `POST /api/crm/followups/:jobId/cancel` (member or above; the phone never leaves the server). API Gateway route entries added.
6. Agency config gains `followupCallsEnabled`, `followupCallOnNewInstagramLead` (default false), `followupMaxAttempts` (2), `followupRetryGapMinutes` (45), `followupPostVisitDelayMinutes` (120), `followupEscalationUserIds` on `GET/PATCH /api/crm/config/ai-employee`.
7. Config plumbing: `FOLLOWUP_SERVICE_DOMAIN_NAME`, `FOLLOWUP_SERVICE_BASE_PATH`, `FOLLOWUP_CALLER_API_KEY`, `FOLLOWUP_INTERNAL_API_KEY` in `cfn-backend.yaml`, `ssm-param-map.txt`, `config/serviceUrls.js`, `.env.sample`.
8. Phone masking (3.5) and Exotel click-to-call (3.6).

### 3.4 Instagram Excel pipeline (`hp-insta-lead-automation`)

- New `scripts/push_leads_to_crm.py`: reads the `Leads` sheet, selects rows with a `mobile_number` and (`action_channel ∈ {call, meeting}` or `dm_can_be_closed = yes`), posts them to `POST /api/internal/adapters/leads` with `x-adapter: insta-excel`, `dedupeKey = insta-excel:<lead_id>`, and the `followUp` hint (`meeting_schedule`, locality or building name, summary). Records what was pushed in a `pushed_to_crm` column plus a Changelog row so nothing is sent twice. Config in `config/crm-push.json` (gitignored; sample committed).
- Analyst contract gains two machine-readable fields: `call_requested: yes|no` and `meeting_datetime` (ISO or blank). Added to `.claude/agents/insta-lead-analyst.md` and the workbook columns.

### 3.5 Phone-number masking (CRM)

- Server-side masking on every `/api/crm/*` JSON response for any role other than `ADMIN | FOUNDER | OWNER`: fields `phone`, `mobile`, `alternatePhone`, `normalizedPhone`, `contactNumber`, `ownerPhone`, `attendeePhone`, `relatedEntityPhone`, `whatsapp`, `phoneNumber` (nested objects and arrays included) become `+91 ******1234` and a `phoneMasked: true` flag is set on each masked object. Implemented once as a `res.json` wrapper middleware, so all ~35 response sites are covered without editing each route.
- By-phone lookup routes keep working (a member who already has a number can search by it) but return masked records. CSV/exports for masked roles omit phone columns.
- Inbound guard in the same middleware: a masked-shaped phone value or a `phoneMasked` flag in any `/api/crm/*` request body is dropped before the route runs, so a masked user's save cannot overwrite a real number (added 2026-09-15 after verification found pages without the frontend strip).
- Frontend shows the masked value and replaces `tel:` links with a "Call" button (3.6).

### 3.6 Exotel click-to-call (CRM plus calling service)

- CRM `POST /api/crm/calls/click-to-call {entityType, entityId}` (member or above): resolves the contact's phone server-side, takes the caller's number from the authenticated user profile, then calls `POST /api/ai-calling/calls/connect` on ai-calling-service, which holds the Exotel credentials. The number is never returned to the browser. The call is logged as a `click_to_call` contact activity on the entity.
- New calling-service config: `EXOTEL_CALLER_ID` (the ExoPhone). Required in prod, optional in dev (feature returns 503 until set).

### 3.7 Frontend (`real-estate-crm-app/`), kept minimal

- Lead detail: "Schedule AI follow-up call" button and a follow-up timeline (attempts, outcome, escalation).
- Masked phone display plus a "Call" (Exotel) button on lead, buyer, seller, owner, tenant and property cards and detail pages; the calendar `tel:` link replaced, the enquiry one gated on the full-phone role (that page is not routed on this branch).
- Settings → AI Employee: follow-up call toggles and escalation contacts.

---

## 4. Deliverables checklist

- [ ] `followup-agent-service/`: src, tests (`node --test`), `infra/cfn-followup.yaml`, `infra/deploy.sh`, `infra/config-deploy.sh`, `infra/config-only-allowed-params.json`, `infra/lib/*`, `.env.example`, `.gitignore`, README, this document.
- [ ] `cfn-templates-cicd/followup-agent-service/`: `deploy.sh`, `README.md`, `.gitignore`.
- [ ] `ai-calling-service/`: purposes, context, three new tools, `call.ended` events, connect endpoint, prompt and tools docs, template IAM and params, tests.
- [ ] `server/`: bugs A to D, meeting events, follow-up internal and proxy routes, agency config fields, adapters `followUp` hint, phone masking middleware, click-to-call route, API Gateway route entries, template/SSM/env plumbing, tests.
- [ ] `hp-insta-lead-automation/`: `push_leads_to_crm.py`, analyst contract fields, workbook columns.
- [ ] `real-estate-crm-app/`: follow-up UI, masked phones plus Call button, settings.
- [ ] Runbook: ElevenLabs dashboard changes (three new tools, two prompt sections, no webhook change) and dev deploy order.

## 5. Decisions and defaults (change any of these)

| # | Topic | Default that will be implemented |
|---|---|---|
| 1 | First-call trigger | Explicit hint (`call_requested` or meeting agreed) from any Instagram path, or the CRM button. Auto-calling every new Instagram lead is a per-tenant toggle, off by default. |
| 2 | Post-visit call | 120 minutes after the site-visit meeting is marked completed, inside business hours, else the next window. |
| 3 | Retries | 2 attempts, 45 minutes apart, then escalate to `assignedTo` plus admins via in-app and email, plus WhatsApp if connected. |
| 4 | Phone masking | `ADMIN` (and the unused `FOUNDER/OWNER`) see full numbers; everyone else sees `+91 ******1234`. Applies to leads too. |
| 5 | Click-to-call | Exotel Connect through ai-calling-service; team member's phone from their user profile; ExoPhone caller ID from config. |
| 6 | Deploy | Templates validated locally (`cfn-lint` / `validate-template` where credentials allow). No AWS deploy without your go-ahead. |
| 7 | Gating and billing | Follow-up calls require `aiEmployeeEnabled` and are billed through the existing `chargeForAiCall` path. |
| 8 | ElevenLabs agent | One shared agent with the prompt extended per purpose; per-purpose agent-id override supported via env for later. |
| 9 | Service folder name | `followup-agent-service/` (wrapper folder named identically, as the deploy skill requires). |

## 6. Open questions

1. Which Instagram path is primary for the first call: ManyChat (C), the laptop agent (B), or the Excel pipeline (A)? All three will be wired; say if one should be skipped.
2. Should a future `MANAGER` role see full numbers? Default: no.
3. Is the team member's mobile number reliably filled in on their profile today (it exists as `phoneNumber` on `/auth/me`)? If not, the click-to-call route will return a clear 400 asking them to add it.
4. Do you have a dev ExoPhone (caller ID) and is Exotel Connect enabled on the account? Needed only to test click-to-call live.
5. Escalate to all admins of the tenant, or a configured list of user ids? Default: all admins plus any configured extras.

## 7. Risks and notes

- ElevenLabs post-call webhooks may not fire for unanswered calls; the design also consumes Exotel terminal statuses and has a 20-minute watchdog.
- The Excel pipeline is single-tenant and offline; it needs `crm-push.json` with the tenant id and adapter key.
- `nodejs20.x` runtime kept (bundled AWS SDK v3 clients).
- All new secrets are NoEcho → Secrets Manager; nothing sensitive in Lambda env vars.
- Masking is enforced server-side, so even stale frontend builds cannot show a number to a member.

## 8. Approval

- [ ] Approved as-is
- [ ] Approved with the changes noted above

---

## 9. Implementation status (updated 2026-09-15)

Everything in Section 4 is implemented and committed on `nabi-app-git-bkp` / `feat/property-pages-ms` (feature `1a09e07`, docs `14a002b`, verification fixes on top). Nothing is deployed and nothing is pushed to origin. On 2026-09-15 every claim in the four docs was re-checked against this branch's code; the corrections are in the docs and in the two small code changes listed below.

| Area | State | Verification |
|---|---|---|
| `followup-agent-service/` + `cfn-templates-cicd/followup-agent-service/` | Complete | 42 unit tests pass; `aws cloudformation validate-template` OK; `cfn-readiness-auditor` verdict READY_TO_DEPLOY (secrets blank by design) |
| `ai-calling-service/` (purposes, context, 3 tools, `call.ended` events, `/calls/connect`, `EXOTEL_CALLER_ID`, docs) | Complete | 54 tests pass |
| `server/` (bugs A to D, meeting events, follow-up internal + proxy routes, adapter `followUp`, agency config, phone masking incl. inbound guard, click-to-call, SSM/CFN/API Gateway plumbing) | Complete | 122 tests across the 10 server test files the feature touched pass; 12 pre-existing jest suites fail locally for unrelated missing SDK modules |
| `real-estate-crm-app/` (PhoneNumber component, Call button, AI follow-up card, settings) | Complete | typecheck: no new errors (84 pre-existing on this branch) |
| `hp-insta-lead-automation/` (`push_leads_to_crm.py`, analyst fields, workbook columns) | Complete | 30 unittest cases pass; the folder is tracked in this repo |

Verification fixes (2026-09-15): (1) `server/middleware/phoneMasking.js` now strips masked phone values and `phoneMasked` from inbound `/api/crm` bodies (property/developer/customer pages had no frontend strip); (2) `followup-agent-service/src/handlers/worker.js` logs a `dispatch result` line per due job and an `event handled` line per event so the test brief's log checks are real. Known UI limits found: the meeting scheduler has no meeting-type or property picker (site visits are recognised by title), the calendar shows no AI-confirmation badge, and the enquiries page is not routed.

Still needed before anything goes live (see `docs/RUNBOOK.md`): your answers to Section 6, the three shared secrets in `.env.dev`, deploys in the order ai-calling → followup → server → frontend, and the ElevenLabs dashboard prompt/tool updates.
