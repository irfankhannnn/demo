# SyncBot Current Design — Runtime Snapshot

This folder captures the **current state** of the WhatsApp SyncBot agent (prompts, tools, formatter, runtime).

For the **product UX specification** (mini-profile cards, templates, five-question rule), see:

→ [`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md)

For **entity DTO contracts** (what data the AI receives), see:

→ [`docs/ai-response-design/`](../ai-response-design/)

## Files

| File | Contents |
|------|----------|
| [01-system-prompt.md](01-system-prompt.md) | WhatsApp system prompt, personality, tool rules |
| [02-tool-definitions.md](02-tool-definitions.md) | Tools from `toolDefinitions.js` (regenerate via `_generate-tools.mjs`) |
| [03-tool-response-shapes.md](03-tool-response-shapes.md) | Example JSON shapes returned by tools |
| [04-response-formatter.md](04-response-formatter.md) | Deterministic vs LLM routing; formatting modules |
| [05-tool-inventory.md](05-tool-inventory.md) | Inventory by category |
| [06-prompt-examples.md](06-prompt-examples.md) | In-prompt examples |
| [07-ai-dto-view-builders.md](07-ai-dto-view-builders.md) | View builder + envelope reference |
| [08-agent-runtime-flow.md](08-agent-runtime-flow.md) | Message → reply pipeline |
| [09-design-goals.md](09-design-goals.md) | **Redirect** to Interaction Design v1 |

## Source of truth (code)

| Concern | File |
|---------|------|
| System prompt | `apps/crm/server/agents/prompts.js` |
| Tool definitions | `apps/crm/server/shared/toolDefinitions.js` |
| Agent loop | `apps/crm/server/agents/agentRuntime.js` |
| Response formatting | `apps/crm/server/agents/responseFormatter.js`, `apps/crm/server/agents/formatting/` |
| AI DTO middleware | `apps/crm/server/aiDtoMiddleware.js` |
| View builders | `apps/crm/server/aiViewBuilders/*.js` |
| Interaction Design | `docs/interaction-design/` |

## Feature flags (AI DTO)

- `USE_AI_DTO_FOR_LEADS`
- `USE_AI_DTO_FOR_OWNERS`
- `USE_AI_DTO_FOR_TENANTS`
- `USE_AI_DTO_FOR_MEETINGS`
- `USE_AI_DTO_FOR_BUYERS` (rolling out)
- `USE_AI_DTO_FOR_PROPERTIES` (rolling out)
- `USE_AI_DTO_FOR_CONTACTS` (rolling out)

When disabled, tools return raw CRM objects; the formatter still renders mini-profile cards from raw shapes.
