# Testing

## Run

```bash
cd backend_insta_sol_ms && npm test          # 121 tests, no AWS, no Meta, ~8s
cd frontend_insta_sol_ms && npm run build    # tsc --noEmit + vite build
```

The backend suite runs the real `dynamoService` against an in-process DynamoDB
stand-in (`services/localDynamo.js`), a fake Instagram (`tests/fakeInstagram.js`), a
fake CRM and fake auth.

| File | Protects |
|---|---|
| `instagramFlow.test.js` | connect (encrypted token, both ids routed, webhook subscribe and fallback, one workspace per account); DM → enquiry → exactly one CRM lead; waiting for a phone; human status surviving re-analysis; reply inside / outside 24h; Meta window error closes the thread, never retried; dry run; kill switch; webhook idempotency, echoes, unknown accounts, sender handle lookup; keyword rules once per comment, 7-day limit, own comments ignored, hourly cap; revoked token → reconnect; token refresh timing; worker cadence; deauthorize; data deletion; disconnect |
| `routes.test.js` | every HTTP route over real Express: OAuth start/callback/deny/forged state, accounts never leaking tokens and tenant isolation, sync, disconnect, webhook handshake and signature, Meta callbacks as form posts, threads, reply, analyse, enquiries validation/audit/tenancy/push, media attribution, rules validation, overview, insights |
| `leadAnalyst.test.js` | phone extraction, budget scale (lakh / crore / k), intent, lead score and recency, our own number never stored as the lead's, a model-invented number rejected, Gemini key in a header, fallback to rules on failure |
| `instagramApi.test.js` | exact Meta URLs, forms and bodies; both token-response shapes; path-injection guard; error classification without leaking the token; retired-metric degradation |
| `sendPolicy.test.js` | window edges, private-reply 7-day limit, Meta-closed windows, message cap; rule matching (word boundary, starts_with spellings, regex, scope, order) |
| `metaSecurity.test.js` | token encryption and tampering, OAuth state forgery and expiry, webhook signature over raw bytes, signed_request |
| `dataLayer.test.js` | message idempotency, comment claim, window on read, enquiry paging, patch whitelist, registry isolation, data deletion scope |
| `crmBridge.test.js` | CRM payload, dedupe key, rupee budget vs bracket, standalone mode, retryable failures, batching |
| `env.test.js`, `cors.test.js`, `dynamoKeys.test.js`, `normalise.test.js`, `lambda.test.js` | configuration guards, preflight handling, key construction, normalisers, both Lambda triggers |

## End-to-end run (15 Sep 2026)

The backend, the console (Vite dev server) and a mock Instagram + mock CRM server were
run locally and driven through the browser and the API:

- Connect → mock consent screen (exact three scopes) → callback → console banner and account card
- "Not now" on the consent screen → error banner, nothing connected
- DM with a phone → Very hot enquiry → CRM lead with name, phone, intent, rupee budget
- 30-hour-old DM → thread shown as window closed, composer disabled, API reply refused (409)
- Reply inside 24h → delivered to the mock Instagram, shown in the thread
- PRICE rule + comment → one private reply and one public reply, not repeated
- Signed webhook DM → thread with the sender's handle, analysed, CRM lead; forged webhook → 401; verify handshake → challenge echoed
- Disconnect → sync refused; reconnect → history kept
- Deauthorize and data deletion via signed_request → account disconnected; all its data deleted; status URL works
- Enquiries, Reels, Rules, Overview screens rendered with the data; no horizontal overflow at 375px
- No errors in the backend log

Bugs found by that run and fixed, each with a regression test: a 45k rent sent to the
CRM as a lakh bracket; a scored lead that was not listed as an enquiry; webhook-only
senders without a name failing the CRM hand-off; every error log losing its event
name; the worker's `token` job name redacted in logs; a sync throw instead of a
rejection on a malformed id.

## Not yet verified

- Against real Meta (needs the app secret in `.env.dev` and a tester account): see
  `07-META-APP-SETUP.md` for the steps.
- Against the deployed CRM adapter endpoint and real DynamoDB.
- Gemini analysis with a real key (the request shape is unit-tested).
