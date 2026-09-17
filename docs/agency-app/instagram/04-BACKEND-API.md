# Backend API — `backend_insta_sol_ms`

Base: `https://<INSTA_API_DOMAIN_NAME>/<INSTA_API_BASE_PATH>/api/insta`.
Errors are always `{ error, details? }`. Tenancy comes from the JWT, never the body.

## Open or Meta-authenticated

| Method | Path | Auth | What |
|---|---|---|---|
| GET | `/health` | none | `{ status, service, env, instagramConfigured, serverTime }` |
| GET | `/oauth/callback` | signed state | Instagram redirect target; 302 to `<INSTA_CONSOLE_URL>/accounts?connected=<handle>` or `?error=` |
| GET | `/webhooks/instagram` | verify token | Meta subscription handshake; echoes `hub.challenge` |
| POST | `/webhooks/instagram` | `X-Hub-Signature-256` | DMs, echoes, comments. 200 `EVENT_RECEIVED`; 401 on a bad signature |
| POST | `/meta/deauthorize` | `signed_request` (form) | `{ ok, found }` |
| POST | `/meta/data-deletion` | `signed_request` (form) | `{ url, confirmation_code }` |
| GET | `/meta/data-deletion/status?code=` | none | `{ confirmationCode, status, completedAt }` |

## Console (JWT)

| Method | Path | What |
|---|---|---|
| POST | `/oauth/start` | `{ authorizeUrl }`; 503 when the Instagram app is not configured |
| GET | `/accounts` | `{ accounts[], instagramConfigured, dryRunSends, killSwitch }` — never a token |
| POST | `/accounts/:igUserId/sync` | runs profile and insights, conversations, media, comments and analysis now (no new job after 20 s); `{ account, summary }`; 409 if not connected |
| DELETE | `/accounts/:igUserId` | disconnect; history kept |
| GET | `/threads?windowState=&unanswered=&igUserId=` | conversations with `windowState`, `windowExpiresAt`, `analysis`; `{ threads, counts }` |
| GET | `/threads/:threadId` | `{ thread, messages[], enquiry, canReply: { allowed, reason } }` |
| POST | `/threads/:threadId/reply` | `{ text }` → 201 `{ messageId, status: sent|dry_run, thread }`; 409 outside the window; 423 kill switch |
| POST | `/threads/:threadId/analyse` | re-run analysis → `{ thread, enquiry }` |
| GET | `/enquiries?status=&temperature=&limit=&cursor=` | newest first, `{ enquiries, cursor }` |
| PATCH | `/enquiries/:enquiryId` | `{ status?, notes? }` |
| POST | `/enquiries/:enquiryId/push-to-crm` | retry the CRM hand-off → `{ enquiry, crmSync }` |
| GET | `/media?sort=enquiries|views&limit=` | reels with `enquiryCount`, `hotCount`, `dmCount` |
| GET | `/media/:mediaId` | `{ media, snapshots }` |
| GET | `/comments?mediaId=&limit=` | synced comments newest first, with `media`, `lastReply`, `privateReplyAllowed`, `privateReplyReason`; `{ comments }` |
| POST | `/comments/:commentId/reply` | `{ text, mode: public|private }` → 201 `{ comment, status: sent|dry_run }`; a private reply also lands in the DM inbox; 409 when a private reply is used or older than 7 days; 423 kill switch |
| GET/POST | `/rules` | list / create or update (`ruleId` present = update) |
| DELETE | `/rules/:ruleId` | |
| GET | `/overview?days=` | `{ counters, accounts, series[{date, enquiries, followers, reach, views}] }`; for 30 days, `counters.reach/views/accountsEngaged/totalInteractions` are Meta's 30-day totals |
| GET | `/insights/timeseries?metric=followers|reach|views&days=&igUserId=` | `{ metric, points }` |

Enum values: `status` new, contacted, qualified, site_visit, won, lost, spam;
`temperature` hot, warm, cold (lead score very_hot, hot, cold); `windowState` STANDARD,
COMMENT_REPLY, CLOSED; rule `matchType` exact, contains, starts_with, regex.
