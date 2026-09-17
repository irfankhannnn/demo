# Call Intelligence — test plan

Step-by-step verification for the call recording → transcript → AI analysis →
CRM update feature. Each test states what to do and what "passed" looks like.

Architecture and configuration reference: [`CALL_INTELLIGENCE.md`](CALL_INTELLIGENCE.md).

---

## 0. Prerequisites

| Requirement | How to check |
|---|---|
| Signed in as `ADMIN`, `FOUNDER` or `OWNER` | The CRM Dashboard shows a **Call Recordings** entry |
| `GEMINI_API_KEY` and `GEMINI_MODEL` set on the API and worker Lambdas | `aws lambda get-function-configuration --function-name dev-real-estate-api --query 'Environment.Variables.GEMINI_MODEL'` |
| Stack deployed with the queue and worker | `aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?starts_with(OutputKey,'CallRecording')]"` |
| Amazon Transcribe available in the deployment region | `aws transcribe list-transcription-jobs --max-results 1` |

Test audio: three or four real recordings, 1–5 minutes, at least one Hinglish,
saved with the customer's number in the file name. Also prepare a lead, a tenant
and an owner in the CRM whose phone numbers match some of those files.

```bash
export API=https://<crm-api-host>/api
export TOKEN=<jwt>
export TENANT=<tenant-id>
auth=(-H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" -H "Content-Type: application/json")
```

---

## A. Automated tests

### A1 — Unit tests

```bash
cd server
CRM_DYNAMODB_TABLE_NAME=test-crm-table npx --node-options=--experimental-vm-modules jest services/callIntelligence workers
```

**Success:** 8 suites, 111 tests, all passing.

### A2 — No regression in the existing suite

```bash
cd server
CRM_DYNAMODB_TABLE_NAME=test-crm-table DYNAMODB_TABLE_NAME=test-table \
AGENCY_CONFIG_DYNAMODB_TABLE_NAME=test-agency AREAS_DYNAMODB_TABLE_NAME=test-areas \
NOTIFICATIONS_TABLE_NAME=test-notif npx --node-options=--experimental-vm-modules jest
```

**Success:** the same 13 pre-existing failures as on the base branch and no
others. Those 13 are unrelated fixture drift in `skillInvoker`,
`responseFormatter`, `leadTextNormalizer` and `inputNormalizer.search`; compare
against `git stash && npx jest` on the base commit if in doubt.

### A3 — Frontend builds and typechecks

```bash
cd real-estate-crm-app
npx tsc --noEmit | wc -l   # 135 — identical to the base branch
npm run build
```

**Success:** the build completes and the error count is unchanged from the base
branch (the 135 are pre-existing errors in unrelated components; none mention
`CallRecordings`, `CallRecordingReviewDrawer` or `callIntelligence`).

### A4 — Templates and scripts are valid

```bash
cd agency-app/api/infra
bash -n deploy.sh
python3 -c "import json; json.load(open('cfn-params.sample.json'))"
aws cloudformation validate-template --template-body file://cfn-backend.yaml
```

**Success:** all three exit 0.

---

## B. Deployment verification

### B1 — Stack resources exist

```bash
aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?starts_with(OutputKey,'CallRecording')].[OutputKey,OutputValue]" --output table
```

**Success:** queue URL, DLQ URL and worker function name are all returned.

### B2 — Worker is wired to the queue

```bash
aws lambda list-event-source-mappings \
  --function-name "${ENVIRONMENT_NAME}-real-estate-call-recording-worker" \
  --query 'EventSourceMappings[0].[State,BatchSize,FunctionResponseTypes]'
```

**Success:** `["Enabled", 5, ["ReportBatchItemFailures"]]`.

### B3 — S3 CORS allows the browser PUT

```bash
aws s3api get-bucket-cors --bucket "$S3_BUCKET_NAME"
```

**Success:** a rule with `PUT` in `AllowedMethods` and `ETag` in
`ExposeHeaders`, and the pre-existing GET rule still present.

### B4 — Route is reachable

```bash
curl -s -o /dev/null -w '%{http_code}\n' "${auth[@]}" "$API/crm/call-recordings"
```

**Success:** `200`. A `403` means the signed-in user is not an admin; a `404`
means the deploy did not pick up `routes/callRecordings.js`.

---

## C. Happy path — matched lead

### C1 — Upload

1. Open **CRM → Call Recordings**.
2. Drag in a recording whose file name contains a phone number belonging to an
   existing lead, e.g. `9876543210.mp3`.

**Success:**
- A progress bar reaches 100%, then the row shows "Processing".
- Within a few seconds a card appears with status **Queued** or
  **Transcribing**, the detected phone number, and the matched lead's name.
- No page reload is needed; the list polls while anything is in flight.

### C2 — Transcription

Wait. A 3-minute recording usually finishes in 1–3 minutes.

**Success:**
- Status moves `TRANSCRIBING → TRANSCRIBED → ANALYZING → AWAITING_APPROVAL`
  (or `COMPLETED` if the only action was the note).
- The card shows a duration and a detected language.
- CloudWatch: `/aws/lambda/${ENVIRONMENT_NAME}-real-estate-call-recording-worker`
  contains `callIntelligence.transcription.completed`.

### C3 — Analysis quality

Open the recording to see the review drawer.

**Success:**
- The summary describes the call in 2–4 sentences and is recognisably about the
  right conversation.
- Key points are specific (budget, locality, BHK) rather than generic.
- Topics match what was discussed.
- Requirements, site visit, follow-up and payment blocks reflect the call; empty
  blocks are absent rather than invented.
- **Show transcript** expands the full transcript, with speaker segments when
  diarization succeeded.
- **Play** produces a working audio player.

### C4 — The note is applied automatically

Open the matched lead in the CRM.

**Success:**
- A new note beginning `📞 Call summary (AI) — YYYY-MM-DD` exists.
- It contains the summary, the key points and a `Source: call recording <id>`
  line.
- In the drawer the note action shows the **applied** badge.
- No other CRM field changed.

### C5 — Approving a suggested update

In the drawer, find "Update lead from call" and click **Approve**.

**Success:**
- The badge becomes **applied** within a second or two.
- The lead now shows the new status/budget/locality.
- When the last pending action is resolved the recording becomes
  **Completed**.
- The agent audit log has an `approve_apply` entry for
  `call-recording-analyzer`.

### C6 — Rejecting a suggestion

Reject a remaining action.

**Success:** it shows **rejected**, nothing changes in the CRM, and the
recording still reaches **Completed** once nothing is pending.

---

## D. The requested scenarios

### D1 — Tenant call about painting / whitewash

Upload a recording of a tenant or owner call where painting or whitewashing is
discussed, with the tenant's number in the file name.

**Success:**
- The recording matches the **tenant** record.
- The summary note lands on the tenant, not on a lead.
- A `create_meeting` action titled `Approve painting work visit` (or the
  detected work type) is proposed with **Approval required**.
- It is *not* applied until clicked — check the calendar before approving.
- Approving creates the meeting on the tenant with notes that include the work
  description, any cost mentioned, and the source recording id.

This is the "create an invite and ask for approval from the agency owner"
requirement: the work visit is never scheduled without an explicit click.

### D2 — Owner call

Upload a call with a property owner.

**Success:** matched as **owner**, note written via `create_owner_note`, and any
maintenance discussion again gated behind approval.

### D3 — Unknown number

Upload a recording whose number is not in the CRM, e.g. `9812345678.mp3`.

**Success:**
- Status reaches `AWAITING_APPROVAL`, matched entity shows **Unmatched**.
- No note action is proposed — there is nowhere to put it.
- A **Create new lead** action is proposed with the caller's name (when the call
  gave one), the phone number, and the requirement extracted from the call.
- Approving it creates the lead; the lead then appears in the leads list with
  those requirements.

### D4 — Khata / payment discussion

Upload a call where money owed or paid is discussed.

**Success:**
- The drawer shows a payment hint: direction, amount, due date and
  "Record it in Khata Book manually if it is confirmed."
- **No** Khata Book entry is created and no action proposes one.

### D5 — Site visit request

Upload a call where the customer asks to see a property.

**Success:** a `create_meeting` "Schedule site visit" action is proposed for the
stated date, or two days out with "(date not stated on the call — please
confirm)" when no date was given. Approving creates the meeting on the matched
record.

### D6 — Hinglish call

Upload a call that switches between Hindi and English.

**Success:** the transcript contains both languages, the detected language is an
Indian locale, and the summary is coherent English prose describing the call.

---

## E. Corner cases

| # | Setup | Expected |
|---|---|---|
| E1 | File name with no phone number (`Recording 2026-08-09.mp3`) | Uploads and processes; matched entity **Unmatched**; no crash |
| E2 | File name with two numbers (`Rahul_9876543210_and_9811111111.mp3`) | One picked, confidence **medium**, both listed as candidates |
| E3 | `+91 98765 43210.m4a` | Same match as `9876543210.mp3` |
| E4 | `0091-9876543210 (owner).amr` | Matches; `.amr` transcribes |
| E5 | 250 MB file | Rejected client-side with "File is larger than 200 MB"; no row created |
| E6 | `.txt` renamed to `.mp3` | Upload succeeds, transcription fails, status **Failed** with a readable reason; the row is still deletable |
| E7 | Silent / music-only recording | Reaches `COMPLETED` with "No speech detected in this recording."; no actions proposed |
| E8 | Same file uploaded twice within 24h | Both process; the second shows a "possible duplicate" marker; neither is blocked |
| E9 | Approve the same action twice (two tabs) | Second returns `409` "Action has already been applied"; the CRM is written once |
| E10 | Approve an action whose target record was deleted | Action goes to **failed** with the tool's error; recording stays reviewable; **Re-analyse** recovers |
| E11 | `POST /:id/confirm` without uploading | `409` "Upload not found in storage" |
| E12 | `POST /:id/confirm` twice | Second returns `alreadyConfirmed: true`; the pipeline is not started twice |
| E13 | Non-admin user opens `/crm/call-recordings` | API returns `403`; no dashboard entry is shown |
| E14 | Recording id from another tenant | `404`, never another tenant's data |
| E15 | Unsupported type (`application/pdf`) | `400` from the schema before any URL is issued |
| E16 | Expired pre-signed URL (wait >15 min, then PUT) | S3 rejects; the UI shows the upload error; retry works |

### E9 in detail

```bash
export REC=<recordingId from the list endpoint>
ACTION=$(curl -s "${auth[@]}" "$API/crm/call-recordings/$REC" | jq -r '.recording.proposedActions[] | select(.status=="pending") | .actionId' | head -1)
curl -s -o /dev/null -w '%{http_code}\n' -X POST "${auth[@]}" -d '{}' "$API/crm/call-recordings/$REC/actions/$ACTION/approve"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "${auth[@]}" -d '{}' "$API/crm/call-recordings/$REC/actions/$ACTION/approve"
```

**Success:** `200` then `409`, and exactly one note/meeting in the CRM.

### Tool allowlist

The approve endpoint executes the stored action, not a client-supplied tool, and
`executeAction` re-checks `PROPOSABLE_TOOLS` before calling `invokeSkill`, so a
tool name cannot be injected at all. What a client *can* send is edited
arguments, so verify that identity arguments survive the edit. Pick a pending
`create_meeting` action and try to re-point it:

```bash
MEETING=$(curl -s "${auth[@]}" "$API/crm/call-recordings/$REC" \
  | jq -r '.recording.proposedActions[] | select(.status=="pending" and .tool=="create_meeting") | .actionId' | head -1)
curl -s -X POST "${auth[@]}" \
  -d '{"arguments":{"relatedEntityId":"SOME-OTHER-LEAD","title":"Edited by the owner"}}' \
  "$API/crm/call-recordings/$REC/actions/$MEETING/approve" \
  | jq '.recording.proposedActions[] | select(.actionId=="'"$MEETING"'") | .arguments'
```

**Success:** `relatedEntityId` is still the originally matched record while the
edited `title` is honoured, and the meeting appears on that original record.

---

## F. Resilience

### F1 — Duplicate SQS delivery

```bash
QUEUE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CallRecordingQueueUrlOutput'].OutputValue" --output text)
aws sqs send-message --queue-url "$QUEUE" \
  --message-body "{\"tenantId\":\"$TENANT\",\"recordingId\":\"$REC\",\"stage\":\"ANALYSIS\"}"
```

Send it against a recording that is already `COMPLETED`.

**Success:** the worker logs the message as processed, the recording is
unchanged, and no duplicate note or meeting appears. Repeat with
`"stage":"TRANSCRIPTION"` — no second Transcribe job is started.

### F2 — Poison message goes to the DLQ

```bash
aws sqs send-message --queue-url "$QUEUE" --message-body 'not json'
aws sqs get-queue-attributes --queue-url "$DLQ" --attribute-names ApproximateNumberOfMessages
```

**Success:** the worker logs `callRecordingWorker.message.unparseable`, the
message is dropped (no infinite retry), and healthy recordings continue to
process.

### F3 — Transcription failure recovery

Force a failure (E6), then click **Re-analyse**.

**Success:** the recording restarts from `UPLOADED`, the attempt counters reset,
and the status leaves `FAILED`.

### F4 — Inline mode (no queue)

Run the server locally with `CALL_RECORDING_QUEUE_URL` unset.

**Success:** upload → confirm still produces a transcript and an analysis; each
list/detail request nudges the pipeline one step further. This is the local
development path and must not be used in production.

### F5 — Concurrency

Upload five recordings at once.

**Success:** all five reach a terminal status, each note lands on the right
record, and nothing is cross-linked. The worker's batch size of 5 means they may
be processed in one invocation.

---

## G. Multi-tenancy

1. Sign in as tenant A, upload a recording, note the id.
2. Sign in as tenant B.

**Success:**
- `GET /crm/call-recordings` for tenant B does not list A's recording.
- `GET /crm/call-recordings/<A's id>` as B returns `404`.
- `DELETE` of A's id as B returns `404` and A's object still exists in S3.

---

## H. Retention

Delete a recording from the drawer.

**Success:**
- The row disappears from the list.
- `aws s3 ls s3://$S3_BUCKET_NAME/$TENANT/call-recordings/$REC/ --recursive` is
  empty (audio, transcripts and analysis are all removed).
- Notes and meetings already written to the CRM are **kept** — they are ordinary
  CRM records now.

---

## Overall success criteria

The feature is ready when all of the following hold.

1. A recording uploaded by an agency owner is transcribed and analysed without
   any manual step.
2. The caller is identified as a lead, tenant, owner, buyer or contact from the
   phone number in the file name, and can be corrected by hand when it is wrong.
3. Every analysed call leaves a readable summary note on the matched CRM record.
4. Discussion of painting, whitewashing or repairs produces a work-visit invite
   that is **only** created after the agency owner approves it.
5. No CRM write other than the summary note happens without an explicit
   approval, and no tool outside the 12-tool allowlist can ever be executed.
6. Money discussion is surfaced but never posted to Khata Book automatically.
7. Duplicate deliveries, retries and concurrent approvals cannot produce
   duplicate CRM records.
8. A failure at any stage leaves a readable reason and a one-click recovery.
9. No tenant can see or touch another tenant's recordings.
10. Existing CRM functionality is unchanged: the pre-existing test failure count
    and the frontend typecheck error count are identical to the base branch.
