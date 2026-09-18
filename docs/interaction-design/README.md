# SyncBot Interaction Design

This folder owns **how WhatsApp replies look and behave**.

It is the third layer alongside:

| Layer | Location | Owns |
|-------|----------|------|
| AI Transformation | [`docs/ai-response-design/`](../ai-response-design/) | What data the AI receives (DTOs, view builders) |
| Current runtime snapshot | [`docs/current_design/`](../current_design/) | How the agent/tools/formatter work today |
| **Interaction Design** | **this folder** | Templates, routing philosophy, UX rules |

## Source of truth

- **[`SYNC_BOT_INTERACTION_DESIGN_v1.md`](SYNC_BOT_INTERACTION_DESIGN_v1.md)** — versioned product spec for WhatsApp responses

Implementation maps to:

- `agency-app/api/agents/responseFormatter.js` + `agency-app/api/agents/formatting/`
- `agency-app/api/agents/prompts.js`
- `agency-app/api/conversationStateService.js`

## Relationship to other docs

- [`docs/current_design/`](../current_design/) documents **current** behavior for consultants — update it when runtime changes.
- [`docs/ai-response-design/`](../ai-response-design/) documents **entity DTO contracts** — never put WhatsApp templates there.
- Obsolete target outline previously in `docs/current_design/09-design-goals.md` is superseded by this folder.
