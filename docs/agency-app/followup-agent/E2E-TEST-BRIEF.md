# End-to-end test brief: AI follow-up calls, phone masking, click-to-call

Written for a browser-automation test agent. Everything it needs is in this file; the deeper contracts are in `CONTRACTS.md`, the deploy order in `RUNBOOK.md`, the design in `APPROVAL-PLAN.md`.

Repo: `nabi-app-git-bkp`, branch `feat/property-pages-ms`. Nothing on it is deployed as of 2026-09-15. Every statement below was re-checked against that branch's code on 2026-09-15. **Sections 2 to 4 can only run once the dev stacks are deployed** (see section 1). Section 5 lists what a browser cannot test and how to cover it instead.

---

## 0. What was built (the flow in one page)

```
Instagram DM  ──(Excel pipeline / insta-agent / ManyChat)──►  CRM ingestLead()
                                                                │  emits crm.leads/lead.created
                                                                │  (+ followUp hint when the DM asked for a call / agreed a meeting)
                                                                ▼
CRM lead page "Schedule AI follow-up call" ──►  CRM proxy POST /api/crm/leads/:id/followup-call
                                                                │
                                                                ▼
                                       followup-agent-service (new, Lambda + DynamoDB)
                                       job: site_visit_confirmation, status scheduled
                                                                │ every 5 min: dispatch due jobs
                                                                │ (inside tenant business hours only)
                                                                ▼
                                       ai-calling-service POST /calls/start  ──►  ElevenLabs agent dials via Exotel
                                       agent has: meeting, property, live inventory, assignee name, DM summary
                                       agent tools: confirm_site_visit, record_visit_feedback, request_callback,
                                                    get_available_properties, schedule_site_visit (existing)
                                                                │
                                                                ▼ aicalling.calls/call.ended (EventBridge)
                                       followup-agent-service classifies the call:
                                         connected (>=20 s or a tool was used)  → done
                                         asked for a human                      → needs_human + escalation
                                         not reached                            → retry in 45 min (max 2 attempts)
                                         still not reached                      → escalated
                                       escalation = CRM notification + email + WhatsApp to assignee + admins + lead note
                                                                
CRM meeting marked Completed (type site_visit) ──► crm.meetings/meeting.completed ──► post_visit_feedback job,
                                                   due +120 min, same call/retry/escalate loop; feedback stored as lead note

Phone privacy:  every /api/crm/* JSON response is masked for non-admin roles
                (+919812345678 → +91 ******5678, phoneMasked:true). MEMBER users get a
                green "Call" button instead: POST /api/crm/calls/click-to-call {entityType, entityId}
                → ai-calling-service /calls/connect → Exotel rings the member first, then the lead.
```

Roles: the auth service only issues `ADMIN` and `MEMBER`. Full numbers: `ADMIN` (also `FOUNDER`/`OWNER` if ever issued). Masked: everyone else.

---

## 1. Preconditions (human tasks before the test agent starts)

| # | Item | How to check |
|---|---|---|
| P1 | dev stacks deployed in this order: ai-calling-service → followup-agent-service → server → frontend (`RUNBOOK.md`) | `GET https://services-api.cloudberrysolutions.in/devrealestatefollowup/api/health` returns 200 |
| P2 | Shared secrets set and matching on both sides (`FOLLOWUP_CALLER_API_KEY`, `FOLLOWUP_INTERNAL_API_KEY`, `CRM_CALLER_API_KEY`) | CRM lead page shows the AI Follow-up card with "No AI follow-up calls yet" instead of "not available on this deployment" |
| P3 | ElevenLabs dashboard: updated prompt + tools `confirm_site_visit`, `record_visit_feedback`, `request_callback` added to the shared agent | ElevenLabs agent settings → Tools tab |
| P4 | `EXOTEL_CALLER_ID` set on ai-calling-service and **Exotel "Connect" (two-leg) enabled on the Exotel account** | Click-to-call returns 202, not 503 |
| P5 | Test tenant with `aiEmployeeEnabled=true`. Then in the CRM at `/crm/ai-employee` → Settings: **AI follow-up calls ON**, **Max call attempts 2**, **Retry gap 10** (minimum, keeps the retry test to ~15 min instead of ~50), **Post-visit call delay 0**, business hours widened to cover the test window (the calling window uses the tenant timezone, default Asia/Kolkata 10:00–19:00) | Settings page saves without error |
| P6 | Two test users in that tenant: `admin@…` with role ADMIN and `member@…` with role MEMBER. Member must have a **verified Indian mobile in `/profile`** (it is the caller leg of click-to-call) | `/admin/members` |
| P7 | Two real Indian mobiles the tester controls: LEAD_PHONE (the "lead") and MEMBER_PHONE (already on the member profile). Calls cost money and are real. | |
| P8 | Frontend `.env` points at the dev CRM/auth APIs (`VITE_CRM_API_DOMAIN_NAME=services-api.cloudberrysolutions.in`, `VITE_CRM_API_BASE_PATH=devrealestatecrm`) | `npm run dev` in `real-estate-crm-app` → http://localhost:5173 |

Optional for backend verification: AWS CLI profile `cloudberry-main` and CloudWatch access to log groups `/aws/lambda/dev-realestateflow-followup-worker-lambda`, `-followup-api-lambda`, and the ai-calling and CRM Lambdas.

---

## 2. Phone masking and click-to-call (pure browser, no calls needed except T2.6)

### T2.1 Admin sees full numbers
1. Log in as ADMIN. Open `/crm/leads`, `/crm/buyers`, `/crm/owners`, `/crm/tenants`, `/crm/contacts`, `/crm/properties`, `/crm/calendar`, `/crm/b2b-leads`. (There is no enquiries route on this branch; `EnquiryList.tsx` is not mounted.)
2. Expect: full numbers rendered as text; on detail pages a `tel:` link where `linkWhenVisible` is used. No `******`.
3. Network check: any `/api/crm/leads` response has **no** `X-Phone-Masked` header and objects carry no `phoneMasked` field.

### T2.2 Member sees masked numbers everywhere
1. Log in as MEMBER. Repeat the same eight pages plus lead/buyer/owner/tenant/contact/property **detail** pages and the lead drawer from the list page.
2. Expect on every page: numbers look like `+91 ******5678` (or `******5678` without country code), tooltip "Number hidden for your role", **no** `tel:` links anywhere in the DOM (`document.querySelector('a[href^="tel:"]')` must be null).
3. Network check: responses carry header `X-Phone-Masked: true`; each object with a phone has `phoneMasked: true`. Grep the raw JSON for a 10-digit run: there must be none (`/\d{10}/` on the response body → no match), except ids/timestamps.
4. Also check masked keys deep inside nested objects: meeting `attendeePhone`/`relatedEntityPhone` on `/crm/calendar`, property `ownerPhone` on `/crm/properties`, `ownerSnapshot.phone` on property detail.

### T2.3 Member cannot overwrite a real number with the mask
1. As MEMBER open a lead detail page, edit an unrelated field (e.g. notes or budget), Save.
2. Log in as ADMIN, open the same lead. Expect: the real number is intact. Two guards: the lead/buyer/owner/tenant/contact pages strip masked values before PUT, and the CRM server drops any masked-shaped phone value (`+91 ******5678`, `******5678`) and every `phoneMasked` flag from every `/api/crm/*` request body before the route runs, so pages without the frontend guard (property, developer) cannot overwrite a number either.
3. As MEMBER open `/crm/properties/:id` for a property that has an owner phone, change the description, Save. As ADMIN: `ownerPhone` and `ownerSnapshot.phone` are intact.
4. Repeat once for a meeting created by the member via **Schedule Meeting** on a lead (`relatedEntityPhone`/`attendeePhone` must not be `***` on the admin's calendar).

### T2.4 Member sees the Call button, admin sees it too
1. As MEMBER on a lead list row and lead detail: a green **Call** button (icon-only in dense rows, `aria-label="Call"`) sits next to the masked number. Same on buyer/owner/tenant/contact rows and property detail (calls the owner).
2. Rows that navigate on click: clicking **Call** must **not** open the record (event is stopped).
3. B2B leads (`/crm/b2b-leads`): masked number, **no** Call button (the server cannot resolve a phone for that entity type).

### T2.5 Click-to-call error states (no real call placed)
1. Temporarily remove the phone from the member's profile (or use a second member without one). Click **Call** on a lead. Expect the inline text "Add your mobile number to your profile to place calls" with an **Add it in Profile** link to `/profile`. HTTP 400 `caller_phone_missing`.
2. Lead with no phone: HTTP 404 `entity_phone_missing`, red inline error.
3. If `EXOTEL_CALLER_ID` is blank on the service: HTTP 503 `click_to_call_not_configured`, and **every** Call button on the page becomes disabled with that tooltip (shared state).
4. Network check: the request body is only `{entityType, entityId}`; the response body is `{callSessionId, callSid, status}`. No phone number in request, response, or any error message.

### T2.6 Click-to-call happy path (real call, costs money)
1. As MEMBER (profile phone = MEMBER_PHONE), lead phone = LEAD_PHONE. Click **Call**.
2. Expect UI: "Connecting… you will receive a call on your phone first" → "Call placed. Pick up your phone to be connected." (HTTP 202). MEMBER_PHONE rings first; on answer, LEAD_PHONE rings.
3. Lead detail → Activity: a `click_to_call` activity "Call placed to <lead name> by <member name>" with no number in it.

---

## 3. AI follow-up: site-visit confirmation (real calls)

Setup for each scenario: as ADMIN create a lead "E2E Followup <timestamp>" with phone LEAD_PHONE, source Instagram, assign it to the MEMBER user. Open `/crm/leads/:id`.

### T3.1 Schedule from the lead page
1. Card **AI Follow-up** is on the lead page (`Bot` icon). Click **Schedule AI follow-up call**.
2. Expect toast "AI follow-up call scheduled." and a row: **Site visit confirmation**, pill **Scheduled**, `Due: <now>`, `Attempts: 0/2`, `via api`.
3. Click the button again → toast "A follow-up call is already scheduled for this lead." (HTTP 200 `duplicate: true`, no second row).
4. **Cancel** on the row → pill **Cancelled**, toast "Follow-up call cancelled." Schedule again for the next tests.
5. Network check: `POST /api/crm/leads/:id/followup-call` body `{"jobType":"site_visit_confirmation"}`; the `GET /api/crm/leads/:id/followups` response contains no phone number.
6. As MEMBER: the same card is visible and the button works (member-or-above). A converted/archived lead shows the button disabled with tooltip "This lead is read-only".

### T3.2 Call placed, lead does not answer → retry → escalation
1. With a job **Scheduled** and the tester inside business hours: within 5 min the pill turns **Calling** (card polls every 30 s while calling). LEAD_PHONE rings. **Do not answer.**
2. After the call ends: pill back to **Scheduled**, `Attempts: 1/2`, `Last outcome: no answer` (or `not reached`), `Due` = +10 min (the retry gap from P5).
3. Second call within the next dispatch after `Due`. Do not answer.
4. Expect: pill **Escalated**, red line "Escalated <time> · max attempts exhausted".
5. Verify the escalation landed:
   - Bell/notifications for MEMBER (assignee) **and** ADMIN: type `FOLLOWUP_ESCALATION`, title "AI follow-up needs you", message `<lead name>: site visit confirmation — could not reach them after the configured attempts.`
   - Lead notes: a note by "AI Follow-up Agent" summarising the escalation.
   - Email to both users (and WhatsApp if the tenant has it configured; best-effort).
6. Backend markers in the worker log, in order: `CALL_PLACED`, `JOB_RETRY_SCHEDULED`, `CALL_PLACED`, `JOB_ESCALATED`.

### T3.3 Lead answers and confirms the visit
1. Before scheduling, create a meeting on the lead via **Schedule Meeting**, tomorrow 16:00, and put the words **Site visit** in the title (e.g. "Site visit – Lodha Park"). The scheduler has no meeting-type or property picker: the follow-up service treats a meeting as a site visit when `meetingType = site_visit` **or** the title contains "site visit". Property details on the call come from the lead's requirement summary; a `propertyId` is only set when the AI agent itself booked the visit.
2. Schedule the AI follow-up. Answer LEAD_PHONE. The agent should greet by name, mention the agency, the property and "tomorrow at 4 pm", and ask to confirm. Say "yes, confirmed".
3. Expect: pill **Done**, `Last outcome: Site visit confirmed`, attempt row with duration and summary. The calendar has no confirmation badge; verify as ADMIN with `GET /api/crm/meetings/:id` → `confirmedVia: "ai_call"` and `confirmedAt` set, plus a lead note by "AI Calling Agent". No retry scheduled.

### T3.4 Lead asks a question the agent answers from inventory
1. During the call ask "do you have any 3 BHK in <area you have properties in>?" The agent must answer from live CRM inventory (`get_available_properties` tool), not invent listings. Ask for something you have none of: it must say it has none and offer a callback.

### T3.5 Lead asks for a human
1. Answer and say "I want to talk to a person / call me back later about the price."
2. Expect: pill **Needs human**, red line "Escalated · callback requested"; notification + note as in T3.2 step 5 with the reason text the lead gave.

### T3.6 Reschedule on the call
1. Answer and say "Sunday 11 am works better."
2. Expect: `Last outcome: site visit rescheduled`; the meeting on the calendar moves to that date/time with status `rescheduled` and a note "AI Calling Agent".

### T3.7 Outside business hours
1. Set the tenant business hours to a window that excludes now. Schedule a job.
2. Expect: it stays **Scheduled** with `Due` moved to the next window start and `Last outcome: Outside business hours`; worker log line `dispatch result` with `result: outside_business_hours`. Restore the hours.

### T3.8 Meeting cancelled → job cancelled
1. With a Scheduled job that has a `meetingId` in its context (from T3.3 setup), cancel the meeting on `/crm/calendar`.
2. Expect: the job row flips to **Cancelled** within one dispatch.

### T3.9 Kill switch
1. Settings → **AI follow-up calls OFF**. Click **Schedule AI follow-up call**.
2. Expect: error toast (HTTP 409 `followup_calls_disabled`), no row added.
3. Turn it ON, schedule a job, turn it OFF again before the next dispatch (up to 5 min).
4. Expect: no call is placed; the job ends **Cancelled** with `Last outcome: Followup calls disabled`; worker log `dispatch result` with `result: followup_calls_disabled`. Turn it back on.

---

## 4. AI follow-up: post-visit feedback (real call)

### T4.1 Completed site visit triggers the feedback call
1. Lead with a meeting whose title contains "Site visit" (T3.3). On `/crm/calendar` mark it **Completed**.
2. Within a minute the lead page shows a new row **Post-visit feedback**, **Scheduled**, `Due` = completion time + post-visit delay (0 in P5), `via event:meeting.completed`.
3. A meeting whose title does not contain "site visit" (e.g. the default "Meeting with <name>") marked Completed must **not** create a job.
4. Answer the call: the agent asks about the visited property, issues, anything unclear, and when they want to proceed with the token. Say: liked it, parking is a problem, unclear about maintenance charges, token next week.
5. Expect: pill **Done**, `Last outcome: Feedback recorded`; a lead note "visit feedback" listing liked/issues/clarifications/token timeline; because there are open issues an escalation **open actions** notification goes to assignee + admins.

---

## 5. What a browser cannot test, and how to cover it

| Area | Why not | Cover with |
|---|---|---|
| Instagram DM → auto job | needs the Excel pipeline or ManyChat | `POST /api/internal/adapters/leads` with header `x-api-key: ADAPTER_INTERNAL_API_KEY` and a body containing `followUp: {type:"site_visit_confirmation", meetingSchedule:"Sat 4pm"}` → a job appears on the new lead. Or run `python scripts/push_leads_to_crm.py --dry-run` in `tools/kalim-sessions/kalim-automations/hp-insta-lead-automation`. |
| Auto-call every new Instagram lead | tenant opt-in | Settings → **Call every new Instagram lead ON**, then the adapter POST above **without** `followUp`: a job must still appear. With it OFF: no job. |
| Watchdog (call stuck in `calling` > 20 min) | needs a lost `call.ended` | disable the `dev-realestateflow-followup-call-ended` EventBridge rule, place a call, re-enable after 25 min → worker log `CALL_WATCHDOG_TIMEOUT`, job goes to retry. |
| Duplicate `call.ended` (Exotel then ElevenLabs) | timing | the worker logs `event handled` for both; the second carries `ignored: already_handled` (or `stale_session` / `job_not_calling`) and the job status does not regress. |
| Direct service API | not user-facing | `curl -H "x-api-key: $FOLLOWUP_CALLER_API_KEY" -H "x-tenant-id: $TENANT" https://services-api.cloudberrysolutions.in/devrealestatefollowup/api/followup/jobs?leadId=...` → `{jobs:[...]}`; wrong key → 401; missing tenant → 400. |
| Unit/integration coverage already green | | `npm test` in `followup-agent-service` (42), `ai-calling-service` (54); server tests for the files this feature touched (122, run with `jest <those files>`); `python -m unittest` in the Excel pipeline (30). |

---

## 6. Things to be careful about while testing

- **Real calls cost money and ring real phones.** Use only the two tester numbers. Set max attempts to 2 and retry gap to 10 so a no-answer run finishes in ~15 min.
- **Business hours gate everything.** If nothing dials, check the tenant hours/timezone first, then `followupCallsEnabled` and `aiEmployeeEnabled`, then the worker log.
- **The dispatcher runs every 5 minutes**, so "immediately" means up to 5 min. `POST /api/followup/jobs/:id/run-now` on the service API only moves `dueAt` to now.
- **Phone numbers must be Indian mobiles** (10 digits starting 6–9). Anything else is rejected before dialling.
- **Click-to-call rings the member first.** If the member does not pick up, the lead is never called.
- **Masking is by role from `/auth/me`**, stored in the browser profile. After changing a user's role, log out and in again.
- **Internal routes are never masked** (`/api/internal/*`); the test agent must not treat that as a leak.
- **Do not save a record as MEMBER and expect the number to change**: masked values are deliberately dropped on save.
- 12 server jest suites fail locally from missing SDK modules; that predates this work and is not a regression.
- **Worker log lines to grep** (`/aws/lambda/dev-realestateflow-followup-worker-lambda`): `JOB_CREATED`, `CALL_PLACED`, `CALL_INITIATION_FAILED`, `JOB_RETRY_SCHEDULED`, `JOB_DONE`, `JOB_NEEDS_HUMAN`, `JOB_ESCALATED`, `ESCALATION_SENT`, `JOB_CANCELLED`, `CALL_WATCHDOG_TIMEOUT`, plus `dispatch result` (one per due job, with `result`) and `event handled` (one per EventBridge event).
