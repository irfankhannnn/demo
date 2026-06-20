import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBalance, deductCredits } from '../creditService.js';
import { getCosts } from '../creditConfig.js';
import { invokeSkill, ALLOWED_TOOLS } from '../skillInvoker.js';
import { logAgentAction } from '../agentAuditService.js';
import { logger } from '../logger.js';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const HAIKU_MODEL = 'anthropic.claude-3-haiku-20240307-v1:0';

function buildSystemPrompt(tenantId) {
  return `You are SyncBot, an AI assistant for RealEstateFlow CRM (tenant: ${tenantId}).
Parse user intent, select the appropriate CRM tool, and execute actions accurately.
Available tools: ${ALLOWED_TOOLS.join(', ')}.
Never invent data. Always use tools for mutations.`;
}

/**
 * Invoke Bedrock agent with tool-use loop (gated by AGENTS_ENABLED + credits).
 */
export async function invokeAgent(tenantId, prompt, context = {}) {
  if (process.env.AGENTS_ENABLED !== 'true') {
    return { ok: false, error: 'agents_disabled' };
  }

  const costs = await getCosts();
  const agentCost = costs.agent_action || 15;
  const balance = await getBalance(tenantId);

  if (balance < agentCost) {
    return { ok: false, error: 'insufficient_credits', balance };
  }

  await deductCredits(tenantId, agentCost, 'agent_action', { reason: 'bedrock_invoke' });

  try {
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: HAIKU_MODEL,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        system: buildSystemPrompt(tenantId),
        messages: [{ role: 'user', content: prompt }],
      }),
    }));

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const text = result.content?.[0]?.text || '';

    // Simple tool detection: if prompt matches known patterns, invoke directly
    const toolMatch = text.match(/TOOL:\s*(\w+)/);
    if (toolMatch && ALLOWED_TOOLS.includes(toolMatch[1])) {
      const toolResult = await invokeSkill(tenantId, toolMatch[1], context.input || {}, { userId: context.userId });
      await logAgentAction(tenantId, 'router', toolMatch[1], context.input, toolResult, agentCost);
      return { ok: true, result: { text, toolResult } };
    }

    await logAgentAction(tenantId, 'router', 'chat', { prompt }, { text }, agentCost);
    return { ok: true, result: { text } };
  } catch (err) {
    logger.error('agentRuntime.invoke.failed', { tenantId, error: err.message });
    await logAgentAction(tenantId, 'router', 'error', { prompt }, { error: err.message }, agentCost);
    return { ok: false, error: err.message };
  }
}
