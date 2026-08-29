# Launch Audit — Findings and Fixes

Three parallel audits run 2026-08-22: **frontend/responsive**, **call-recording pipeline**, **backend security**. This records what was found, what was fixed, and what deliberately was not.

Backend suite: **614/614 green**. Frontend: **`vite build` passes**.

Two further passes on 2026-08-22:
- [**Second pass**](#second-pass--the-deferred-mediums-closed) — closed the six call-recording MEDIUMs and the S3 compliance gap.
- [**Third pass**](#third-pass--rbac-and-two-bugs-found-behind-the-permission-bypass) — closed the WhatsApp permission bypass, and found **two bugs hiding behind it**: every MCP tool call would have been denied in production, and the RBAC allowlists had rotted far enough to deny an admin their own daily brief.

---

## Fixed — call-recording pipeline (4 HIGH)

### H1. Duplicate processing — the concurrency guard did not guard
`services/callIntelligence/constants.js`, `pipeline.js`

`STAGE_ENTRY_STATUSES` included each stage's own **in-progress** status (`ANALYSIS: [TRANSCRIBED, ANALYZING, FAILED]`), and that set was used as the DynamoDB `ConditionExpression` when a stage claimed a recording. A condition that accepts `ANALYZING` is **still true while another invocation is mid-analysis**, so two concurrent SQS deliveries both "claimed" successfully and both ran the stage.

Consequences, in order of how bad they are for a customer:
- The **call-summary note was written to the lead twice** (`createLeadNote` generates a fresh noteId per call — no idempotency backstop).
- Two Gemini analyses, two `planActions` runs producing **different actionIds**; last write wins on `proposedActions`, so actionIds the UI already held started 404-ing on approve.
- Two Transcribe jobs writing the same output key.

The file header claimed *"a duplicate SQS delivery or a Lambda retry cannot process the same recording twice."* That was false.

**Fix:** added `STAGE_CLAIM_STATUSES` — same sets minus the in-progress status — and used it at both claim sites. `STAGE_ENTRY_STATUSES` is retained and still correct for its other purpose: the transcription stage is legitimately resumable (it re-enqueues itself to poll the ASR job), and that poll path performs no transition, so it is unaffected. Two regression tests assert the claim precondition excludes `TRANSCRIBING`/`ANALYZING`.

### H2. `/confirm` TOCTOU started the pipeline twice
`routes/callRecordings.js`

Read status → check → **unconditional** `updateRecording(UPLOADED)` → `startProcessing`. Two concurrent confirms both passed the check and both enqueued. A conditional `transitionStatus(→ QUEUED, [UPLOADED])` existed on the next line and would have deduped — but **its return value was discarded**.

**Fix:** honour it. The loser of the race returns `processing: 'already_started'` instead of enqueueing a second time.

### H3. Customer PII written to CloudWatch in cleartext
`logger.js`, `infra/cfn-backend.yaml`

`skillInvoker` logs every tool's input and result. For `create_lead_note` the input is the **entire AI call-summary** — name, budget, requirements, objections, intent. `logger.js`'s redact list covered `phone`/`email`/tokens but not `content`, `summary`, `keyPoints`, `notes`, or transcript fields.

Worse, the result log was **uncapped in production**: `TOOL_LOG_MAX_RESULT_CHARS ?? '0'` where `0` means Infinity. The comment called 0 the "default for dev", but the CFN never set the variable, so production inherited the dev default.

**Fix:** added the free-text keys to the redact list, and a `ToolLogMaxResultChars` CFN parameter (default 2000) wired to every Lambda. Verified by direct invocation — customer content gone, `leadId` still visible so logs stay debuggable. The note body is still retained deliberately in the AgentAudit table with a 90-day TTL, which is the right place for it.

### H4. "Delete" left the verbatim transcript in S3 forever
`routes/callRecordings.js`, `transcription/amazonTranscribeProvider.js`

Amazon Transcribe writes its own raw diarized output to `{tenant}/call-recordings/{id}/transcript/amazon-transcribe-raw.json`. That key was never stored on the item, and the delete handler only removed the four keys it *had* stored. A deleted recording therefore left the **full verbatim customer conversation** in S3 indefinitely — contradicting the acceptance criterion in [`../recording-flow-test.md`](../recording-flow-test.md) §4.12 and the obvious DPDP expectation.

**Fix:** exported `rawTranscriptKeyFor()` (the key is deterministic) and added it to the delete list.

---

## Fixed — frontend (all 7 items)

| # | Issue | Fix |
|---|---|---|
| F1 | **CRMDashboard header overflowed ~25px at 375px** for admin/owner — the right action cluster is `flex-shrink-0` and needed ~280px. Nothing sets `overflow-x: hidden` on `body`, so the app's landing screen scrolled sideways for the primary persona. | Hid the **decorative** logo tile below `sm:` (−48px) and tightened action-button padding to `px-2 sm:px-3` (−40px). No control removed. |
| F2 | **Calendar view modes unreachable on a phone.** The toggle is `hidden sm:flex`, and its buttons are the only `setViewMode` call site reachable on mobile — so users were locked into list view permanently, and `statusFilter` was permanently `'all'`. | Added a native `<select>` for view mode below `sm:`; made the status filter visible on mobile. |
| F3 | NotificationCenter dropdown `w-96` (384px) clipped ~33px off the left edge inside `overflow-hidden`. | `max-w-[calc(100vw-1.5rem)]` |
| F4 | Toast `max-w-[420px]` clipped off-screen; carries save-failure errors. | Clamped to viewport below `sm:` |
| F5 | NPS score buttons ~24px wide — below Apple 44pt and Material 48dp, and 11×44px cannot fit on one line at any phone width. Renders globally on every route. | `grid-cols-6` on mobile (2 rows, ~48px) → `grid-cols-11` from `sm:` |
| F6 | OwnerDetails list-property modal — the only modal missing a height cap; clipped at both ends with the keyboard open. | `max-h-[90vh] overflow-y-auto` |

Verified: `vite build` passes. `tsc --noEmit` reports 103 errors, **all pre-existing** — the only ones in files I touched are unused-*import* warnings (`getIdToken`, `Trash2`, …) unrelated to these changes.

### F7 — mobile web had no navigation shell (now fixed)

`BottomTabBar` returned `null` unless `isNativeApp()`. On a phone **browser** the app was 55 flat routes with **no nav, no sidebar, no hamburger** — every page's only exit was its back-arrow to `/crm`.

I originally left this as a product decision. It isn't one: mobile web is a launch surface by the terms already set for this launch — the WhatsApp-first flow means brokers arrive by tapping a link on a phone, and "compatible with all screen sizes" is not satisfied by a phone view with no way to move between pages.

**Fix:** the gate is now the viewport, not the platform. `BottomTabBar` renders on web too, carrying `md:hidden`, so it is a pure CSS no-op at ≥768px where the existing in-page navigation lives; native behaviour is byte-for-byte unchanged, including on tablets. Content clearance is keyed on a `has-tab-bar` body class the component sets only while it is actually rendering, so the routes that hide the bar (login, onboarding, legal) get no dead space. That padding sits on `<body>` rather than `<main>` because only 30 of the ~55 routed pages have a `<main>` — a `<main>`-only rule would have left the rest with their last row under the bar. `vite build` passes.

**Still native-only, and correctly so:** the `.native-app` CSS block (44px touch-target floor, modal height caps, tap-highlight suppression, disabled text selection). Several of those rules are deliberately app-like — suppressing text selection and the long-press callout on a *web page* removes behaviour a browser user expects. The 44px floor is the one piece worth revisiting for mobile web on its own merits, separately from the navigation gap.

---

## Fixed — Instagram / ManyChat

The flow is better built than expected: per-tenant token auth, rate limiting, idempotency keyed on `subscriberId`, EventBridge publish, and a deliberate always-200 policy so ManyChat doesn't storm retries. Two real defects:

- **A rental enquiry was filed as a buyer lead.** `leadType` was hardcoded `'buyer'` for every Instagram lead, so someone selecting "rent" (or "heavy deposit", which is a rental arrangement) never appeared in *"tenant leads dikhao"* and had their budget written to `buyerRequirement` instead of `tenantRequirement`. The `requirement` value already carried the answer; it just wasn't used. **Fixed** — routes to `leadType: 'tenant'` + `tenantRequirement` for rentals.
- **Full-table Scan on every inbound lead** to resolve the tenant from the webhook token — the same problem fixed for WhatsApp, but I'd only indexed the phone lookup. **Fixed** — added `instagramWebhookToken-index` and switched to a Query. Same deploy gate as the other GSI (wait for `ACTIVE` + `Backfilling: false`).

---

## Security audit — done by hand, and the result is good

Two subagent attempts at this died (a session limit, then an API error), so I ran it directly with targeted checks rather than a broad sweep. Scope: tenant isolation, route authorization, and JWT handling — the three areas where a mistake is unrecoverable.

**One HIGH vulnerability found and fixed** (below), plus algorithm pinning. The rest of the surface checked out.

### 🔴 HIGH — cross-tenant access via `x-tenant-id` on the MCP tool endpoint (FIXED)

`routes/agentTools.js:50`:

```js
const tenantId = req.agentTenantId || req.headers['x-tenant-id'];
```

The MCP endpoint (`POST /api/crm/agent/tool`) derived its tenant from the verified service JWT — **or, failing that, from a client-supplied header**. Any caller holding a valid `mcp-agent` token whose payload lacked a `tenantId` claim could name **any tenant** in `x-tenant-id` and drive the full CRM tool registry against it: reading leads, creating records, archiving. Cross-tenant read *and* write.

This directly contradicted the rule the codebase states in `tenantMiddleware.js` — *"NEVER trust the client-provided x-tenant-id header for authenticated routes"* — and the error message even advertised the fallback (*"must be in JWT or x-tenant-id header"*).

**Fixed:** tenant now comes only from the verified token; `verifyMcpToken` rejects a token with no `tenantId` claim, so the handler cannot be reached without one. Also pinned `algorithms: ['HS256']` on that `jwt.verify` (JWT_SECRET is symmetric, so the verifier previously accepted whatever `alg` the token declared).

**How this was nearly missed — worth recording.** My first pass concluded "no local signature verification in this service to get wrong," based on reading `validateToken.js` alone. That generalisation was wrong: a repo-wide grep (which I'd backgrounded and almost didn't read) surfaced a second, independent `jwt.verify` in `agentTools.js` — and reading *that* file is what exposed the header fallback four lines below it. The lesson matches the one already recorded for prompt files in `../phase1-imp/07-bugs-found.md` #11b: **a conclusion drawn from one file is not a property of the codebase.** Checking two other route files (`crm.js`, `khata.js`) would not have found this either — only the exhaustive grep did.

Two other `x-tenant-id` readers were checked and are **not** vulnerabilities: `routes/buildings.js` is not mounted anywhere (dead file), and `middleware/requestLogger.js` only logs the header for request correlation. `routes/aiCallingInternal.js` does use a header-supplied tenant, but it is a service-to-service API gated by a shared `x-api-key` — header-passed tenant is the normal pattern there, and there is no JWT in that flow to derive one from. Worth knowing its risk profile though: one shared key covers all tenants, so leaking it grants cross-tenant access by design. Left as-is deliberately — changing it would break the calling service.

### Everything else checked out. Specifically verified:

**Tenant isolation — sound.** All **82 of 83** `PK:` assignments in `crmDynamodbService.js` use the `TENANT#${tenantId}#...` template. The one apparent outlier (`GSI1PK: currentOwnerContactId`, line 1222) is a grep artifact — it's the *condition* of a multi-line ternary whose actual values on the next line are both tenant-prefixed. Services that build keys via a helper (`whatsappConversationService`, `conversationStateService`, `notificationDynamodbService`) were checked at the helper: each interpolates `tenantId` as the first segment. So tenant scoping lives in the **key**, not a FilterExpression — a crafted id from another tenant is a key miss, not a leak.

**The trust root cannot be spoofed.** `tenantMiddleware.js` never reads `x-tenant-id` and hard-rejects when `req.tenantId` is absent. More importantly, `validateToken.js` does **not** trust its own local JWT decode: that function is explicitly labelled *"no verification, just for expiration check"* and is only a fast-fail. Real verification is delegated to the auth microservice (`GET /auth/me`), and `req.tenantId` is set from **that response**, not from the token payload. This sidesteps the entire algorithm-confusion class — there is no local signature verification in this service to get wrong.

**Route authorization — complete.** Of 17 route files: 6 apply `router.use(validateToken)` globally; the rest apply it per-route. Enumerating every `router.<verb>` line across the per-route files found **7 routes without `validateToken`**, and every one is *intentionally* public with its own control:
- `crm.js` public property list/detail — `apiKeyAuth` + explicitly rejects a null tenant + deliberately excludes owner data
- `enquiries.js` contact/consultation, `b2bLeads.js` capture — `strictRateLimit` + `apiKeyAuth`
- `grievance.js` submission — `publicLimiter` (must be public; it's the DPDP grievance channel)
- `feedback.js` NPS — validates an HMAC over `userId+score`, so it is authenticated, just not by JWT

No router is mounted without auth, and no route silently skips `requireAdmin` where its siblings require it.

**What this audit did NOT cover** (budget went to the three areas above): DynamoDB expression injection, request-size limits, secrets-in-source, and the webhook replay surface beyond what was already checked in the Instagram review. Worth a pass eventually; none is as consequential as the three above.

## Confirmed SAFE (worth knowing, so nobody re-audits it)

- **Call-recording tenant isolation.** Every handler builds the full primary key `TENANT#{tenantId}#CALL_RECORDING#{id}` and does Get/Update/Delete on it — not a filtered query. Cross-tenant id → key miss → 404. `listRecordings` uses `GSI1PK` as a KeyCondition, not a filter. `req.tenantId` is server-derived and `x-tenant-id` is never read. S3 keys always come off the tenant-scoped item.
- **Approval identity re-pin.** `pickIdentityArgs` is spread **last**, so caller-supplied `arguments` cannot re-target an approved action at a different record. Verified against every action the planner emits.
- **Khata cannot be auto-created.** Structurally impossible — no khata write tool exists anywhere in the registry.
- **S3 key construction.** `tenantId` server-derived, `recordingId` a server uuid, and the only user-controlled part is `path.extname(filename)` which can never contain `/` or yield `..`. No traversal.
- **All 11 `<table>` elements** in the frontend are inside overflow guards. **All nine `GlassDataTable` consumers** render a stacked card list below `sm` — `LeadList`'s low raw responsive-class count is a false signal, it delegates layout to that component.

---

## Second pass — the deferred MEDIUMs, closed

All six call-recording MEDIUMs and the S3 compliance gap are now fixed. Each entry below states what was wrong, what it did to a customer, and what changed.

### M1. `/link` destroyed the applied-action history — and the guard against it never worked
`routes/callRecordings.js`, `services/callIntelligence/pipeline.js`, `actionPlanner.js`

`/link` set `proposedActions: []` before re-analysing, wiping the record that a call-summary note had already been auto-applied — while that note still sat on the *wrong* CRM record, now unreferenced — then auto-applied a fresh one.

`/reanalyze` looked safe by comparison: it pre-wrote the applied subset with the comment *"Keep already-applied actions so history is not lost."* **It didn't work either.** `runAnalysisStage` overwrites `proposedActions` wholesale two calls later, so the preserved list was destroyed moments after being written. Every re-analysis, from either route, lost the history *and* wrote a duplicate note.

**Fix:** the merge now happens at the one place both routes pass through. `mergeWithAppliedActions()` (in `actionPlanner.js`, unit-covered) keeps every `APPLIED` action and drops a freshly planned action that targets the *same tool on the same record*. Identity is `tool` + the entity-id argument, so re-linking to a **different** record is correctly not a duplicate and the new record does get its note. `/link` additionally no longer clears the list.

One deliberate trade-off: a re-analysis that produces a better summary does **not** rewrite an already-applied note. One note per call is worth more to a broker than marginally better wording, and the full analysis payload in S3 is always current.

*Nearly shipped broken:* the first version of `actionIdentity()` read `action.args`. Stored actions use `action.arguments` (see `makeAction`). Every identity would have been `tool|` and the dedup would have silently done nothing. The pipeline test caught it — a unit test written against my own assumption about the field name would not have.

### M2. The retry budget never reset on success
`pipeline.js`, `routes/callRecordings.js`

`stageAttempts` was treated as a budget for one run of a stage but accumulated for the recording's lifetime, and `/link` didn't reset it the way `/reanalyze` did. A recording that needed two retries early carried that debt forever, and a later manual re-run could hit `MAX_STAGE_ATTEMPTS` immediately and fail permanently.

**Fix:** both stages zero their own counter on success, and `/link` resets it the way `/reanalyze` does.

### M3. The automatic path wrote to the CRM before claiming the action
`services/callIntelligence/actionExecutor.js`

`applyAutomaticActions` checked `action.status !== PENDING` against the **in-memory list** — a snapshot taken when the analysis stage planned it — then called the CRM, then recorded the outcome. An owner who rejected the note in the seconds between planning and applying still got it written to the customer record. A stale-snapshot check cannot see a write that landed since; only a conditional write can.

**Fix:** each action is claimed with a conditional write to `APPROVED` *before* `invokeSkill` runs, the same order `/approve` already used. A lost claim skips the action. Two tests: one asserts the literal ordering (`claim → CRM → record`), one asserts no CRM call when the claim is lost.

### M4. A recording whose CRM writes all failed still read as `COMPLETED`
`routes/callRecordings.js`, `CallRecordings.tsx`, `types/callIntelligence.ts`

`refreshCompletionStatus` moves to `COMPLETED` when nothing is `PENDING` — `FAILED` counts as "not pending". That status is defensible (transcription and analysis genuinely finished; only the CRM writes failed), but the list row showed a plain "Completed" and nothing else, so nobody opened the drawer to retry.

**Fix:** the status enum is unchanged — changing it would ripple through the UI for no gain. The list payload now carries `failedActions`, and the row renders a red *"N failed"* badge. The drawer already rendered each failure with a Retry button; the only thing missing was the reason to open it.

### M5. A recording that died mid-analysis polled forever
`routes/callRecordings.js`

`ANALYZING` is excluded from `STAGE_CLAIM_STATUSES` — that exclusion is exactly what fixed H1 and must stay. The cost is that a recording whose worker died mid-analysis (Lambda timeout, or an SQS message that exhausted its receives and went to the DLQ) sits in `ANALYZING` with **nothing able to re-claim it**. Simply adding `ANALYZING` to the inline-nudge list would have been a no-op for this reason — the nudge would have called a stage that immediately fails its own claim.

**Fix:** time-based recovery instead. `recoverStalledAnalysis()` runs on list and detail reads; once a row has been untouched for `CALL_INTEL_STALLED_ANALYSIS_MS` (default 15 min) exactly one caller wins a conditional write back to `TRANSCRIBED` and re-drives the stage. A worker that is genuinely still alive keeps `updatedAt` fresh and never trips the window. Unlike the nudge, this runs **under SQS too** — a DLQ'd message is precisely the case that needs it.

### M6. Approve `arguments` was unbounded and could brick the row
`validation/callRecordingSchemas.js`

`z.record(z.string(), z.unknown())` with no size limit, merged back into the recording item. A few hundred KB would push the item past DynamoDB's 400 KB limit, after which **every** subsequent write to that recording — including the one marking the action failed — would be rejected, leaving it unrecoverable through the API.

**Fix:** 32 KB cap, far above any legitimate edit (a corrected date, title or note body) and far below the limit even with the rest of the item.

### I1. `DocumentsBucket` had no encryption, no lifecycle policy, and no bucket policy
`infra/cfn-backend.yaml`

The bucket holding call recordings, transcripts and analysis payloads — customer conversations, names, phone numbers — had none of the three.

**Fix:**
- **SSE-S3 (AES-256) default encryption.** Applies server-side to every write including the browser's pre-signed PUT, so no client change. `BucketKeyEnabled` is set so a later move to KMS doesn't rewrite the block.
- **A `DocumentsBucketPolicy` denying non-TLS requests.** Pre-signed URLs are handed to browsers and could in principle be replayed over plain HTTP. The bucket had no policy before, so nothing was replaced.
- **Lifecycle rules, hygiene only — deliberately no expiration.** These are customer records; nothing here deletes them. Abandoned multipart uploads are aborted after 7 days, leftover object versions and delete markers are reclaimed, and cold objects move to `INTELLIGENT_TIERING` at 30 days.

Two constraints shaped that last rule. Object keys are tenant-prefixed (`<tenantId>/call-recordings/…`) and S3 prefix filters cannot wildcard a leading segment, so **every rule is necessarily bucket-wide** — each was chosen to be safe at that scope. And `INTELLIGENT_TIERING` rather than `STANDARD_IA`: recordings go cold once transcribed, but property images stay hot, and IA would add a per-GB retrieval charge to every page view.

Retention/deletion is a policy decision, not a technical one, and is still open — see below.

---

## Known-remaining, deliberately not fixed

**Call-recording (5 LOW).** Cosmetic and low-impact; none affect a customer-visible outcome.

**Data retention.** The bucket now has lifecycle rules but **no expiration** — by choice. DPDP-style "delete after N months" needs a decision on N and on whether deletion is per-tenant configurable, and would be a `RecordingRetentionDays` parameter driving an `ExpirationInDays` rule. Deleting customer records on a default nobody chose is the wrong failure mode.

**Frontend polish (~9 items).** Header titles without `truncate` in admin pages, `grid-cols-3` without breakpoints in BillingSettings/AddPropertyModal, `p-10` on the signup card. Cramped, not broken.

**Dead code the frontend audit identified** — `EnquiryList.tsx` (1,791 lines), `CustomerList`, `RentalList`, `BuildingDetail`, `Dashboard`, `components/flat/*`. Not routed; they account for a large share of the 103 pre-existing `tsc` errors. Deleting them is a cheap, separate cleanup.

---

## Third pass — RBAC, and two bugs found behind the permission bypass

Chasing the WhatsApp permission bypass turned up two problems that were worse than the bypass itself.

### R1. 🔴 Every MCP tool call was denied in production
`userCategoryService.js`, `routes/agentTools.js`

`canUserAccessTool` is fail-closed, and `skillInvoker` runs it whenever a `userId` is present. The MCP endpoint **always** supplies one — `req.headers['x-user-id'] || 'mcp-agent'` — and `reality-flow-mcp`'s `jwtAuth` sets that header to the literal `'mcp-agent'` when the token names no human. No `CATEGORY#USER` row is ever created for that identity, and `AllowUserCategoryDefaultFallback` defaults to `'false'` in CFN.

So: **`getUserCategory` → null → no dev fallback → `return false`.** Every tool call through the MCP server would have failed with "User does not have access", for every tenant. This is not a security finding; it is a feature that could not have worked once deployed.

**Fix:** an explicit `fallbackCategory` option on `canUserAccessTool`/`invokeSkill`. The MCP route passes `'admin'` **only** for the anonymous service identity — the authorisation there is the token itself, which `verifyMcpToken` has already checked for signature, algorithm, role, and tenant. A *named* user still fails closed: naming a specific person is a claim their provisioned category exists to answer, and silently upgrading an unprovisioned human to admin would be the actual bypass. Every fallback use is logged.

### R2. 🟠 The category allowlists had rotted, and the check was fail-closed
`userCategoryService.js`

`admin` — whose own description reads *"Full access to all tools"* — was **missing 13 live tools** and still **listing 13 that no longer exist**. The missing ones were the entire briefing surface (`get_daily_brief`, `get_dashboard_snapshot`, `get_business_health`, `suggest_next_actions`, `get_priority_leads`, every `*_summary`) plus contact notes. The stale ones (`delete_lead_note`, `get_tenant_rental_history`, …) are leftovers from the Slice 5 delete-tool removal — the same family of leftovers found three times already in this codebase.

Combined with fail-closed evaluation, a provisioned admin asking for their daily brief through MCP was denied by a stale array.

**Fix:** stop hand-maintaining copies of the tool list. `admin` is now `[...ALLOWED_TOOL_NAMES]` and `viewer` is the registry's `readOnly` set; `agent`/`team_lead`/`whatsapp_bot` keep their deliberate write restrictions but pick up the read-only surface by spreading it. A new `userCategoryService.categories.test.js` fails the build if any category names a tool that does not exist, if `admin` stops covering the registry, if `viewer` gains a write, or if `whatsapp_bot` drifts up to admin.

One existing test was wrong and was corrected: it classified read-only tools by a `get_`/`search_`/`find_` **name prefix**, which mislabels `suggest_next_actions` as a write. It now asserts against the registry's own `readOnly` flag.

### R3. The WhatsApp permission bypass — now a decision instead of an accident
`agents/agentRuntime.js`, `skillInvoker.js`, `followUpResolver.js`

`skillInvoker` skips the category check entirely when no `userId` is passed, and WhatsApp turns passed none. The product's largest write surface ran with authZ switched off, with nothing in the logs to say so.

**Fix:** the turn's principal (`wa:<phone>`) is the identity the channel actually has, so the check now runs against it, in all three `invokeSkill` call sites plus the auto-open follow-up read.

**Behaviour is unchanged by default and deliberately so.** No tenant has a `CATEGORY#USER` row for a principal, so `WHATSAPP_FALLBACK_CATEGORY` applies; it defaults to `admin`, which now covers the whole registry. What changed is that the decision is *made, logged, and closable* — an agency can provision a row for a specific principal, or set the parameter to `whatsapp_bot`, with no code change.

**What this does not fix.** The self-chat check means the only possible sender is whoever controls the tenant's connected number, so per-staff permissions require per-staff identity, which this channel does not have. A shared WhatsApp number is still one identity. That remains a real limitation, and it is now a documented one with the plumbing in place rather than a silent hole.

Note also that `whatsapp_bot`, the one purpose-built restricted category, **forbids property and buyer writes** — so it is not compatible with the WhatsApp-first flow as specified ("updating properties … should be from WhatsApp"). It is left deliberately narrow rather than widened into a second `admin`; the CFN parameter description says so explicitly.

---

## Still open from earlier

- **Per-staff identity on a shared WhatsApp number** — see R3. Needs a real identity model; the hooks now exist.
- **Nothing is deployed**, and **nothing has run against the real model or real AWS.**
