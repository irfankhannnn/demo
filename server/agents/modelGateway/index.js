/**
 * Model gateway (Phase 2 Slice 2c) — the classify()/plan()/compose()
 * interface server/agents/agentRuntime.js calls into, instead of importing
 * domainRouter.js/llm/planTurn.js/llm/composeReply.js directly.
 *
 * This is deliberately a thin, behavior-preserving wrapper, not a rewrite:
 * the three functions below just forward their arguments to the existing,
 * unchanged, independently-tested implementations. The Gemini path (each of
 * those three files independently constructing its own GoogleGenerativeAI
 * client, including domainRouter.js's own GEMINI_CLASSIFIER_MODEL env
 * fallback and planTurn's throw-on-missing-key vs. the other two returning
 * null) is untouched -- it's "the one adapter" behind this seam, exactly as
 * docs/proposals/agent-channel-architecture/03-implementation-plan.md's
 * Phase 2 describes. A future non-Gemini adapter would be added here later,
 * without agentRuntime.js needing to change at all.
 *
 * The onApiCall callback convention is forwarded through unchanged in all
 * three -- agentRuntime.js's trackGeminiApiCall() wiring (each call site
 * passes `onApiCall: () => trackGeminiApiCall('<reason>.generateContent')`)
 * depends on it being invoked at the same point relative to the network
 * call as before, and this seam doesn't touch that, since it never calls
 * onApiCall itself -- it just passes `opts`/`params` straight through.
 *
 * See docs/proposals/agent-channel-architecture/phase2-imp/
 * 03-slice2c-model-gateway.md for what shipped and how it was verified.
 */
import { routeDomains } from '../domainRouter.js';
import { planTurn } from '../llm/planTurn.js';
import { runToolLoop } from '../llm/runToolLoop.js';
import { composeReply } from '../llm/composeReply.js';

/**
 * Classify a message into CRM domain(s) (or smalltalk). Delegates to
 * domainRouter.js's routeDomains(), which itself has a rules fast-path and
 * only calls Gemini when the fast-path can't decide.
 * @param {string} message
 * @param {object} opts - { conversationState, onApiCall }
 * @returns {Promise<{domains: string[], smalltalk: boolean, source: string}>}
 */
export function classify(message, opts) {
  return routeDomains(message, opts);
}

/**
 * Plan a turn: one scoped tool call, or a chat/clarify reply. Delegates to
 * llm/planTurn.js's planTurn() unchanged.
 * @param {string} message
 * @param {object} opts - { tenantId, personality, conversationState, historyMessages, toolNames, domains, onApiCall }
 * @returns {Promise<{kind: 'chat'|'clarify'|'tool', text?: string, toolName?: string, input?: object}>}
 */
export function plan(message, opts) {
  return planTurn(message, opts);
}

/**
 * Plan AND execute a turn as a bounded multi-step tool loop (Phase 3).
 * Delegates to llm/runToolLoop.js unchanged. Unlike plan(), this one also
 * runs the tools (via the injected `executeTool`), because the model needs
 * each result fed back before it can decide the next step.
 * @param {string} message
 * @param {object} opts - plan()'s options plus { executeTool, truncateForModel, maxSteps, budgetMs }
 * @returns {Promise<object>} `{kind:'chat'|'clarify'|'tool'|'tool_loop', ...}`
 */
export function planAndRun(message, opts) {
  return runToolLoop(message, opts);
}

/**
 * Compose a natural-language reply from a tool result. Delegates to
 * llm/composeReply.js's composeReply() unchanged.
 * @param {object} params - { userMessage, personality, tenantId, toolName, toolResult, truncatedPayload, channel, onApiCall }
 *   `channel` ('whatsapp' | 'web') selects the length budget and formatting
 *   vocabulary only — never the facts. Defaults to 'whatsapp' downstream.
 * @returns {Promise<string|null>}
 */
export function compose(params) {
  return composeReply(params);
}
