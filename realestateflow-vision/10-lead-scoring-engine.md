# 10 — Lead Scoring Engine

> **Scope:** classifying leads as **Hot / Warm / Cold** to prioritize agent effort and drive assignment (`11`) and follow-up (`09`). Designed to be explainable, cheap, and tunable per tenant.

---

## 1. Philosophy: deterministic core + LLM signals, always explainable

Scoring drives money decisions (who gets the hot lead, who gets called first), so it must be **explainable and controllable**, not a black box. We use a **hybrid**:
- a **deterministic, weighted feature model** (transparent, tunable, free) for the bulk of the signal, plus
- **LLM-derived signals** (Haiku) for fuzzy inputs like conversation quality and sentiment.

Output is a **score (0–100) + band (Hot/Warm/Cold) + top reasons** written onto the Lead record, recomputed on relevant events.

## 2. Scoring Factors (from the vision, made concrete)

| Signal | Weight class | Source |
|---|---|---|
| **Price/pricing request** | High intent | conversation/intent |
| **Brochure / floor-plan request** | High intent | Document MCP events |
| **Phone shared** | High | CRM completeness |
| **Email shared** | Medium | CRM completeness |
| **Site-visit request** | Very high | Visit MCP |
| **Follow-up engagement** (replies, opens, recency) | High | conversation metrics |
| **Conversation quality** (specificity, seriousness, sentiment) | Medium | Haiku signal |
| **Budget fit vs available inventory** | High | Lead × Property MCP |
| **Timeline urgency** | High | qualification slot |
| **Channel/source quality** (referral > portal > cold) | Medium | attribution |
| **Negative signals** (broker/competitor, abusive, fake number) | Penalty | Haiku + validation |

## 3. The Model

```
score = Σ (wᵢ · featureᵢ)    as a transparent weighted sum, normalized to 0–100
bands:  Hot ≥ 70 ,  Warm 40–69 ,  Cold < 40   (thresholds tenant-tunable)
```

- **Deterministic features** (visit requested, phone shared, recency, budget-fit) computed in code — free, instant, auditable.
- **LLM features** (conversation_quality, sentiment, seriousness, is_broker) produced by a single **Haiku** call returning a structured 0–1 per signal — cheap, batched where possible.
- **Recency decay:** engagement signals decay over time so stale "Hot" leads cool automatically (addresses the classic "hot lead rots in inbox" problem).
- **Reasons:** the top contributing features are stored alongside the score so agents see *why* ("requested price + booked visit + replied within 2h").

## 4. When It Runs (event-driven)
Recompute on: new message, qualification slot change, brochure/price/visit request, follow-up engagement, time-decay tick (scheduled). Implemented as a small **Lead Scorer agent/function (T0)** subscribed to conversation/CRM events (`03 §3`); writes `score`, `band`, `reasons`, `scoredAt` via Lead MCP.

## 5. Tenant Tunability & Learning
- **Per-tenant weights & thresholds** (a luxury-villa brokerage scores differently than a rental shop) — exposed in dashboard config.
- **Calibration over time:** compare predicted band vs actual conversion; periodically adjust weights (start heuristic; introduce a learned model only once enough labeled outcomes exist — avoid premature ML).
- **Guardrail:** scoring never *hides* leads, only orders them; humans can override band.

## 6. Integration
- **→ Assignment (`11`):** band/score is an input to assignment rules (e.g. Hot → senior closer).
- **→ Follow-Up (`09`):** band sets cadence/intensity and channel (Hot → immediate human + call; Cold → low-touch nurture).
- **→ Analytics (`05` Analytics MCP):** funnel by band, scoring accuracy, band→conversion rates.
- **→ Dashboard:** sortable, color-coded pipeline with reasons.

## 7. KPIs
Band→conversion correlation (is Hot actually converting?), scoring latency, override rate (signals miscalibration), false-hot / false-cold rates, lift in agent efficiency.

## 8. Phasing
- **P1:** deterministic weighted model with the high-confidence signals (visit/price/brochure/phone/recency) + bands on the pipeline.
- **P2:** add Haiku conversation-quality/sentiment + budget-fit; per-tenant tuning.
- **P3:** calibration loop and optional learned scoring once labeled data supports it.
