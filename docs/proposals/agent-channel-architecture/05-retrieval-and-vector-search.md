# Semantic Retrieval — DynamoDB Vector Search

**Status:** Proposed, pending a non-prod spike.
**Feature maturity:** AWS added vector index support to the service model on **4 August 2026** — under three weeks before this document. Treat production guidance as thin.

This document validates whether DynamoDB Vector Search should be adopted, designs how, and records the constraints that change the design. Every AWS-side claim here is taken from the official documentation (`VectorSearch.html`, `VectorSearchTutorial.html`); every codebase claim was verified against `auth_rbac_feature` at commit `f6b557e`.

---

## 1. The problem it actually solves

### What search does today

`searchLeads` (`agency-app/api/crmDynamodbService.js:5823`) and `searchProperties` (`:5934`) are the same shape:

```js
const leads = unwrapLeadsList(await getLeads(tenantId));   // load everything
filtered = filtered.filter(lead =>
  lead.name?.toLowerCase().includes(normalizedQuery) ||
  lead.buyerRequirement?.requirement?.toLowerCase().includes(normalizedQuery) ||
  /* ...15 more .includes() checks... */
);
```

And `getLeads` (`:3701`) underneath it is:

```js
const items = await collectAllPages(docClient, ScanCommand, {
  TableName: CRM_TABLE_NAME,
  FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
  ...
}, { maxPages: 100 });
```

That is a **full Scan of the shared multi-tenant CrmTable**, filtered server-side after the read (so RCU is consumed for every item scanned, not every item returned), capped at 100 pages. Three consequences:

1. **Substring matching cannot match meaning.** A lead whose `buyerRequirement.requirement` reads `"do bedroom flat, station ke paas"` will never match a search for `"2BHK near metro"` — zero shared substrings, perfect semantic match. Given the project's own 70/30 Hinglish convention, this is the common case, not the edge case.
2. **Cost and latency grow with total tenant data**, because the Scan reads everything before filtering.
3. **No ranking exists.** `.includes()` is boolean. There is no notion of "this property fits better than that one," so results come back in whatever order DynamoDB returned them.

And a fourth, worse than a limitation — **`maxPages: 100` silently truncates.** A tenant past that page count gets incomplete search results with no error.

### The capability that does not exist at all

There is no `matchProperties`, `recommendedProperties`, or equivalent anywhere in the codebase (verified: zero matches). "Which properties fit this lead's requirement?" is not a slow query today — **it is not a query at all.** That is the single strongest argument for this work: it is a missing feature, not an optimisation.

Call recordings have no search either. `docs/CALL_INTELLIGENCE.md §12` lists filter-by-status and pagination only; finding *"the calls where a site visit was promised"* means opening recordings one at a time.

---

## 2. What DynamoDB Vector Search is

Store embeddings on your existing items, declare a vector index on the attribute, and query it with `SearchVectors` — an approximate-nearest-neighbour search returning items ranked by similarity score. No separate vector database, no replication pipeline.

| Concept | Detail (from AWS docs) |
|---|---|
| Created via | `CreateTable` (`VectorIndexes`) or `UpdateTable` (`VectorIndexUpdates`) |
| Read API | `SearchVectors` |
| Search type | **ANN, not exact** |
| Max per table | **5** |
| Capacity mode | **On-demand only** |
| Distance functions | `COSINE`, `DOT_PRODUCT`, `EUCLIDEAN` — immutable after creation |
| Partitioning | Optional `SearchSchema` with one `HASH` key + `INLINE_FILTER` attributes |
| Projection | `KEYS_ONLY` / `INCLUDE` / `ALL` — `INCLUDE` set immutable after creation |

---

## 3. Codebase fit — verified

| Prerequisite | Status | Evidence |
|---|---|---|
| Tables on `PAY_PER_REQUEST` | ✅ Satisfied | `CrmTable` (`cfn-backend.yaml:655`), `PropertiesTable` (`:595`) — in fact **every** table in the stack |
| Vector index headroom (5/table) | ✅ Satisfied | Both tables have 3 GSIs, 0 vector indexes; GSI and vector limits are separate |
| Bedrock `InvokeModel` IAM | ✅ Satisfied | `cfn-backend.yaml:1426, 2342` — and a `Resource: '*'` grant already exists, so Titan needs **no IAM change** |
| Bedrock SDK dependency | ✅ Present | `@aws-sdk/client-bedrock-runtime@^3.1073.0` in `agency-app/api/package.json`, currently unused for embeddings |
| `tenantId` as a top-level item attribute | ✅ Present | Written on CRM items (e.g. `callRecordingRepository.js:60`); required for tenant-scoped search — see §4 |
| **DynamoDB SDK new enough** | ❌ **Blocked** | See below |

### The SDK gap is definite, not a "check it"

| | Version | Published |
|---|---|---|
| Locked in `agency-app/api/package-lock.json` | `@aws-sdk/client-dynamodb@3.936.0` | **2025-11-19** |
| First release containing vector search | `3.1103.0` | **2026-08-04** |
| Current latest | `3.1111.0` | 2026-08-14 |

The locked version predates vector search by roughly nine months. `SearchVectors` is not merely untested here — **it does not exist in the installed client.** Required: bump `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` to `≥3.1103.0`. (AWS's stated floor is `botocore 1.43.64` / AWS CLI `2.36.16` for the CLI path.)

---

## 4. The constraint that dominates the design: multi-tenancy

**This is the most important section of this document.**

Cloudberry is a multi-tenant CRM using single-table design with `TENANT#` prefixes. A vector index created **without** a `SearchSchema` partition key searches **the entire index** — meaning every `SearchVectors` call would rank vectors belonging to **every tenant in the system**. With `ProjectionType: ALL`, another agency's lead data would be returned in the response body.

That is a cross-tenant data breach, and it would not be caught by any existing test, because every current data path filters by `tenantId` *in application code* — a habit that does not carry over to `SearchVectors`.

### The fix, and why it is robust

Define `tenantId` as the vector index `HASH` in `SearchSchema`. AWS's rule then works in our favour:

> *"If you define a vector index partition key in the SearchSchema, you must provide its value in the `SearchConditionExpression` when you call `SearchVectors`."*

Tenant scoping stops being a convention developers must remember and becomes **an API-level requirement that fails the call if omitted.** This is strictly stronger than the isolation the rest of the codebase has today.

It is also the correct performance choice: AWS recommends a partition key precisely so each search examines one partition instead of the whole index, and `tenantId` is naturally low-to-medium cardinality.

**Non-negotiable rule for this project: no vector index is created without `tenantId` as its `SearchSchema` `HASH`.**

---

## 5. The constraint that reshapes property matching

> *"Inline filters support the equality operator (`=`) in `SearchConditionExpression`. Comparison, range, and set-membership operators (`<>`, `<`, `<=`, `>`, `>=`, `IN`) are not yet available."*

The motivating example — *"2BHK near a metro station **under ₹2 crore**"* — **cannot** be expressed as an inline filter. Budget is a range. So is date. So is area size.

Three options, in order of preference:

| Option | How | Trade-off |
|---|---|---|
| **A. Over-fetch + post-filter** (recommended) | `topK = N × over-fetch factor`, then apply range predicates in Lambda | Simple, exact ranges, no schema change. Costs extra `VectorSearchRequestBytes` and can under-fill after filtering |
| **B. Bucketed equality** | Store `budgetBracket` (`"80L-1Cr"`, `"1Cr-2Cr"`) as an `INLINE_FILTER`; match brackets by equality | Storage-layer filtering, cheaper; bracket boundaries are lossy and a query spanning brackets needs multiple calls |
| **C. Hybrid** | Bucket coarsely as an inline filter, then post-filter exactly | Best of both; most code |

Start with **A**. It is correct by construction and the volumes here (per-tenant property counts in the hundreds to low thousands) do not justify B's complexity yet.

Note the related trap: **`SearchVectors` always returns `topK` results, even when nothing is a good match.** Judge quality by `Score`, never by result count. With no score threshold, "find properties for this buyer" will confidently return five unrelated flats for a buyer whose requirements match nothing.

---

## 6. Other constraints that change implementation

| Constraint | Consequence here |
|---|---|
| **`SearchVectors` uses a separate endpoint** — `search-dynamodb.{region}.amazonaws.com` | Any VPC endpoint, proxy or egress allowlist must permit it. Failure mode is nasty: writes and `Query` succeed, only search fails, usually as an opaque connection error. Must be in the CFN/networking checklist. |
| **`dynamodb:SearchVectors` is a new IAM action** | Existing DynamoDB read policies do **not** grant it. Must be added explicitly to Lambda roles in `cfn-backend.yaml`. |
| **`COSINE` scores: lower is more similar** (cosine *distance*, 0→2) | Sort ascending; thresholds are upper bounds. Inverted from most developers' intuition — a "similarity > 0.8" check would be exactly backwards. |
| **Stored vs query vector formats differ** | Stored: `{"L":[{"N":"0.1"},…]}`. Query: `[{"N":"0.1"},…]` — no `L` wrapper. |
| **DAX does not support `SearchVectors`** | Route search calls directly to DynamoDB. |
| **Distance function and `INCLUDE` projection are immutable** | Getting these wrong means delete + recreate + full re-backfill. Decide deliberately. |
| **Adding an index to an existing table backfills** | Both target tables exist with `DeletionPolicy: Retain`, so this is the `UpdateTable` path. Must wait for `IndexStatus: ACTIVE` **and** `Backfilling: false`. Searching during backfill returns incomplete results. |
| **`ItemCount` / `IndexSizeBytes` refresh ~every 6 hours** | Never use them to verify a load; use `Scan --select COUNT`. |
| **Vector size** | 1024 dims ≈ **32 KB request payload**, ≈ **5 KB stored per item**. |
| **New billing dimension** | `ConsumedCapacity.VectorSearchRequestBytes` (~31 KB per 1024-dim query). Budget and alarm on it. |
| **Titan Text Embeddings V2** | Dimensions must be 256, 512 or 1024; `normalize: true` recommended for `COSINE`. Query and stored vectors must use the **same model and dimension count**. |

### Embedding freshness — the pipeline concern nobody mentions

DynamoDB keeps the *index* in sync with the *item* automatically. It does **not** generate embeddings. If a lead's requirement text changes and we do not recompute the vector, the index is silently stale — semantically wrong results with no error anywhere.

Every write path that touches an embedded field must recompute the embedding, or the embedding must be regenerated asynchronously off DynamoDB Streams. Recommendation: **compute inline on write** for the low-volume paths below, and store `embeddingSourceHash` + `embeddingModel` + `embeddedAt` on the item so staleness is detectable and a backfill job can find what to fix.

---

## 7. Recommended adoption — ranked by fit

### Tier 1 — Call transcript semantic search *(start here)*

| | |
|---|---|
| Table | `CrmTable`, `CALL_RECORDING` items (`PK = TENANT#{t}#CALL_RECORDING#{id}`) |
| Embed | `summary` + `keyPoints` + `topics` from `normalizeAnalysis()` |
| Why first | The text is already produced, already clean, already written to `CrmTable` in the same `PutItem`. One extra Bedrock call in `analysisService.js` before persist — **no new table, no new pipeline stage, no new write path.** |
| Unlocks | *"calls about khata disputes last month"*, *"calls where a site visit was promised"* |
| Volume | Low (one embedding per uploaded recording) — cheapest possible way to learn the feature |

### Tier 2 — Buyer requirement ↔ property matching

| | |
|---|---|
| Tables | `PropertiesTable` (listing text) + lead requirement text on `CrmTable` |
| Why second | Highest product value — it is a **missing capability**, not a slow one. But it needs the §5 range-filter design and touches the busiest write paths. |
| Unlocks | `match_properties_for_lead` as a first-class agent tool for every flow |

### Tier 3 — Fuzzy duplicate detection

| | |
|---|---|
| Table | `CrmTable` lead/contact items |
| Why third | Genuinely useful (same person, different number — invisible to `entityResolver.js`'s exact `phonesEqual` matching) but it is a **precision-critical** task where a false merge is worse than a miss. Needs a conservative score threshold and human confirmation. |

### Explicitly NOT vector search

**Phone-number identity resolution stays exact-match.** `entityResolver.js` uses `phonesEqual` / `normalizePhoneForMatch` and should continue to. A phone number is a key, not a concept; ANN would make it fuzzier, slower and less correct. The same applies to any `get_*_by_id` path.

The rule: **vector search is for free-text meaning (`requirement`, `notes`, `summary`, `description`). Exact indexes stay for identity and keys.**

---

## 8. Target architecture

```
WRITE PATH (embedding generation)

  analysisService.js / lead write / property write
              │
              ▼
   ┌────────────────────────────┐
   │ buildEmbeddingSource(item) │  deterministic text assembly
   └──────────────┬─────────────┘
                  ▼
        hash(source) === item.embeddingSourceHash ?
                  │
          ┌───────┴────────┐
        yes                no
          │                 │
        skip                ▼
              ┌───────────────────────────┐
              │ Bedrock InvokeModel       │
              │ amazon.titan-embed-text-v2│
              │ dimensions:1024,          │
              │ normalize:true            │
              └─────────────┬─────────────┘
                            ▼
              PutItem / UpdateItem on existing table:
                requirementVector   : L[N]      (the embedding)
                embeddingSourceHash : S
                embeddingModel      : S
                embeddedAt          : S
                tenantId            : S         (already present)


READ PATH (semantic search)

  agent tool call: search_leads_semantic / match_properties_for_lead
              │
              ▼
   embed(query text)  ── same model, same dimensions ──┐
              │                                         │
              ▼                                         │
   ┌──────────────────────────────────────────────┐    │
   │ SearchVectors                                 │    │
   │   TableName    : CrmTable                     │    │
   │   IndexName    : <entity>-vector-index        │    │
   │   SearchVector : [{N},…]   (no L wrapper)     │◀───┘
   │   TopK         : k × overFetch                │
   │   SearchConditionExpression:                  │
   │       tenantId = :t   ← MANDATORY, enforced   │
   │       [ + inline equality filters ]           │
   │   ProjectionExpression : minimal attributes   │
   └──────────────────┬───────────────────────────┘
                      ▼
        drop results with Score > threshold       (COSINE: lower = closer)
                      ▼
        post-filter ranges (budget, dates, area)  (§5 option A)
                      ▼
        truncate to k → deterministic formatter → channel
```

### Proposed indexes (2 of the 5 available per table)

| Table | Index | Vector attribute | Dist. | SearchSchema | Projection |
|---|---|---|---|---|---|
| `CrmTable` | `call-recording-vector-index` | `summaryVector` | `COSINE` | `HASH: tenantId`, `INLINE_FILTER: EntityType` | `INCLUDE` (keys, `recordingId`, `createdAt`, `matchedEntityType`) |
| `PropertiesTable` | `property-vector-index` | `descriptionVector` | `COSINE` | `HASH: tenantId`, `INLINE_FILTER: propertyType` | `INCLUDE` (keys, `area`, `bedrooms`, `rent`, `price`, `status`) |

Rationale: `COSINE` because Titan is a text-embedding model whose meaning lives in direction (AWS's stated default). `INCLUDE` rather than `ALL` to keep index storage and `VectorSearchRequestBytes` down — but note the set is immutable, so include the post-filter fields (`rent`, `price`, `status`, `bedrooms`) from day one, since §5 option A filters on them **after** the search and cannot read unprojected attributes.

`EntityType` as an inline filter on `CrmTable` matters because it is a single-table design — without it, one index over the table would mix leads, contacts and recordings in one vector space.

---

## 9. Cost model

Per **write** of an embedded item: 1 Bedrock Titan call (short text) + ~5 KB extra stored.
Per **search**: 1 Bedrock Titan call (the query) + ~31 KB `VectorSearchRequestBytes` + index storage rent.

Two honest observations:

- Every semantic search costs a **Bedrock round trip before DynamoDB is touched**. This adds latency to a path that is currently pure DynamoDB. For WhatsApp — where §Flow-01 already has a latency budget — semantic search should be a **distinct tool the agent chooses**, not a silent replacement inside `search_leads`.
- Vector index storage bills for as long as the index exists, searched or not.

Set a CloudWatch alarm on `VectorSearchRequestBytes` from day one.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| **Cross-tenant leakage** via missing search condition | `tenantId` as `SearchSchema` `HASH` makes it API-enforced (§4). Add an integration test that asserts a search from tenant A never returns tenant B's item. Non-negotiable gate. |
| ANN recall is unmeasurable at our scale | AWS states recall characteristics only become observable at millions of vectors. Do not claim accuracy we cannot measure; validate on a labelled set of real queries per §Phase-1 eval work. |
| Feature is ~3 weeks old | Spike on a **non-prod table** first. Do not put it on the critical path of an existing working flow until the spike passes. |
| Stale embeddings return confidently wrong results | `embeddingSourceHash` + `embeddedAt` on every item; a reconciliation job that finds and re-embeds drift. |
| Immutable choices (distance fn, `INCLUDE` set) | Decide in the spike, not in production. Re-creating means a full backfill. |
| Silent quality failure (`topK` always full) | Score threshold enforced in the retrieval helper, not per-caller, so no tool can forget it. |
| Scope creep into identity matching | Documented rule in §7: keys stay exact-match. |

---

## 11. Sequenced work

| Step | Deliverable | Gate |
|---|---|---|
| **R0** | Bump `@aws-sdk/client-dynamodb` + `lib-dynamodb` to `≥3.1103.0`; confirm `SearchVectors` exists in the client | Existing test suite green |
| **R1** | Non-prod spike: throwaway table, `tenantId` HASH, 200 real call summaries, measure recall/latency/cost. Confirm the search endpoint is reachable from a Lambda in our networking setup | Cross-tenant isolation test passes |
| **R2** | `agency-app/api/services/embeddings/` — `buildEmbeddingSource()`, `embedText()`, `searchVectors()` helper with **mandatory** tenant scoping and score thresholding baked in | Unit tests; no caller can bypass tenant scope |
| **R3** | Tier 1: embedding write in `analysisService.js` + `call-recording-vector-index` via `UpdateTable` + backfill job for existing recordings | `IndexStatus ACTIVE`, `Backfilling false`, eval queries pass |
| **R4** | `search_calls_semantic` tool in `agency-app/api/shared/toolDefinitions.js` → available to every flow and to MCP automatically | Tool eval cases added |
| **R5** | Tier 2: property + lead-requirement embeddings, `match_properties_for_lead` tool, §5 option-A range post-filtering | Product acceptance on real tenant data |
| **R6** | Tier 3: duplicate detection, conservative threshold, human confirmation only | Precision measured before enabling |

**R0 and R1 are prerequisites for everything else and are cheap. Nothing in Tier 1–3 should start before R1 reports back.**
