/**
 * Bounded tool loop (Phase 3) — the fix for "complete a whole task from
 * WhatsApp in one exchange".
 *
 * The single-shot planner (llm/planTurn.js) takes `functionCalls[0]` and
 * discards the rest, so a compound request ("create a lead for Rajesh AND
 * schedule a site visit tomorrow") is impossible by construction: the second
 * half of the request is silently dropped. This module keeps calling the
 * model, feeding each tool result back, until the model produces a final
 * answer or a bound is hit.
 *
 * Two bounds, both hard:
 *   - step cap (AGENT_TOOL_LOOP_MAX_STEPS, default 6)
 *   - wall-clock budget (AGENT_TOOL_LOOP_BUDGET_MS, default 25000)
 * Whichever trips first stops the loop; whatever tool results were gathered
 * up to that point are still returned, so a bounded-out turn degrades to a
 * partial answer rather than an error.
 *
 * planTurn.js is deliberately NOT modified or replaced by this file. Both
 * exist side by side and agentRuntime.js picks one per turn based on
 * AGENT_TOOL_LOOP_ENABLED, so the single-shot path stays available and
 * byte-identical for rollback. See docs/proposals/agent-channel-architecture/
 * phase3-imp/01-slice3a-bounded-tool-loop.md.
 *
 * Tool execution is injected (`executeTool`) rather than imported, so this
 * module is unit-testable without DynamoDB and so the caller keeps ownership
 * of permissions/audit (agentRuntime.js passes a closure over invokeSkill).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ALLOWED_TOOL_NAMES, TOOL_SCHEMAS } from '../../shared/toolDefinitions.js';
import { normalizeToolInput } from '../inputNormalizer.js';
import { buildGeminiToolDefinitions, normalizeGeminiToolName } from '../geminiToolDeclarations.js';
import { buildPlannerSystemPrompt } from './plannerPrompt.js';
import { createGeminiLogSession } from '../geminiFileLogger.js';
import { logger } from '../../logger.js';

const ALLOWED = new Set(ALLOWED_TOOL_NAMES);

const DEFAULT_MAX_STEPS = parseInt(process.env.AGENT_TOOL_LOOP_MAX_STEPS || '6', 10);
const DEFAULT_BUDGET_MS = parseInt(process.env.AGENT_TOOL_LOOP_BUDGET_MS || '25000', 10);

function requireEnv(name, value) {
  if (!value) throw new Error(`${name} environment variable is required for LLM pipeline`);
  return value;
}

function buildUserPayload(message, historyMessages = []) {
  if (!historyMessages.length) return message;
  const historyText = historyMessages
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n');
  return `${historyText}\n\nUser: ${message}`;
}

function missingRequired(toolName, input) {
  const schema = TOOL_SCHEMAS[toolName];
  const required = schema?.required || [];
  return required.filter((r) => input[r] === undefined || input[r] === null || input[r] === '');
}

/**
 * Validate + normalize one model-proposed call into something executable.
 *
 * ORDER MATTERS: required fields are checked against the args AS THE MODEL
 * PROVIDED THEM, before normalizeToolInput() runs. normalizeToolInput
 * renames/removes fields -- create_meeting/update_meeting's `scheduledDate`
 * is mapped to meetingDate+meetingTime and then deleted -- so checking
 * required-ness afterwards rejects every correctly-formed call that used the
 * documented field name. planTurn.js had exactly this inverted and therefore
 * answered "I need a bit more info to do that: scheduledDate" to every single
 * meeting-creation request; same root cause as the skillInvoker.js bug fixed
 * in Phase 1 (see phase1-imp/07-bugs-found.md #1), which turned out to be
 * necessary but not sufficient because the planner short-circuits first.
 *
 * @returns {{ ok: true, toolName: string, input: object } | { ok: false, reason: string }}
 */
function prepareCall(rawName, rawArgs) {
  const toolName = normalizeGeminiToolName(rawName);
  if (!ALLOWED.has(toolName)) {
    return { ok: false, reason: `Tool not allowed: ${toolName}` };
  }
  const rawInput = rawArgs && typeof rawArgs === 'object' ? { ...rawArgs } : {};
  const missing = missingRequired(toolName, rawInput);
  if (missing.length > 0) {
    return { ok: false, reason: `Missing required parameter(s): ${missing.join(', ')}` };
  }
  return { ok: true, toolName, input: normalizeToolInput(toolName, rawInput) };
}

/**
 * Run a bounded tool loop for one conversational turn.
 *
 * @param {string} message
 * @param {object} options
 * @param {string} options.tenantId
 * @param {(toolName: string, input: object) => Promise<object>} options.executeTool
 *   Executes one tool and resolves to the `{ok, data, error}` envelope.
 * @param {(toolName: string, result: object) => object} [options.truncateForModel]
 *   Shrinks a tool result before it goes back to the model (token control).
 * @param {string} [options.personality]
 * @param {object|null} [options.conversationState]
 * @param {Array<{role:string,content:string}>} [options.historyMessages]
 * @param {string[]|null} [options.toolNames]
 * @param {string[]} [options.domains]
 * @param {boolean} [options.allowScopeEscalation]
 *   When true (Phase 3 Slice 3b), a first step that produces no tool call is
 *   treated as "the router scoped us to the wrong domain" rather than "there
 *   is nothing to do": the turn retries once with the FULL tool registry.
 * @param {() => void} [options.onApiCall]
 * @param {number} [options.maxSteps]
 * @param {number} [options.budgetMs]
 * @returns {Promise<object>} one of:
 *   `{ kind: 'chat', text }`                         — model answered with no tool call
 *   `{ kind: 'clarify', text }`                      — nothing actionable
 *   `{ kind: 'tool', toolName, input, result, steps, stopReason }`
 *        — exactly ONE tool ran; shaped so the caller can render it through
 *          the existing deterministic formatter path unchanged
 *   `{ kind: 'tool_loop', steps, text, stopReason }`  — 2+ tools ran
 */
export async function runToolLoop(message, options = {}) {
  const {
    tenantId,
    executeTool,
    truncateForModel = (_toolName, result) => result,
    personality = 'friendly',
    conversationState = null,
    historyMessages = [],
    toolNames = null,
    domains = [],
    allowScopeEscalation = false,
    onApiCall,
    maxSteps = DEFAULT_MAX_STEPS,
    budgetMs = DEFAULT_BUDGET_MS,
  } = options;

  if (typeof executeTool !== 'function') {
    throw new Error('runToolLoop requires an executeTool function');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;
  requireEnv('GEMINI_API_KEY', apiKey);
  requireEnv('GEMINI_MODEL', modelName);

  const startedAt = Date.now();
  const systemInstruction = buildPlannerSystemPrompt(tenantId, personality, conversationState, domains);
  const userPayload = buildUserPayload(message, historyMessages);
  const functionDeclarations = buildGeminiToolDefinitions(toolNames);

  const geminiLog = createGeminiLogSession({ tenantId, agentId: 'planner', kind: 'tool_loop' });
  await geminiLog?.writeInput({
    type: 'tool_loop',
    model: modelName,
    systemInstruction,
    userPrompt: userPayload,
    tools: [{ functionDeclarations }],
    domains,
    maxSteps,
    budgetMs,
  });

  const genAI = new GoogleGenerativeAI(apiKey);
  const buildChat = (declarations) => genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    tools: [{ functionDeclarations: declarations }],
  }).startChat();

  let chat = buildChat(functionDeclarations);
  // Scope escalation (Slice 3b): the router narrows the tool list before the
  // planner runs, so a wrong domain guess used to be unrecoverable -- the
  // planner physically did not have the right tool and could only give up.
  // Escalation is only possible when the router actually narrowed something.
  let escalated = false;
  const canEscalate = allowScopeEscalation && Array.isArray(toolNames) && toolNames.length > 0;

  /** @type {Array<{toolName: string, input: object, result: object}>} */
  const steps = [];
  let finalText = '';
  let stopReason = 'done';
  let pendingMessage = userPayload;

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    if (Date.now() - startedAt > budgetMs) {
      stopReason = 'time_budget';
      break;
    }

    onApiCall?.();
    const result = await chat.sendMessage(pendingMessage);
    const response = result.response;

    let text = '';
    try {
      text = (response.text() || '').trim();
    } catch (_) {
      text = '';
    }
    const functionCalls = response.functionCalls?.() || [];

    // No tool calls -> either the model is done, or it was scoped to the
    // wrong domain and had nothing it could call.
    if (functionCalls.length === 0) {
      if (!escalated && canEscalate && steps.length === 0) {
        // Nothing ran and the router had narrowed the tool list: retry once
        // against the FULL registry instead of failing closed. Costs one
        // extra round-trip, but only on turns that were going to fail
        // anyway. Logged so the escalation rate becomes router eval data.
        escalated = true;
        logger.info('agent.tool_loop.scope_escalation', {
          tenantId,
          domains,
          scopedToolCount: toolNames.length,
          modelText: text.slice(0, 120),
        });
        chat = buildChat(buildGeminiToolDefinitions(null));
        pendingMessage = userPayload;
        continue;
      }
      finalText = text;
      stopReason = 'done';
      break;
    }

    // Execute EVERY call the model asked for in this response, not just the
    // first -- parallel calls in a single response were previously dropped
    // by planTurn.js's `functionCalls[0]`.
    const functionResponses = [];
    for (const call of functionCalls) {
      const prepared = prepareCall(call.name, call.args);
      if (!prepared.ok) {
        // Hand the refusal back to the model rather than aborting the turn:
        // it can correct itself (ask the user, or pick a different tool)
        // within the remaining step budget.
        logger.warn('agent.tool_loop.call_rejected', { tenantId, step: stepIndex, name: call.name, reason: prepared.reason });
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { ok: false, error: prepared.reason },
          },
        });
        continue;
      }

      const { toolName, input } = prepared;
      let toolResult;
      try {
        toolResult = await executeTool(toolName, input);
      } catch (err) {
        logger.error('agent.tool_loop.tool_threw', { tenantId, step: stepIndex, toolName, error: err.message });
        toolResult = { ok: false, error: err.message };
      }
      steps.push({ toolName, input, result: toolResult });
      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: truncateForModel(toolName, toolResult),
        },
      });
    }

    pendingMessage = functionResponses;

    // Ran out of steps with tool calls still pending -- stop, but keep
    // whatever we gathered.
    if (stepIndex === maxSteps - 1) {
      stopReason = 'step_cap';
    }
  }

  const durationMs = Date.now() - startedAt;
  let plan;
  if (steps.length === 0) {
    plan = finalText
      ? { kind: 'chat', text: finalText }
      : {
        kind: 'clarify',
        text: 'Sorry, I did not catch that. Try something like "show new leads" or "how many buyers".',
      };
  } else if (steps.length === 1) {
    // Exactly one tool ran: return the same shape the single-shot planner
    // returns so the caller renders it through the existing deterministic
    // formatter, byte-identical to pre-Phase-3 behavior for this (common) case.
    plan = {
      kind: 'tool',
      toolName: steps[0].toolName,
      input: steps[0].input,
      result: steps[0].result,
      steps,
      stopReason,
      text: finalText || null,
    };
  } else {
    plan = { kind: 'tool_loop', steps, text: finalText || null, stopReason };
  }

  await geminiLog?.writeOutput({
    type: 'tool_loop_response',
    model: modelName,
    stepCount: steps.length,
    stopReason,
    durationMs,
    steps: steps.map((s) => ({ toolName: s.toolName, input: s.input, ok: s.result?.ok })),
    text: finalText,
    planKind: plan.kind,
  });

  logger.info('agent.tool_loop.result', {
    tenantId,
    stepCount: steps.length,
    stopReason,
    durationMs,
    escalated,
    toolNames: steps.map((s) => s.toolName),
    planKind: plan.kind,
    hasText: !!finalText,
  });

  return plan;
}
