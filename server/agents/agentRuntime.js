/**
 * Agent Runtime — invokes LLM (Bedrock Claude or Gemini) with tool loop.
 * Enforces tenant opt-in (provisioning + config + credits) before invoking.
 */
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getBalance, deductCredits } from '../creditService.js';
import { invokeSkill, ALLOWED_TOOLS, TOOL_SCHEMAS, enrichContextWithLead } from '../skillInvoker.js';
import { logAgentAction } from './agentAuditService.js';
import { buildSystemPrompt } from './prompts.js';
import { getProvisioningByTenant } from '../aiEmployeeProvisioningService.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { getConversationContext } from '../whatsappConversationService.js';
import { getConversationState } from '../conversationStateService.js';
import { metrics } from '../observability/cloudwatch.js';
import { logger } from '../logger.js';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const HAIKU_MODEL = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'bedrock').toLowerCase();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemma-4-26b-a4b-it';
const MAX_TOOL_TURNS = 5;
const AGENT_ACTION_CREDITS = parseInt(process.env.AGENT_ACTION_CREDITS || '15', 10);
const LOCAL_DEV_BYPASS = process.env.NODE_ENV === 'development' || process.env.AI_EMPLOYEE_BYPASS_PROVISIONING === 'true';

/**
 * Consistent hash for gradual rollout.
 * Returns true if tenantId falls within the rollout percentage.
 */
function isEnabledForRollout(tenantId, rolloutPercentage) {
  if (rolloutPercentage >= 100) return true;
  if (rolloutPercentage <= 0) return false;
  const hash = tenantId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a >>> 0;
  }, 0);
  return (hash % 100) < rolloutPercentage;
}

function buildAnthropicToolDefinitions() {
  return ALLOWED_TOOLS.map(tool => {
    const schema = TOOL_SCHEMAS[tool];
    const properties = {};
    if (schema) {
      for (const [key, type] of Object.entries(schema.types)) {
        properties[key] = { type, description: `Parameter: ${key}` };
      }
    }
    return {
      name: tool,
      description: schema?.description
        || (schema
          ? `CRM tool: ${tool.replace(/_/g, ' ')}. Required: ${schema.required.join(', ') || 'none'}.`
          : `Execute CRM operation: ${tool.replace(/_/g, ' ')}`),
      input_schema: {
        type: 'object',
        properties,
        required: schema?.required || [],
      },
    };
  });
}

function buildGeminiToolDefinitions() {
  return ALLOWED_TOOLS.map(tool => {
    const schema = TOOL_SCHEMAS[tool];
    const properties = {};
    if (schema) {
      for (const [key, type] of Object.entries(schema.types)) {
        properties[key] = { type, description: `Parameter: ${key}` };
      }
    }
    return {
      name: tool,
      description: schema?.description
        || (schema
          ? `CRM tool: ${tool.replace(/_/g, ' ')}. Required: ${schema.required.join(', ') || 'none'}.`
          : `Execute CRM operation: ${tool.replace(/_/g, ' ')}`),
      parameters: {
        type: 'object',
        properties,
        required: schema?.required || [],
      },
    };
  });
}

async function invokeBedrockWithTools(messages, systemPrompt) {
  logger.info('agent.llm.request', { model: HAIKU_MODEL, systemPromptLength: systemPrompt.length, messageCount: messages.length });
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: HAIKU_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: systemPrompt,
      tools: buildAnthropicToolDefinitions(),
      messages,
    }),
  }));
  const result = JSON.parse(new TextDecoder().decode(response.body));
  const rawText = result.content?.find(c => c.type === 'text')?.text || '';
  logger.info('agent.llm.response.raw', { stopReason: result.stop_reason, rawTextLength: rawText.length, rawText: rawText.substring(0, 800) });
  return result;
}

async function createGeminiChat(systemPrompt) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
  });
  return model.startChat({
    tools: [{ functionDeclarations: buildGeminiToolDefinitions() }],
  });
}

/**
 * Score a candidate text segment for likelihood of being the actual user-facing response.
 * Higher score = more likely to be the real reply (not reasoning).
 */
function scoreResponseCandidate(text) {
  if (!text || typeof text !== 'string') return -100;
  const trimmed = text.trim();
  if (trimmed.length < 3) return -10;
  if (trimmed.length > 500) return -5;

  const lower = trimmed.toLowerCase();
  let score = 0;

  // Positive signals (actual response characteristics)
  if (trimmed.length >= 10 && trimmed.length <= 250) score += 4;
  if (!trimmed.includes('`')) score += 3; // no tool/code references
  if (!/^\d+[\.\)]\s/.test(trimmed)) score += 2; // not a numbered list item
  if (/[a-zA-Z\u0900-\u097F]/.test(trimmed)) score += 1; // has actual text content

  // Negative signals (reasoning / meta-commentary)
  if (lower.includes('the user said')) score -= 10;
  if (lower.includes('the user asked')) score -= 10;
  if (lower.includes('the user wants')) score -= 10;
  if (lower.includes('i am syncbot')) score -= 10;
  if (lower.includes('my role is')) score -= 10;
  if (lower.includes('as syncbot')) score -= 10;
  if (/^i am\s/i.test(trimmed) && lower.includes('assistant')) score -= 8;
  if (lower.includes('i should') || lower.includes('i need to') || lower.includes('i will')) score -= 6;
  if (lower.includes('check rules') || lower.includes('response rules')) score -= 8;
  if (lower.includes('let\'s go with') || lower.includes('let us go with')) score -= 6;
  if (lower.includes('wait,')) score -= 5;
  if (lower.includes('looking at')) score -= 5;
  if (lower.includes('according to')) score -= 5;
  if (lower.includes('possible response')) score -= 6;
  if (lower.includes('tool returned') || lower.includes('data array')) score -= 6;
  if (lower.includes('recount carefully')) score -= 5;
  if (lower.includes('the information is:')) score -= 6;
  if (lower.includes('i should present') || lower.includes('i should reply')) score -= 6;
  if (lower.includes('i found one') && lower.includes('matching')) score -= 5;
  if (lower.includes('i don\'t have')) score -= 5;
  if (lower.includes('i can see')) score -= 4;
  if (lower.includes('i should ask')) score -= 5;
  if (lower.includes('examples of correct') || lower.includes('examples of wrong')) score -= 7;
  if (lower.includes('i should respond')) score -= 5;
  if (lower.includes('this is strange') || lower.includes('this is odd')) score -= 4;
  if (lower.includes('hmm') || lower.includes('uhh')) score -= 3;

  return score;
}

/**
 * Strip leaked reasoning / meta-commentary from agent replies.
 * Claude Haiku puts the actual response at the end of its output.
 * We extract it by scoring candidate segments and picking the best one.
 */
export function sanitizeAgentReply(text) {
  if (!text || typeof text !== 'string') return text;

  // Try structured JSON output first (whatsapp agent now returns {"thinking":"...","reply":"..."})
  try {
    const trimmed = text.trim();
    // Strip any markdown code fences if present
    const jsonText = trimmed.replace(/^```json\s*|\s*```$/gi, '').trim();
    if (jsonText.startsWith('{')) {
      const parsed = JSON.parse(jsonText);
      if (parsed && typeof parsed.reply === 'string') {
        const reply = parsed.reply.trim();
        if (reply.length > 0) {
          logger.info('agent.sanitize.structured_reply', { replyLength: reply.length, reply });
          return reply;
        }
      }
    }
  } catch (err) {
    // Not valid JSON, fall through to heuristic
  }

  // Quick pass: if text is already clean, return as-is
  if (text.length < 250 && !text.includes('`') && !text.includes('The user') && !text.includes('I should')) {
    return text;
  }

  const candidates = [];

  // Method 1: Split by double newlines, score paragraphs from the end
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  for (let i = paragraphs.length - 1; i >= Math.max(0, paragraphs.length - 6); i--) {
    const score = scoreResponseCandidate(paragraphs[i]);
    // Bonus for being later in the text
    const positionBonus = ((i + 1) / paragraphs.length) * 2;
    candidates.push({ text: paragraphs[i], score: score + positionBonus, method: 'paragraph' });
  }

  // Method 2: Split by sentences, score from the end
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  for (let i = sentences.length - 1; i >= Math.max(0, sentences.length - 12); i--) {
    const s = sentences[i].trim();
    const score = scoreResponseCandidate(s);
    const positionBonus = ((i + 1) / sentences.length) * 1.5;
    candidates.push({ text: s, score: score + positionBonus, method: 'sentence' });
  }

  // Method 3: Look for quoted text that appears at the very end (Claude drafts in quotes)
  const quoteMatches = [...text.matchAll(/"([^"]{5,200})"/g)];
  if (quoteMatches.length > 0) {
    const lastQuote = quoteMatches[quoteMatches.length - 1][1];
    const lastQuotePos = text.lastIndexOf('"' + lastQuote + '"');
    if (lastQuotePos >= 0) {
      const afterQuote = text.substring(lastQuotePos + lastQuote.length + 2).trim();
      // If the quoted text appears again right after the quote, it's the final response
      if (afterQuote.startsWith(lastQuote) || afterQuote.length < 3) {
        candidates.push({ text: lastQuote, score: 15, method: 'quoted' });
      }
    }
  }

  // Pick the best candidate
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best.score > 0) {
      return best.text;
    }
  }

  // Ultimate fallback: last non-empty line under 300 chars without backticks
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].length < 300 && !lines[i].includes('`')) {
      return lines[i];
    }
  }

  return text;
}

async function runGeminiLoop(chat, prompt, tenantId, agentId, context, historyMessages = []) {
  // Prepend conversation history to prompt for Gemini (simpler than rebuilding chat session)
  let fullPrompt = prompt;
  if (historyMessages.length > 0) {
    const historyText = historyMessages
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n');
    fullPrompt = `${historyText}\n\nUser: ${prompt}`;
  }
  let result = await chat.sendMessage(fullPrompt);
  const toolResults = [];
  let lastText = '';

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = result.response;
    const text = response.text();
    if (text) lastText = text;

    const functionCalls = response.functionCalls();
    if (!functionCalls || functionCalls.length === 0) break;

    const call = functionCalls[0];
    const toolName = call.name;
    const toolInput = call.args || {};

    let toolResult;
    if (ALLOWED_TOOLS.includes(toolName)) {
      toolResult = await invokeSkill(tenantId, toolName, toolInput, { userId: context.userId });
      toolResults.push({ tool: toolName, result: toolResult });
      await logAgentAction(tenantId, agentId, 'tool_call', { toolName, input: toolInput }, toolResult, 0);
    } else {
      toolResult = { error: `Tool '${toolName}' not in allowed list` };
      logger.warn('agent.invoke.unauthorized_tool', { tenantId, agentId, toolName });
    }

    result = await chat.sendMessage([{
      functionResponse: {
        name: toolName,
        response: toolResult,
      },
    }]);
  }

  return { text: sanitizeAgentReply(lastText), toolResults: toolResults.length > 0 ? toolResults : undefined };
}

async function runBedrockLoop(prompt, systemPrompt, tenantId, agentId, context, historyMessages = []) {
  const messages = [
    ...historyMessages,
    { role: 'user', content: prompt },
  ];
  const toolResults = [];
  let lastText = '';

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const result = await invokeBedrockWithTools(messages, systemPrompt);
    const stopReason = result.stop_reason;
    const content = result.content || [];

    const textPart = content.find(c => c.type === 'text');
    if (textPart) lastText = textPart.text;

    if (stopReason !== 'tool_use') break;

    const toolUseBlock = content.find(c => c.type === 'tool_use');
    if (!toolUseBlock) break;

    const toolName = toolUseBlock.name;
    const toolInput = toolUseBlock.input?.input || toolUseBlock.input || {};

    let toolResult;
    if (ALLOWED_TOOLS.includes(toolName)) {
      toolResult = await invokeSkill(tenantId, toolName, toolInput, { userId: context.userId });
      toolResults.push({ tool: toolName, result: toolResult });
      await logAgentAction(tenantId, agentId, 'tool_call', { toolName, input: toolInput }, toolResult, 0);
    } else {
      toolResult = { error: `Tool '${toolName}' not in allowed list` };
      logger.warn('agent.invoke.unauthorized_tool', { tenantId, agentId, toolName });
    }

    messages.push({ role: 'assistant', content });
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUseBlock.id,
        content: JSON.stringify(toolResult),
      }],
    });
  }

  const sanitized = sanitizeAgentReply(lastText);
  logger.info('agent.llm.response.final', { rawTextLength: lastText?.length, rawText: lastText?.substring(0, 800), sanitizedTextLength: sanitized?.length, sanitizedText: sanitized?.substring(0, 800), toolCalls: toolResults.length });
  return { text: sanitized, toolResults: toolResults.length > 0 ? toolResults : undefined };
}

/**
 * Main entry point.
 * @param {string} tenantId
 * @param {string} agentId  - 'qualifier' | 'router' | 'followup' | 'whatsapp' | 'mcp'
 * @param {string} prompt   - User/system prompt
 * @param {object} context  - Optional: { userId, source, leadId, ... }
 */
export async function invokeAgent(tenantId, agentId, prompt, context = {}) {
  // 1. Global kill-switch
  if (process.env.AGENTS_ENABLED !== 'true') {
    logger.info('agent.invoke.disabled', { tenantId, agentId });
    return { ok: false, error: 'agents_disabled' };
  }

  // 2. Gradual rollout check
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

  // Load agency config to get personality setting (reuse if already fetched)
  if (!agencyConfig) {
    try {
      agencyConfig = await getAgencyConfig(tenantId);
    } catch (err) {
      logger.warn('agent.invoke.getAgencyConfig.failed', { tenantId, agentId, error: err.message });
    }
  }
  // WhatsApp agent defaults to friendly/Hinglish; other agents remain professional
  const defaultPersonality = agentId === 'whatsapp' ? 'friendly' : 'professional';
  const personality = agencyConfig?.aiPersonality || defaultPersonality;

  // Load conversation context if contact phone is provided
  let systemPrompt = buildSystemPrompt(agentId, tenantId, personality);
  let conversationHistory = [];
  let conversationState = null;
  if (context.contactPhone) {
    try {
      const history = await getConversationContext(tenantId, context.contactPhone, 20);
      if (history.length > 0) {
        conversationHistory = history.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));
        logger.info('agent.conversation.history_loaded', { tenantId, contactPhone: context.contactPhone, count: conversationHistory.length });
      }
    } catch (err) {
      logger.warn('agent.invoke.conversation_context.failed', { tenantId, contactPhone: context.contactPhone, error: err.message });
      // Continue without context if loading fails
    }

    // Load conversation state (topic, last discussed entities) for multi-turn coherence
    try {
      conversationState = await getConversationState(tenantId, context.contactPhone);
    } catch (err) {
      logger.warn('agent.invoke.conversation_state.failed', { tenantId, contactPhone: context.contactPhone, error: err.message });
    }
  }

  // Append conversation state to system prompt for context-aware replies
  if (conversationState) {
    const MAX_CONTEXT_ENTITIES = 3;
    const MAX_PROMPT_FIELD_LEN = 100;
    const lastEntities = conversationState.context?.lastDiscussedEntities || [];
    const stateLines = [];
    if (conversationState.intent) {
      stateLines.push(`Current intent: ${String(conversationState.intent).replace(/[\n\r\t]/g, '').slice(0, MAX_PROMPT_FIELD_LEN)}`);
    }
    if (conversationState.topic) {
      stateLines.push(`Current topic: ${String(conversationState.topic).replace(/[\n\r\t]/g, '').slice(0, MAX_PROMPT_FIELD_LEN)}`);
    }
    if (lastEntities.length > 0) {
      stateLines.push('Last discussed entities (use these when user says "this", "his", "her", "iska", etc.):');
      for (const e of lastEntities.slice(0, MAX_CONTEXT_ENTITIES)) {
        if (!e || typeof e !== 'object') continue;
        const type = String(e.type || 'unknown').replace(/[\n\r\t]/g, '').slice(0, MAX_PROMPT_FIELD_LEN);
        const name = String(e.name || 'Unknown').replace(/[\n\r\t]/g, '').slice(0, MAX_PROMPT_FIELD_LEN);
        const id = e.id ? ` (ID: ${String(e.id).replace(/[\n\r\t]/g, '').slice(0, MAX_PROMPT_FIELD_LEN)})` : '';
        const phone = e.phone ? ` (Phone: ${String(e.phone).replace(/[\n\r\t]/g, '').slice(0, 20)})` : '';
        stateLines.push(`- ${type}: ${name}${id}${phone}`);
      }
    }
    if (stateLines.length > 0) {
      systemPrompt += `\n\nCONVERSATION STATE:\n${stateLines.join('\n')}\nWhen the user refers to "this", "that", "his/her", "iska/iski", or similar pronouns, assume they mean the most relevant entity from the list above.`;
    }
  }

  logger.info('agent.system_prompt', { agentId, tenantId, personality, systemPromptLength: systemPrompt.length, systemPrompt: systemPrompt.substring(0, 500) + '...' });

  // Load lead context if leadId is provided
  if (context.leadId) {
    try {
      const leadContext = await enrichContextWithLead(tenantId, context.leadId);
      if (Object.keys(leadContext).length > 0) {
        const leadStr = `
Lead Information:
- Name: ${leadContext.leadName || 'N/A'}
- Phone: ${leadContext.leadPhone || 'N/A'}
- Email: ${leadContext.leadEmail || 'N/A'}
- Type: ${leadContext.leadType || 'N/A'}
- Score: ${leadContext.leadScore || 'N/A'}
- Source: ${leadContext.leadSource || 'N/A'}
- Status: ${leadContext.leadStatus || 'N/A'}
${leadContext.notes && leadContext.notes.length > 0 ? `- Recent Notes: ${leadContext.notes.join('; ')}` : ''}`;
        systemPrompt += `\n${leadStr}`;
      }
    } catch (err) {
      logger.warn('agent.invoke.lead_context.failed', { tenantId, leadId: context.leadId, error: err.message });
      // Continue without context if loading fails
    }
  }

  const startMs = Date.now();

  try {
    let output;
    if (LLM_PROVIDER === 'gemini') {
      const chat = await createGeminiChat(systemPrompt);
      output = await runGeminiLoop(chat, prompt, tenantId, agentId, context, conversationHistory);
    } else {
      output = await runBedrockLoop(prompt, systemPrompt, tenantId, agentId, context, conversationHistory);
    }

    const durationMs = Date.now() - startMs;
    await logAgentAction(tenantId, agentId, 'invoke', { prompt: prompt.slice(0, 200), context }, { text: output.text, toolResults: output.toolResults }, AGENT_ACTION_CREDITS);

    try { await metrics.agentActionInvoked(tenantId, agentId); } catch (_) {}

    return {
      ok: true,
      result: {
        text: output.text,
        toolResults: output.toolResults,
        durationMs,
      },
    };
  } catch (err) {
    logger.error('agent.invoke.failed', { tenantId, agentId, provider: LLM_PROVIDER, error: err.message });
    try { await metrics.agentActionFailed(tenantId, agentId); } catch (_) {}
    await logAgentAction(tenantId, agentId, 'invoke', { prompt: prompt.slice(0, 200) }, { error: err.message }, AGENT_ACTION_CREDITS);
    return { ok: false, error: err.message };
  }
}
