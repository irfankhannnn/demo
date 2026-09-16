# Cross-service contracts for the follow-up agent

Every service touching the follow-up flow implements exactly these shapes. Field names are final; add fields only as optional.

## 1. EventBridge events (default bus, region ap-south-1)

### 1.1 `crm.leads` / `lead.created` (existing, extended by CRM)
```json
{
  "tenantId": "t-123", "leadId": "uuid", "leadType": "buyer", "name": "Rahul", "phone": "+919812345678",
  "createdAt": "2026-09-14T10:00:00.000Z",
  "sourceAdapter": "manychat | insta-agent | insta-excel | null",
  "source": "Instagram",
  "followUp": { "type": "site_visit_confirmation", "meetingSchedule": "6 Sep 4pm", "propertyHint": "2 BHK Andheri West, Lodha Park", "note": "asked for a call" }
}
```
`followUp` is optional. The follow-up service creates a `site_visit_confirmation` job when `followUp` is present, or when the tenant has `followupCallOnNewInstagramLead=true` and `sourceAdapter` is one of the Instagram adapters and `phone` is present.

### 1.2 `crm.meetings` / `meeting.completed` and `meeting.cancelled` (new, emitted by CRM `updateMeeting`)
```json
{
  "tenantId": "t-123", "meetingId": "uuid", "status": "completed",
  "meetingType": "site_visit | meeting | null", "title": "Site visit - Lodha Park", "meetingDate": "2026-09-06", "meetingTime": "16:00",
  "relatedEntityType": "LEAD", "relatedEntityId": "lead-uuid", "relatedEntityName": "Rahul",
  "propertyId": "prop-uuid | null", "propertyName": "2 BHK in Andheri West | null",
  "outcome": "free text | null", "completedBy": "user id or name", "completedAt": "iso"
}
```
The follow-up service creates a `post_visit_feedback` job only when `relatedEntityType === 'LEAD'` and (`meetingType === 'site_visit'` or the title contains "site visit"). The CRM meeting scheduler has no type picker, so meetings booked by a person are recognised by title; `meetingType`/`propertyId` are set when the AI agent books the visit.

### 1.3 `aicalling.calls` / `call.ended` (new, emitted by ai-calling-service)
Emitted once per terminal outcome: from the ElevenLabs post-call webhook (`post_call_transcription`, `call_initiation_failure`), from Exotel terminal statuses (`completed|failed|busy|no-answer`), and from `startAICall` initiation failure. Consumers must be idempotent on `callSessionId` (the same session may emit twice, e.g. Exotel `completed` then ElevenLabs transcript; the later event carries more data).
```json
{
  "tenantId": "t-123", "callSessionId": "uuid", "leadId": "lead-uuid | null",
  "callPurpose": "site_visit_confirmation | post_visit_feedback | lead_followup | lead_qualification | click_to_call",
  "status": "completed | failed | no_answer | busy | cancelled",
  "outcome": "call_initiation_failed | site_visit_scheduled | site_visit_confirmed | site_visit_rescheduled | feedback_recorded | callback_requested | null",
  "duration": 143,
  "followupJobId": "job-uuid | null",
  "needsHuman": false,
  "needsHumanReason": "string | null",
  "feedback": { "liked": true, "issues": ["parking"], "clarificationsNeeded": ["maintenance charges"], "tokenTimeline": "next week", "interestLevel": "high|medium|low|none" },
  "meeting": { "meetingId": "uuid", "action": "confirmed|rescheduled|scheduled", "meetingDate": "2026-09-06", "meetingTime": "16:00" },
  "transcriptSummary": "string | null",
  "dataCollection": { "any": "ElevenLabs analysis.data_collection_results, passed through" },
  "source": "elevenlabs_post_call | exotel_status | initiation",
  "endedAt": "iso"
}
```

## 2. ai-calling-service HTTP (auth: `x-api-key: CRM_CALLER_API_KEY`, `x-tenant-id`)

### 2.1 `POST /api/ai-calling/calls/start` (extended)
```json
{
  "leadId": "lead-uuid", "leadName": "Rahul", "leadPhone": "+919812345678",
  "callPurpose": "site_visit_confirmation",
  "context": {
    "meeting": { "meetingId": "uuid", "meetingDate": "2026-09-06", "meetingTime": "16:00", "location": "Lodha Park, Worli", "status": "scheduled" },
    "property": { "propertyId": "uuid", "title": "2 BHK in Andheri West", "propertyType": "apartment", "bhk": 2, "area": "Andheri West", "city": "Mumbai", "buildingName": "Lodha Park", "price": 18000000, "rentAmount": null, "carpetArea": 950, "furnishing": "semi-furnished" },
    "visitedProperty": { "...same shape as property..." },
    "assignedAgentName": "Sameer",
    "dmSummary": "Asked for 2 BHK under 1.8 Cr in Andheri West, wants to visit Saturday",
    "instructions": "free text appended to the prompt context"
  },
  "metadata": { "followupJobId": "job-uuid", "attempt": 1, "source": "followup-agent-service" }
}
```
Response `201 { callSessionId, status: "ringing", conversationId, callSid }`. `400` for bad phone / unconfigured agent. Purposes accepted: existing two plus `site_visit_confirmation`, `post_visit_feedback`. Dynamic variables added: `meeting_details`, `property_details`, `visit_details`, `assigned_agent_name`, `dm_summary`, `extra_instructions`.

### 2.2 `POST /api/ai-calling/calls/connect` (new, click-to-call)
```json
{ "fromPhone": "+919800000000", "toPhone": "+919812345678", "entityType": "lead", "entityId": "uuid", "initiatedByUserId": "user-uuid", "initiatedByName": "Sameer" }
```
Exotel `Calls/connect.json` with `From=fromPhone`, `To=toPhone`, `CallerId=EXOTEL_CALLER_ID`, `StatusCallback=<WEBHOOK_BASE_URL>/webhooks/exotel/status`, `CustomField={"tenantId","callSessionId"}`. Response `201 { callSessionId, callSid, status: "initiated" }`. `503` when `EXOTEL_CALLER_ID` is blank.

### 2.3 New agent tools (auth: `x-api-key: SERVER_TOOL_API_KEY`, headers `x-tenant-id`, `x-lead-id`, `x-call-session-id`)
- `POST /api/ai-calling/tools/confirm-site-visit` body `{ meetingId?, action: "confirm|reschedule", newDate?, newTime?, note? }` → CRM `PATCH /api/internal/meetings/:id`. Returns `{ speech, meeting }`.
- `POST /api/ai-calling/tools/visit-feedback` body `{ liked?: bool, issues?: string[], clarificationsNeeded?: string[], tokenTimeline?: string, interestLevel?: "high|medium|low|none", notes?: string }`. Stored on the session (`visitFeedback`) and as a CRM lead note via `POST /api/internal/followups/notes`. Returns `{ speech: "", recorded: true }`.
- `POST /api/ai-calling/tools/request-callback` body `{ reason, topic? }`. Sets `needsHuman=true`, `needsHumanReason` on the session, appends `CALLBACK_REQUESTED` action. Returns `{ speech, recorded: true }`.

## 3. CRM internal HTTP for the follow-up service (auth: `x-api-key: FOLLOWUP_INTERNAL_API_KEY`, `x-tenant-id`)

### 3.1 `GET /api/internal/followups/leads/:leadId/snapshot`
```json
{
  "lead": { "leadId", "name", "phone", "status", "leadType", "assignedTo", "source", "sourceAdapter", "requirementSummary": "string", "notes": "string" },
  "assignee": { "userId", "name", "email", "phone" } | null,
  "admins": [ { "userId", "name", "email", "phone" } ],
  "upcomingMeeting": { "meetingId", "meetingDate", "meetingTime", "location", "status", "meetingType", "propertyId", "propertyName" } | null,
  "lastCompletedMeeting": { "...same..." } | null,
  "property": { "...property shape from 2.1..." } | null,
  "agencyName": "Happy Properties",
  "followupConfig": { "enabled": true, "callOnNewInstagramLead": false, "maxAttempts": 2, "retryGapMinutes": 45, "postVisitDelayMinutes": 120, "businessHoursStart": "10:00", "businessHoursEnd": "19:00", "timezone": "Asia/Kolkata", "escalationUserIds": [] },
  "aiEmployeeEnabled": true
}
```

### 3.2 `POST /api/internal/followups/escalations`
```json
{ "leadId", "jobId", "jobType", "reason": "max_attempts_exhausted | callback_requested | open_actions | error", "summary": "string", "attempts": 2, "lastCallSessionId", "targetUserIds": ["..."], "details": { "feedback": {...}, "needsHumanReason": "..." } }
```
Creates an in-app notification (type `FOLLOWUP_ESCALATION`, `targetUserIds` = assignee + admins + configured extras), emails them, WhatsApp best-effort, and appends a lead note. Returns `{ ok: true, notified: ["userId"] }`.

### 3.3 `POST /api/internal/followups/notes`
```json
{ "leadId", "jobId"?, "callSessionId"?, "type": "followup_call | visit_feedback | followup_status", "content": "string", "data"?: {} }
```
Appends a lead note (createdBy `AI Follow-up Agent`) and a contact activity. Returns `{ ok: true, noteId }`.

### 3.4 `PATCH /api/internal/meetings/:meetingId` (auth: AI_CALLING_INTERNAL_API_KEY, used by the agent tool)
```json
{ "action": "confirm | reschedule | cancel", "meetingDate"?, "meetingTime"?, "note"?, "updatedBy": "AI Calling Agent" }
```
`confirm` sets `confirmedAt`, `confirmedVia: 'ai_call'`; `reschedule` changes date/time (status `rescheduled`); `cancel` sets `cancelled`. Returns the meeting.

## 4. followup-agent-service HTTP (auth: `x-api-key: FOLLOWUP_CALLER_API_KEY`, `x-tenant-id`)

- `POST /api/followup/jobs` `{ leadId, jobType: "site_visit_confirmation|post_visit_feedback", dueAt?: iso, context?: { meetingId?, propertyId?, meetingSchedule?, propertyHint?, note? }, requestedBy?: "user id or 'system'" }` → `201 { job }`. Returns `200 { job, duplicate: true }` if an open job with the same dedupe key exists; `409 { error: "ai_employee_disabled" | "followup_calls_disabled" }` when the tenant has the feature off; `404 { error: "lead_not_found" }`.
- `GET /api/followup/jobs?leadId=&status=&limit=` → `{ jobs: [...] }`
- `GET /api/followup/jobs/:jobId` → `{ job, attempts: [...] }`
- `POST /api/followup/jobs/:jobId/cancel` → `{ job }`
- `POST /api/followup/jobs/:jobId/run-now` → `{ job }` (sets dueAt=now; dispatcher picks it up within 5 min)
- `GET /api/health`

Job shape:
```json
{ "jobId", "tenantId", "leadId", "jobType", "status": "scheduled|calling|done|needs_human|escalated|cancelled|failed",
  "dueAt", "attemptCount", "maxAttempts", "lastAttemptAt", "lastOutcome", "escalatedAt", "escalationReason",
  "context": {...}, "requestedBy", "source": "event:lead.created | event:meeting.completed | api | crm-adapter", "createdAt", "updatedAt" }
```

## 5. CRM user-facing proxy routes (JWT, member or above)
- `POST /api/crm/leads/:id/followup-call` `{ jobType?: "site_visit_confirmation", note? }` → proxied to 4 with `requestedBy = req.user.userId`.
- `GET /api/crm/leads/:id/followups` → `{ jobs }`
- `POST /api/crm/followups/:jobId/cancel`
- `POST /api/crm/calls/click-to-call` `{ entityType: "lead|buyer|owner|customer|contact|property", entityId }` → resolves callee phone server-side, caller = `req.user.phoneNumber`; → `202 { callSessionId, callSid, status }`. `400 { error: "caller_phone_missing" }` if the user has no phone; `404 { error: "entity_phone_missing" }` if the record has none; `503 { error: "click_to_call_not_configured" }` if `EXOTEL_CALLER_ID` is blank.

## 6. Agency config keys (AgencyConfig item, via `GET/PATCH /api/crm/config/ai-employee`)
`followupCallsEnabled` (bool, default true when aiEmployeeEnabled), `followupCallOnNewInstagramLead` (bool, default false), `followupMaxAttempts` (int 1..5, default 2), `followupRetryGapMinutes` (int 10..240, default 45), `followupPostVisitDelayMinutes` (int 0..1440, default 120), `followupEscalationUserIds` (string[]). Existing `businessHoursStart/End`, `timezone` are reused for the calling window.

## 7. Phone masking
Roles that see full numbers: `ADMIN`, `FOUNDER`, `OWNER`. Everyone else gets masked values on every `/api/crm/*` JSON response. Masked keys (case-sensitive, any depth): `phone`, `mobile`, `mobileNumber`, `alternatePhone`, `normalizedPhone`, `contactNumber`, `ownerPhone`, `attendeePhone`, `relatedEntityPhone`, `whatsapp`, `whatsappNumber`, `phoneNumber`, `tenantPhone`, `buyerPhone`, `sellerPhone`. Format: keep the country code if present and the last 4 digits, replace the rest with `*`: `+919812345678` → `+91 ******5678`; `9812345678` → `******5678`. Each object that had a masked key gets `phoneMasked: true`; the response also carries the header `X-Phone-Masked: true`. Internal (`/api/internal/*`) routes are never masked. Inbound: any masked-shaped phone value and any `phoneMasked` key in a `/api/crm/*` request body is dropped before the route runs (role-independent; a masked value is never valid input).
