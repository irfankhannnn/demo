# 10 — Lead Scoring Engine

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. The June weighted feature model with decay and tenant-tunable thresholds was not built; Hot/Warm/Cold now comes from a Gemini rubric in the CRM, plus a separate rules score in the Instagram service.

> **Note:** The founder is building a next-generation lead engine separately; these docs will be updated when it lands.

> **Scope:** how leads get a Hot / Warm / Cold temperature today, where it is stored, what can overwrite it, and where it shows up. Related: `09` (qualification), `11` (assignment).

---

## 1. Two scorers exist

| Scorer | Where | Method | Output |
|---|---|---|---|
| **CRM rubric** | `agency-app/api/utils/leadRubric.js`, called by `agency-app/api/scripts/lead-qualifier-handler.js` and served to AI calls by `agency-app/api/routes/aiCallingInternal.js` | An LLM (Gemini) judges the lead against a written rubric, with structured output | `HOT` / `WARM` / `COLD` plus confidence 0–100 and reasons |
| **Instagram rules score** | `agency-app/instagram-api/services/extract.js` (`scoreLead`), used by `services/leadAnalyst.js` | Deterministic weighted sum | 0–100, mapped to `very_hot` / `hot` / `cold`, then to CRM `hot` / `warm` / `cold` |

They are not unified. A lead from Instagram gets the rules score inside the Instagram service, but CRM ingestion (`agency-app/api/leadIngestion.js`) does not write that value to the CRM `score` field; in the CRM the lead is scored by the rubric after intake.

## 2. The CRM rubric

The rubric text (`LEAD_TEMPERATURE_RUBRIC`):

- **HOT:** wants a property immediately and has already named a specific area or building.
- **WARM:** wants to visit and decide in person, but hasn't fixed an area or building.
- **COLD:** timeline is roughly a couple of months out; early research.

The only input computed in code is `hasNamedAreaOrBuilding`: true when `preferredArea` is set and is not a city-level value. The city list is hardcoded to Mumbai, Pune, Thane and Navi Mumbai.

The model returns `{score, scoreValue, reasons}` under `QUALIFIER_RESPONSE_SCHEMA`. `scoreValue` is the model's **confidence** in the label, not a points total, and there are no numeric band thresholds. The label comes first. If the label is valid but the number is missing, the bucket midpoint is used: HOT 85, WARM 50, COLD 20. If nothing usable comes back, the lead gets WARM / 50 and a warning is logged.

Fields stored on the Lead (`agency-app/web/src/types/crm.ts`):

| Field | Values |
|---|---|
| `score` | `HOT` \| `WARM` \| `COLD` (unset = unscored) |
| `scoreValue` | 0–100 |
| `scoreReasons` | up to 300 chars |
| `scoredAt` | ISO timestamp |
| `scoreSource` | `llm_text` \| `ai_call` \| `manual` \| `migrated` |

The older `priority` field on Lead is retired. Existing leads were backfilled from it with `scoreSource: 'migrated'` (`agency-app/api/scripts/backfill-lead-temperature.js`).

## 3. The Instagram rules score

From `scoreLead` in `extract.js`:

| Signal | Points |
|---|---|
| Phone number found in the lead's own messages | +40 |
| Budget stated (has a max) | +25 |
| Intent known (buy / rent / sell / heavy deposit) | +12 |
| Area named | +10 |
| Asked for a site visit | +10 |
| Message depth | +2 per message after the first, up to +8 |

Capped at 100. Mapping (`scoreToLeadScore`): `very_hot` if a phone and at least one requirement signal are present, else `hot` if the score is 40 or more, else `cold`. `leadAnalyst.js` then maps `very_hot → hot`, `hot → warm`, `cold → cold`. Threads older than 21 days are treated as stale (`STALE_AFTER_MS`).

## 4. When scoring runs and what wins

| Event | Writer | `scoreSource` |
|---|---|---|
| `lead.created` (once; skipped if scored in the last 24 h; only for tenants with the AI Employee live and enabled) | `lead-qualifier-handler.js` | `llm_text` |
| AI qualification call returns a verdict | `aiCallingInternal.js` call-outcome route | `ai_call` |
| A user sets the score in the CRM | `agency-app/api/routes/leads.js` (server stamps `scoreSource` and `scoredAt`; the client cannot set them) | `manual` |

Precedence in practice: an AI call result overwrites the text score, and a manual edit always sets `manual`. There is no rescoring on new messages, visit requests or follow-up engagement, and no time decay.

See `09 §2` for a known gap: the qualifier Lambda's template does not pass the Gemini key and model, so the `llm_text` path may not run in a deployed stack until that is fixed.

## 5. Where the score is used

- **Lead list filter** by temperature, including `unscored` (`agency-app/api/crmDynamodbService.js`).
- **Analytics:** temperature counts.
- **Lead detail / drawer:** reasons shown (`LeadDetails.tsx`, `LeadDrawer.tsx`).
- **Notifications:** a change to HOT notifies (`notifyHotLead` in `leads.js`).
- **Assignment:** the router passes the score to the model as context (`11`).
- **Human override:** built (manual edit, above).

Status against the June design:

| June item | Status |
|---|---|
| Score + band + reasons on the Lead | Built (label + confidence + reasons) |
| Deterministic weighted feature model in the CRM | Not built (exists only in the Instagram service) |
| Numeric band thresholds (Hot ≥ 70 …) | Not built |
| Recency decay | Not built |
| Recompute on each relevant event | Not built (lead creation and AI call only) |
| Per-tenant weights and thresholds | Not built; rubric and city list are global |
| Human override | Built |
| Colour-coded pipeline with reasons | Partly built (filter, counts, reasons in detail views) |
| Calibration against conversions | Not built |

## 6. Considered in June, not adopted

A hybrid score: a deterministic weighted sum (price or brochure request, phone and email shared, site-visit request, engagement, budget fit against inventory, timeline, source quality, negative signals) plus Haiku-derived quality and sentiment signals, bands at 70 / 40, recency decay, tenant-tunable weights, and a later calibration loop. None of this was built; per D11 no new target design is written here.

## 7. KPIs

Band → conversion correlation, share of leads scored, `llm_text` vs `ai_call` disagreement rate, manual override rate, time from lead creation to first score.
