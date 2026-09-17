# SyncBot Interaction Design — Active Workstream

**Started:** 2026-07-19  
**Spec:** [`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md)

## Purpose

Make every WhatsApp response consistent across entities: mini-profile detail cards, unified lists/confirmations, hybrid insights (metadata recommendation → formatter rules), no UUID dumps.

## Three layers

1. **AI Transformation** — `docs/ai-response-design/` + view builders  
2. **Runtime snapshot** — `docs/current_design/`  
3. **Interaction Design** — `docs/interaction-design/` (WhatsApp UX)

## Done

- [x] Rich mini-profile cards for lead / buyer / owner / tenant / property / contact / meeting
- [x] `normalizeList` fix (entity notes/properties not mistaken for lists)
- [x] Explicit routing registry (`DETAIL` / `LIST` / `SUMMARY`) in `formatting/routing.js`
- [x] Interaction Design v1 written; `09-design-goals.md` redirected
- [x] `docs/ai-response-design/` buyer + contact design docs
- [x] Formatter extracted to `agency-app/api/agents/formatting/` (+ compact create, empty/error templates)
- [x] Relative dates + `Phone:` / `Email:` labels; no UUID labels on cards
- [x] Buyer / property / contact normalizers + view builders + middleware flags (local `.env` = true)
- [x] Hybrid `metadata.recommendation` for **all** detail entities (`recommendations.js`)
- [x] Conversation memory (`lastListResults`, `currentEntity`)
- [x] Prompt alignment (detail-by-name; UUID policy)
- [x] Golden check: `node agency-app/api/agents/run-golden-check.mjs`

## Still open

- [ ] Live WhatsApp verification after CRM deploy
- [ ] Optional: Jest via `npm install` in `agency-app/api/`

## Key files

| Area | Path |
|------|------|
| Spec | `docs/interaction-design/` |
| Formatter | `agency-app/api/agents/responseFormatter.js`, `agency-app/api/agents/formatting/` |
| DTOs | `agency-app/api/aiViewBuilders/`, `agency-app/api/aiDtoMiddleware.js` |
| Recommendations | `agency-app/api/aiViewBuilders/recommendations.js` |
| Prompt | `agency-app/api/agents/prompts.js` |
| Golden | `agency-app/api/agents/run-golden-check.mjs`, `goldenConversations.test.js` |

## Decisions

- Detail/list/CRUD = deterministic formatter (not LLM prose)
- Insight hybrid: `metadata.recommendation` preferred; formatter rules as fallback
- Create/update = compact confirmation (2–4 key fields), not full mini-profile
- AI DTO flags enabled in local `.env` after cards landed
