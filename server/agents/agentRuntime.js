/**
 * Agent Runtime — invokes Bedrock Claude Haiku with tool loop.
 * Enforces tenant opt-in (provisioning + config + credits) before invoking.
 */
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBalance, deductCredits } from '../creditService.js';
import { invokeSkill, ALLOWED_TOOLS } from '../skillInvoker.js';
import { logAgentAction } from './agentAuditService.js';
import { buildSystemPrompt } from './prompts.js';
import { getProvisioningByTenant } from '../aiEmployeeProvisioningService.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { metrics } from '../observability/cloudwatch.js';
import { logger } from '../logger.js';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const HAIKU_MODEL = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
const MAX_TOOL_TURNS = 5;
const AGENT_ACTION_CREDITS = parseInt(process.env.AGENT_ACTION_CREDITS || '15', 10);

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

function buildToolDefinitions() {
  return ALLOWED_TOOLS.map(tool => ({
    name: tool,
    description: `Execute CRM operation: ${tool.replace(/_/g, ' ')}`,
    input_schema: {
      type: 'object',
      properties: {
        input: { type: 'object', description: 'Parameters for this CRM operation' },
      },
      required: [],
    },
  }));
}

async function invokeBedrockWithTools(messages, systemPrompt) {
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: HAIKU_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: systemPrompt,
      tools: buildToolDefinitions(),
      messages,
    }),
  }));
  return JSON.parse(new TextDecoder().decode(response.body));
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

  // 3. Provisioning check (Razorpay subscription paid + activated)
  const provisioning = await getProvisioningByTenant(tenantId);
  if (!provisioning || provisioning.status !== 'live') {
    logger.warn('agent.invoke.not_provisioned', { tenantId, agentId, status: provisioning?.status });
    return { ok: false, error: 'ai_employee_not_provisioned', status: provisioning?.status };
  }

  // 4. Tenant config check (explicitly enabled by admin)
  const agencyConfig = await getAgencyConfig(tenantId);
  if (!agencyConfig?.aiEmployeeEnabled) {
    logger.warn('agent.invoke.disabled_by_tenant', { tenantId, agentId });
    return { ok: false, error: 'ai_employee_disabled_by_tenant' };
  }

  // 5. Credit check
  const balance = await getBalance(tenantId);
  if (balance < AGENT_ACTION_CREDITS) {
    logger.warn('agent.invoke.insufficient_credits', { tenantId, agentId, balance, required: AGENT_ACTION_CREDITS });
    try { await metrics.creditInsufficient(tenantId); } catch (_) {}
    return { ok: false, error: 'insufficient_credits', balance };
  }

  // 6. Deduct credits upfront (atomic, non-refundable)
  try {
    await deductCredits(tenantId, AGENT_ACTION_CREDITS, 'agent_action', { reason: 'bedrock_invoke', agentId });
  } catch (err) {
    logger.error('agent.invoke.credit_deduction_failed', { tenantId, agentId, error: err.message });
    return { ok: false, error: 'credit_deduction_failed' };
  }

  const systemPrompt = buildSystemPrompt(agentId, tenantId);
  const messages = [{ role: 'user', content: prompt }];
  const toolResults = [];
  let lastText = '';
  const startMs = Date.now();

  try {
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

    const durationMs = Date.now() - startMs;
    await logAgentAction(tenantId, agentId, 'invoke', { prompt: prompt.slice(0, 200), context }, { text: lastText, toolResults }, AGENT_ACTION_CREDITS);

    try { await metrics.agentActionInvoked(tenantId, agentId); } catch (_) {}

    return {
      ok: true,
      result: {
        text: lastText,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        durationMs,
      },
    };
  } catch (err) {
    logger.error('agent.invoke.failed', { tenantId, agentId, error: err.message });
    try { await metrics.agentActionFailed(tenantId, agentId); } catch (_) {}
    await logAgentAction(tenantId, agentId, 'invoke', { prompt: prompt.slice(0, 200) }, { error: err.message }, AGENT_ACTION_CREDITS);
    return { ok: false, error: err.message };
  }
}

// Legacy shim: old callers that don't pass agentId
export async function invokeAgentLegacy(tenantId, prompt, context = {}) {
  return invokeAgent(tenantId, context.agentId || 'whatsapp', prompt, context);
}
