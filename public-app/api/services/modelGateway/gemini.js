/**
 * Gemini adapter — the default MODEL_PROVIDER.
 *
 * Same package and JSON-response pattern the CRM's agent runtime uses
 * (agency-app/api/agents/agentRuntime.js, runSingleShotAgent): one
 * GoogleGenerativeAI client, `responseMimeType: 'application/json'` so the
 * model is constrained to JSON rather than asked nicely, low temperature
 * because a filter parser should be boring and repeatable.
 *
 * Both exported functions throw on any failure (no key, timeout, bad JSON).
 * aiSearch.js catches and falls back; nothing here decides what the buyer
 * sees when the model is unavailable.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/env.js';
import {
  intentSystemPrompt, intentUserPrompt, explainSystemPrompt, explainUserPrompt,
  extractJson, normaliseIntent, normaliseExplanation, withTimeout,
} from './shared.js';

let client = null;

function getClient() {
  if (!config.model.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
  if (!client) client = new GoogleGenerativeAI(config.model.geminiApiKey);
  return client;
}

async function generateJson(systemInstruction, userText) {
  const model = getClient().getGenerativeModel({
    model: config.model.geminiModel,
    systemInstruction,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 1024 },
  });
  const result = await withTimeout(
    model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: userText }] }] },
      { timeout: config.model.timeoutMs },
    ),
    config.model.timeoutMs + 500,
    'gemini',
  );
  return extractJson(result.response.text());
}

export async function parseIntent({ query, city, cities }) {
  const raw = await generateJson(intentSystemPrompt(), intentUserPrompt({ query, city, cities }));
  return normaliseIntent(raw, { query });
}

export async function explain({ query, intent, listings }) {
  const raw = await generateJson(explainSystemPrompt(), explainUserPrompt({ query, intent, listings }));
  return normaliseExplanation(raw, listings);
}

export const name = 'gemini';
