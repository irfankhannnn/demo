# Priority 7 — AI DTO View Builders

Source: `agency-app/api/aiViewBuilders/`, `agency-app/api/aiDtoMiddleware.js`, `agency-app/api/normalizers/`

Entity contracts: [`docs/ai-response-design/`](../ai-response-design/)  
WhatsApp templates: [`docs/interaction-design/`](../interaction-design/)

---

## Pipeline

```
crmDynamodbService handler
        ↓
skillInvoker (raw result)
        ↓
aiDtoMiddleware.transformWithAiDto()  [if feature flag on]
        ↓
normalizer → view builder
        ↓
{ metadata, data } envelope
```

---

## Feature flags

| Flag | Entity |
|------|--------|
| `USE_AI_DTO_FOR_LEADS` | Lead + lead notes |
| `USE_AI_DTO_FOR_OWNERS` | Owner + owner notes |
| `USE_AI_DTO_FOR_TENANTS` | Tenant + rentals/notes |
| `USE_AI_DTO_FOR_MEETINGS` | Meetings |
| `USE_AI_DTO_FOR_BUYERS` | Buyer + buyer notes |
| `USE_AI_DTO_FOR_PROPERTIES` | Property CRUD |
| `USE_AI_DTO_FOR_CONTACTS` | Contact + notes + phone lookup |

Local/dev `.env` and `.env.example` set these to `true`. Production Lambda env should enable per entity after deploy.

Shared recommendations: `agency-app/api/aiViewBuilders/recommendations.js` (lead, buyer, owner, tenant, property, contact, meeting).

---

## View builders

| File | Entity |
|------|--------|
| `leadAIViewBuilder.js` | Lead |
| `ownerAIViewBuilder.js` | Owner |
| `tenantAIViewBuilder.js` | Tenant |
| `meetingAIViewBuilder.js` | Meeting |
| `buyerAIViewBuilder.js` | Buyer |
| `propertyAIViewBuilder.js` | Property |
| `contactAIViewBuilder.js` | Contact |
| `recommendations.js` | Hybrid insight actions |
| `utils.js` | Envelope, money, dates |

---

## Envelope

```json
{ "metadata": { "recommendation": { "action": "...", "reasons": [] } }, "data": {} }
```

`metadata.recommendation` (optional) is rendered by the formatter as the 💡 block when present; otherwise rule-based insight is used.

---

## Gaps

- Meeting normalizer still thin (raw → builder)
- Buyer design docs under `docs/ai-response-design/buyer/` incomplete vs leads (ARCHITECTURE + README only historically; prefer root README for status)
- Document tools not fully DTO-wrapped
