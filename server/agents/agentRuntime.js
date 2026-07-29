/**
 * Agent Runtime — single, unified agent pipeline.
 *
 * Conversational agent (WhatsApp SyncBot) flow — ONE path, no legacy branches:
 *
 *   inbound message
 *     → Stage A: routeDomains()      (pick relevant CRM domain[s])
 *     → Stage B: planTurn()          (plan: ONE scoped tool call OR a chat reply)
 *     → Stage C: execute             (invokeSkill + optional auto-open detail)
 *     → Stage D: compose             (deterministic formatter, or LLM for summaries)
 *
 * Non-conversational agents (qualifier / router / followup / mcp) use a simple
 * single-shot LLM completion with their role prompt (no tools, raw text out).
 *
 * The planner only ever sees the routed domain's handful of tools — never all
 * 60+ — which is what makes tool selection accurate and cheap.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getBalance, deductCredits } from '../creditService.js';
import { invokeSkill, enrichContextWithLead } from '../skillInvoker.js';
import {
  SUMMARY_INSIGHT_TOOLS,
  getToolMeta,
  getToolsForDomain,
} from '../shared/toolDefinitions.js';
import { logAgentAction } from './agentAuditService.js';
import { buildSystemPrompt } from './prompts.js';
import { renderDecision, isValidWhatsAppReply } from './responseFormatter.js';
import { autoOpenSingleSearchDetail, shouldAutoOpenAfterSearch } from './followUpResolver.js';
import { getProvisioningByTenant } from '../aiEmployeeProvisioningService.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { getConversationContext } from '../whatsappConversationService.js';
import {
  getConversationState,
  updateConversationState,
  updateLastDiscussedEntities,
  extractListAndFocusFromToolResults,
} from '../conversationStateService.js';
import { routeDomains } from './domainRouter.js';
import { planTurn } from './llm/planTurn.js';
import { composeReply } from './llm/composeReply.js';
import { decideInteraction } from './interaction/decideInteraction.js';
import { metrics } from '../observability/cloudwatch.js';
import { logger } from '../logger.js';

// Re-export tool declaration builders for scripts/tests that import them here.
export { buildAnthropicToolDefinitions, buildGeminiToolDefinitions, normalizeGeminiToolName } from './geminiToolDeclarations.js';

const AGENT_ACTION_CREDITS = parseInt(process.env.AGENT_ACTION_CREDITS || '15', 10);
const LOCAL_DEV_BYPASS = process.env.NODE_ENV === 'development' || process.env.AI_EMPLOYEE_BYPASS_PROVISIONING === 'true';

/** Agents that hold a conversation and use CRM tools. */
const CONVERSATIONAL_AGENTS = new Set(['whatsapp']);

const PENDING_YES_RE = /^(yes|yeah|yep|haan|haa+n?|ha|ji|ji haan|sure|confirm|ok karo|kar do|delete karo|proceed|go ahead|pakka)\b/i;
const PENDING_NO_RE = /^(no|nope|nahi+|na|mat|rehne do|cancel|ruko|stop|abort|chhodo|skip|don'?t)\b/i;

// ─── Gemini API call accounting (per invoke) ─────────────────────────────────
let _geminiApiCallsThisInvoke = 0;
function resetGeminiCallCount() { _geminiApiCallsThisInvoke = 0; }
export function trackGeminiApiCall(reason) {
  _geminiApiCallsThisInvoke += 1;
  logger.debug('agent.gemini.api_call', { reason, count: _geminiApiCallsThisInvoke });
}

// ─── Result truncation for the composer LLM ──────────────────────────────────
const TRUNCATE_LIST_LIMIT = parseInt(process.env.AGENT_TRUNCATE_LIST_LIMIT || '3', 10);
const TRUNCATE_MAX_RESULT_CHARS = parseInt(process.env.AGENT_TRUNCATE_MAX_RESULT_CHARS || '2000', 10);
const TRUNCATE_STRING_LENGTH = parseInt(process.env.AGENT_TRUNCATE_STRING_LENGTH || '100', 10);

// Summary/insight payloads are already small, curated aggregates — never truncate.
const NEVER_TRUNCATE_TOOLS = new Set([...SUMMARY_INSIGHT_TOOLS, 'get_leads_summary']);

/**
 * Produce a lean, token-safe representation of a tool result before it is sent
 * to the composer LLM. Lists collapse to count + top N; large single records get
 * their long string fields trimmed. The user still sees the full deterministic
 * formatting — this only bounds what the LLM reads.
 */
export function truncateToolResultForLlm(toolName, toolResult) {
  if (!toolResult || typeof toolResult !== 'object') return toolResult;
  if (!toolResult.ok) return toolResult;
  if (NEVER_TRUNCATE_TOOLS.has(toolName)) return toolResult;

  const data = toolResult.data;
  if (!data) return toolResult;

  const payload = (data && typeof data === 'object' && data.metadata && 'data' in data) ? data.data : data;

  let list = null;
  if (Array.isArray(payload)) list = payload;
  else if (payload && typeof payload === 'object') {
    for (const key of ['items', 'leads', 'buyers', 'owners', 'customers', 'properties', 'contacts', 'meetings', 'notes', 'documents']) {
      if (Array.isArray(payload[key])) { list = payload[key]; break; }
    }
  }

  if (list && list.length > TRUNCATE_LIST_LIMIT) {
    const topN = list.slice(0, TRUNCATE_LIST_LIMIT).map((item) => {
      if (!item || typeof item !== 'object') return String(item).slice(0, TRUNCATE_STRING_LENGTH);
      const name = item.name || item.leadName || item.ownerName || item.customerName || item.buyerName || item.title || 'Unknown';
      const id = item.leadId || item.ownerId || item.customerId || item.buyerId || item.propertyId || item.contactId || item.meetingId || '';
      const type = item.leadType || item.status || '';
      return {
        name: String(name).slice(0, TRUNCATE_STRING_LENGTH),
        id: String(id).slice(0, TRUNCATE_STRING_LENGTH),
        type: String(type).slice(0, TRUNCATE_STRING_LENGTH),
      };
    });
    return { ok: true, data: { total: list.length, showing: `top ${TRUNCATE_LIST_LIMIT} (system formats full list for user)`, items: topN } };
  }

  const resultStr = JSON.stringify(toolResult);
  if (resultStr.length > TRUNCATE_MAX_RESULT_CHARS) {
    try {
      const cloned = JSON.parse(resultStr);
      const trim = (obj, depth = 0) => {
        if (depth > 4 || !obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach((i) => trim(i, depth + 1)); return; }
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'string' && obj[key].length > TRUNCATE_STRING_LENGTH) {
            obj[key] = obj[key].slice(0, TRUNCATE_STRING_LENGTH) + '...';
          } else {
            trim(obj[key], depth + 1);
          }
        }
      };
      trim(cloned);
      return cloned;
    } catch (_) {
      return { ok: true, data: { note: 'Result too large, truncated', summary: String(data).slice(0, 200) } };
    }
  }

  return toolResult;
}

/** Consistent hash for gradual rollout. */
function isEnabledForRollout(tenantId, rolloutPercentage) {
  if (rolloutPercentage >= 100) return true;
  if (rolloutPercentage <= 0) return false;
  const hash = tenantId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a >>> 0;
  }, 0);
  return (hash % 100) < rolloutPercentage;
}

// ─── Pending delete-confirmation handling ────────────────────────────────────

/** Short-circuit the planner when the user is answering a pending delete confirm. */
function planFromPendingConfirmation(prompt, conversationState) {
  const pending = conversationState?.context?.pendingConfirmation;
  if (!pending?.toolName) return null;
  const trimmed = String(prompt || '').trim();
  if (PENDING_YES_RE.test(trimmed)) {
    return { kind: 'tool', toolName: pending.toolName, input: pending.input || {}, source: 'pending_confirmation' };
  }
  if (PENDING_NO_RE.test(trimmed)) {
    return { kind: 'chat', text: 'Okay, cancelled. Nothing was changed.', source: 'pending_confirmation' };
  }
  return null;
}

/** Block a destructive delete until the user confirms on a follow-up message. */
function gateDeleteToolPlan(plan, conversationState) {
  if (plan.kind !== 'tool' || !plan.toolName?.startsWith('delete_')) return plan;
  const pending = conversationState?.context?.pendingConfirmation;
  if (pending?.toolName === plan.toolName) return plan;
  return {
    kind: 'confirm_pending',
    toolName: plan.toolName,
    input: plan.input || {},
    text: 'Are you sure you want to delete this record? Reply "yes" to confirm or "no" to cancel.',
  };
}

/** Persist last list / focused entity + pending confirmation after a turn. */
async function persistTurnState(tenantId, contactPhone, toolResults, decision) {
  try {
    const { lastListResults, currentEntity } = extractListAndFocusFromToolResults(toolResults);
    if (lastListResults || currentEntity) {
      await updateLastDiscussedEntities(tenantId, contactPhone, [], null, { lastListResults, currentEntity });
    }
    const state = await getConversationState(tenantId, contactPhone);
    const context = { ...(state?.context || {}) };
    if (decision?.mode === 'confirm' && decision.pending) {
      context.pendingConfirmation = decision.pending;
    } else if (context.pendingConfirmation) {
      context.pendingConfirmation = null;
    } else {
      return;
    }
    await updateConversationState(tenantId, contactPhone, { context });
  } catch (err) {
    logger.warn('agent.persist_state.failed', { tenantId, contactPhone, error: err.message });
  }
}

const SEARCH_LIST_TOOLS = new Set([
  'search_leads', 'search_buyers', 'search_contacts', 'search_properties', 'search_tenants',
]);

/**
 * Conversational pipeline: route → plan → execute → compose.
 * @returns {Promise<object>} same success shape as invokeAgent
 */
async function runConversationalPipeline(tenantId, agentId, prompt, context, conversationState, conversationHistory, personality, startMs) {
  // ── Stage A + B: decide the plan ──────────────────────────────────────────
  let plan = planFromPendingConfirmation(prompt, conversationState);
  let domains = [];
  let smalltalk = false;

  if (!plan) {
    const routed = await routeDomains(prompt, {
      conversationState,
      onApiCall: () => trackGeminiApiCall('router.generateContent'),
    });
    domains = routed.domains;
    smalltalk = routed.smalltalk;

    if (smalltalk) {
      plan = { kind: 'chat', source: 'router_smalltalk' };
    } else {
      const toolNames = getToolsForDomain(domains);
      plan = await planTurn(prompt, {
        tenantId,
        personality,
        conversationState,
        historyMessages: conversationHistory,
        toolNames,
        domains,
        onApiCall: () => trackGeminiApiCall('planner.generateContent'),
      });
      plan = gateDeleteToolPlan(plan, conversationState);
    }
  }

  // Standardized plan envelope (for logging / observability).
  logger.info('agent.plan', {
    tenantId,
    agentId,
    domains,
    smalltalk,
    intent: plan.kind,
    toolCall: plan.kind === 'tool',
    tool: plan.toolName || null,
    source: plan.source || (smalltalk ? 'router' : 'planner'),
  });

  const toolResults = [];
  let result = null;
  let decision = null;
  let instruction = null;

  // ── Non-tool turns (chat / clarify / confirm) ─────────────────────────────
  if (plan.kind === 'confirm_pending') {
    decision = decideInteraction({
      kind: 'confirm',
      confirm: { entity: 'record', toolName: plan.toolName, input: plan.input, promptText: plan.text },
    });
    const text = renderDecision(decision, null, null);
    if (context.contactPhone) await persistTurnState(tenantId, context.contactPhone, toolResults, decision);
    return finish(tenantId, agentId, prompt, context, { text, toolResults }, startMs, 'confirm_pending');
  }

  if (plan.kind === 'chat') {
    const raw = plan.text?.trim();
    const text = raw && isValidWhatsAppReply(raw) ? raw : decideInteraction({ kind: 'chat' }).text;
    return finish(tenantId, agentId, prompt, context, { text, toolResults }, startMs, 'chat');
  }

  if (plan.kind === 'clarify') {
    const text = plan.text?.trim() || decideInteraction({ kind: 'clarify', clarifyQuestion: plan.text }).text;
    return finish(tenantId, agentId, prompt, context, { text, toolResults }, startMs, 'clarify');
  }

  // ── Stage C: execute the tool ─────────────────────────────────────────────
  if (plan.kind === 'tool' && plan.toolName) {
    instruction = { kind: 'tool', toolName: plan.toolName, input: plan.input || {} };
    result = await invokeSkill(tenantId, plan.toolName, plan.input || {}, {
      userId: context.userId,
      source: 'agent.pipeline',
    });
    toolResults.push({ tool: plan.toolName, input: plan.input || {}, result });
    await logAgentAction(tenantId, agentId, 'tool_call', { toolName: plan.toolName, input: plan.input || {} }, result, 0);

    // Auto-open the single matching record when the user searched by name.
    if (SEARCH_LIST_TOOLS.has(plan.toolName) && result?.ok && shouldAutoOpenAfterSearch(plan.input)) {
      const opened = await autoOpenSingleSearchDetail(tenantId, plan.toolName, result, {
        userId: context.userId,
        source: 'agent.pipeline',
      });
      if (opened) {
        toolResults.push({ tool: opened.tool, input: {}, result: opened.result });
        result = opened.result;
        instruction = { kind: 'tool', toolName: opened.tool, input: {} };
      }
    }
    decision = decideInteraction(instruction, result);
  } else {
    decision = decideInteraction({ kind: 'clarify', clarifyQuestion: 'I could not determine which CRM action to run. Please try again.' });
    const text = renderDecision(decision, null, null);
    return finish(tenantId, agentId, prompt, context, { text, toolResults }, startMs, 'clarify');
  }

  // ── Stage D: compose the reply (hybrid: formatter, or LLM for summaries) ───
  const meta = getToolMeta(instruction.toolName);
  const useComposer = meta?.replyOwner === 'llm' && decision?.mode !== 'list' && decision?.mode !== 'detail';
  let text;
  if (useComposer) {
    const truncated = truncateToolResultForLlm(instruction.toolName, result);
    const composed = await composeReply({
      userMessage: prompt,
      personality,
      tenantId,
      toolName: instruction.toolName,
      truncatedPayload: truncated,
      onApiCall: () => trackGeminiApiCall('composer.generateContent'),
    });
    text = composed || renderDecision(decision, result, null);
  } else {
    text = renderDecision(decision, result, null);
  }

  if (context.contactPhone) await persistTurnState(tenantId, context.contactPhone, toolResults, decision);

  return finish(tenantId, agentId, prompt, context, { text, toolResults }, startMs, plan.kind, instruction?.toolName);
}

/** Shared success-return + audit for the conversational pipeline. */
async function finish(tenantId, agentId, prompt, context, { text, toolResults }, startMs, plannerKind, toolName) {
  const durationMs = Date.now() - startMs;
  try { await metrics.agentActionInvoked(tenantId, agentId); } catch (_) {}
  await logAgentAction(
    tenantId,
    agentId,
    'invoke',
    { prompt: String(prompt).slice(0, 200), context, plannerKind },
    { text, toolResults },
    AGENT_ACTION_CREDITS,
  );
  logger.info('agent.invoke.complete', {
    tenantId,
    agentId,
    plannerKind,
    geminiApiCalls: _geminiApiCallsThisInvoke,
    toolCalls: toolResults.length,
    replyOwner: toolName ? getToolMeta(toolName)?.replyOwner : 'n/a',
  });
  return {
    ok: true,
    toolResults,
    result: { text, toolResults, durationMs, geminiApiCalls: _geminiApiCallsThisInvoke, pipeline: 'unified' },
  };
}

/**
 * Single-shot completion for non-conversational agents (qualifier/router/followup/mcp).
 * These analyse the provided data and return raw text (usually role-specific JSON).
 */
async function runSingleShotAgent(tenantId, agentId, prompt, systemPrompt, startMs) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;
  if (!apiKey || !modelName) {
    return { ok: false, error: 'llm_not_configured' };
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
  trackGeminiApiCall('single_shot.generateContent');
  const result = await model.generateContent(prompt);
  let text = '';
  try { text = (result.response.text() || '').trim(); } catch (_) { text = ''; }

  const durationMs = Date.now() - startMs;
  await logAgentAction(tenantId, agentId, 'invoke', { prompt: String(prompt).slice(0, 200) }, { text }, AGENT_ACTION_CREDITS);
  return { ok: true, toolResults: [], result: { text, toolResults: [], durationMs, geminiApiCalls: _geminiApiCallsThisInvoke } };
}

/**
 * Main entry point.
 * @param {string} tenantId
 * @param {string} agentId  - 'whatsapp' (conversational) | 'qualifier' | 'router' | 'followup' | 'mcp'
 * @param {string} prompt
 * @param {object} context  - { userId, source, contactPhone, leadId, ... }
 */
export async function invokeAgent(tenantId, agentId, prompt, context = {}) {
  const startMs = Date.now();

  // 1. Global kill-switch
  if (process.env.AGENTS_ENABLED !== 'true') {
    logger.info('agent.invoke.disabled', { tenantId, agentId });
    return { ok: false, error: 'agents_disabled' };
  }

  // 2. Gradual rollout
  const rolloutPct = parseInt(process.env.AI_EMPLOYEE_ROLLOUT_PERCENTAGE || '100', 10);
  if (!isEnabledForRollout(tenantId, rolloutPct)) {
    logger.info('agent.invoke.rollout_excluded', { tenantId, agentId, rolloutPct });
    return { ok: false, error: 'tenant_not_in_rollout' };
  }

  // 3. Provisioning / config / credits (bypassed in local dev)
  let agencyConfig = null;
  if (!LOCAL_DEV_BYPASS) {
    const provisioning = await getProvisioningByTenant(tenantId);
    if (!provisioning || provisioning.status !== 'live') {
      logger.warn('agent.invoke.not_provisioned', { tenantId, agentId, status: provisioning?.status });
      return { ok: false, error: 'ai_employee_not_provisioned', status: provisioning?.status };
    }
    agencyConfig = await getAgencyConfig(tenantId);
    if (!agencyConfig?.aiEmployeeEnabled) {
      logger.warn('agent.invoke.disabled_by_tenant', { tenantId, agentId });
      return { ok: false, error: 'ai_employee_disabled_by_tenant' };
    }
    const balance = await getBalance(tenantId);
    if (balance < AGENT_ACTION_CREDITS) {
      logger.warn('agent.invoke.insufficient_credits', { tenantId, agentId, balance, required: AGENT_ACTION_CREDITS });
      try { await metrics.creditInsufficient(tenantId); } catch (_) {}
      return { ok: false, error: 'insufficient_credits', balance };
    }
    try {
      await deductCredits(tenantId, AGENT_ACTION_CREDITS, 'agent_action', { reason: 'llm_invoke', agentId });
    } catch (err) {
      logger.error('agent.invoke.credit_deduction_failed', { tenantId, agentId, error: err.message });
      return { ok: false, error: 'credit_deduction_failed' };
    }
  } else {
    logger.info('agent.invoke.local_dev_bypass', { tenantId, agentId });
  }

  if (!agencyConfig) {
    try { agencyConfig = await getAgencyConfig(tenantId); } catch (err) {
      logger.warn('agent.invoke.getAgencyConfig.failed', { tenantId, agentId, error: err.message });
    }
  }
  const defaultPersonality = agentId === 'whatsapp' ? 'friendly' : 'professional';
  const personality = agencyConfig?.aiPersonality || defaultPersonality;

  resetGeminiCallCount();

  try {
    // ── Non-conversational agents: single-shot completion ────────────────────
    if (!CONVERSATIONAL_AGENTS.has(agentId)) {
      let systemPrompt = buildSystemPrompt(agentId, tenantId, personality);
      if (context.leadId) {
        try {
          const leadContext = await enrichContextWithLead(tenantId, context.leadId);
          if (Object.keys(leadContext).length > 0) {
            systemPrompt += `\nLead Information:\n- Name: ${leadContext.leadName || 'N/A'}\n- Phone: ${leadContext.leadPhone || 'N/A'}\n- Type: ${leadContext.leadType || 'N/A'}\n- Status: ${leadContext.leadStatus || 'N/A'}`;
          }
        } catch (_) { /* continue without lead context */ }
      }
      return await runSingleShotAgent(tenantId, agentId, prompt, systemPrompt, startMs);
    }

    // ── Conversational agent (WhatsApp): load history + state ────────────────
    let conversationHistory = [];
    let conversationState = null;
    if (context.contactPhone) {
      try {
        const history = await getConversationContext(tenantId, context.contactPhone, 20);
        if (history.length > 0) {
          conversationHistory = history.map((msg) => ({ role: msg.role, content: msg.content }));
        }
      } catch (err) {
        logger.warn('agent.invoke.conversation_context.failed', { tenantId, contactPhone: context.contactPhone, error: err.message });
      }
      try {
        conversationState = await getConversationState(tenantId, context.contactPhone);
      } catch (err) {
        logger.warn('agent.invoke.conversation_state.failed', { tenantId, contactPhone: context.contactPhone, error: err.message });
      }
    }

    // The planner prompt is built inside planTurn from this conversationState
    // (focus entity, last list, pending confirmation) — single source, no dupes.
    return await runConversationalPipeline(
      tenantId,
      agentId,
      prompt,
      context,
      conversationState,
      conversationHistory,
      personality,
      startMs,
    );
  } catch (err) {
    logger.error('agent.invoke.failed', { tenantId, agentId, error: err.message, stack: err.stack });
    try { await metrics.agentActionFailed(tenantId, agentId); } catch (_) {}
    await logAgentAction(tenantId, agentId, 'invoke', { prompt: String(prompt).slice(0, 200) }, { error: err.message }, AGENT_ACTION_CREDITS);
    // Graceful user-facing fallback for the conversational path.
    if (CONVERSATIONAL_AGENTS.has(agentId)) {
      return {
        ok: true,
        toolResults: [],
        result: { text: 'Sorry, I could not process that right now. Please try again in a moment.', toolResults: [], durationMs: Date.now() - startMs, error: err.message },
      };
    }
    return { ok: false, error: err.message };
  }
}
