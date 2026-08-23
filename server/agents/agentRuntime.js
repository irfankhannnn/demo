/**
 * Agent Runtime — single, unified agent pipeline.
 *
 * Conversational agent (WhatsApp SyncBot) flow — ONE path, no legacy branches:
 *
 *   inbound message
 *     → Stage A: classify()          (pick relevant CRM domain[s] -- modelGateway/, wraps domainRouter.js)
 *     → Stage B: plan()              (plan: ONE scoped tool call OR a chat reply -- modelGateway/, wraps llm/planTurn.js)
 *     → Stage C: execute             (invokeSkill + optional auto-open detail)
 *     → Stage D: compose()           (deterministic formatter, or LLM via modelGateway/ wrapping llm/composeReply.js)
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
import { buildWhatsAppPrincipal } from '../utils/whatsapp.js';
import { canReceiveMessage, canAutoReply } from '../whatsappAccessControl.js';
import { resolveCategory } from '../userCategoryService.js';
import {
  getConversationState,
  initializeConversationState,
  recordMessageInConversation,
  resetConversationStateIfStale,
  updateLastDiscussedEntities,
  extractEntitiesFromToolResults,
  extractListAndFocusFromToolResults,
} from '../conversationStateService.js';
// Model-gateway seam (Phase 2 Slice 2c) -- classify()/plan()/compose() wrap
// domainRouter.js/llm/planTurn.js/llm/composeReply.js unchanged. See
// server/agents/modelGateway/index.js for why this is a thin delegation,
// not a rewrite.
import { classify, plan as planWithGateway, planAndRun as planAndRunWithGateway, compose as composeWithGateway } from './modelGateway/index.js';
import { decideInteraction } from './interaction/decideInteraction.js';
import { metrics } from '../observability/cloudwatch.js';
import { logger } from '../logger.js';

// Re-export tool declaration builders for scripts/tests that import them here.
export { buildAnthropicToolDefinitions, buildGeminiToolDefinitions, normalizeGeminiToolName } from './geminiToolDeclarations.js';

const AGENT_ACTION_CREDITS = parseInt(process.env.AGENT_ACTION_CREDITS || '15', 10);
const LOCAL_DEV_BYPASS = process.env.NODE_ENV === 'development' || process.env.AI_EMPLOYEE_BYPASS_PROVISIONING === 'true';

/**
 * Phase 3: use the bounded multi-step tool loop (llm/runToolLoop.js) instead
 * of the single-shot planner (llm/planTurn.js). Read per-turn rather than
 * cached at module load so it can be flipped without a redeploy.
 *
 * Defaults to OFF: the single-shot path stays the production default until
 * this is deliberately enabled, so shipping the loop is a no-op for live
 * traffic until someone turns it on. See docs/proposals/
 * agent-channel-architecture/phase3-imp/01-slice3a-bounded-tool-loop.md.
 */
function isToolLoopEnabled() {
  return process.env.AGENT_TOOL_LOOP_ENABLED === 'true';
}

/**
 * Agents that hold a conversation and use CRM tools.
 *
 * Phase 5 added 'web'. Both channels run the identical pipeline — classify →
 * plan → execute → compose — against the identical tool registry. What differs
 * is only the composer's length budget (Phase 4) and how the reply is
 * delivered. That was the whole point of the Phase 2 extraction: adding a
 * channel is one entry in this set plus an adapter, not a second agent.
 */
const CONVERSATIONAL_AGENTS = new Set(['whatsapp', 'web']);

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

// ─── Business-hours / agent-pause policy ─────────────────────────────────────
// Moved here from server/scripts/whatsapp-message-processor.js (Phase 2 Slice 2b)
// -- this is tenant business-hours policy, not WhatsApp transport, so a future
// channel needs it too. See docs/proposals/agent-channel-architecture/
// phase2-imp/02-slice2b-processor-extraction.md.
function minutesFromTime(timeStr) {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(String(timeStr))) return null;
  const [h, m] = String(timeStr).split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function isWithinBusinessHours(start, end, timezone = 'Asia/Kolkata') {
  if (!start || !end) return true;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value, 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value, 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return true;

    const current = hour * 60 + minute;
    const startMinutes = minutesFromTime(start);
    const endMinutes = minutesFromTime(end);
    if (startMinutes === null || endMinutes === null) return true;

    // Handle cross-midnight ranges like 22:00-02:00.
    if (endMinutes < startMinutes) {
      return current >= startMinutes || current <= endMinutes;
    }
    return current >= startMinutes && current <= endMinutes;
  } catch {
    return true;
  }
}

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

/**
 * Persist last list / focused entity after a turn, for follow-up context
 * (e.g. "open the second one"). Archive tools (server/shared/toolDefinitions.js)
 * replaced the delete_* tools this used to also gate behind a WhatsApp
 * yes/no confirmation -- see docs/proposals/agent-channel-architecture/
 * phase1-imp/05-slice5-remove-delete-tools.md for why that subsystem was
 * removed rather than kept alongside archive tools.
 */
async function persistTurnState(tenantId, principal, toolResults) {
  try {
    const { lastListResults, currentEntity } = extractListAndFocusFromToolResults(toolResults);
    if (!lastListResults && !currentEntity) return;
    await updateLastDiscussedEntities(tenantId, principal, [], null, { lastListResults, currentEntity });
  } catch (err) {
    logger.warn('agent.persist_state.failed', { tenantId, principal, error: err.message });
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
  /*
   * Permission identity for this turn.
   *
   * `skillInvoker` skips its category check entirely when no userId is given,
   * and WhatsApp turns passed none — so the largest write surface in the
   * product ran with the check switched off, silently and with nothing in the
   * logs to say so. The principal (`wa:<phone>`) is the identity the channel
   * actually has, so it is what the check runs against.
   *
   * Behaviour is unchanged by default: no `CATEGORY#USER` row exists for a
   * principal, so `WHATSAPP_FALLBACK_CATEGORY` (default `admin`) applies, and
   * admin covers the whole registry. What changes is that the decision is now
   * made, logged, and closable — an agency can provision a row for a specific
   * principal, or set the env to `whatsapp_bot`, without a code change.
   *
   * This does not make a shared WhatsApp number safe on its own. The self-chat
   * check means the only possible sender is whoever controls the tenant's
   * connected number, so per-staff permissions need per-staff identity, which
   * this channel does not have. See the launch-readiness audit.
   */
  const permissionIdentity = context.userId || context.principal || undefined;
  // An adapter that knows the actor's real category supplies it (the web
  // channel derives one from the JWT role). Otherwise: WhatsApp's principal
  // gets the env default, and a bare named userId still fails closed.
  const permissionFallback = context.fallbackCategory
    ?? (context.userId ? undefined : (process.env.WHATSAPP_FALLBACK_CATEGORY || 'admin'));

  /** Progress hooks for channels that render tool activity (Phase 5, web chat). */
  const notifyToolStart = (toolName) => {
    try { context.onToolStart?.(toolName); } catch (_) { /* never break a turn on a UI hook */ }
  };
  const notifyToolEnd = (toolName, ok) => {
    try { context.onToolEnd?.(toolName, ok); } catch (_) { /* as above */ }
  };

  // ── Stage A + B: decide the plan ──────────────────────────────────────────
  let plan = null;
  let domains = [];
  let smalltalk = false;

  const routed = await classify(prompt, {
    conversationState,
    onApiCall: () => trackGeminiApiCall('router.generateContent'),
  });
  domains = routed.domains;
  smalltalk = routed.smalltalk;

  if (smalltalk) {
    plan = { kind: 'chat', source: 'router_smalltalk' };
  } else {
    const toolNames = getToolsForDomain(domains);
    const planOptions = {
      tenantId,
      personality,
      conversationState,
      historyMessages: conversationHistory,
      toolNames,
      domains,
      onApiCall: () => trackGeminiApiCall('planner.generateContent'),
    };
    if (isToolLoopEnabled()) {
      // The loop executes tools itself (the model needs each result before it
      // can choose the next step), so tool execution + its audit entry are
      // injected here rather than happening in Stage C below.
      plan = await planAndRunWithGateway(prompt, {
        ...planOptions,
        truncateForModel: truncateToolResultForLlm,
        // Slice 3b: let a mis-scoped turn retry against the full registry
        // instead of failing closed on a wrong router guess.
        allowScopeEscalation: true,
        // A caller that answers inside a request/response deadline can shrink
        // the loop's budget. The web channel does: the loop's own 25s default
        // plus classify and compose can outrun the API Lambda's 30s timeout,
        // and a turn killed by the platform returns nothing at all — strictly
        // worse than a turn that stops early and answers with what it has.
        ...(context.toolLoopBudgetMs ? { budgetMs: context.toolLoopBudgetMs } : {}),
        executeTool: async (toolName, input) => {
          notifyToolStart(toolName);
          const toolResult = await invokeSkill(tenantId, toolName, input, {
            userId: permissionIdentity,
            fallbackCategory: permissionFallback,
            source: 'agent.pipeline',
          });
          notifyToolEnd(toolName, Boolean(toolResult?.ok));
          await logAgentAction(tenantId, agentId, 'tool_call', { toolName, input }, toolResult, 0);
          return toolResult;
        },
      });
    } else {
      plan = await planWithGateway(prompt, planOptions);
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

  // ── Non-tool turns (chat / clarify) ───────────────────────────────────────
  if (plan.kind === 'chat') {
    const raw = plan.text?.trim();
    const text = raw && isValidWhatsAppReply(raw) ? raw : decideInteraction({ kind: 'chat' }).text;
    return finish(tenantId, agentId, prompt, context, { text, toolResults }, startMs, 'chat');
  }

  if (plan.kind === 'clarify') {
    const text = plan.text?.trim() || decideInteraction({ kind: 'clarify', clarifyQuestion: plan.text }).text;
    return finish(tenantId, agentId, prompt, context, { text, toolResults }, startMs, 'clarify');
  }

  // ── Multi-step tool loop (Phase 3) ────────────────────────────────────────
  // 2+ tools ran for this one turn. Every tool has already been executed (and
  // audited) inside the loop, so there is nothing to run here -- only to
  // render. The model's own closing text is the reply, because it is the only
  // thing that has seen all the steps; the deterministic formatter renders one
  // tool result and cannot summarize a compound action ("created the lead AND
  // booked the visit"). Falls back to formatting the last step if the model
  // returned no usable text (e.g. the loop stopped on its step cap).
  if (plan.kind === 'tool_loop') {
    for (const step of plan.steps) {
      toolResults.push({ tool: step.toolName, input: step.input, result: step.result });
    }
    const lastStep = plan.steps[plan.steps.length - 1];
    const raw = plan.text?.trim();
    let text;
    if (raw && isValidWhatsAppReply(raw)) {
      text = raw;
    } else {
      const lastDecision = decideInteraction(
        { kind: 'tool', toolName: lastStep.toolName, input: lastStep.input },
        lastStep.result,
      );
      text = renderDecision(lastDecision, lastStep.result, null);
    }
    logger.info('agent.tool_loop.rendered', {
      tenantId,
      stepCount: plan.steps.length,
      stopReason: plan.stopReason,
      usedModelText: !!(raw && isValidWhatsAppReply(raw)),
    });
    if (context.principal) await persistTurnState(tenantId, context.principal, toolResults);
    return finish(tenantId, agentId, prompt, context, { text, toolResults }, startMs, plan.kind, lastStep.toolName);
  }

  // ── Stage C: execute the tool ─────────────────────────────────────────────
  if (plan.kind === 'tool' && plan.toolName) {
    instruction = { kind: 'tool', toolName: plan.toolName, input: plan.input || {} };
    if (plan.result !== undefined) {
      // Came from the bounded tool loop, which already executed and audited
      // this call -- reusing its result instead of running the tool a second
      // time (a duplicate create_* here would be a real double-write).
      result = plan.result;
      toolResults.push({ tool: plan.toolName, input: plan.input || {}, result });
    } else {
      notifyToolStart(plan.toolName);
      result = await invokeSkill(tenantId, plan.toolName, plan.input || {}, {
        userId: permissionIdentity,
        fallbackCategory: permissionFallback,
        source: 'agent.pipeline',
      });
      notifyToolEnd(plan.toolName, Boolean(result?.ok));
      toolResults.push({ tool: plan.toolName, input: plan.input || {}, result });
      await logAgentAction(tenantId, agentId, 'tool_call', { toolName: plan.toolName, input: plan.input || {} }, result, 0);
    }

    // Auto-open the single matching record when the user searched by name.
    if (SEARCH_LIST_TOOLS.has(plan.toolName) && result?.ok && shouldAutoOpenAfterSearch(plan.input)) {
      const opened = await autoOpenSingleSearchDetail(tenantId, plan.toolName, result, {
        userId: permissionIdentity,
        fallbackCategory: permissionFallback,
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
    const composed = await composeWithGateway({
      userMessage: prompt,
      personality,
      tenantId,
      toolName: instruction.toolName,
      truncatedPayload: truncated,
      // Phase 4. `context.channel` is set by the channel adapter; WhatsApp
      // turns do not set it and get the default, so their replies are
      // byte-identical to before.
      channel: context.channel || 'whatsapp',
      onApiCall: () => trackGeminiApiCall('composer.generateContent'),
    });
    text = composed || renderDecision(decision, result, null);
  } else {
    text = renderDecision(decision, result, null);
  }

  if (context.principal) await persistTurnState(tenantId, context.principal, toolResults);

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
async function runSingleShotAgent(tenantId, agentId, prompt, systemPrompt, startMs, responseSchema = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;
  if (!apiKey || !modelName) {
    return { ok: false, error: 'llm_not_configured' };
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  // Phase 5b: when a caller supplies a schema, constrain the model to it
  // instead of parsing prose afterwards. These are unattended flows — the
  // qualifier writes a lead score with nobody watching — so "the model
  // probably returned JSON" is not a good enough contract.
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    ...(responseSchema
      ? { generationConfig: { responseMimeType: 'application/json', responseSchema } }
      : {}),
  });
  trackGeminiApiCall('single_shot.generateContent');
  const result = await model.generateContent(prompt);
  let text = '';
  try { text = (result.response.text() || '').trim(); } catch (_) { text = ''; }

  const durationMs = Date.now() - startMs;
  await logAgentAction(tenantId, agentId, 'invoke', { prompt: String(prompt).slice(0, 200) }, { text }, AGENT_ACTION_CREDITS);
  return { ok: true, toolResults: [], result: { text, toolResults: [], durationMs, geminiApiCalls: _geminiApiCallsThisInvoke } };
}

/**
 * A single inbound turn, channel-agnostic. `principal` is the
 * conversation-state/session key (e.g. `wa:<phone>` for WhatsApp, built via
 * server/utils/whatsapp.js buildWhatsAppPrincipal(); a future `web:<userId>`
 * channel would build its own equivalent). Not yet a class/enforced shape --
 * this codebase is plain JS -- just the documented contract the `context`
 * object passed to invokeAgent() is expected to satisfy for a conversational
 * agent. See docs/proposals/agent-channel-architecture/phase2-imp/.
 * @typedef {object} Turn
 * @property {string} tenantId
 * @property {string} [principal]   - session/conversation-state key, e.g. `wa:<phone>`
 * @property {string} [channel]     - e.g. 'whatsapp' (mirrors agentId today; kept
 *                                     distinct for when a channel can host more than one agentId)
 * @property {string} text          - the inbound message text
 * @property {string} [sessionId]   - reserved for a future explicit session identifier;
 *                                     principal is the key in use today
 */

/**
 * Main entry point.
 * @param {string} tenantId
 * @param {string} agentId  - 'whatsapp' (conversational) | 'qualifier' | 'router' | 'followup' | 'mcp'
 * @param {string} prompt
 * @param {object} context  - { userId, source, contactPhone, principal, leadId, ... } -- see the Turn typedef above for the conversational-agent shape
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
      return await runSingleShotAgent(
        tenantId, agentId, prompt, systemPrompt, startMs, context.responseSchema || null,
      );
    }

    // ── Conversational agent (WhatsApp): load history + state ────────────────
    // Two distinct keys: getConversationContext (whatsappConversationService.js,
    // the message log) is still phone-keyed and NOT re-keyed in this slice, so
    // it needs the raw contactPhone. getConversationState (conversationStateService.js)
    // was re-keyed to a principal (e.g. `wa:<phone>`) -- see server/utils/whatsapp.js
    // buildWhatsAppPrincipal(). Callers should pass context.principal explicitly;
    // falling back to deriving it from contactPhone here is a safety net for any
    // caller not yet updated, not the primary path.
    // The web channel has no phone number, so it supplies its own history
    // rather than reading the phone-keyed WhatsApp message log. When a caller
    // provides history explicitly it wins — the lookup below is the WhatsApp
    // path, not a general one.
    let conversationHistory = Array.isArray(context.conversationHistory)
      ? context.conversationHistory
      : [];
    let conversationState = null;
    const principal = context.principal || (context.contactPhone ? buildWhatsAppPrincipal(context.contactPhone) : null);
    // Backfill onto context so runConversationalPipeline's later persistTurnState
    // call (which reads context.principal) sees the resolved value too, even if
    // the caller only passed contactPhone.
    context.principal = principal;
    if (context.contactPhone && conversationHistory.length === 0) {
      try {
        const history = await getConversationContext(tenantId, context.contactPhone, 20);
        if (history.length > 0) {
          conversationHistory = history.map((msg) => ({ role: msg.role, content: msg.content }));
        }
      } catch (err) {
        logger.warn('agent.invoke.conversation_context.failed', { tenantId, contactPhone: context.contactPhone, error: err.message });
      }
    }
    if (principal) {
      try {
        conversationState = await getConversationState(tenantId, principal);
      } catch (err) {
        logger.warn('agent.invoke.conversation_state.failed', { tenantId, principal, error: err.message });
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

// ─── Conversational-turn business logic (Phase 2 Slice 2b) ──────────────────
//
// server/scripts/whatsapp-message-processor.js used to do all of this inline
// before Phase 2 -- the channel adapter's job now shrinks to transport (event
// parsing), dedup (claim lifecycle), and delivery (sending the reply, logging
// the inbound/outbound message). This is split into two functions, not one,
// specifically to preserve a seam the processor needs: it logs the inbound
// message via whatsappConversationService AFTER access-control passes but
// BEFORE the agent runs (and never logs a message that was access-denied) --
// collapsing everything into a single call would either lose that ordering
// or start logging denied messages, both silent behavior changes.
//
// Deliberately separate from invokeAgent() (not folded into it): invokeAgent
// is also called directly for non-conversational agents (qualifier/router/
// followup/mcp — see CONVERSATIONAL_AGENTS), which must NOT inherit
// business-hours/category-access policy that only makes sense for a live
// conversational turn.

/**
 * Step 1: business-hours/pause policy + category-based access control +
 * category resolution + conversation-state bootstrap. Call this first; if it
 * returns `access_denied`, the caller should stop (release its dedup claim,
 * skip logging the message, skip the reply) exactly as before this slice.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.principal     - e.g. `wa:<phone>`, see server/utils/whatsapp.js
 * @param {string} params.contactPhone  - raw phone, passed to whatsappAccessControl/userCategoryService (unchanged contract)
 * @returns {Promise<object>}
 *   `{ outcome: 'access_denied', reason }` or
 *   `{ outcome: 'ready', isAgentPaused, isAutoReplyBlocked, autoReply, category }`
 */
export async function prepareConversationalTurn({ tenantId, principal, contactPhone }) {
  const agencyConfig = await getAgencyConfig(tenantId).catch(() => ({}));
  const autoReply = agencyConfig?.autoReply !== false;
  const inBusinessHours = isWithinBusinessHours(agencyConfig?.businessHoursStart, agencyConfig?.businessHoursEnd, agencyConfig?.timezone || 'Asia/Kolkata');
  const isAgentPaused = !autoReply || !inBusinessHours;

  const aiEmployeeConfig = agencyConfig?.aiEmployee || {};
  const accessCheck = await canReceiveMessage(contactPhone, tenantId, aiEmployeeConfig);
  if (!accessCheck.allowed) {
    return { outcome: 'access_denied', reason: accessCheck.reason };
  }

  const autoReplyCheck = await canAutoReply(contactPhone, tenantId, aiEmployeeConfig);
  const isAutoReplyBlocked = !autoReplyCheck.allowed;

  const category = await resolveCategory(contactPhone, tenantId, {
    messageCount: 1,
    lastInteractionAt: new Date().toISOString(),
    hasLeadCreated: false,
  });
  logger.debug('agent.turn.category_resolved', { tenantId, principal, category });

  try {
    await resetConversationStateIfStale(tenantId, principal, 2, { source: 'whatsapp', category });
    let convState = await getConversationState(tenantId, principal);
    if (!convState) {
      convState = await initializeConversationState(tenantId, principal, { source: 'whatsapp', category });
    }
    await recordMessageInConversation(tenantId, principal);
  } catch (err) {
    logger.warn('agent.turn.conversation_state.failed', { tenantId, principal, error: err.message });
  }

  return { outcome: 'ready', isAgentPaused, isAutoReplyBlocked, autoReply, category };
}

/**
 * Step 2: given the result of prepareConversationalTurn (`ready` outcome),
 * decide whether to invoke the agent and do so, persisting any entities the
 * turn surfaced. Call this after the caller has logged the inbound message.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.principal
 * @param {string} params.contactPhone
 * @param {string} params.text
 * @param {string} params.messageId
 * @param {boolean} params.isAgentPaused
 * @param {boolean} params.isAutoReplyBlocked
 * @param {boolean} params.autoReply
 * @param {string} params.category
 * @returns {Promise<object>} one of:
 *   `{ outcome: 'empty_message' }`
 *   `{ outcome: 'agent_result', ok, error, text, toolCalls }`
 *   `{ outcome: 'agent_invocation_failed' }`
 *   `{ outcome: 'agent_paused', isAutoReplyBlocked, autoReply }`
 *   `{ outcome: 'agents_not_available' }`
 */
export async function runConversationalTurn({ tenantId, principal, contactPhone, text, messageId, isAgentPaused, isAutoReplyBlocked, autoReply, category }) {
  const hasText = text && typeof text === 'string' && text.trim().length > 0;
  if (!hasText) {
    return { outcome: 'empty_message' };
  }

  if (process.env.AGENTS_ENABLED === 'true' && !isAgentPaused && !isAutoReplyBlocked) {
    try {
      const agentResult = await invokeAgent(tenantId, 'whatsapp', text, {
        source: 'whatsapp', from: contactPhone, contactPhone, principal, messageId, category,
      });
      let toolCalls = [];
      if (agentResult.ok) {
        toolCalls = agentResult.result?.toolResults || agentResult.toolResults || [];
        try {
          const currentState = await getConversationState(tenantId, principal);
          if (currentState) {
            const entities = extractEntitiesFromToolResults(toolCalls);
            const { lastListResults, currentEntity } = extractListAndFocusFromToolResults(toolCalls);
            if (entities.length > 0 || lastListResults || currentEntity) {
              await updateLastDiscussedEntities(tenantId, principal, entities, 'crm_query', { lastListResults, currentEntity });
              logger.info('agent.turn.entities_persisted', {
                tenantId,
                principal,
                count: entities.length,
                listCount: lastListResults?.length || 0,
                currentEntity: currentEntity?.name || null,
                entities: entities.map((e) => e.name),
              });
            }
          } else {
            logger.debug('agent.turn.entity_extraction.skipped_no_state', { tenantId, principal });
          }
        } catch (err) {
          logger.warn('agent.turn.entity_extraction.failed', { tenantId, principal, error: err.message });
        }
      }
      return {
        outcome: 'agent_result',
        ok: agentResult.ok,
        error: agentResult.error || null,
        text: agentResult.result?.text || null,
        toolCalls,
      };
    } catch (err) {
      logger.error('agent.turn.agent_failed', { error: err.message, tenantId, principal, stack: err.stack });
      return { outcome: 'agent_invocation_failed' };
    }
  }

  if (isAgentPaused || isAutoReplyBlocked) {
    return { outcome: 'agent_paused', isAutoReplyBlocked, autoReply };
  }

  return { outcome: 'agents_not_available' };
}
