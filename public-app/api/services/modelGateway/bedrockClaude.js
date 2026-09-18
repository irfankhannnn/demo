/**
 * Bedrock (Claude) adapter — MODEL_PROVIDER=bedrock.
 *
 * Uses the Converse API so the request shape does not depend on the model
 * family, and reads the model id from BEDROCK_MODEL_ID (config/env.js holds
 * the one default; nothing else in the service names a model). The Lambda
 * role only grants bedrock:InvokeModel / Converse on that configured id, and
 * only when the stack is deployed with this provider — see the Condition in
 * infra/cfn-marketplace-api.yaml.
 *
 * Claude has no JSON-mode switch, so the system prompt demands bare JSON and
 * extractJson() strips any fence or preamble that slips through. Both
 * exported functions throw on failure; aiSearch.js owns the fallback.
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from '../../config/env.js';
import {
  intentSystemPrompt, intentUserPrompt, explainSystemPrompt, explainUserPrompt,
  extractJson, normaliseIntent, normaliseExplanation, withTimeout,
} from './shared.js';

let client = null;

function getClient() {
  if (!client) client = new BedrockRuntimeClient({ region: config.region });
  return client;
}

async function converseJson(system, userText) {
  if (!config.model.bedrockModelId) throw new Error('BEDROCK_MODEL_ID not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.model.timeoutMs);
  try {
    const out = await withTimeout(
      getClient().send(new ConverseCommand({
        modelId: config.model.bedrockModelId,
        system: [{ text: system }],
        messages: [{ role: 'user', content: [{ text: userText }] }],
        inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
      }), { abortSignal: controller.signal }),
      config.model.timeoutMs + 500,
      'bedrock',
    );
    const text = (out.output?.message?.content || [])
      .map((part) => part.text || '')
      .join('')
      .trim();
    return extractJson(text);
  } finally {
    clearTimeout(timer);
  }
}

export async function parseIntent({ query, city, cities }) {
  const raw = await converseJson(intentSystemPrompt(), intentUserPrompt({ query, city, cities }));
  return normaliseIntent(raw, { query });
}

export async function explain({ query, intent, listings }) {
  const raw = await converseJson(explainSystemPrompt(), explainUserPrompt({ query, intent, listings }));
  return normaliseExplanation(raw, listings);
}

export const name = 'bedrock';
