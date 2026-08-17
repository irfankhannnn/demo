# Flow 03 — Call Intelligence

**Mode B — constrained extraction + deterministic rules.** Runs unattended; the LLM reports facts, code decides actions, a human approves writes.

**Status:** built and merged (`f6b557e`). **This flow is the reference implementation for Mode B** — the other Mode B flows should be brought up to its standard, not the reverse.

---

## Current architecture

```
Browser                API Lambda              SQS              Worker Lambda
   │                        │                   │                     │
   │ 1 POST /upload-url     │                   │                     │
   │───────────────────────▶│ phoneExtractor: parse number from filename
   │                        │ entityResolver: rank lead→tenant→owner→buyer→contact
   │                        │ DynamoDB row: PENDING_UPLOAD
   │◀── pre-signed PUT ─────│                   │                     │
   │ 2 PUT file ─────────────────────────────────────────▶ S3        │
   │ 3 POST /:id/confirm    │                   │                     │
   │───────────────────────▶│ HeadObject verify │                     │
   │                        │ UPLOADED → QUEUED │──────────────────── ▶│
   │                        │                   │        4 StartTranscriptionJob
   │                        │                   │◀── re-enqueue 45s ──│
   │                        │                   │        5 poll → transcript to S3
   │                        │                   │──── ANALYSIS ──────▶│
   │                        │                   │        6 Gemini analysis
   │                        │                   │          actionPlanner (RULES)
   │                        │                   │          auto-apply the note only
   │ 7 GET /:id (poll)      │                   │                     │
   │ 8 approve / reject ───▶│ invokeSkill → CRM │                     │
```

**Storage:** `CrmTable`, `PK = TENANT#{tenantId}#CALL_RECORDING#{recordingId}`, `SK = PROFILE`, `GSI1PK = TENANT#{tenantId}#CALL_RECORDINGS` for newest-first listing. Summary-sized fields on the item; bulk transcript/analysis JSON in S3.

**Status machine:** `PENDING_UPLOAD → UPLOADED → QUEUED → TRANSCRIBING → TRANSCRIBED → ANALYZING → ANALYZED → AWAITING_APPROVAL → COMPLETED`, plus `FAILED` with `failureStage`/`failureReason`.

---

## Why this flow is the reference

`server/services/callIntelligence/actionPlanner.js` states the principle outright:

> *"This mapping is deterministic on purpose. The LLM reports what was said; the rules here decide what the CRM may be asked to do. That keeps tool arguments schema-valid and makes the behaviour unit-testable without an LLM."*

Four properties worth copying everywhere:

1. **The LLM never names a tool.** `analysisService.js` → `normalizeAnalysis()` returns validated JSON (`summary`, `keyPoints`, `topics`, `requirements{propertyType,bhk,budgetMin,budgetMax,locations,purpose,furnishing,timeline}`). Tool selection is code.
2. **Exactly one auto-applied write** — the call-summary note. Everything else is *proposed* and waits for a human.
3. **Async by construction.** Transcribe jobs are long, so the worker re-enqueues itself with an SQS delay instead of holding a Lambda open.
4. **Provider abstraction that is actually thin.** `TranscriptionProvider.js` defines `startTranscription`/`pollTranscription`; swapping Whisper for Amazon Transcribe is one file plus one case in `transcription/index.js`, because the pipeline only sees a normalised result.

---

## Target changes

The pipeline shape does not change. Three additions.

### 1. Semantic search over recordings — the Tier 1 vector use case

Today there is no search at all (`docs/CALL_INTELLIGENCE.md §12`: filter-by-status and pagination only). Finding *"the calls about khata disputes"* means opening recordings one by one.

This is the **best first adoption of DynamoDB Vector Search** in the whole codebase:

- The text already exists, already normalised (`summary` + `keyPoints` + `topics`).
- It is already written to `CrmTable` in one `PutItem`.
- Volume is low — one embedding per uploaded recording.
- **No new table, no new pipeline stage, no new write path.** One Bedrock call in `analysisService.js` before persist.

```
normalizeAnalysis() ──▶ buildEmbeddingSource(summary + keyPoints + topics)
                              │
                              ▼
                    Bedrock Titan Text Embeddings V2
                    dimensions: 1024, normalize: true
                              │
                              ▼
              same PutItem, additional attributes:
                summaryVector       : L[N]
                embeddingSourceHash : S
                embeddingModel      : S
                embeddedAt          : S
                tenantId            : S   (already present)
```

Index: `call-recording-vector-index` on `CrmTable`, `COSINE`, `SearchSchema { HASH: tenantId, INLINE_FILTER: EntityType }`, `INCLUDE` projection.

`EntityType` as an inline filter is **required** — `CrmTable` is single-table, so without it one index mixes recordings, leads and contacts in one vector space. `tenantId` as `HASH` is **non-negotiable** (see `../05-retrieval-and-vector-search.md §4`).

Backfill for existing recordings is a one-off job; the index must reach `IndexStatus: ACTIVE` **and** `Backfilling: false` before search is exposed.

### 2. Expose `search_calls_semantic` as a shared tool

Added to `server/shared/toolDefinitions.js`, which means it becomes available to **Flow 01, Flow 02 and Flow 06 automatically** — one registry, every consumer. An agency owner can then ask on WhatsApp: *"pichhle mahine ke khata dispute wale calls dikhao"*.

### 3. Fix the documented limitations

From `docs/CALL_INTELLIGENCE.md §12`:

| Limitation | Action |
|---|---|
| Status filter reads extra pages (DynamoDB filters apply after limit) | Move to a status GSI — already identified in the doc |
| Duplicate detection only sees the 50 most recent | Candidate for vector similarity (Tier 3), but **only** with a conservative threshold and human confirmation |
| Diarization does not know which speaker is the agent | Out of scope; a labelling problem, not an architecture one |
| Phone extraction is Indian-mobile only | Acceptable given the market; unmatched recordings already degrade gracefully to a "create lead" proposal |

---

## What must not change

| Property | Why |
|---|---|
| The LLM never selects a tool | The entire safety model of Mode B |
| Only the note auto-applies | Unattended writes stay minimal by design |
| Khata entries are never created automatically | Explicitly by design (`§12`) — money records need a human |
| Exact phone matching in `entityResolver.js` | A phone number is a key, not a concept. Vector search must **not** be applied here (`../05-retrieval… §7`) |
| Normalised transcription result shape | It is what makes the provider swap cheap |

---

## Failure modes

| Symptom | Cause | Handling today / proposed |
|---|---|---|
| Recording stuck `TRANSCRIBING` | Transcribe job lost | Re-enqueue with attempt counter → `FAILED` with `failureStage` ✅ exists |
| Wrong entity matched | Ambiguous filename number | All candidates returned; re-pointable from the review drawer ✅ exists |
| No entity matched | Landline / international number | Stays `unmatched`, proposes "create lead" ✅ exists |
| Semantic search returns unrelated calls | `SearchVectors` always returns `topK` | **Score threshold in the shared retrieval helper**, not per-caller |
| Search silently misses recent calls | Backfill incomplete, or stale embedding | Gate on `Backfilling: false`; `embeddingSourceHash` makes staleness detectable |
| Search returns another tenant's calls | Missing `SearchConditionExpression` | `tenantId` as `SearchSchema` HASH makes the call **fail** rather than leak |

---

## Acceptance criteria

1. Every new recording is embedded in the same write that persists its analysis — no second write path.
2. `search_calls_semantic` returns tenant-scoped results only, proven by an explicit cross-tenant isolation test.
3. Results below the score threshold are dropped, not returned as weak matches.
4. Existing behaviour — status machine, approvals, auto-applied note — is byte-for-byte unchanged.
5. Backfill completes and is verified with `Scan --select COUNT` (not `ItemCount`, which lags ~6 hours).
