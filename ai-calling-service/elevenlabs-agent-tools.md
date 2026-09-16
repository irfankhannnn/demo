# ElevenLabs Agent — Server Tools

Nine webhook tools to add to the shared agent in the ElevenLabs dashboard
(**Agent → Tools → Add tool → Webhook**). They replace the old
"intent webhook → regex classifier → inject context" relay: the agent's own
model now decides when it needs data.

Implementations live in `src/handlers/serverTools.js`, routed in
`src/routes/tools.js`.

## Base URL

```
{WEBHOOK_BASE_URL}/api/ai-calling/tools
```

`WEBHOOK_BASE_URL` is `https://<AI_CALLING_API_DOMAIN_NAME>/<AI_CALLING_API_BASE_PATH>`
(stack output `AiCallingApiBaseUrl`) — the API Gateway custom domain + base
path, never an execute-api invoke URL. The tools only respond once the stack is
deployed.

## Headers — required on all nine tools

Set these identically on every tool. They are what scopes a call to one tenant;
without them the request is rejected.

| Header | Value | Type |
|---|---|---|
| `x-api-key` | the `SERVER_TOOL_API_KEY` secret | Secret |
| `x-tenant-id` | `{{secret__tenant_id}}` | Dynamic variable |
| `x-lead-id` | `{{secret__lead_id}}` | Dynamic variable |
| `x-call-session-id` | `{{secret__call_session_id}}` | Dynamic variable |

**Tenant scope must come from these headers, never from a body parameter.**
The model can write anything into a body parameter, including another tenant's
id; it cannot alter a header bound to a `secret__` dynamic variable. Adding a
`tenant_id` body parameter to any of these tools would reopen exactly the
cross-tenant hole the old unauthenticated webhook had.

Store the API key as a **Secret** in the ElevenLabs workspace, not as a plain
header value.

---

## 1. `search_properties`

**Description** (the model reads this to decide when to call it — keep it
behavioural, not technical):

> Search the agency's live property listings. Call this whenever the customer
> describes what they are looking for — budget, area, number of bedrooms,
> property type — or asks what is available. Always call this rather than
> guessing what might be available.

`POST /search-properties`

| Parameter | Type | Required | Description for the model |
|---|---|---|---|
| `description` | string | no | **What the customer said they want, in their own words** — e.g. "kuch shaant jagah chahiye station ke paas, family ke liye". Pass this whenever they described their needs in prose rather than exact numbers. Do not reduce it to keywords: the phrasing carries meaning the search uses. |
| `location` | string | no | Area, locality or landmark the customer mentioned, e.g. "Whitefield" |
| `bedrooms` | number | no | Number of bedrooms (the number in "3 BHK") |
| `propertyType` | string | no | e.g. "apartment", "villa", "independent house" |
| `maxPrice` | number | no | Maximum budget in rupees, as a plain number: 8000000 for 80 lakhs |
| `minPrice` | number | no | Minimum budget in rupees, plain number |

Returns `{ speech, count, properties[] }`.

**How `description` changes the search.** With it, matching runs on *meaning*
against property embeddings, so a listing written as "spacious flat, walking
distance to the metro" matches a customer who said "bada ghar station ke paas" —
no shared words at all. That Hinglish-to-English gap is the common case on these
calls, not an edge case, and plain keyword filters cannot bridge it.

Hard constraints (`maxPrice`, `bedrooms`) still apply exactly on top of the
semantic ranking, so a budget is never merely "approximately" respected. If
semantic matching returns nothing, the service falls back to exact filters
automatically — an empty result mid-call would have the agent tell a customer
there is nothing available, so a degraded answer is preferred to a wrong one.

---

## 2. `get_property_details`

> Get full details of one specific property the customer is asking about —
> amenities, size, furnishing, exact rent. Use the propertyId from a previous
> search result.

`POST /property-details`

| Parameter | Type | Required | Description for the model |
|---|---|---|---|
| `propertyId` | string | yes | The id from a previous search_properties result |

Returns `{ speech, property }`.

---

## 3. `schedule_site_visit`

> Book a site visit for the customer. Only call this once you have both a
> specific property and a day they want to come. Do not invent a date — ask.

`POST /schedule-site-visit`

| Parameter | Type | Required | Description for the model |
|---|---|---|---|
| `propertyId` | string | yes | Property they want to visit |
| `preferredDate` | string | yes | Day as the customer said it, e.g. "tomorrow", "Saturday", "12 March" |
| `preferredTime` | string | no | Rough time, e.g. "morning", "4pm" |

Returns `{ speech, visit }`. The lead is taken from the header, not a
parameter — the model never supplies who it is booking for.

---

## 4. `answer_policy_question`

> Answer questions about agency policies, rental rules, deposits, paperwork,
> agreements, or the agency itself, from the agency's own documents. Use this
> instead of answering from memory — policies differ per agency.

`POST /policy-answer`

| Parameter | Type | Required | Description for the model |
|---|---|---|---|
| `question` | string | yes | The customer's question, in your own words |
| `category` | string | no | One of: `faq`, `policies`, `agency_info`, `pricing` |

Returns `{ speech, answer, confidence }`.

> **Note:** this tool answers only from what the agency has written in the CRM
> under **Agency Policies**. That text is chunked one rule per paragraph,
> embedded with Titan v2 and searched over DynamoDB vector search
> (`server/services/knowledge/`). An agency with no policies saved gets "I
> don't have specific information about that" every time — which is correct,
> not a fault. Uploading a *file* is still not supported; that route returns 501.

---

## 5. `submit_qualification`

> Record how ready this customer is to transact. Call this once on a
> qualification call, as soon as you can tell. This is a silent background
> note — never tell the customer their classification.

`POST /qualification`

| Parameter | Type | Required | Description for the model |
|---|---|---|---|
| `temperature` | string | yes | Exactly one of: `HOT`, `WARM`, `COLD` |
| `reasons` | array of strings | no | Short reasons for the classification |

Returns `{ speech: "", recorded, temperature }` — deliberately empty speech so
the agent carries on naturally instead of announcing the scoring.

---

## 6. `request_human_handoff`

> Flag that this customer needs a person. Call this when they ask for a human,
> get frustrated, raise something you cannot answer, or want to negotiate.

`POST /human-handoff`

| Parameter | Type | Required | Description for the model |
|---|---|---|---|
| `reason` | string | no | Brief reason for the handoff |

Returns `{ speech, recorded }`.

---

## 7. `confirm_site_visit`

> Confirm, or move to a new time, a site visit that is already booked. Call
> this on a site-visit confirmation call once the customer has said whether
> the planned time works. For a reschedule, ask for the new day first — never
> invent one.

`POST /confirm-site-visit`

| Parameter | Type | Required | Description for the model |
|---|---|---|---|
| `action` | string | yes | Exactly one of: `confirm`, `reschedule` |
| `newDate` | string | for reschedule | New day as the customer said it, e.g. "Sunday", "12 March" |
| `newTime` | string | no | New rough time, e.g. "11am", "evening" |
| `note` | string | no | Anything the customer asked to pass on |
| `meetingId` | string | no | Leave empty — the visit is taken from the call's own context |

Returns `{ speech, meeting }`. The meeting comes from the context the CRM
supplied at call start, so the model never has to know an id; if nothing is
on record the service flags a callback itself and returns speech saying so.

---

## 8. `record_visit_feedback`

> Record how a site visit went. Call this once on a post-visit call, after
> you have heard whether they liked it, any issues, anything they still need
> clarity on, and when they could proceed with the token. This is a silent
> background note — never tell the customer you are recording anything.

`POST /visit-feedback`

| Parameter | Type | Required | Description for the model |
|---|---|---|---|
| `liked` | boolean | no | Did they like the property they visited |
| `issues` | array of strings | no | Concerns raised, e.g. ["parking", "west facing"] |
| `clarificationsNeeded` | array of strings | no | Things they still want answered, e.g. ["maintenance charges"] |
| `tokenTimeline` | string | no | When they could pay the token, in their words: "next week", "after Diwali" |
| `interestLevel` | string | no | Your read: exactly one of `high`, `medium`, `low`, `none` |
| `notes` | string | no | Anything else worth passing to the agent |

Returns `{ speech: "", recorded: true }` — deliberately empty speech so the
agent carries on naturally. Stored on the call session and appended to the
lead as a CRM note.

---

## 9. `request_callback`

> Flag that a person needs to call this customer back about something
> specific. Call this when they ask something you have no information for,
> or want something done that you cannot do (a revisit, a price discussion,
> documents, a different property). Be specific about the reason.

`POST /request-callback`

| Parameter | Type | Required | Description for the model |
|---|---|---|---|
| `reason` | string | yes | What the person needs to address, in one sentence |
| `topic` | string | no | Short label, e.g. "pricing", "documents", "revisit" |

Returns `{ speech, recorded }`. Marks the call as needing a human; the
follow-up service escalates to the assigned agent instead of retrying.

---

## Post-call webhook

Separately from the tools, configure the workspace **post-call webhook**
(Settings → Webhooks):

- **URL:** `{WEBHOOK_BASE_URL}/webhooks/elevenlabs/post-call`
- **Events:** post-call transcription
- **Secret:** generate one, then store the same value as
  `ELEVENLABS_WEBHOOK_SECRET` in the service's Secrets Manager secret

The service verifies the `elevenlabs-signature` HMAC on every delivery and
rejects unsigned or stale requests.

> **Confirm on the first delivery.** ElevenLabs documents signature
> verification through their SDK and does not publish the raw scheme, so
> `verifyWebhookSignature()` implements the standard
> `t=<timestamp>,v0=<hex-hmac-sha256>` over `${timestamp}.${rawBody}`. If the
> first real delivery is rejected, CloudWatch logs the header's *shape* (values
> redacted) — compare it against that assumption and adjust
> `parseSignatureHeader()` if the format differs. Only that function and the
> signed-payload line need to change.

## Checklist

- [ ] All nine tools created, pointing at the deployed API Gateway URL
- [ ] All four headers set identically on all nine tools
- [ ] `SERVER_TOOL_API_KEY` stored as a workspace Secret, matching the value in Secrets Manager
- [ ] No tool has a `tenant_id` body parameter
- [ ] Post-call webhook configured, secret matching `ELEVENLABS_WEBHOOK_SECRET`
- [ ] Test conversation confirms tools fire and no `secret__` value is spoken
