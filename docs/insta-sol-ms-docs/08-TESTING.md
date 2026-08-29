# Testing

Everything below was actually run on 2026-08-29, not asserted from the code.

## Summary

| Suite | Command | Result |
|---|---|---|
| Backend unit + route tests | `cd backend_insta_sol_ms && npm test` | **80 pass, 0 fail** |
| Laptop agent tests | `cd instagram-local-agent && npm test` | **85 pass, 0 fail** |
| Frontend typecheck + build | `cd frontend_insta_sol_ms && npm run build` | **clean** (tsc --noEmit then vite build) |
| CFN templates | `aws cloudformation validate-template` x3 | **all valid** |
| Deploy scripts | `bash -n` x4 | **no syntax errors** |
| Live API smoke test | against the deployed stack | **7/7 as expected** |

## What the tests actually cover

### The cross-component test that matters most

`instagram-local-agent/tests/uplink.test.js` imports the **real backend module**
(`backend_insta_sol_ms/services/hmac.js`) alongside the agent's own signer and asserts
they produce identical output. The two are separate deployables that must agree
byte-for-byte on the HMAC construction, so a change to either side breaks this test.
That is the point — a copied fixture would have silently drifted.

It checks: identical string-to-sign, identical signature, the backend verifying an
agent-produced signature, every signed component being tamper-evident, an empty body
still contributing `sha256("")`, a different secret failing, and skew bounded in both
directions.

### Safety guarantees (`instagram-local-agent/tests/safety.test.js`)

These encode the product's central promise, so they are deliberately blunt:

- the full window-classifier truth table, including the exact boundaries (24h and 7d
  are *exclusive* — at exactly the limit the window has lapsed)
- `HUMAN_AGENT` never grants automated permission
- `COMMENT_REPLY` permits a private reply but **not** a free-form DM
- the sender refuses to queue a DM to a `CLOSED` thread, and records it as `blocked`
  rather than dropping it
- a Meta window error downgrades the conversation to `CLOSED` and is attempted
  **exactly once** — never retried
- the kill switch leaves items queued and lets nothing reach the network
- dry run builds the request and sends nothing
- the rate governor refuses over cap, and our caps sit below Meta's ceilings
- the console binds `127.0.0.1`, never `0.0.0.0`
- Phase 4 stubs refuse, and the browser importer is not schedulable
- a source-wide scan asserting no banned endpoint (follow/unfollow/likes/follower list)
  appears anywhere in `src/`

### Hinglish extraction (`instagram-local-agent/tests/extract.test.js`)

Real phrasings, not tidy English: `"1.4 cr tak"`, `"1 crore ke around"`, `"50 lakh max"`,
`"80L-1Cr"`, `"80 to 90 lakh"`. Also the negative cases that matter — `"2 BHK chahiye"`
and `"3rd floor"` must **not** parse as budgets, and a ten-digit price must not parse as
a phone number.

### Backend (`backend_insta_sol_ms/tests/`)

80 tests across HMAC, device auth (including replay and skew), DynamoDB key
construction, normalisation helpers, and every route with a mocked data layer. No AWS
calls.

## Live verification against the deployed stack

API: `https://dvdmdi6c5i.execute-api.ap-south-1.amazonaws.com/v1`

```
GET  /api/insta/health                      200  {"status":"ok","service":"insta-sol-ms",...}
GET  /api/insta/overview        (no JWT)    401  Missing or invalid Authorization header
POST /api/insta/agent/snapshot  (no HMAC)   401  Missing device authentication headers
POST /api/insta/agent/heartbeat (valid)     200  {"ok":true,"killSwitch":false}
POST /api/insta/agent/heartbeat (bad secret)401  Signature verification failed
POST /api/insta/agent/heartbeat (stale ts)  401  Request timestamp outside the allowed window
POST /api/insta/agent/heartbeat (replay)    401  Nonce already used
GET  /api/insta/agent/rules                 200  {"rules":[],"updatedAt":null}
POST /api/insta/agent/snapshot              200  {"ok":true,"accounts":1,...}
POST /api/insta/agent/enquiries             200  {"ok":true,"written":1,"rejected":[]}
```

The signed requests were produced by the **agent's own** `signRequest()`, so this
exercises the real client against the real service, not a hand-built curl.

Items written were confirmed in DynamoDB and then deleted:

```
DEVICE#dev_smoke1
ENQ#enq_smoke1
SNAP#ACCOUNT#ig_smoke#2026-08-29
```

The seeded test device and all smoke-test rows were removed afterwards; the table is
empty of test data.

## Two real bugs the tests found

Both were caught by tests rather than in review, and both would have been live defects.

1. **`openStore()` cached "migrated" as a single boolean.** After `closeDb()` a
   subsequent `getDb()` can open a *different* file (a new home, a restored backup, a
   test temp DB). The flag then reported that database as migrated when it had no
   tables at all, and every query after it failed with "no such table". Fixed with a
   `WeakSet` keyed on the handle. See `src/store/repos.js`.

2. **`flush()` double-parsed the upload payload.** `listDueUploads()` already parses
   the `payload` column, so `JSON.parse(row.payload)` on an already-parsed object
   stringified it to `"[object Object]"` and threw — which the catch treated as a
   corrupt payload and killed the row as `dead`. Every queued upload would have been
   silently discarded. See `src/uplink/queue.js`.

A third mismatch was caught by the live smoke test, not the unit tests: the backend
queried `IndexName: 'GSI1'` while the template created `gsi1-index`. Resolved by
aligning both on `gsi1-index`, which matches the convention already live in this repo
(`instagramWebhookToken-index`, `connectedWhatsAppPhone-index`). Worth noting that no
unit test could have caught it — it only appears against a real table, which is the
argument for the live smoke test existing at all.

## Running it yourself

```bash
cd backend_insta_sol_ms   && npm install && npm test
cd instagram-local-agent  && npm install && npm test
cd frontend_insta_sol_ms  && npm install && npm run build
```

No AWS credentials, network access or Meta app are needed for any of the three.

## What is not tested

Honest list of the gaps:

- **No live Meta API calls.** Every collector is tested against a stubbed Graph client.
  Nothing here proves the field and metric names are still correct against
  `graph.instagram.com` — Meta removed `impressions`, `plays` and `profile_views` in
  April 2025 and could remove more. The collectors are written to degrade rather than
  fail when a metric disappears, but the first real `ig-agent sync` is where the metric
  list gets confirmed.
- **No browser end-to-end test** of the frontend. It typechecks and builds, and its
  pages are wired to the real API contract, but nothing has clicked through it.
- **No JWT-authenticated live test.** Exercising `/overview`, `/devices/pair` and the
  rest against the deployed API needs a real user token from the auth service.
- **The `/insta/*` CloudFront behavior is unexercised**, because no CloudFront
  distribution exists in the account yet. See `09-CLOUDFRONT-INTEGRATION.md`.
- **OAuth is untested end to end.** `ig-agent connect` needs a real Meta app and a
  tester account; see `07-META-APP-SETUP.md`.
