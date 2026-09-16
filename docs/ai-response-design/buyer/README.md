# Buyer — AI Transformation

| Document | Status |
|----------|--------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Active |
| [`BUYER_AI_DTO_CONTRACT.md`](BUYER_AI_DTO_CONTRACT.md) | Active |
| [`BUYER_AI_VIEW_BUILDER.md`](BUYER_AI_VIEW_BUILDER.md) | Active |
| [`COMPLETE_BUYER_MANAGEMENT.md`](COMPLETE_BUYER_MANAGEMENT.md) | Active |
| [`PHASED_PLAN.md`](PHASED_PLAN.md) | Active |

WhatsApp cards: [`docs/interaction-design/`](../../interaction-design/)

## Code

| Piece | Path | Status |
|-------|------|--------|
| Normalizer | `apps/crm/server/normalizers/buyerNormalizer.js` | Implemented |
| View builder | `apps/crm/server/aiViewBuilders/buyerAIViewBuilder.js` | Implemented |
| Recommendations | `apps/crm/server/aiViewBuilders/recommendations.js` | Implemented |
| Middleware | `USE_AI_DTO_FOR_BUYERS` | Implemented (local `.env` = true) |
