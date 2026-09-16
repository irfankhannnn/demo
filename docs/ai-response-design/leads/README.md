# Lead — AI Transformation

Leads are the reference entity for the AI DTO pipeline.

## Documents

| Document | Description |
|----------|-------------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Layers and boundaries |
| [`COMPLETE_LEAD_MANAGEMENT.md`](COMPLETE_LEAD_MANAGEMENT.md) | Operation inventory |
| [`LEAD_AI_DTO_CONTRACT.md`](LEAD_AI_DTO_CONTRACT.md) | Data the AI receives |
| [`LEAD_AI_VIEW_BUILDER.md`](LEAD_AI_VIEW_BUILDER.md) | How DTOs are built |
| [`PHASED_PLAN.md`](PHASED_PLAN.md) | Rollout notes |

## WhatsApp UX (not this folder)

Detail cards, lists, confirmations:

→ [`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../../interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md)

## Implementation status (code)

| Piece | Location | Status |
|-------|----------|--------|
| Normalizer | `apps/crm/server/normalizers/leadNormalizer.js` | Implemented |
| View builder | `apps/crm/server/aiViewBuilders/leadAIViewBuilder.js` | Implemented |
| Middleware | `apps/crm/server/aiDtoMiddleware.js` | Flag `USE_AI_DTO_FOR_LEADS` |
| Mini-profile card | `apps/crm/server/agents/formatting/entityCards.js` | Implemented |
| Recommendation metadata | `buildLeadDetails` → `metadata.recommendation` | Implemented |

## Principles

1. Backend-first — `crmDynamodbService` stays the data layer.
2. ViewBuilder exposes fields only — no WhatsApp prose.
3. Formatter owns WhatsApp layout (Interaction Design).
4. Internal fields never reach the AI.
