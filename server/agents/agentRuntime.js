import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBalance, deductCredits } from '../creditService.js';
import { getCosts } from '../creditConfig.js';
import { invokeSkill, ALLOWED_TOOLS } from '../skillInvoker.js';
import { logAgentAction } from './agentAuditService.js';
import { metrics } from '../observability/cloudwatch.js';
import { logger } from '../logger.js';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const HAIKU_MODEL = 'anthropic.claude-3-haiku-20240307-v1:0';
const MAX_TOOL_TURNS = 5;

function buildSystemPrompt(tenantId) {
  return `You are SyncBot, an AI assistant for RealEstateFlow CRM (tenant: ${tenantId}).
Parse user intent, select the appropriate CRM tool, and execute actions accurately.
Never invent data. Always use tools for mutations. Be concise.`;
}

// Build Bedrock-native tool definitions from ALLOWED_TOOLS list
function buildToolDefinitions() {
  return ALLOWED_TOOLS.map(tool => ({
    name: tool,
    description: `Execute CRM operation: ${tool.replace(/_/g, ' ')}`,
    input_schema: {
      type: 'object',
      properties: {
        input: {
          type: 'object',
          description: 'Parameters for this CRM operation',
        },
      },
      required: [],
    },
  }));
}

async function invokeBedrockWithTools(tenantId, messages, systemPrompt) {
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

export async function invokeAgent(tenantId, prompt, context = {}) {
  if (process.env.AGENTS_ENABLED !== 'true') {
    return { ok: false, error: 'agents_disabled' };
  }

  const costs = await getCosts();
  const agentCost = costs.agent_action || 15;
  const balance = await getBalance(tenantId);

  if (balance < agentCost) {
    await metrics.creditInsufficient(tenantId);
    return { ok: false, error: 'insufficient_credits', balance };
  }

  await deductCredits(tenantId, agentCost, 'agent_action', { reason: 'bedrock_invoke' });
  await metrics.agentActionInvoked(tenantId, 'invoke');

  const systemPrompt = buildSystemPrompt(tenantId);
  const messages = [{ role: 'user', content: prompt }];
  const toolResults = [];
  let lastText = '';
  let lastToolName = 'chat';

  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const result = await invokeBedrockWithTools(tenantId, messages, systemPrompt);
      const stopReason = result.stop_reason;
      const content = result.content || [];

      // Collect any text from this turn
      const textPart = content.find(c => c.type === 'text');
      if (textPart) lastText = textPart.text;

      // If model is done (no tool use), break
      if (stopReason !== 'tool_use') break;

      // Find tool_use block
      const toolUseBlock = content.find(c => c.type === 'tool_use');
      if (!toolUseBlock) break;

      const toolName = toolUseBlock.name;
      const toolInput = toolUseBlock.input?.input || toolUseBlock.input || {};
      lastToolName = toolName;

      // Execute tool if allowed
      let toolResult;
      if (ALLOWED_TOOLS.includes(toolName)) {
        toolResult = await invokeSkill(tenantId, toolName, toolInput, { userId: context.userId });
        toolResults.push({ tool: toolName, result: toolResult });
      } else {
        toolResult = { error: `Tool ${toolName} not in allowed list` };
      }

      // Feed tool result back for next turn
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

    await logAgentAction(
      tenantId, 'router', lastToolName,
      { prompt, context },
      { text: lastText, toolResults },
      agentCost
    );

    return {
      ok: true,
      result: {
        text: lastText,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
      },
    };
  } catch (err) {
    logger.error('agentRuntime.invoke.failed', { tenantId, error: err.message });
    await metrics.agentActionFailed(tenantId, 'invoke');
    await logAgentAction(tenantId, 'router', 'error', { prompt }, { error: err.message }, agentCost);
    return { ok: false, error: err.message };
  }
}
