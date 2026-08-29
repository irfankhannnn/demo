# AI Transformation Layer

This folder defines **what data** the AI agent receives for each CRM entity.

It does **not** define WhatsApp layouts. Those live in:

→ [`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md)

## Pipeline

```
crmDynamodbService
    → Normalizer (strip internal fields, normalize enums)
    → AI ViewBuilder (project fields, format money/dates)
    → { metadata, data } DTO
    → Formatter / LLM (Interaction Design layer)
```

## Entity folders

| Entity | Docs | Code (`server/`) | Feature flag |
|--------|------|------------------|--------------|
| Lead | [`leads/`](./leads/) | `aiViewBuilders/leadAIViewBuilder.js`, `normalizers/leadNormalizer.js` | `USE_AI_DTO_FOR_LEADS` |
| Owner | [`owner/`](./owner/) | `ownerAIViewBuilder.js`, `ownerNormalizer.js` | `USE_AI_DTO_FOR_OWNERS` |
| Tenant | [`tenant/`](./tenant/) | `tenantAIViewBuilder.js`, `tenantNormalizer.js` | `USE_AI_DTO_FOR_TENANTS` |
| Meeting | (covered under leads + meeting builder) | `meetingAIViewBuilder.js` | `USE_AI_DTO_FOR_MEETINGS` |
| Property | [`property/`](./property/) | *implementing* | `USE_AI_DTO_FOR_PROPERTIES` |
| Buyer | [`buyer/`](./buyer/) | *implementing* | `USE_AI_DTO_FOR_BUYERS` |
| Contact | [`contact/`](./contact/) | *implementing* | `USE_AI_DTO_FOR_CONTACTS` |

## Canonical docs per entity

1. `README.md` — entry  
2. `ARCHITECTURE.md` — layers  
3. `COMPLETE_*_MANAGEMENT.md` — operations  
4. `*_AI_DTO_CONTRACT.md` — what the AI sees  
5. `*_AI_VIEW_BUILDER.md` — how DTOs are built  
6. `PHASED_PLAN.md` — rollout  

View builders **must not** generate English WhatsApp text. They only expose structured fields (including optional `metadata.recommendation` for hybrid insights).

## Related

- Current SyncBot runtime docs: [`docs/current_design/`](../docs/current_design/)  
- WhatsApp UX templates: [`docs/interaction-design/`](../docs/interaction-design/)  
- Working session notes: [`working-context/`](../working-context/)  
