# Lead adapters — one table, one pipeline

**Status:** implemented on branch `instagram-solution`, 2026-09-02. Phases 0–4 are
code; Phase 5 (WhatsApp) is a plan only, deliberately untouched.

---

## 1. The idea

Every lead, whatever channel it arrived through, lands as one row in one table and
gets the identical downstream treatment: notification, AI qualification call
(Exotel + ElevenLabs), sentiment scoring, then closure.

An *adapter* is the only channel-specific part. Its whole job is to turn a native
payload into the canonical `LeadInput` and call `ingestLead()`. Everything after
that point is shared.

```
  ManyChat          Instagram          (later)          (later)
  webhook           laptop agent       website          WhatsApp
     │                   │                │                │
     │                   ▼                │                │
     │        backend_insta_sol_ms        │                │
     │        services/crmBridge.js       │                │
     │                   │                │                │
     │      POST /api/internal/adapters/leads              │
     ▼                   ▼                ▼                ▼
  ┌────────────────────────────────────────────────────────────┐
  │            apps/crm/server/leadIngestion.js  →  ingestLead()        │
  │   dedupe → createLead() → notifyNewLead() → lead.created   │
  └────────────────────────────────────────────────────────────┘
                              │
                    one row in CrmTable
                    EntityType: 'LEAD'
                              │
   ── unchanged, and already source-agnostic before this work ──
   EventBridge lead.created → LeadQualifierRule → lead-qualifier-handler
   → AI text score → lead.qualified
   "Call now to qualify" → ai-calling-service → Exotel + ElevenLabs
   → PATCH /api/internal/leads/:id/call-outcome → score + per-minute billing
   → convertLead() → BUYER / OWNER / CUSTOMER  (closure)
```

### Why there was no new engine to build

The qualification pipeline never inspected `lead.source`. It operates purely on
`{tenantId, leadId}`. So "one flow for every adapter" did not need a new engine —
it needed every adapter to *arrive at the same place, in one shape, with one
quality bar*. That is all `ingestLead()` is.

### The single table already existed

`CrmTable` (`apps/crm/server/infra/cfn-backend.yaml`) is single-table design. Leads are
`EntityType: 'LEAD'`, PK `TENANT#<t>#LEAD#<id>`, SK `PROFILE`. Buyers, Owners and
Customers are item types in that same table — **CLAUDE.md's claim that they are
separate tables is wrong.** The only real outsider was the Instagram Solution's
`insta-data` table, which is what Phase 3 bridges.

---

## 2. What changed

| Phase | Change | Files |
|---|---|---|
| 0 | `getLeads` full-table Scan → Query on `search-index` | `apps/crm/server/crmDynamodbService.js` |
| 1 | `sourceAdapter`, `externalRef`, `dedupeKey` columns; `site_visit` + `spam` statuses | `crmDynamodbService.js`, `agents/inputNormalizer.js`, `normalizers/leadNormalizer.js` |
| 2 | Shared `ingestLead()`; ManyChat webhook refactored onto it | `apps/crm/server/leadIngestion.js`, `apps/crm/server/routes/webhooks.js` |
| 3 | Internal adapter route; Instagram bridge | `apps/crm/server/routes/adapterIngestionInternal.js`, `apps/instagram/backend_insta_sol_ms/services/crmBridge.js`, `routes/agent.js` |
| 4 | Status/adapter fields in the CRM UI; "Open in CRM" from the Instagram dashboard | `apps/crm/real-estate-crm-app/src/...`, `apps/instagram/frontend_insta_sol_ms/src/pages/Enquiries.tsx` |
| — | Billing model rework | `apps/crm/server/creditConfig.js`, `apps/crm/server/aiCallBilling.js`, `routes/aiCallingInternal.js`, `routes/leads.js` |

### Phase 0 — the scan that would have bitten us

`getLeads` was a **full-table Scan** filtered on `EntityType`/`tenantId`, capped at
100 pages, with every other filter applied in memory. Every tenant's lead list read
every item of every entity type. Pouring Instagram DM volume into that table would
have slowed the product for everyone and, past the page cap, silently truncated
lists.

It now queries the existing `search-index` (GSI3) partition
`TENANT#<id>#SEARCH` with `begins_with(GSI3SK, 'LEAD#')`.

**No new GSI, no CFN change, no backfill wait** — every LEAD item has written GSI3
since `createLead` was first committed (verified: the attributes and the function
were added in the same commit, and the only other LEAD writer, the demo seeder,
sets them too). So no lead can exist outside the index.

### Phase 1 — new columns

`createLead` cherry-picks known fields into an object literal, so an unknown
attribute is **silently dropped, not rejected**. New fields must be added there
explicitly. Added:

- `sourceAdapter` — `'manychat' | 'insta-agent' | 'bailey' | 'website' | null`.
  `source` stays the coarse channel the UI filters on (`'Instagram'`); this
  distinguishes paths *within* a channel.
- `externalRef` — one blob for channel-native ids (`igUsername`, `igSenderId`,
  `sourceMediaId`, `conversationRef`), so a new adapter needs no new column.
- `dedupeKey` — stable per-source id backing idempotency.

**Status enum** gained `site_visit` (active pipeline, between qualified and
negotiating) and `spam` (terminal). `spam` is deliberately **not** in
`LEAD_ACTIVE_STATUSES`, so a spam lead is never picked up by follow-up crons or AI
qualification. Updated in all four places the enum is duplicated.

`won` from the Instagram vocabulary is **not** added. In the CRM, "converted" is
not a status flip — `convertLead()` writes a BUYER/OWNER/CUSTOMER item plus a
snapshot and deletes the LEAD row in one transaction. A `won` status that skipped
that would be a lie about the data.

### Phase 3 — why an API call, not a shared table

`backend_insta_sol_ms`'s IAM role is scoped to its own two tables, with an explicit
comment calling that "the isolation guarantee, enforced by IAM rather than by
convention". Granting it the CRM table would have been a small policy edit and a
large loss: an Instagram-side compromise would reach CRM data.

Going through `POST /api/internal/adapters/leads` keeps that boundary and means
there is exactly **one** implementation of "what happens when a lead is created",
rather than a second one in the microservice that could drift.

- Auth: `x-api-key` + `x-tenant-id`, matching the ai-calling-service pattern, with
  its **own** key (`ADAPTER_INTERNAL_API_KEY`) so one service's compromise does not
  grant the other's access. The comparison is constant-time.
- Mounted at `/api/internal/adapters` **before** `/api/internal`, because that
  router applies its own key check via `router.use` to everything passing through
  it and would otherwise reject adapter traffic first.
- No CFN/API Gateway change needed: the CRM API is already a catch-all `{proxy+}`.

**Failure policy.** The enquiry is stored locally first (never lose agent data),
then forwarded. A forwarding failure returns **502** so the agent's upload queue
retries — safe because each enquiry carries its `enquiryId` as a `dedupeKey`.
Unconfigured (`CRM_INTERNAL_API_URL` blank) is not a failure: the Instagram feature
runs standalone exactly as before.

---

## 3. Billing model

**Humans work for free; AI costs credits. 1 credit = ₹1.**

| Action | Before | Now |
|---|---|---|
| `lead_add` (manual lead) | 10 | **0** |
| `contact_add` / `property_add` / `owner_add` / `tenant_add` / `khata_entry` | 5 / 8 / 3 / 3 / 1 | **0** |
| `agent_action` (an LLM turn — incl. AI WhatsApp replies, text qualifier) | 15 | 15 |
| `ai_call_per_minute` | — | **15 per started minute** |

Manual costs are set to `0` in config rather than ripped out of the routes: every
helper in `middleware/meterCredits.js` already short-circuits on `cost <= 0`, so
this is a pure config change with no route churn, and a cost can be re-enabled from
the admin cost editor without a deploy.

Top-up packs are repriced 1:1 (500 credits = ₹500). Subscription plans still bundle
credits at a discount — their prices are tied to fixed Razorpay plan ids, so they
were deliberately left alone.

### AI call billing correctness

Charged in `apps/crm/server/aiCallBilling.js`, hooked into `PATCH /leads/:id/call-outcome`.

- **Per started minute** (`ceil`), like telecom billing. A 10-second call is 1 minute.
- **Never double-charged.** Exotel's status webhook *and* ElevenLabs' post-call
  webhook can both deliver a duration for the same call, so call-outcome can fire
  twice. Every charge is guarded by the repo's existing idempotency log, keyed on
  `callSessionId`. Without a session id it skips rather than risk double-charging.
- **Never fails the CRM write.** The call already happened; losing a lead's
  qualification result to a billing error would be worse than an uncharged call.
  Every failure path is logged and swallowed.
- **The guard against unbounded spend** is the pre-call balance check in
  `POST /leads/:id/qualify-call` (402 if the tenant cannot afford one minute), not
  the post-hoc charge.
- A duration of 0 does **not** consume the idempotency key, so a later corrected
  duration for the same call can still be billed.

---

## 3b. One person is one lead (phone dedupe)

**Decided 2026-09-02: an adapter always updates an existing lead rather than
creating a second one.** `ingestLead()` looks the phone up first; a hit is
enriched, a miss is created.

### Matching

- Keyed on `normalizedPhone`, using `crmDynamodbService.normalizePhone` — the
  *same exported function* `createLead` writes with. A second copy here would
  eventually drift and dedupe would silently stop matching.
- **Blank phones never match.** `normalizePhone` returns `''` for anything that is
  not a valid 10-digit Indian mobile, so keying those would collapse every
  unparseable number into one bucket and merge unrelated people.
- **Converted leads are excluded** — conversion deletes the LEAD row, so a match
  would be a stale residual, and `updateLead` refuses converted leads anyway. A
  returning customer therefore gets a fresh lead, which is correct.
- **Spam/lost leads still match**, and their status is left alone. A repeat
  contact from someone marked spam updates that row instead of breeding new leads.

### What an update does — enrich, never overwrite

The existing row may carry a human's edits and the AI's qualification result. A
returning enquiry is *new information about that person*, not a reason to reset
what is known. So an update:

- **never touches** `status`, `score*`, `assignedTo`, `leadType`, `name`,
  `createdBy`, `createdAt`;
- **fills blanks only** — a budget an agent already recorded is not revised by a
  later enquiry quoting a different one;
- **merges** `externalRef` channel ids and adds `reelRef` if absent;
- **does not** fire `notifyNewLead` or publish `lead.created`. The person is
  already in the pipeline; re-firing would re-notify the agent and re-run AI
  qualification (and re-bill it) on someone already qualified.

A **different intent** from the same person (a buyer who later asks about renting)
is recorded in the notes, **not** written into the wrong blob — that would fail
`updateLead`'s type validation and corrupt the record. The lead keeps its
original type.

### Built for repeat-contact channels (this matters for WhatsApp)

Instagram enquiries are occasional; WhatsApp is not — one person may send fifty
messages. Writing on every touch would append a note line and a history entry each
time, growing a single item toward DynamoDB's 400KB cap and burying the useful
notes in noise.

So **a touch that adds nothing writes nothing at all** — `ingestLead` returns
`{ unchanged: true, reason: 'no_new_information' }` without a DynamoDB write. Only
genuinely new information (a filled blank, a new channel id, a changed intent)
produces an update.

### Cost, and the one thing to do before WhatsApp ships

- A **batch** does one `buildLeadPhoneIndex()` Query for the whole upload, not one
  per item, and the index is mutated as leads are created — so two enquiries from
  the same person in one batch collapse onto one lead.
- A **single** ingest does one `findLeadByPhone()` Query over the tenant's lead
  partition (GSI3, filtered server-side).

That per-ingest Query is fine for ManyChat and Instagram volumes. **It is the wrong
shape for Bailey**, which would run it per inbound message. Before WhatsApp
becomes a lead adapter, add a real phone GSI (`normalizedPhone` as partition key)
so the lookup is a point query. Noted as the prerequisite in Phase 5 below.

**Known race:** two adapters ingesting the same phone concurrently can both miss
and both create. Rare at current volumes, and recoverable by merging. A
conditional write on a phone-uniqueness item is the proper fix if it shows up.

---

## 4. Phase 5 — WhatsApp adapter (PLAN ONLY, no code written)

**Important finding: WhatsApp is not a lead adapter today.** The Bailey webhook
(`apps/crm/server/routes/webhooks.js` `POST /whatsapp`) never calls `createLead`. It
publishes to EventBridge for the message processor, which runs a *conversation*.
So this is new work, not a rewire — which is why nothing here was touched.

Proposed shape, when it is picked up:

1. **Trigger.** Not every inbound WhatsApp message is a lead. The natural trigger
   is the AI employee concluding it has name + phone + an intent — i.e. a new
   `extractLeadFromConversation` step in `whatsapp-message-processor.js`, not the
   webhook itself. An inbound message from an unknown number is a *conversation*;
   it becomes a *lead* only once it qualifies.
2. **Adapter.** Map to `LeadInput` with `source: 'WhatsApp'`,
   `sourceAdapter: 'bailey'`, `externalRef: { waJid, conversationRef }`.
3. **Call `ingestLead()` in-process.** WhatsApp already runs inside the CRM Lambda,
   so it needs no internal HTTP hop and no new key — unlike the Instagram agent,
   which is out-of-process.
4. **Dedupe** on the conversation id, so a long thread yields one lead, not one per
   message.
5. **Billing** needs no change: the LLM turn that extracts the lead is already
   charged as `agent_action`.

6. **Prerequisite: add a phone GSI first.** See §3b — phone dedupe currently costs
   one Query over the tenant's lead partition per ingest. That is fine for
   Instagram, wrong for a per-message channel. WhatsApp should not ship as a lead
   adapter until `normalizedPhone` is a real partition key.

The "update vs. create" question this section originally flagged is now settled —
adapters always update an existing lead. See §3b.

---

## 5. Known follow-ups (not done, deliberately)

- **`AGENT_ACTION_CREDITS` bypasses the admin cost editor.** `agentRuntime.js` reads
  `process.env.AGENT_ACTION_CREDITS` directly at module load, because it needs a
  synchronous value so the deduct and the refund-on-failed-turn can never disagree.
  The config default is now chained to that env var so the admin table and the
  actual charge agree, but *changing* the charge still means setting the env var.
  A proper fix threads an async cost through 8 call sites including a refund pair —
  a refund/deduct mismatch is exactly the bug worth not risking casually.
- **`creditsCharged` on WhatsApp message records reports 1 per chunk** while 15 was
  actually deducted upstream (`whatsapp-message-processor.js` bookkeeping only,
  never passed to `deductCredits`). Display bug, not a billing bug.
- **`listEnquiries` filters after its limit**, so a filtered page can return fewer
  rows than `limit`. Pre-existing, in the microservice.
- **13 other full-table scans remain** on `CrmTable`. The GSI3 trick used for
  `getLeads` works for any entity type already writing GSI3 (CUSTOMER/OWNER/BUYER/
  PROPERTY/CONTACT); the rest need a real tenant GSI.
- **Storing `crmLeadId` back on the enquiry** would let the Instagram dashboard deep-link
  each row to its CRM lead. The internal route already returns `dedupeKey` + `leadId`
  per item, so the data is there; it needs a second write, which risks clobbering a
  concurrent status edit. Skipped for now — the header links to the filtered CRM list instead.
