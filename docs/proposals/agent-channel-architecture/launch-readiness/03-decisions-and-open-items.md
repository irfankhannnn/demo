# Decisions taken, and what is still open

A running record of product decisions made during launch prep, and the items still waiting on someone. Kept so a decision does not have to be re-derived from a chat log.

---

## Decisions taken

### D1. Call-recording retention — keep forever, with Intelligent-Tiering
**Decided by:** product owner · **Status:** ✅ already implemented

The S3 `DocumentsBucket` keeps call recordings, transcripts and analysis payloads **indefinitely**. No expiration rule. Objects move to `INTELLIGENT_TIERING` after 30 days, which cuts storage cost on cold data without a retrieval fee and moves objects back automatically on access.

The lifecycle rules that *do* exist are hygiene only: abort incomplete multipart uploads after 7 days, reclaim non-current object versions and expired delete markers.

**Rejected alternative:** a `RecordingRetentionDays` parameter driving `ExpirationInDays`. It would need a chosen N and a decision on per-tenant configurability, and deleting customer records on a default nobody picked is the wrong failure mode.

**If this is ever revisited:** tiered retention ("delete audio at N, keep transcripts") is *not* a lifecycle-rule change alone. Object keys are tenant-prefixed (`{tenantId}/call-recordings/…`) and S3 lifecycle filters cannot wildcard a leading path segment, so targeting only the audio requires **object tagging at upload time** — a code change in the upload path, not just infra.

### D2. Credit refund on a failed turn — refund only when no CRM write landed
**Decided by:** product owner (option B of two) · **Status:** ✅ implemented

Full write-up: [`02-credit-refund.md`](./02-credit-refund.md).

A turn that fails without any tool succeeding now returns its 15 credits. A turn that fails *after* a tool wrote to the CRM does not — the customer got what they asked for.

**Rejected alternative (option A):** refund on any exception. Simpler, but pays the customer for work that was actually done.

### D3. Dead frontend code — delete
**Decided by:** product owner · **Status:** ⏳ awaiting a `git rm` (deletion is blocked for the assistant by the permission classifier)

12 files, 4,829 lines, every one referenced by **zero** other files:

| File | Lines | What it was |
|---|---|---|
| `pages/crm/EnquiryList.tsx` | 1,791 | An "enquiries" screen; folded into `LeadList`/`ContactList` |
| `pages/crm/CustomerList.tsx` | 339 | "Customers"; replaced by `TenantList`/`TenantDetails` |
| `pages/RentalList.tsx` | 441 | Rentals list; replaced by `PropertyList` |
| `pages/BuildingDetail.tsx` | 239 | An abandoned **building → flats** data model |
| `components/flat/*.tsx` (5) | 972 | Tabs for that same abandoned model |
| `pages/crm/ProjectDetails.tsx` | 399 | Projects screen |
| `pages/crm/DeveloperDetails.tsx` | 374 | Developers screen |
| `pages/crm/RealEstateAreaDetails.tsx` | 274 | Areas screen |

**Why it is safe:** `CLAUDE.md` lists Developers/Projects/Areas as real DynamoDB tables, so the obvious worry is orphaning a working backend. It does not. Seven matching backend routers exist — `developers.js`, `projects.js`, `areas.js`, `buildings.js`, `realEstateAreas.js`, `areasBuildings.js`, `publicAreas.js` — and **none of them is mounted in `server.js`**. The whole vertical is dead at both ends: an earlier product direction (buildings/flats/projects/developers) replaced by the current one (properties/leads/contacts) and never cleaned up.

**Why it is worth doing:** not bundle size — Vite only bundles reachable modules, so these never ship. The cost is that they generate most of the remaining `tsc` errors, and **that noise is where a real bug hid**: `WhatsAppInbox.tsx` called three `api` methods that did not exist, `tsc` reported it the whole time, and nobody could see it. A clean baseline makes the next one visible on day one.

**Not irreversible.** Everything is in git history; `git revert` on the deletion commit restores it.

**Related follow-up, not yet done:** the seven unmounted backend routers are dead for the same reason and were not part of this decision.

---

## Open — needs a person

### O1. `git rm` for D3
The assistant is blocked from deleting files by the permission classifier. One command from the repo root, then the assistant verifies `tsc`/`vite build` and commits.

### O2. Flip `AgentToolLoopEnabled`
The bounded multi-step tool loop — the capability that lets *"create a lead and schedule a visit"* complete in one turn — is shipped **OFF** (`AgentToolLoopEnabled: 'false'` in CFN). Single-tool turns work either way.

Bounded at 6 steps / 25s (18s on web), 15 tests. **It has never run against the real Gemini model.** Enable in staging first and watch cost-per-turn and p95 latency; more steps means more round-trips.

### O3. Phase 3c — strict tool schemas
Blocked on evaluation data, not on code. Turning on `additionalProperties: false` means deleting `coerceQueryToFilters()` and `LEAD_STATUS_TYPOS`, which are load-bearing today; removing them without evidence breaks whatever they were silently repairing.

Needs: a `GEMINI_API_KEY`, and **~100–200 real WhatsApp utterances labelled with the tool that should have been called**. The harness exists (`npm run eval`) but has only 5 hand-written fixtures. Fixture shape is in `server/eval/fixtures/whatsapp-tool-choice.json`. The labelling needs someone who knows the right answer.

### O4. Phase R1 — vector-search spike
R0 is done: the SDK is at 3.1116.0 and `SearchVectorsCommand` is available.

R1 is a throwaway spike — scratch table, ~200 embedded call summaries, measure recall/latency/cost. Needs non-prod AWS credentials and confirmation that `search-dynamodb.{region}.amazonaws.com` is reachable from the Lambda's networking. **A cross-tenant isolation test must pass before anything else in Phase R starts** — a vector index without `tenantId` as its partition key searches every tenant's data.

### O5. Token-by-token streaming
Buys *perceived* latency only; the reply already arrives complete. `@vendia/serverless-express` buffers, so it needs a streaming entry point. The client already speaks SSE and needs no change.

Options: a Lambda Function URL with `awslambda.streamifyResponse` for `/api/crm/agent-chat` (the plan's own fallback, and the recommendation), API Gateway REST `ResponseTransferMode: STREAM` (still unverified in this account), or skip it.

### O6. Deploy, and run against reality
Nothing here is deployed and nothing has run against the real Gemini model or real AWS. Two GSIs (`connectedWhatsAppPhone-index`, `instagramWebhookToken-index`) must report `ACTIVE` **and** `Backfilling: false` before the code that queries them runs.

**Full runbook: [`04-backend-deployment-runbook.md`](./04-backend-deployment-runbook.md)** — the template inventory, the deploy order, and the six blockers found when the templates were checked against the live account. Both GSIs land in one shot because `AgencyConfigTable` is being created, not updated.

---

## Deliberately not doing

- **Retention/expiration** — see D1.
- **Per-staff identity on a shared WhatsApp number** — self-chat means one identity per connected number. Needs a real identity model; the RBAC plumbing now exists for when there is one.
- **Deleting the 5 remaining LOW call-recording items** — cosmetic, none customer-visible.
