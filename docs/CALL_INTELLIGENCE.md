# Call Intelligence — call recordings to CRM updates

Agency owners record their calls with leads, tenants and owners. This feature
takes those recordings, works out who the call was with, transcribes it,
analyses what was discussed and proposes the CRM updates that follow from it.
Nothing is written to the CRM except the call-summary note until the owner
approves it.

- Frontend page: **CRM → Call Recordings** (`/crm/call-recordings`, admin only)
- API base path: `/api/crm/call-recordings`
- Backend code: `apps/crm/server/services/callIntelligence/`, `apps/crm/server/routes/callRecordings.js`,
  `apps/crm/server/workers/callRecordingWorker.js`

---

## 1. What happens to a recording

```
Browser                API Lambda              SQS                Worker Lambda
   │                        │                   │                      │
   │ 1 POST /upload-url     │                   │                      │
   │───────────────────────▶│ parse phone from file name               │
   │                        │ match lead/tenant/owner/buyer/contact    │
   │                        │ write DynamoDB row (PENDING_UPLOAD)      │
   │◀── pre-signed PUT ─────│                   │                      │
   │                        │                   │                      │
   │ 2 PUT file ──────────────────────────────────────────▶ S3         │
   │                        │                   │                      │
   │ 3 POST /:id/confirm    │                   │                      │
   │───────────────────────▶│ HeadObject verify │                      │
   │                        │ UPLOADED → QUEUED │                      │
   │                        │──── enqueue ─────▶│──────────────────────▶│
   │                        │                   │            4 StartTranscriptionJob
   │                        │                   │◀── re-enqueue (45s) ──│
   │                        │                   │──────────────────────▶│
   │                        │                   │            5 poll; on COMPLETED
   │                        │                   │              write transcript to S3
   │                        │                   │──── ANALYSIS ────────▶│
   │                        │                   │            6 Gemini analysis
   │                        │                   │              plan actions
   │                        │                   │              auto-apply the note
   │ 7 GET /:id (polling)   │                   │                      │
   │───────────────────────▶│                   │                      │
   │ 8 approve / reject ───▶│ invokeSkill → CRM │                      │
```

Steps 4–6 run in the worker Lambda. Amazon Transcribe batch jobs are
asynchronous, so the worker starts a job and re-queues itself with an SQS delay
instead of holding a Lambda open for the length of the call.

### Status machine

| Status | Meaning |
|---|---|
| `PENDING_UPLOAD` | Row created, waiting for the browser PUT |
| `UPLOADED` | Object verified in S3 |
| `QUEUED` | Job handed to SQS |
| `TRANSCRIBING` | Amazon Transcribe job running |
| `TRANSCRIBED` | Transcript stored in S3 |
| `ANALYZING` | Gemini analysis running |
| `ANALYZED` | Analysis stored, actions proposed |
| `AWAITING_APPROVAL` | At least one action is still pending |
| `COMPLETED` | No pending actions left |
| `FAILED` | A stage gave up; `failureStage` / `failureReason` say why |

`AWAITING_APPROVAL` and `COMPLETED` are recomputed from the action list after
every approve/reject, so rejecting the last pending action completes the
recording.

---

## 2. Identifying the caller

`apps/crm/server/services/callIntelligence/phoneExtractor.js` reads the number out of the
file name. Recorder apps produce wildly different names, so the parser strips
the extension, glues digit groups split by spaces or dashes, and then evaluates
each digit run:

| File name | Extracted | Confidence |
|---|---|---|
| `9876543210.mp3` | 9876543210 | high |
| `+91 98765 43210.m4a` | 9876543210 | high |
| `0091-9876543210 (owner).amr` | 9876543210 | high |
| `Call_Rahul_919876543210_20260809_101500.mp3` | 9876543210 | medium |
| `20260809_101500_09876543210.wav` | 9876543210 | medium |
| `Recording 2026-08-09.mp3` | — | — |

Only Indian mobile shapes (10 digits starting 6–9) are accepted, so dates and
landline-style numbers do not produce false matches. When a name contains more
than one plausible number the confidence drops to `medium` and every candidate
is returned so the UI can show them.

`entityResolver.js` then looks the number up across the CRM using the lookups
that already exist — `getLeads`, `findPersonByPhone`, `findContactByPhone` — and
ranks the hits **lead → tenant → owner → buyer → contact**. A live sales
conversation is most useful on the lead record; the unified contact is the last
resort. Every hit is returned as a candidate, so the owner can re-point the
recording from the review drawer when the ranking guessed wrong.

If nothing matches, the recording stays `unmatched` and the analysis proposes
creating a lead instead of writing a note.

---

## 3. Transcription

`transcription/TranscriptionProvider.js` defines the contract:

```js
startTranscription({ tenantId, recordingId, s3Key, filename, attempt }) → { jobId }
pollTranscription({ jobId, tenantId, recordingId })
  → { status: 'IN_PROGRESS' }
  | { status: 'FAILED', error }
  | { status: 'COMPLETED', result: { transcript, segments, language, confidence, durationSeconds, provider } }
```

`transcription/amazonTranscribeProvider.js` implements it today. Swapping in
Whisper later means adding one file and one case in
`transcription/index.js` — nothing upstream changes, because the pipeline only
ever sees the normalized result shape.

Language handling matters for this audience: Indian real-estate calls
code-switch constantly. By default the provider passes
`IdentifyMultipleLanguages` with `LanguageOptions` covering English plus the
major Indian languages, which handles Hinglish far better than pinning a single
language. Set `TRANSCRIBE_LANGUAGE_CODE` to pin one language instead — that is
also the only configuration where a custom vocabulary
(`TRANSCRIBE_VOCABULARY_NAME`) reliably applies, so use it if you have built a
vocabulary of local project and area names.

Speaker diarization is requested (2 speakers). Some region/account combinations
reject language identification together with `Settings`; the provider retries
once without `Settings` so the recording is transcribed without diarization
rather than failing outright.

---

## 4. Analysis and the action plan

`analysisService.js` sends the transcript to Gemini with a strict JSON contract
(`analysisPrompt.js`) and `responseMimeType: 'application/json'`. The response
is passed through `normalizeAnalysis`, which coerces every field: unknown topics
are dropped, money strings become numbers, malformed dates become `null`, list
fields are capped, and `suggestedLeadStatus` must be one of the five statuses
`update_lead` accepts. The model's raw output is never trusted directly. If the
first reply is not parseable JSON there is exactly one repair attempt, then the
stage fails cleanly.

It calls Gemini directly rather than going through `agents/agentRuntime.js`,
because the AI Employee runtime is gated on provisioning, credits and a rollout
percentage — an owner uploading their own recordings should not be blocked by
those switches. Tool *execution* still goes through `skillInvoker`, so
permission checks and audit logging are unchanged.

`actionPlanner.js` maps the analysis to CRM tool calls **deterministically**.
The model reports what was said; the rules decide what the CRM may be asked to
do. That is why the LLM never emits a tool name, and why the mapping is
unit-testable without an LLM.

| Situation | Proposed action | Approval |
|---|---|---|
| Any analysed call with a matched record | `create_*_note` with the call summary | auto-applied |
| Number matched nothing | `create_lead` | required |
| Lead requirements or status changed | `update_lead` | required |
| Site visit requested | `create_meeting` | required |
| Painting / whitewash / repairs discussed | `create_meeting` for the work visit | required |
| Follow-up promised | `create_meeting` | required |
| Payment / khata discussed | *no action* — surfaced as a text hint | n/a |

Money is never posted to Khata Book automatically. Payment talk becomes a hint
on the review screen that the owner acts on manually.

Two safety nets close the loop in `planActions`: any tool outside
`PROPOSABLE_TOOLS` is filtered out, and anything not in
`AUTO_APPLICABLE_TOOLS` is forced to `requiresApproval: true` regardless of what
the rest of the planner decided. `actionExecutor.js` checks the allowlist again
before calling `invokeSkill`, so a hand-crafted request cannot smuggle
`delete_lead` through the approve endpoint.

`PROPOSABLE_TOOLS` is 12 of the 65 CRM tools, and none of them delete anything.

---

## 5. Storage

### DynamoDB

One item per recording in the existing CRM table — no new table:

```
PK     = TENANT#{tenantId}#CALL_RECORDING#{recordingId}
SK     = PROFILE
GSI1PK = TENANT#{tenantId}#CALL_RECORDINGS
GSI1SK = {createdAt}#{recordingId}
```

The list view is a `ScanIndexForward: false` query on `owner-property-index`,
so recordings come back newest-first without a scan. The item holds the
summary-sized fields (summary, key points, topics, extracted facts, proposed
actions, a 1,200-character transcript preview); bulk payloads live in S3.

### S3 (existing documents bucket)

```
{tenantId}/call-recordings/{recordingId}/original.{ext}
{tenantId}/call-recordings/{recordingId}/transcript/amazon-transcribe-raw.json
{tenantId}/call-recordings/{recordingId}/transcript/transcript.json
{tenantId}/call-recordings/{recordingId}/transcript/transcript.txt
{tenantId}/call-recordings/{recordingId}/analysis/analysis.json
```

Every key is prefixed with the tenant id, matching the convention the rest of
the CRM already uses for documents.

---

## 6. Idempotency and failure handling

SQS is at-least-once, and Lambda retries. Both are handled at the data layer
rather than by hoping messages arrive once.

- **Guarded transitions.** Each stage claims the recording with a conditional
  DynamoDB update (`transitionStatus`) that only succeeds from the statuses that
  stage is allowed to start from. A duplicate delivery loses the race and
  returns `skipped` instead of re-transcribing.
- **Per-stage attempt counters.** `stageAttempts.TRANSCRIPTION` /
  `.ANALYSIS` are incremented atomically; past `CALL_INTEL_MAX_STAGE_ATTEMPTS`
  (default 4) the recording is marked `FAILED` rather than looping.
- **Poll budget.** Transcription polls stop after
  `CALL_INTEL_MAX_POLL_ATTEMPTS` (default 60 × 45s ≈ 45 minutes).
- **Transient vs terminal.** A failed *poll call* (throttling) re-queues; a
  failed *job* marks the recording `FAILED`. Only unexpected exceptions become
  SQS batch item failures, so a business failure is not retried forever.
- **Partial batch responses.** The worker returns `batchItemFailures`, so one
  poisoned message never forces redelivery of its whole batch. Messages that
  keep failing land in the DLQ after 5 receives.
- **Unparseable messages are dropped**, because retrying them cannot help.
- **Duplicate uploads** are detected best-effort (same file name and size within
  24 hours) and surfaced as a warning; the upload is never blocked.
- **Action races.** Approving an action pins both its array index and its id in
  the condition expression, so two browser tabs cannot double-apply it.
- **No queue configured.** With `CALL_RECORDING_QUEUE_URL` unset the pipeline
  runs inline and the list/detail endpoints nudge in-flight recordings forward.
  This keeps local development working end to end without SQS.

Recovery from `FAILED` is one click: **Re-analyse** re-runs the analysis when a
transcript exists, or restarts the whole pipeline when it does not. Actions that
were already applied are preserved so history is not lost.

---

## 7. Security

- Every route requires a valid token, a resolved tenant, and the
  `ADMIN` / `FOUNDER` / `OWNER` role — recordings contain customer PII and the
  approved actions write to the CRM.
- All reads and writes are keyed by `TENANT#{tenantId}`; a recording id from
  another agency simply does not resolve.
- Audio never transits the API Lambda. The browser PUTs to a pre-signed URL that
  expires in 15 minutes and is bound to one key and one content type. Playback
  URLs are short-lived GETs.
- Request bodies are validated with strict Zod schemas — unknown keys are
  rejected, the content type must be an accepted audio type, and the size cap is
  enforced before a URL is issued.
- On approval the owner may edit an action's arguments, but the identity
  arguments (`leadId`, `tenantRecordId`, `ownerId`, `buyerId`, `contactId`,
  `relatedEntityId`, `relatedEntityType`) are re-applied from the original
  proposal, so an approved write cannot be re-pointed at a different record.
- Every executed action is written to the agent audit log under the agent id
  `call-recording-analyzer` with the tool name and arguments.

---

## 8. API reference

All paths are relative to `/api/crm/call-recordings`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/upload-url` | Create the row, return a pre-signed PUT URL |
| POST | `/:recordingId/confirm` | Verify the object and start the pipeline |
| GET | `/` | List recordings (`limit`, `cursor`, `status`) |
| GET | `/:recordingId` | Full detail incl. proposed actions |
| GET | `/:recordingId/transcript` | Transcript JSON (segments + text) |
| GET | `/:recordingId/audio-url` | Short-lived playback URL |
| POST | `/:recordingId/link` | Re-point at a CRM record, optionally re-analyse |
| POST | `/:recordingId/reanalyze` | Re-run analysis, or the whole pipeline |
| POST | `/:recordingId/actions/:actionId/approve` | Apply an action |
| POST | `/:recordingId/actions/:actionId/reject` | Discard an action |
| DELETE | `/:recordingId` | Delete the row and every S3 object |

`POST /upload-url` body:

```json
{
  "filename": "9876543210.mp3",
  "contentType": "audio/mpeg",
  "sizeBytes": 4823192,
  "phone": "9876543210",
  "callDate": "2026-08-09"
}
```

`phone` and `callDate` are optional; `phone` overrides file-name parsing.

Response:

```json
{
  "recordingId": "3f2a…",
  "uploadUrl": "https://…s3….amazonaws.com/…",
  "s3Key": "tenant-1/call-recordings/3f2a…/original.mp3",
  "expiresIn": 900,
  "phone": "9876543210",
  "phoneConfidence": "high",
  "match": { "entityType": "lead", "entityId": "L1", "name": "Rahul" },
  "matchCandidates": [ … ],
  "possibleDuplicateOf": null
}
```

Errors follow the existing convention, `{ "error": string, "details?": string }`:
`400` validation, `403` wrong role, `404` unknown recording/action, `409`
upload missing or action no longer pending, `502` a tool call failed.

---

## 9. Configuration

Backend (`apps/crm/server/.env`, and CloudFormation parameters of the same name):

| Variable | Default | Notes |
|---|---|---|
| `CALL_RECORDING_QUEUE_URL` | *(empty)* | Set by CloudFormation. Empty ⇒ inline processing |
| `ASR_PROVIDER` | `amazon-transcribe` | `whisper` is reserved for a future provider |
| `TRANSCRIBE_LANGUAGE_OPTIONS` | `en-IN,hi-IN,mr-IN,gu-IN,ta-IN,te-IN,kn-IN,ml-IN,pa-IN,bn-IN` | Used for automatic identification |
| `TRANSCRIBE_LANGUAGE_CODE` | *(empty)* | Pin one language; required for a custom vocabulary |
| `TRANSCRIBE_VOCABULARY_NAME` | *(empty)* | Must already exist, or every job fails |
| `CALL_INTEL_AUTO_APPLY_NOTES` | `true` | `false` ⇒ even the summary note needs approval |
| `CALL_INTEL_POLL_DELAY_SECONDS` | `45` | Delay between transcription status polls |
| `CALL_INTEL_MAX_POLL_ATTEMPTS` | `60` | ≈45 minutes of transcription |
| `CALL_INTEL_MAX_STAGE_ATTEMPTS` | `4` | Retries before a stage gives up |
| `CALL_INTEL_MAX_TRANSCRIPT_CHARS` | `60000` | Transcript truncation before the prompt |
| `CALL_INTEL_MAX_UPLOAD_BYTES` | `209715200` | 200 MB upload cap |
| `CALL_INTEL_UPLOAD_URL_TTL_SECONDS` | `900` | Pre-signed PUT lifetime |
| `CALL_INTEL_PLAYBACK_URL_TTL_SECONDS` | `3600` | Pre-signed GET lifetime |
| `CALL_INTEL_DEFAULT_MEETING_TIME` | `11:00` | Slot used when the call named no time |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | — | Already required by the CRM |

CloudFormation-only parameters: `CallIntelWorkerMemorySize` (1024),
`CallIntelWorkerTimeout` (300), `CallRecordingQueueRetentionSeconds` (345600).

Frontend needs no new environment variables — it uses the existing
`VITE_API_URL`.

---

## 10. Infrastructure and deployment

### What the CloudFormation change adds

`apps/crm/server/infra/cfn-backend.yaml`:

- `CallRecordingQueue` — SQS, visibility timeout tied to the worker timeout so a
  message is never redelivered while it is still being processed, redrive to the
  DLQ after 5 receives.
- `CallRecordingDlq` — 14-day retention.
- `CallRecordingWorkerFunction` — same deployment package as the API Lambda with
  a different handler (`workers/callRecordingWorker.handler`), reusing
  `ApiLambdaExecutionRole` so every CRM table and S3 permission is already
  granted.
- `CallRecordingWorkerEventSource` — batch of 5, `ReportBatchItemFailures`.
- IAM: SQS send/receive/delete on the two queues, and
  `transcribe:StartTranscriptionJob` / `GetTranscriptionJob` /
  `ListTranscriptionJobs`.
- An S3 CORS rule allowing `PUT`/`POST` with `ETag` exposed — required for the
  browser to upload directly. The existing GET rule is untouched.
- The call-intelligence environment variables on both Lambdas.

New stack outputs: `CallRecordingQueueUrlOutput`, `CallRecordingDlqUrlOutput`,
`CallRecordingWorkerFunctionOutput`.

### API Gateway

No changes needed. `/api/{proxy+}` already forwards unknown paths to the API
Lambda, which is how `/api/crm/call-recordings/*` is reached. Audio never goes
through API Gateway, so its 10 MB payload limit does not apply.

### CDN / frontend

The SPA is served by Netlify with a catch-all rewrite to `index.html`, so
`/crm/call-recordings` is routable with no config change. There is no
CloudFront distribution in front of the API and no Content-Security-Policy to
extend. The one CDN-adjacent change that *is* required is the S3 CORS rule
above, without which the browser PUT is blocked.

### Deploying

```bash
cd server
bash infra/deploy.sh          # packages workers/, deploys the stack
```

`deploy.sh` now includes `workers/` in the zip, passes the new parameters, and —
on a code-only deploy (`DEPLOY_CFN=false`) — updates
`${ENVIRONMENT_NAME}-real-estate-call-recording-worker` alongside the API
Lambda so the two cannot drift apart. The first deploy must be a full
CloudFormation deploy, since the worker and the queue do not exist yet.

Frontend:

```bash
cd real-estate-crm-app
npm run build     # Netlify runs this on push
```

### Rollback

The feature is additive. Removing the CRM Dashboard entry and the route hides it
entirely; the queue and worker can stay in place with no traffic. Existing
recordings and their notes are ordinary CRM data and are unaffected.

---

## 11. Cost model

Per 10-minute recording, roughly:

| Item | Cost |
|---|---|
| Amazon Transcribe (batch, ~$0.024/min) | ~$0.24 |
| Gemini analysis (~4k in / ~1k out) | ~$0.002 |
| S3 storage (audio ~5 MB + text) | negligible |
| Lambda (start + ~14 polls + analysis) | negligible |
| SQS | negligible |

Transcription dominates. Two levers if volume grows: pin
`TRANSCRIBE_LANGUAGE_CODE` (identification adds processing), and move to a
self-hosted Whisper provider behind the same interface.

---

## 12. Known limitations

- Phone extraction is tuned for Indian mobile numbers. A file name with only a
  landline or an international number yields no match, and the recording lands
  as `unmatched` with a "create lead" proposal.
- Diarization labels speakers `spk_0` / `spk_1` — it does not know which one is
  the agent.
- The list filter by status reads extra pages because DynamoDB filters apply
  after the limit; with very large volumes this should move to a status GSI.
- Duplicate detection only looks at the 50 most recent recordings.
- Khata Book entries are never created automatically, by design.
