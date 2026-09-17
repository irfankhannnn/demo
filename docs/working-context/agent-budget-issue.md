# Agent Budget Update Issue

## Problem
User asked: "unka budget 2.8 crore update kardo" (update the budget to 2.8 crore).

Expected behavior: update `buyerRequirement.budget` in the lead.

Actual behavior: agent created a note with content "Budget updated to 2.8 crore." instead of updating the structured field.

## Root cause
1. The `update_lead` tool schema only advertised `status`, `score`, and `assignedTo` as parameters.
2. The `toolContextBuilder.js` `allowedFields` only allowed `['status', 'score', 'assignedTo', 'notes', 'lastInteractionAt']`.
3. The WhatsApp agent prompt did not explicitly instruct the agent to update structured fields when requested.

Because the agent did not see budget/requirement fields as updatable through `update_lead`, it fell back to `create_lead_note`.

## Fixes applied
1. **Tool schema expanded**
   - `agency-app/api/skillInvoker.js` `TOOL_SCHEMAS.update_lead` now includes `notes`, `buyerRequirement`, `sellerRequirement`, `ownerRequirement`, `tenantRequirement`.
   - Added a description explaining that structured requirement updates should use `update_lead`, not notes.

2. **Allowed fields expanded**
   - `agency-app/api/agents/toolContextBuilder.js` `buildLeadUpdateContext` now includes requirement objects in `allowedFields`.

3. **Prompt updated**
   - `agency-app/api/agents/prompts.js` WhatsApp agent prompt now has a "CRITICAL RULES for tool use" section:
     - Update structured fields via `update_lead` when asked.
     - Example: "budget 2.8 crore update kardo" means update `buyerRequirement.budget`.
     - Only use `create_lead_note` for free-form info.

4. **Requirement merging**
   - `agency-app/api/crmDynamodbService.js` `updateLead` now merges incoming requirement objects with existing requirement objects.
   - This prevents a partial update (e.g., only budget) from wiping out `preferredArea`, `bhk`, `propertyType`, etc.

## Verification

All existing tests passed after the changes.

## Notes for next session

- If the LLM still does not reliably update structured fields, consider adding more examples to the prompt or splitting requirement updates into a dedicated tool.
- The current schema uses simple type strings; if more nested structure is needed, the tool definition builder may need to support richer JSON schemas.
