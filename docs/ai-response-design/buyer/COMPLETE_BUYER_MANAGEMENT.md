# Complete Buyer Management

Buyer tools exposed to SyncBot / MCP:

| Tool | View |
|------|------|
| `create_buyer` | createConfirmation |
| `get_buyer` | details (+ `metadata.recommendation`) |
| `search_buyers` | searchResults |
| `update_buyer` | updateConfirmation |
| `delete_buyer` | deleteConfirmation |
| `create_buyer_note` | noteCreateConfirmation |
| `get_buyer_notes` | notesList |
| `get_buyers_summary` | LLM summary (no AI DTO) |

WhatsApp templates: [`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../../interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md)

Code: `apps/crm/server/normalizers/buyerNormalizer.js`, `apps/crm/server/aiViewBuilders/buyerAIViewBuilder.js`, flag `USE_AI_DTO_FOR_BUYERS`.
