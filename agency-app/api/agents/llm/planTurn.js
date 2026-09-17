/**
 * LLM planner — one Gemini turn with function calling (no regex NLU).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ALLOWED_TOOL_NAMES, TOOL_SCHEMAS } from '../../shared/toolDefinitions.js';
import { normalizeToolInput } from '../inputNormalizer.js';
import { buildGeminiToolDefinitions, normalizeGeminiToolName } from '../geminiToolDeclarations.js';
import { buildPlannerSystemPrompt } from './plannerPrompt.js';
import { createGeminiLogSession } from '../geminiFileLogger.js';
import { logger } from '../../logger.js';

const ALLOWED = new Set(ALLOWED_TOOL_NAMES);

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
 * @param {string} message
 * @param {object} options
 * @param {string} options.tenantId
 * @param {string} [options.personality]
 * @param {object|null} [options.conversationState]
 * @param {Array<{role:string,content:string}>} [options.historyMessages]
 * @param {() => void} [options.onApiCall]
 * @returns {Promise<{ kind: 'chat'|'clarify'|'tool', text?: string, toolName?: string, input?: object }>}
 */
export async function planTurn(message, options = {}) {
  const {
    tenantId,
    personality = 'friendly',
    conversationState = null,
    historyMessages = [],
    toolNames = null,
    domains = [],
    onApiCall,
  } = options;

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;
  requireEnv('GEMINI_API_KEY', apiKey);
  requireEnv('GEMINI_MODEL', modelName);

  const systemInstruction = buildPlannerSystemPrompt(tenantId, personality, conversationState, domains);
  const userPayload = buildUserPayload(message, historyMessages);
  // Scope the function declarations to the routed domain(s) so the planner only
  // ever sees the relevant handful of tools (not all 60+).
  const functionDeclarations = buildGeminiToolDefinitions(toolNames);

  const geminiLog = createGeminiLogSession({
    tenantId,
    agentId: 'planner',
    kind: 'planner',
  });
  await geminiLog?.writeInput({
    type: 'generate_content',
    model: modelName,
    systemInstruction,
    userPrompt: userPayload,
    tools: [{ functionDeclarations }],
    domains,
  });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    tools: [{ functionDeclarations }],
  });

  onApiCall?.();
  const result = await model.generateContent(userPayload);
  const response = result.response;
  let text = '';
  try {
    text = (response.text() || '').trim();
  } catch (_) {
    text = '';
  }
  const functionCalls = response.functionCalls?.() || [];
  const rawFunctionCalls = functionCalls.map((fc) => ({
    name: fc.name,
    args: fc.args && typeof fc.args === 'object' ? { ...fc.args } : fc.args,
  }));

  let plan = null;
  if (functionCalls.length > 0) {
    const call = functionCalls[0];
    const toolName = normalizeGeminiToolName(call.name);
    let input = call.args && typeof call.args === 'object' ? { ...call.args } : {};

    if (!ALLOWED.has(toolName)) {
      plan = {
        kind: 'clarify',
        text: 'I cannot run that action. Could you rephrase what you need from the CRM?',
      };
    } else {
      // ORDER MATTERS: check required fields against the args AS THE MODEL
      // PROVIDED THEM, before normalizeToolInput() runs. normalizeToolInput
      // renames/removes fields -- create_meeting/update_meeting's
      // `scheduledDate` is mapped to meetingDate+meetingTime and then
      // deleted -- so validating afterwards rejected every correctly-formed
      // meeting request with "I need a bit more info to do that:
      // scheduledDate". Same root cause as the skillInvoker.js bug fixed in
      // Phase 1 (phase1-imp/07-bugs-found.md #1); this planner-level copy
      // short-circuits before the executor is ever reached, so that fix
      // alone did not make meeting creation work.
      const missing = missingRequired(toolName, input);
      if (missing.length > 0) {
        plan = {
          kind: 'clarify',
          text: `I need a bit more info to do that: ${missing.join(', ')}.`,
        };
      } else {
        plan = { kind: 'tool', toolName, input: normalizeToolInput(toolName, input) };
      }
    }
  } else if (text) {
    plan = { kind: 'chat', text };
  } else {
    plan = {
      kind: 'clarify',
      text: 'Sorry, I did not catch that. Try something like "show new leads" or "how many buyers".',
    };
  }

  await geminiLog?.writeOutput({
    type: 'generate_content_response',
    model: modelName,
    text,
    functionCalls: rawFunctionCalls,
    plan,
  });

  logger.info('agent.planner.result', {
    tenantId,
    hasText: !!text,
    textPreview: text.slice(0, 120),
    functionCallCount: functionCalls.length,
    functionNames: functionCalls.map((fc) => fc.name),
    planKind: plan?.kind,
    toolName: plan?.toolName,
    toolInput: plan?.input,
  });

  return plan;
}
