# Implementation Plan

Ordered so measurement comes first — later phases need a baseline to be shown to help. Each phase is independently shippable and revertable. File paths are the actual files as read on `auth_rbac_feature`; expect minor drift by the time each phase starts.

## Phase 1 — Make quality measurable, stop the bleeding

**Ships:** an accuracy number to track, and a materially faster hot path. No behavior change to what users see.

- Build a labelled eval set: 200–300 real Hinglish utterances → expected `(tool, args)`, drawn from actual conversation logs (not invented examples). Store as fixtures for CI.
- Wire the eval set into CI against a recorded-fixture harness (no live token spend per commit).
- Baseline the current single-shot pipeline against it — this number is the point of the phase.
- Delete the two debug fetches (`google.com`, Bailey ALB `/health`) from `server/scripts/whatsapp-message-processor.js`'s hot path — each adds up to a 5s abort timeout per message.
- Replace the tenant-resolution `ScanCommand` (same file) with a GSI query on `connectedWhatsAppPhone`.
- Remove the 8 `delete_*` tools from `server/shared/toolDefinitions.js` / `ALLOWED_TOOL_NAMES`; add `archive_*` equivalents that flip a status field. Drop the `gateDeleteToolPlan()` / `pendingConfirmation` confirmation subsystem it was guarding.

**Files touched:** `server/scripts/whatsapp-message-processor.js`, `server/shared/toolDefinitions.js`, `server/agents/agentRuntime.js` (remove delete-gate logic), new `eval/` fixtures + CI job.

## Phase 2 — Extract the agent core

**Ships:** WhatsApp running on the restructured core, behavior unchanged. This is the seam the web channel will plug into later.

- Define `Turn` and `Session` types; re-key conversation state to a principal (`wa:<phone>` / `web:<userId>`) instead of phone-only (`server/conversationStateService.js`).
- Move business logic out of `whatsapp-message-processor.js` into the agent core; the processor becomes a thin channel adapter (transport, dedup, delivery only).
- Hoist the ~20 dynamic `import()` calls in the processor to module scope (cold-start latency).
- Introduce a model-gateway seam with the current Gemini path as its only adapter for now — no behavior change, just the interface (`classify()`, `plan()`, `compose()`).
- Replace up-front flat credit deduction with reserve → meter per tool step → settle on completion / release on failure.
- **Gate:** eval score from Phase 1 must not regress before merging.

**Files touched:** `server/conversationStateService.js`, `server/scripts/whatsapp-message-processor.js`, `server/agents/agentRuntime.js`, new `server/agents/modelGateway/` seam, billing/credit metering code (wherever the current flat deduction lives).

## Phase 3 — The reliability fix

**Ships:** the actual "complete flow from WhatsApp" capability. This phase answers the original goal directly.

- Replace single-shot `planTurn()` (`server/agents/llm/planTurn.js`) with a bounded tool loop: ≤6 steps, hard wall-clock budget, feed each tool result back as a tool-result message, let the model decide when it's done.
- Convert `domainRouter.js` from a hard gate to a ranker: load top domains eagerly, allow the loop to pull in additional domains on demand instead of failing closed. Log every escalation.
- Turn on strict tool schemas (`additionalProperties: false`, real enums) in `server/shared/toolDefinitions.js`; delete `coerceQueryToFilters()` and the `LEAD_STATUS_TYPOS` map in `server/agents/inputNormalizer.js` once the eval set shows no regression (keep the Hinglish date and lakh/crore money normalizers — those are legitimate input handling, not repair).
- Add `find_person(name|phone)` and similar resolver tools; remove the ~8 prose disambiguation rules for buyer/seller/tenant/owner from `server/agents/llm/plannerPrompt.js` now that the model can call a tool instead of guessing.
- Consolidate the 12 overlapping metrics tools (`get_crm_metrics`, `get_leads_summary`, `get_pipeline_summary`, `get_dashboard_snapshot`, `get_business_health`, `suggest_next_actions`, `get_daily_brief`, ...) down to 3–4 with disjoint trigger conditions.
- Enable prompt caching on the stable prefix (system prompt + tool schemas); verify a non-zero cache hit rate before relying on the cost saving.

**Files touched:** `server/agents/llm/planTurn.js`, `server/agents/domainRouter.js`, `server/shared/toolDefinitions.js`, `server/agents/inputNormalizer.js`, `server/agents/llm/plannerPrompt.js`.

## Phase 4 — Channel-aware compose

**Ships:** short WhatsApp replies without truncation, using the same tool results the loop produced.

- Add a `channel: 'whatsapp' | 'web'` parameter to `server/agents/llm/composeReply.js` and `server/agents/llm/composerPrompt.js`, changing the prompt/length budget used, not the underlying tool results.
- Set a WhatsApp prose budget (~400–700 chars) at the prompt level; keep `chunkWhatsAppText`/`sendWhatsAppMessageChunks` (`server/bailey.js`, 4000-char hard split) purely as a safety net.
- Extend the existing `RESPONSE_MAX_LIST_ITEMS` capping principle in `server/agents/responseFormatter.js` / `server/agents/formatting/` to prose, not just list rendering (e.g. top-N + "10 more hain, dikhau?" instead of a full dump).

**Files touched:** `server/agents/llm/composeReply.js`, `server/agents/llm/composerPrompt.js`, `server/agents/responseFormatter.js`, `server/bailey.js` (no logic change, confirm chunking stays as fallback only).

## Phase 5 — In-CRM web chat (second channel)

**Ships:** the ChatGPT/Claude-style web channel, on the same core.

- Add a streaming route on the existing `RealEstateCrmRestApi` with `ResponseTransferMode: STREAM` (API Gateway REST streaming, available since Nov 2025).
- Dedicated Lambda for this route with a longer timeout and its own reserved concurrency, so a slow multi-step turn can't starve ordinary CRM REST traffic (main API Lambda's 30s timeout stays as-is for everything else).
- Web channel adapter emits SSE; React chat panel in `real-estate-crm-app/src/` renders streamed tokens plus entity cards (reuse the same card components the WhatsApp deterministic formatter's data shapes already imply).
- Same session store as WhatsApp (principal from Phase 2) — a conversation started on one channel is visible on the other, if useful; not a hard requirement to ship.

**Files touched:** `server/infra/cfn-backend.yaml` (new route + Lambda), new web channel adapter under `server/agents/`, new chat panel under `real-estate-crm-app/src/pages/` or equivalent, `docs/interaction-design/` update once shipped.

## Phase 5b — Re-mode the background flows (independent, any time after Phase 1)

**Ships:** unattended automation that can no longer write outside its allowlist.

The lead qualifier, lead router and follow-up cron currently call `invokeAgent()` and inherit full chat-agent autonomy over 87 tools with nobody watching. Move them to Mode B — the shape Call Intelligence already uses successfully.

- Freeze current inputs/outputs as fixtures **before** changing anything.
- Remove tool declarations from these flows' model calls; require schema-validated structured output.
- Extract rubric thresholds and assignment rules from prompts into unit-testable code.
- Add a per-source tool allowlist at the `skillInvoker` boundary (it already takes `{ userId, source }`).
- Delete `extractScoreLabel()`'s prose-sniffing fallback once output is schema-constrained.
- Preserve the `scoreSource` precedence rule (`ai_call` beats `llm_text`).

**Files touched:** `server/scripts/lead-qualifier-handler.js`, `server/scripts/lead-router-handler.js`, `server/scripts/lead-followup-cron.js`, `server/skillInvoker.js`, `server/utils/leadRubric.js`. Detail: [`flows/04-background-automation.md`](./flows/04-background-automation.md).

## Phase 5c — Voice classifier (independent)

**Ships:** the Exotel agent understands Hinglish.

Keep Mode C — no tool loop, realtime latency budget stands. Replace only the classifier: Hinglish patterns in the regex fast-path first (cheap, may be sufficient), then a small-model structured-output fallback with a hard timeout falling through to the existing `SMALL_TALK` default. Mirrors the proven `domainRouter.js` shape.

**Files touched:** `ai-calling-service/src/services/intentService.js`, `ai-calling-service/src/config/constants.js`. Detail: [`flows/05-voice-exotel.md`](./flows/05-voice-exotel.md).

## Phase R — Semantic retrieval (independent track, runs alongside)

**Ships:** semantic search, and the property-matching capability that does not exist today.

Full design and constraints in [`05-retrieval-and-vector-search.md`](./05-retrieval-and-vector-search.md). Summary:

| Step | Work | Gate |
|---|---|---|
| **R0** | Bump `@aws-sdk/client-dynamodb` + `lib-dynamodb` to `≥3.1103.0` (locked at `3.936.0`, predates the feature by ~9 months) | Test suite green |
| **R1** | Non-prod spike: throwaway table, `tenantId` as `SearchSchema` HASH, ~200 real call summaries. Measure recall, latency, cost. Confirm `search-dynamodb.{region}.amazonaws.com` is reachable from a Lambda in our networking setup | **Cross-tenant isolation test passes** |
| **R2** | `server/services/embeddings/` — `buildEmbeddingSource()`, `embedText()`, and a `searchVectors()` helper with mandatory tenant scoping and score thresholding baked in so no caller can bypass them | No caller can omit tenant scope |
| **R3** | Tier 1: embed call summaries in `analysisService.js`; add `call-recording-vector-index` via `UpdateTable`; backfill existing recordings | `IndexStatus: ACTIVE` **and** `Backfilling: false` |
| **R4** | `search_calls_semantic` in the canonical registry → reaches every flow and MCP automatically | Eval cases added |
| **R5** | Tier 2: property + lead-requirement embeddings; `match_properties_for_lead`; range post-filtering (inline filters support `=` only) | Product acceptance on real data |
| **R6** | Tier 3: fuzzy duplicate detection, conservative threshold, human confirmation only | Precision measured before enabling |

**R0 and R1 are cheap prerequisites. Nothing else in this track starts before R1 reports back.** Also add `dynamodb:SearchVectors` to the relevant Lambda roles in `cfn-backend.yaml` — it is a new IAM action not covered by existing DynamoDB read grants.

## Phase 6 — Close the MCP drift (independent, any time after Phase 1)

**Ships:** `reality-flow-mcp` tool coverage back to parity with the canonical registry, with no future drift.

- Generate `reality-flow-mcp/src/services/toolDefinitions.ts` from `server/shared/toolDefinitions.js` at build/deploy time (script or CI step) instead of hand-maintaining a second copy.
- Update the stale doc-comment ("54 CRM tools") as part of the same change.
- No change to the MCP protocol layer, OAuth flow, or `crmClient.ts` — only the source of the tool schema changes.

**Files touched:** `reality-flow-mcp/src/services/toolDefinitions.ts` (becomes generated), new generation script, `reality-flow-mcp/package.json` build step.

## Risks (carried from architecture review, still applicable)

- **Loop cost vs. caching savings** — more steps means more round trips; mitigate with the step cap and by measuring cost-per-turn on the eval set in Phase 3, not after rollout.
- **Strict schemas surface cases the normalizer was silently rescuing** — run both paths in parallel for one phase, log every divergence, delete repair code only once the eval set shows no regression.
- **Eval set encodes today's assumptions** — label from real inbound messages and what the user evidently wanted (including messages the agent got wrong today), not from what the current system happens to do. Have someone other than the runtime author do the labelling.
- **Re-keying conversation state loses in-flight context** — dual-read during migration (try principal key, fall back to phone key), let old state expire naturally rather than backfilling.
- **Archive-instead-of-delete leaves stale records in AI search results** — filter archived status at the query layer in `crmDynamodbService`, not per-tool, so no tool can forget; add an eval case for it.
- **Cross-tenant leakage via vector search** — a vector index without a `tenantId` partition key searches every tenant's data. Mitigation: `tenantId` as `SearchSchema` HASH makes AWS reject any unscoped search; plus an explicit isolation test as the gate on R1. Non-negotiable.
- **Stale embeddings return confidently wrong results** — DynamoDB syncs the index to the item but never regenerates embeddings. Mitigation: `embeddingSourceHash` + `embeddedAt` on every embedded item, and a reconciliation job that finds drift.
- **API Gateway REST streaming may not exist as assumed** — unverified at time of writing, and load-bearing for Phase 5's "no new infrastructure" claim. Mitigation: verify before the phase starts; fall back to a Lambda Function URL with response streaming rather than to a buffered response.

## Dependency order

```
Phase 1 (eval + hot path + archive_*)
   │
   ├──▶ Phase 2 (agent core, principal) ──▶ Phase 3 (tool loop) ──▶ Phase 4 (compose) ──▶ Phase 5 (web chat)
   │
   ├──▶ Phase 5b (background flows)      independent
   ├──▶ Phase 5c (voice classifier)      independent
   ├──▶ Phase 6  (MCP drift)             independent
   │
   └──▶ Phase R  (retrieval)             independent track
             R0 → R1 → R2 → R3 → R4 → R5 → R6
```

Only the 1 → 2 → 3 → 4 → 5 spine is strictly ordered. Everything else can run in parallel with it, subject to its own gates.
