# Call Intelligence — Recording Flow Test Plan

Companion to [`flows/03-call-intelligence.md`](./flows/03-call-intelligence.md). That doc describes the target architecture; this one is a practical guide to standing the flow up locally and proving it end to end before/after a change.

**Scope:** upload → S3 → Amazon Transcribe → Gemini analysis → deterministic action plan → approval → CRM write (via `skillInvoker.invokeSkill`, same path WhatsApp uses).

---

## 1. Understanding the flow (recap)

```
Browser              API (server/routes/callRecordings.js)         Pipeline (services/callIntelligence/)
  │ upload-url  ─────────────▶  create DynamoDB row (PENDING_UPLOAD)
  │                             phoneExtractor + entityResolver match
  │◀──── pre-signed PUT URL ───
  │ PUT file ──────────────────────────────────────────▶ S3 (original.mp3)
  │ confirm ──────────────────▶  headObject verify, size check, QUEUED
  │                                                      pipeline.startProcessing()
  │                                                        → runTranscriptionStage (Amazon Transcribe, async poll)
  │                                                        → runAnalysisStage (Gemini → normalizeAnalysis → planActions)
  │                                                        → applyAutomaticActions (notes only, auto)
  │ GET /:id (poll every 10s while in flight)
  │ approve/reject action ────▶  actionExecutor.executeAction → skillInvoker.invokeSkill → CRM write
```

Key files:
| Layer | File |
|---|---|
| Routes | `server/routes/callRecordings.js` |
| Orchestration | `server/services/callIntelligence/pipeline.js` |
| Transcription | `server/services/callIntelligence/transcription/amazonTranscribeProvider.js` |
| Analysis (LLM) | `server/services/callIntelligence/analysisService.js`, `analysisPrompt.js` |
| Action planning (rules, no LLM) | `server/services/callIntelligence/actionPlanner.js` |
| Action execution (CRM write) | `server/services/callIntelligence/actionExecutor.js` |
| Phone/entity matching | `phoneExtractor.js`, `entityResolver.js` |
| Storage | `callRecordingRepository.js` (DynamoDB), `s3Service.js` (S3) |
| Async worker (prod) | `server/workers/callRecordingWorker.js`, SQS queue in `server/infra/cfn-backend.yaml` |
| Frontend | `real-estate-crm-app/src/pages/crm/CallRecordings.tsx`, `CallRecordingReviewDrawer.tsx` |

Two run modes, same code:
- **Inline** (`CALL_RECORDING_QUEUE_URL` unset): pipeline runs synchronously in-process, nudged forward on every list/detail GET (`nudgeInlinePipeline`). This is what local testing uses.
- **Queued** (SQS + Lambda worker): production mode. Not exercised locally unless you point at a real queue.

---

## 2. Implementation / setup steps (before testing)

1. **AWS credentials** with access to S3, DynamoDB, and Amazon Transcribe in the target region (`AWS_REGION`, default `ap-south-1`).
2. **DynamoDB table** — the existing CRM single-table (`CRM_DYNAMODB_TABLE_NAME`) with GSI `owner-property-index`. No new table needed.
3. **S3 bucket** — `S3_BUCKET_NAME`, with CORS allowing `PUT`/`POST` from your dev origin (see the `cfn-backend.yaml` diff — `AllowedOrigins` param, not `"*"` in real deployments).
4. **Gemini** — `GEMINI_API_KEY`, `GEMINI_MODEL` (e.g. `gemini-2.5-flash`).
5. **`server/.env`** — copy relevant keys from `server/.env.sample`:
   ```
   CRM_DYNAMODB_TABLE_NAME=...
   S3_BUCKET_NAME=...
   GEMINI_API_KEY=...
   GEMINI_MODEL=gemini-2.5-flash
   CALL_RECORDING_QUEUE_URL=            # leave empty → inline mode for local testing
   TRANSCRIBE_LANGUAGE_OPTIONS=en-IN,hi-IN,mr-IN,gu-IN,ta-IN,te-IN,kn-IN,ml-IN,pa-IN,bn-IN
   CALL_INTEL_AUTO_APPLY_NOTES=true
   CALL_INTEL_MAX_STAGE_ATTEMPTS=4
   CALL_INTEL_MAX_UPLOAD_BYTES=209715200
   ```
6. **Auth** — the routes are mounted behind `validateToken` + `extractTenantId` + `requireAdmin` (`callRecordings.js:59-61`). You need a JWT for a tenant user with an **admin/owner** role; a normal agent role gets 403.
7. **Start the server**: `cd server && npm run dev`.
8. **Test audio files** — prepare 2-3 short (10-30s) real speech clips in supported formats (`mp3`/`m4a`/`wav`), named to exercise the phone extractor, e.g. `Call recording Rahul_919876543210_20260821.mp3`. Silent/noise-only clips are useful for the empty-transcript path.
9. **Seed CRM data** — create at least one lead with a phone number matching a test filename, so the entity-match path has something to hit.

---

## 3. Automated tests (already in the repo — run these first)

```bash
cd server
npx jest services/callIntelligence --coverage=false
```
Covers, per file:
- `phoneExtractor.test.js` — filename → phone parsing edge cases (trunk prefix, country code, glued timestamps).
- `entityResolver.test.js` — phone → lead/tenant/owner/buyer/contact matching & priority order.
- `analysisService.test.js` — JSON extraction/repair, `normalizeAnalysis` coercion (bad enum values, malformed money, etc.).
- `actionPlanner.test.js` — analysis → action list mapping (the deterministic rules), including the "never propose an unlisted tool" guarantee.
- `actionExecutor.test.js` — `invokeSkill` call shape, status transitions (`pending→applied/failed`), audit logging.
- `pipeline.test.js` — stage transitions, retry/attempt caps, requeue behavior.

**Pass criteria:** all green before touching manual testing. A red test here means the manual walkthrough below will fail for a reason already explained by the failing assertion — fix that first.

If you changed `actionPlanner.js` or `constants.js` (tool allowlists), also grep for hardcoded tool names in `actionPlanner.test.js` to make sure fixtures still match.

---

## 4. Manual / integration test plan

Use `curl`/Postman with a valid `Authorization: Bearer <token>` header and tenant scoping already resolved server-side from the token.

### 4.1 Happy path — matched lead, note + update auto/approved

1. **Request upload URL**
   ```bash
   curl -X POST http://localhost:3000/api/crm/call-recordings/upload-url \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"filename":"Call recording Rahul_919876543210_20260821.mp3","contentType":"audio/mpeg","sizeBytes":512000}'
   ```
   **Expect:** `201`, body has `recordingId`, `uploadUrl`, `phone: "9876543210"`, `match` populated if a lead with that phone exists.
2. **Upload to S3** — `curl -X PUT -H "Content-Type: audio/mpeg" --data-binary @rahul.mp3 "<uploadUrl>"`. Expect `200`.
3. **Confirm**
   ```bash
   curl -X POST http://localhost:3000/api/crm/call-recordings/<recordingId>/confirm \
     -H "Authorization: Bearer $TOKEN"
   ```
   **Expect:** `200`, `recording.status: "QUEUED"` or already advanced (inline mode runs synchronously-ish), `processing: "inline"`.
4. **Poll status**
   ```bash
   curl http://localhost:3000/api/crm/call-recordings/<recordingId> -H "Authorization: Bearer $TOKEN"
   ```
   Repeat every ~10-15s (each GET nudges the inline pipeline forward). **Expect** status to progress `TRANSCRIBING → TRANSCRIBED → ANALYZING → ANALYZED → AWAITING_APPROVAL`, with `summary`, `topics`, `proposedActions[]` populating along the way.
5. **Verify auto-applied note:** in the response, the `create_lead_note` action should already show `status: "applied"` with no manual step — confirm the note actually landed on the lead (`GET /api/crm/leads/:id` and check notes/activity).
6. **Approve a pending action** (e.g. `update_lead` or `create_meeting`):
   ```bash
   curl -X POST http://localhost:3000/api/crm/call-recordings/<recordingId>/actions/<actionId>/approve \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
   ```
   **Expect:** `200`, action `status: "applied"`. Verify the CRM record actually changed (lead status/requirement updated, or a meeting created).
7. **Final state:** re-`GET` the recording — `status: "COMPLETED"` once every proposed action is applied or rejected.

### 4.2 No-match path — new lead proposal

Upload a recording whose phone doesn't exist in the CRM. **Expect:** `matchedEntityType: "unmatched"`, and after analysis a `create_lead` action with `requiresApproval: true`. Approve it and confirm a new lead is created with the extracted requirement/phone.

### 4.3 Reject path

Approve nothing; instead:
```bash
curl -X POST .../actions/<actionId>/reject -d '{"reason":"date not confirmed"}'
```
**Expect:** action `status: "rejected"`, `rejectionReason` stored, recording still moves to `COMPLETED` once all actions are terminal (applied or rejected).

### 4.4 Manual link + reanalyze

Upload a file with an unrecognizable/wrong filename phone. Confirm it lands `unmatched`. Then:
```bash
curl -X POST .../link -d '{"entityType":"lead","entityId":"<leadId>","reanalyze":true}'
```
**Expect:** `matchedEntityName` updates, `matchSource: "manual"`, and analysis re-runs against the newly linked lead's context (proposed actions regenerate; previously-applied actions are preserved per `reanalyze` route logic).

### 4.5 Duplicate detection

Upload the same file (same filename + size) twice. **Expect:** the second `upload-url` response has `possibleDuplicateOf` set to the first recording's id. Not blocking — just a signal surfaced in the UI.

### 4.6 Oversized upload

Send `sizeBytes` above `CALL_INTEL_MAX_UPLOAD_BYTES` at `upload-url` time → schema validation should reject with `400` before an S3 URL is even issued. Separately, to test the **actual-size** enforcement (`confirm` re-checks `headObject().contentLength`), upload a file whose real size exceeds the limit while declaring a smaller `sizeBytes` — expect `413` on `/confirm`, the S3 object deleted, and `status: "FAILED"` with `failureStage: "UPLOAD"`.

### 4.7 Empty / silent audio

Upload a silent clip. **Expect:** transcript comes back empty, `analysis = emptyAnalysis()` (`summary: "No speech detected..."`), no notes/actions proposed (nothing to act on), recording still reaches `COMPLETED`.

### 4.8 Transcription failure

Point `S3_BUCKET_NAME`/permissions at something Transcribe can't read, or upload a corrupt/unsupported file. **Expect:** after `CALL_INTEL_MAX_STAGE_ATTEMPTS` retries, `status: "FAILED"`, `failureStage: "TRANSCRIPTION"`, `failureReason` populated. Then hit `/reanalyze` — since there's no transcript yet, it should restart from `UPLOADED` and re-attempt transcription.

### 4.9 Analysis (LLM) failure

Temporarily unset `GEMINI_API_KEY` (or set an invalid model) and drive a recording through transcription. **Expect:** `runAnalysisStage` returns `llm_not_configured` (or a Gemini error), recording `status: "FAILED"`, `failureStage: "ANALYSIS"`. Restore the key and call `/reanalyze` — should re-run analysis only (transcript is already there) and succeed.

### 4.10 Malformed model output (repair path)

Hard to trigger deterministically without mocking, but worth a manual spot-check with `deps.generate` in `analysisService.test.js` as reference — confirm (via logs) `callIntelligence.analysis.repairAttempt` fires when the model's first reply isn't valid JSON, and that a genuinely broken response ends in `analysis_parse_failed` rather than a crash.

### 4.11 Playback & transcript retrieval

```bash
curl .../<recordingId>/audio-url        # short-lived S3 playback URL, plays in browser
curl .../<recordingId>/transcript       # full transcript JSON (segments + speaker labels)
```
**Expect:** audio URL playable in browser within `CALL_INTEL_PLAYBACK_URL_TTL_SECONDS`; transcript 409s with `"Transcript is not ready yet"` if requested before `TRANSCRIBED`.

### 4.12 Delete / retention

```bash
curl -X DELETE .../<recordingId>
```
**Expect:** `200`, and all associated S3 objects (`original`, `transcript.json/.txt`, `analysis.json`) are gone — verify with `aws s3 ls` on the tenant prefix.

### 4.13 Permission boundary

Repeat step 4.1 with a non-admin tenant user's token. **Expect:** `403` at `requireAdmin` before any handler logic runs.

### 4.14 Cross-tenant isolation

Attempt to `GET /api/crm/call-recordings/<recordingId>` for a recording created under a different tenant's token. **Expect:** `404` (row keyed by `tenantId`, not just `recordingId`) — confirms no tenant leak.

### 4.15 Identity-arg protection on approval

Approve an action while passing `arguments` that attempt to override `leadId`/`tenantRecordId` in the body:
```bash
curl -X POST .../approve -d '{"arguments":{"leadId":"someone-elses-lead","status":"qualified"}}'
```
**Expect:** the write still targets the original matched entity — `pickIdentityArgs` re-pins identity fields after the merge (`callRecordings.js:484`). Verify the *other* lead was untouched.

### 4.16 S3 presign regression check (relevant to your current uncommitted diff)

Since `s3Service.js` / `ai-calling-service/src/routes/knowledge.js` were just changed to fix `BadDigest` on presigned PUTs (SDK checksum defaults), explicitly re-run 4.1 step 2 (the raw `curl -X PUT` upload) and confirm it succeeds with `200`, not `400 BadDigest`. This is the regression the diff is fixing — do not skip it.

### 4.17 UI walkthrough (browser)

1. Open `CallRecordings.tsx` page as an admin user.
2. Drag-and-drop a file — verify progress bar (`uploading → processing → done`), and that the list auto-refreshes (10s poll while anything is in flight, per `hasInFlight`).
3. Open the review drawer for an `AWAITING_APPROVAL` recording — verify summary, key points, proposed actions, and approve/reject buttons work and reflect status immediately.
4. Confirm the audio player uses the presigned URL and actually plays.

---

## 5. Example end-to-end data snapshot

Input filename: `Call recording Rahul_919876543210_20260821.mp3`

Expected mid-pipeline state (`GET /:recordingId`):
```json
{
  "recording": {
    "status": "AWAITING_APPROVAL",
    "phone": "9876543210",
    "matchedEntityType": "lead",
    "matchedEntityName": "Rahul Sharma",
    "summary": "Rahul confirmed interest in a 3BHK in Wakad, budget up to 90 lakh, and asked for a site visit this Saturday.",
    "topics": ["site_visit", "budget", "property_requirement"],
    "proposedActions": [
      { "tool": "create_lead_note", "status": "applied" },
      { "tool": "update_lead", "status": "pending" },
      { "tool": "create_meeting", "status": "pending" }
    ]
  }
}
```
After approving both pending actions: `status: "COMPLETED"`, lead status `qualified`, a meeting exists on `2026-08-23T11:00` (or whatever date/time the transcript implied), and the lead's notes contain the AI call summary.

---

## 6. Acceptance checklist

- [ ] All `services/callIntelligence` jest suites pass.
- [ ] 4.1 happy path completes end to end (upload → transcript → analysis → approval → CRM write) with a real audio file.
- [ ] Note auto-applies without a click; every other action requires explicit approval.
- [ ] Oversized/duplicate/unmatched/empty-audio edge cases behave as specified in §4.6-4.7.
- [ ] Failure + `/reanalyze` recovery works for both transcription and analysis failure.
- [ ] Non-admin and cross-tenant access are rejected.
- [ ] Approval cannot re-target an action's identity args (§4.15).
- [ ] Raw `PUT` to the presigned URL succeeds (no `BadDigest`) — validates the current uncommitted `s3Service.js`/CORS fix.
- [ ] Deleting a recording removes all its S3 objects.
- [ ] UI upload, polling, and review drawer approve/reject work in a real browser session.
