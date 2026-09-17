# Architecture

## 1. Shape

```
Browser (console /insta)          Meta                         CRM
   |  JWT                          |  OAuth redirect             ^
   v                               |  webhooks (signed)          | x-api-key
API Gateway  --->  Lambda (Express) <------------------------    |
                     |  services/instagramService.js  -----------+
EventBridge  --->  Lambda (worker)  --->  graph.instagram.com
                     |
                  DynamoDB: insta-data, insta-audit
```

One Lambda, two triggers. HTTP requests go to Express (`server.js`); the EventBridge
rule invokes `services/worker.js` every two minutes.

## 2. Authentication

| Caller | Route prefix | Proof |
|---|---|---|
| Console (browser) | everything under `/api/insta` not listed below | CRM JWT, validated by `GET <auth service>/auth/me` (60s cache). Tenant comes from the token, never from the request |
| Instagram OAuth redirect | `GET /oauth/callback` | HMAC-signed `state` carrying tenant + user, 15-minute expiry (`services/metaSecurity.js`) |
| Meta webhooks | `/webhooks/instagram` | `X-Hub-Signature-256` over the raw body with the app secret; `GET` handshake with the verify token |
| Meta platform callbacks | `/meta/deauthorize`, `/meta/data-deletion` | `signed_request` verified with the app secret |
| Health | `GET /health` | open |

Local development can set `INSTA_DEV_AUTH_TENANT_ID` to skip the JWT. `assertEnv`
refuses it under Lambda or `NODE_ENV=production`.

## 3. Data model

Two tables. Every agency row lives in partition `TENANT#<tenantId>`.

| Item | Sort key | Notes |
|---|---|---|
| Instagram account | `IGACCOUNT#<igUserId>` | profile, `status` (`connected`, `reconnect_required`, `disconnected`), **encrypted** token (`tokenCiphertext`, AES-256-GCM), expiry, webhook state, job clocks, last error |
| Thread | `THREAD#<igUserId>_<participantId>` | one per (business account, person); last inbound/outbound/comment times, unanswered, `needsAnalysis`, `analysis` summary, `enquiryId`, `sourceMediaId`. The Meta window is computed on read |
| Message | `MSG#<threadId>#<messageId>` | stored once per Meta message id, whether it came by webhook, poll or our own send |
| Enquiry | `ENQ#<enquiryId>` (GSI1 `TENANT#t#ENQ` / `createdAt#id`) | `ig_<threadId>`; name, phone, intent, lead score, requirement, summary, next action, suggested reply, `status` + `notes` (human-owned), `crmSync` |
| Comment | `COMMENT#<commentId>` | claimed once with a conditional put, so a comment seen by webhook and poll fires a rule once |
| Rule | `RULE#<ruleId>` | keyword, match type, public reply, DM message, media scope |
| Media / snapshots | `MEDIA#`, `SNAP#MEDIA#<id>#<date>`, `SNAP#ACCOUNT#<igUserId>#<date>` | reels, insights, daily account metrics |

Cross-tenant pointer rows (no agency data, only `{tenantId, igUserId}`):

| Partition | Sort key | Used by |
|---|---|---|
| `REGISTRY#IGIDS` | `IGID#<any Instagram id>` | webhooks and Meta callbacks find the tenant |
| `REGISTRY#IGACCOUNTS` | `ACCT#<tenantId>#<igUserId>` | the worker lists every connected account |
| `REGISTRY#DELETIONS` | `DEL#<code>` | data-deletion status lookups |

One Instagram account belongs to one workspace; connecting it from a second one is
refused while the first connection is active.

The audit table holds `EVT#<ts>#<id>` rows under a 30-day TTL. Note text and message
bodies are never written to it.

## 4. Flows

**Connect.** `POST /oauth/start` → Instagram consent → `GET /oauth/callback` → code →
short-lived token → long-lived (60 days) → `GET /me` → account row with encrypted
token → registry pointers → `POST /me/subscribed_apps` (`messages,comments`, falling
back to `messages`) → redirect to `<INSTA_CONSOLE_URL>/accounts?connected=<handle>`.

**DMs in.** Webhook messages and polled conversations both go through
`ingestMessages`: store new messages, recompute the thread, mark it for analysis when
a new inbound message arrived. For webhook-only senders the handle is looked up with
the User Profile API.

**Analysis.** The worker (or `POST /threads/:id/analyse`) runs `services/leadAnalyst.js`
on threads marked for analysis. A lead becomes an enquiry; human-owned fields
(status, notes, first captured phone) survive re-analysis.

**CRM hand-off.** An enquiry with a phone and a buy/rent/sell intent is forwarded to
`POST <CRM>/api/internal/adapters/leads` with `dedupeKey = <enquiryId>:<phone digits>`.
A parsed rupee figure is sent as `budget`; the bracket only when no figure exists.
The outcome is stored as `crmSync` (`created`, `updated`, `duplicate`, `skipped`,
`failed`, `waiting_for_phone`, `needs_intent`, `not_configured`).

**Replies.** `POST /threads/:id/reply` → kill switch → window policy → dry run or
`POST /me/messages` → stored as an outbound message. A window error from Meta sets
`windowClosedAt`; the thread stays closed until the person writes again, and the send
is not retried.

**Keyword rules.** A comment (webhook or poll of the 10 newest media) is claimed once;
own comments are ignored; the oldest matching enabled rule sends one private reply
(`recipient.comment_id`, within 7 days) and an optional public reply, subject to the
hourly cap per account.

**Worker jobs** (per account, each with its own clock on the account row):

| Job | Default cadence |
|---|---|
| token refresh | checked every 12h, refreshed in the last 10 days of 60 |
| profile + account insights | 6h |
| conversations | 5 min |
| analysis | every run |
| media + insights | 60 min |
| comments | 5 min, only when rules exist |

An auth error marks the account `reconnect_required`; a rate-limit error stops that
account until the next run.

**Meta callbacks.** Deauthorize: token removed, account disconnected, pointers removed.
Data deletion: every row this service holds for the account is deleted (CRM leads
already created belong to the CRM and are not touched), and
`{ url, confirmation_code }` is returned.

## 5. Meta endpoints

Only documented Instagram API with Instagram Login endpoints, all in
`services/instagramApi.js`:

| Purpose | Call |
|---|---|
| Consent | `https://www.instagram.com/oauth/authorize` |
| Code exchange | `POST https://api.instagram.com/oauth/access_token` |
| Long-lived / refresh | `GET graph.instagram.com/access_token` (`ig_exchange_token`), `/refresh_access_token` (`ig_refresh_token`) |
| Profile | `GET /me?fields=user_id,username,...` |
| Webhooks | `POST /me/subscribed_apps` |
| Conversations | `GET /me/conversations?platform=instagram`, `GET /<conversation>?fields=messages{...}` |
| Sender handle | `GET /<IGSID>?fields=name,username` |
| Send / private reply | `POST /me/messages` with `recipient.id` or `recipient.comment_id` |
| Public comment reply | `POST /<comment>/replies` |
| Media, comments, insights | `GET /me/media`, `/<media>/comments`, `/<media>/insights`, `/me/insights` |

Errors are classified once (`services/metaErrors.js`): rate limit, window blocked,
auth, permission, not found, retired metric, transient, validation. A retired metric
is dropped and the rest re-requested.

## 6. Safety controls

| Control | Where |
|---|---|
| 24h / 7-day windows, no HUMAN_AGENT | `services/windowPolicy.js` |
| Dry run (record, never send) | `INSTA_DRY_RUN_SENDS` |
| Kill switch (no sends at all) | `INSTA_KILL_SWITCH` |
| Hourly cap on rule replies | `INSTA_MAX_AUTO_REPLIES_PER_HOUR` |
| One private reply per comment | conditional `COMMENT#` claim |
| Tokens encrypted at rest | `INSTA_TOKEN_ENCRYPTION_KEY` |
| No token, phone or message text in logs | `logger.js` redaction |
| Phone numbers only from the lead's own messages | `services/leadAnalyst.js` |
