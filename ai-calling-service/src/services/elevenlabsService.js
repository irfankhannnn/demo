// ElevenLabs Conversational AI Service

import axios from 'axios';
import { logger } from '../utils/logger.js';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;

const elevenLabsClient = axios.create({
  baseURL: 'https://api.elevenlabs.io/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'xi-api-key': ELEVENLABS_API_KEY,
  },
});

/**
 * Initialize a conversation session with ElevenLabs
 * @param {string} callSessionId - Our internal session ID
 * @param {object} config - Agent configuration
 * @returns {Promise<{sessionId: string, websocketUrl: string}>}
 */
export async function initializeConversation(callSessionId, config) {
  try {
    const response = await elevenLabsClient.post('/convai/conversations', {
      agent_id: config.agentId || ELEVENLABS_AGENT_ID,
      initial_message: config.greeting || "Hello, this is your real estate assistant. How can I help you today?",
      webhook_url: `${WEBHOOK_BASE_URL}/webhooks/elevenlabs/intent`,
      metadata: {
        call_session_id: callSessionId,
        tenant_id: config.tenantId,
        lead_id: config.leadId,
        lead_name: config.leadName,
      },
      conversation_config: {
        max_duration_seconds: config.maxDuration || 600,
        end_call_on_goodbye: true,
        language: 'en',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      },
      system_prompt: buildSystemPrompt(config),
    });
    
    logger.callEvent('ELEVENLABS_SESSION_CREATED', callSessionId, config.tenantId, {
      elevenLabsSessionId: response.data.session_id,
    });
    
    return {
      sessionId: response.data.session_id,
      websocketUrl: response.data.websocket_url,
    };
  } catch (error) {
    logger.error('Failed to initialize ElevenLabs conversation', error, { callSessionId });
    throw new Error(`ElevenLabs initialization failed: ${error.message}`);
  }
}

/**
 * Build system prompt for the AI agent
 */
function buildSystemPrompt(config) {
  const agencyName = config.agencyName || 'our real estate agency';
  
  return `You are a helpful real estate assistant for ${agencyName}. Your role is to:

1. Help customers find properties that match their requirements
2. Answer questions about available properties
3. Schedule site visits
4. Provide information about rental policies and procedures

Important guidelines:
- Be polite and professional at all times
- Keep responses concise and suitable for phone conversation
- If you don't have specific information, offer to connect them with an agent
- For property availability or scheduling, wait for the system to provide data
- Do not make up property details - only share verified information
- If the customer asks about pricing, provide only confirmed prices

Customer context:
- Name: ${config.leadName || 'the customer'}
- Purpose of call: ${config.callPurpose || 'general inquiry'}
${config.leadContext ? `- Previous interactions: ${config.leadContext}` : ''}

When you need data from the CRM (like property listings or scheduling), respond with:
[NEED_DATA: INTENT_TYPE]

Where INTENT_TYPE is one of:
- PROPERTY_AVAILABILITY
- PROPERTY_DETAILS
- SCHEDULE_SITE_VISIT
- FAQ_POLICY
- HANDOFF_HUMAN`;
}

/**
 * Inject context into ongoing conversation
 * @param {string} sessionId - ElevenLabs session ID
 * @param {string} contextText - Data to inject
 */
export async function injectContext(sessionId, contextText) {
  try {
    await elevenLabsClient.post(`/convai/conversations/${sessionId}/add-context`, {
      context: contextText,
      speak_immediately: true,
    });
    
    logger.debug('Context injected to ElevenLabs', { sessionId, contextLength: contextText.length });
    return true;
  } catch (error) {
    logger.error('Failed to inject context', error, { sessionId });
    return false;
  }
}

/**
 * End a conversation session
 */
export async function endConversation(sessionId) {
  try {
    await elevenLabsClient.post(`/convai/conversations/${sessionId}/end`);
    
    logger.info('ElevenLabs conversation ended', { sessionId });
    return true;
  } catch (error) {
    logger.error('Failed to end conversation', error, { sessionId });
    return false;
  }
}

/**
 * Get conversation transcript
 */
export async function getTranscript(sessionId) {
  try {
    const response = await elevenLabsClient.get(`/convai/conversations/${sessionId}/transcript`);
    return response.data.transcript;
  } catch (error) {
    logger.error('Failed to get transcript', error, { sessionId });
    return [];
  }
}

/**
 * Parse ElevenLabs intent webhook payload
 */
export function parseIntentWebhook(body) {
  return {
    sessionId: body.session_id,
    callSessionId: body.metadata?.call_session_id,
    tenantId: body.metadata?.tenant_id,
    leadId: body.metadata?.lead_id,
    transcript: body.transcript,
    detectedIntent: body.detected_intent,
    entities: body.entities || {},
    confidence: body.confidence || 0,
    timestamp: body.timestamp,
  };
}

/**
 * Detect intent from transcript using Claude
 * This is called when ElevenLabs doesn't have built-in intent detection
 */
export async function detectIntentFromTranscript(transcript, context = {}) {
  // Use Bedrock Claude for intent detection
  // This is a fallback when ElevenLabs doesn't provide intent
  
  const intentPatterns = {
    PROPERTY_AVAILABILITY: [
      /available|what.*properties|show.*properties|any.*rent|looking.*for/i,
    ],
    PROPERTY_DETAILS: [
      /details|more.*about|tell.*about.*property|describe/i,
    ],
    SCHEDULE_SITE_VISIT: [
      /visit|schedule|see.*property|come.*see|appointment/i,
    ],
    FAQ_POLICY: [
      /policy|rules|allow|permitted|deposit|agreement|bachelor/i,
    ],
    PRICING_INFO: [
      /price|cost|rent.*amount|how.*much|budget/i,
    ],
    HANDOFF_HUMAN: [
      /speak.*agent|human|real.*person|connect.*someone/i,
    ],
    CALL_END: [
      /bye|goodbye|thank.*you|that.*all|no.*more/i,
    ],
  };
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(transcript)) {
        return {
          intent,
          confidence: 0.8,
          entities: extractEntities(transcript),
        };
      }
    }
  }
  
  return {
    intent: 'SMALL_TALK',
    confidence: 0.5,
    entities: {},
  };
}

/**
 * Extract entities from transcript
 */
function extractEntities(transcript) {
  const entities = {};
  
  // Extract BHK type
  const bhkMatch = transcript.match(/(\d)\s*bhk/i);
  if (bhkMatch) {
    entities.bedrooms = parseInt(bhkMatch[1], 10);
    entities.propertyType = `${bhkMatch[1]} BHK`;
  }
  
  // Extract budget
  const budgetMatch = transcript.match(/(\d+)\s*(lakh|lac|thousand|k)/i);
  if (budgetMatch) {
    let amount = parseInt(budgetMatch[1], 10);
    const unit = budgetMatch[2].toLowerCase();
    if (unit === 'lakh' || unit === 'lac') amount *= 100000;
    if (unit === 'thousand' || unit === 'k') amount *= 1000;
    entities.budget = amount;
  }
  
  // Extract location keywords
  const locationKeywords = ['near', 'in', 'at', 'around'];
  for (const keyword of locationKeywords) {
    const regex = new RegExp(`${keyword}\\s+([\\w\\s]+?)(?:\\.|,|\\?|$)`, 'i');
    const match = transcript.match(regex);
    if (match) {
      entities.location = match[1].trim();
      break;
    }
  }
  
  return entities;
}

export default {
  initializeConversation,
  injectContext,
  endConversation,
  getTranscript,
  parseIntentWebhook,
  detectIntentFromTranscript,
};
