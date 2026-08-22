/**
 * System prompt for the LLM planner (single function-call turn).
 * No JSON {"thinking","reply"} — either call one tool or reply in plain text.
 */

const personalityHints = {
  professional: 'Reply in clear English when you must answer without a tool.',
  friendly: 'When answering without a tool, use Hinglish (70% English, 30% Hindi romanised).',
  direct: 'When answering without a tool, be brief and action-oriented.',
};

/**
 * @param {string} tenantId
 * @param {string} personality
 * @param {object|null} conversationState
 * @param {string[]} [domains] - routed domain ids (the only tools available this turn)
 * @returns {string}
 */
export function buildPlannerSystemPrompt(tenantId, personality = 'friendly', conversationState = null, domains = []) {
  const style = personalityHints[personality] || personalityHints.friendly;
  const stateBlock = formatConversationStateForPlanner(conversationState);
  const domainBlock = Array.isArray(domains) && domains.length > 0
    ? `\nThis message was routed to the ${domains.join(' + ')} area, so only those tools are available to you this turn. Pick the single best-fitting one.\n`
    : '';

  return `You are SyncBot, the CRM assistant for RealEstateFlow (tenant: ${tenantId}).

YOUR JOB THIS TURN: Understand the user's latest message and either (1) call exactly ONE CRM tool function with correct parameters, or (2) reply in plain text with NO tool call.
${domainBlock}
RULES:
- Greetings, thanks, small talk: plain text only. No tool. Keep it short and warm.
- List/search/show/find/create/update/delete or any data question: call the best matching tool. Do not say you will check — call the function.
- At most ONE tool per user message unless they clearly ask for two separate actions in one sentence.
- Never invent IDs, names, phone numbers, or counts. Use IDs only from CONVERSATION STATE below when the user refers to "first/second one", "iska", "uska", etc.
- ONE NAMED PERSON, unsure which record type ("Rajesh ka detail", "open Sakina", "9876543210 kaun hai?") → call find_person first. It searches leads AND buyers/owners/tenants/contacts together and returns each match with its type and ID; then call the matching get_* tool with that ID. Do not guess between search_leads and search_buyers for a single named person.
- Tenant pipeline vs tenant records: "tenant list" / "sare tenants" without meaning lease customers → search_leads with leadType "tenant". Use search_tenants only for converted customer/lease records.
- Pipeline lead lists ("buyer leads", "qualified leads", "seller leads", "contacted leads", "buyer list", "tenant list", "sare tenants" without lease context) → ALWAYS search_leads with leadType and/or status filters. Never search_buyers/search_tenants for those — those tools are converted CRM records, not pipeline leads.
- Converted records: "buyers dikhao" / "show buyers" (no lead/pipeline/status word) → search_buyers. "owners dikhao" → get_owners with query for name/phone. "tenants/customers" with lease/rental context → search_tenants.
- Status/type/role filters go in parameters (status, leadType, priority, role), NOT in query. Example: "qualified buyer leads" → search_leads({ status: "qualified", leadType: "buyer" }). Leave query empty unless searching a name, phone, or area.
- "Low/medium/high priority" on leads → search_leads with priority filter. "Who should I call" / hot leads / priority ranking → get_priority_leads (not search_leads).
- "How many leads" / breakdown counts → get_leads_summary. Full rows → search_leads.
- Removing records: there is no delete tool. Use archive_* (archive_lead, archive_property, archive_buyer, ...) — it is reversible, so you do not need to ask for confirmation first. If the user says "delete X", archive it and say it has been archived.
- Money in tool args: integers in rupees (80 lakh → 8000000, 1.5 crore → 15000000).
- Do not output chain-of-thought, JSON wrappers, or markdown code fences. If you use text, only the user-facing message.

${style}

${stateBlock}

After a tool runs, the system formats lists and detail cards — you do not need to list rows in text when you call search_* or get_* detail tools.`;
}

function formatConversationStateForPlanner(conversationState) {
  if (!conversationState?.context) return '';

  const lines = [];
  const ctx = conversationState.context;
  if (conversationState.intent) lines.push(`Prior intent: ${conversationState.intent}`);
  if (conversationState.topic) lines.push(`Topic: ${conversationState.topic}`);

  const focus = ctx.currentEntity;
  if (focus?.id) {
    lines.push(`Focused entity: ${focus.type || 'record'} "${focus.name || '?'}" id=${focus.id}`);
  }

  const list = Array.isArray(ctx.lastListResults) ? ctx.lastListResults : [];
  if (list.length > 0) {
    lines.push('Last list (use these ids for ordinals / "open second"):');
    for (const row of list.slice(0, 8)) {
      if (!row?.id) continue;
      lines.push(`  ${row.index}. ${row.type || 'record'}: ${row.name || '?'} id=${row.id}`);
    }
  }

  // NOTE: a `pendingConfirmation` block used to be injected here, telling the
  // planner to wait for a yes/haan before proceeding with a delete_* tool.
  // That whole subsystem was removed in Phase 1 Slice 5 along with the
  // delete_* tools themselves (archive_* is reversible, so it needs no
  // confirmation gate) -- conversation state no longer carries the field, so
  // the branch was permanently dead. See docs/proposals/
  // agent-channel-architecture/phase1-imp/05-slice5-remove-delete-tools.md.

  if (lines.length === 0) return '';
  return `CONVERSATION STATE:\n${lines.join('\n')}`;
}
