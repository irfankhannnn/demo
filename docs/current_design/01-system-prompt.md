# Priority 1 — Current System Prompt

Source: `server/agents/prompts.js` + `server/agents/agentRuntime.js`

Agent ID for WhatsApp: **`whatsapp`**

Product UX rules: [`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md)

---

## Prompt composition

`buildSystemPromptWithContext()` builds:

```
You are a CRM assistant for RealEstateFlow (tenant: {tenantId})...
{personality block}
{whatsapp agent block}
Tenant ID: {tenantId}
[+ optional business context / team members]
[+ CONVERSATION STATE: currentEntity, lastListResults, lastDiscussedEntities]
```

---

## Two tool classes

**A) DATA/LIST** — system renders mini-profile card or numbered list. LLM gives short intro only (lists) or empty/short line (details). Never re-list fields.

**B) SUMMARY/INSIGHT** — LLM owns full 3-layer reply.

## Detail-by-name

`"Show complete details of Sakina Shaikh"` → `search_*` by name → if one match → `get_*`. If multiple → disambiguate.

## UUID policy

Never expose IDs unless user asks.

## Conversation memory (injected)

- `currentEntity` — last opened detail  
- `lastListResults` — indexed `{ index, type, id, name }` for "open second one"  
- `lastDiscussedEntities` — pronoun resolution  

See `conversationStateService.js` + WhatsApp processor persistence.
