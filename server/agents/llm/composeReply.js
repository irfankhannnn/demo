/**
 * LLM composer — grounded prose for summary/chat modes (second call when needed).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildComposerSystemPrompt } from './composerPrompt.js';
import { createGeminiLogSession } from '../geminiFileLogger.js';
import { isValidWhatsAppReply } from '../responseFormatter.js';
import { logger } from '../../logger.js';

/**
 * @param {object} params
 * @param {string} params.userMessage
 * @param {string} [params.personality]
 * @param {string} [params.tenantId]
 * @param {string} [params.toolName]
 * @param {object} [params.toolResult] - invokeSkill envelope
 * @param {object} [params.truncatedPayload] - safe JSON for LLM
 * @param {() => void} [params.onApiCall]
 * @returns {Promise<string|null>} null if generation failed
 */
export async function composeReply(params) {
  const {
    userMessage,
    personality = 'friendly',
    tenantId = '',
    toolName = null,
    truncatedPayload = null,
    onApiCall,
  } = params;

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;
  if (!apiKey || !modelName) return null;

  const systemInstruction = buildComposerSystemPrompt(personality);
  const dataBlock = truncatedPayload != null
    ? JSON.stringify(truncatedPayload, null, 0)
    : '(no tool data — conversational reply only)';

  const userPrompt = toolName
    ? `User asked: ${userMessage}\n\nTool: ${toolName}\nTool result JSON:\n${dataBlock}\n\nWrite the WhatsApp reply.`
    : `User said: ${userMessage}\n\nWrite a short WhatsApp reply.`;

  const geminiLog = createGeminiLogSession({
    tenantId,
    agentId: 'composer',
    kind: 'composer',
  });
  await geminiLog?.writeInput({
    type: 'generate_content',
    model: modelName,
    systemInstruction,
    userPrompt,
  });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
    });
    onApiCall?.();
    const result = await model.generateContent(userPrompt);
    let text = '';
    try {
      text = (result.response.text() || '').trim();
    } catch (_) {
      text = '';
    }

    const valid = !!(text && isValidWhatsAppReply(text));
    await geminiLog?.writeOutput({
      type: 'generate_content_response',
      model: modelName,
      text,
      valid,
    });

    if (valid) return text;
    logger.debug('agent.composer.invalid_output', { toolName, length: text?.length || 0 });
    return null;
  } catch (err) {
    await geminiLog?.writeOutput({
      type: 'generate_content_error',
      model: modelName,
      error: err.message,
    });
    logger.warn('agent.composer.failed', { error: err.message, toolName });
    return null;
  }
}
