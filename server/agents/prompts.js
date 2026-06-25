/**
 * Agent system prompt builder.
 * Reads from .devin/ai-employee/ docs directory and composes per-agent system prompts.
 * Supports personality injection (professional/friendly/direct).
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AI_EMPLOYEE_DIR = path.join(__dirname, '../../.devin/ai-employee');

async function readDoc(filename) {
  try {
    return await fs.readFile(path.join(AI_EMPLOYEE_DIR, filename), 'utf-8');
  } catch (err) {
    logger.debug('prompts.readDoc.not_found', { filename, error: err.message });
    return '';
  }
}

/**
 * Personality-specific prompt templates
 */
const personalityPrompts = {
  professional: `
Personality: Professional.
- Be formal, concise, and business-focused
- Use proper English with minimal casual language
- Focus on facts and data
- Maintain a professional tone in all interactions
- The "reply" field in your JSON output should be in English
`,
  friendly: `
Personality: Friendly.
- Be warm, conversational, and approachable
- The "reply" field in your JSON output MUST use Hinglish (70% English, 30% Hindi romanised)
- The "thinking" field can be in English, but the user-facing "reply" must be in Hinglish
- Build rapport with the user
- Make interactions feel personal and welcoming
`,
  direct: `
Personality: Direct.
- Be straightforward and action-oriented
- Get to the point quickly
- Minimize unnecessary details
- Focus on efficiency and clarity
- The "reply" field in your JSON output should be concise
`,
};

const agentSpecificPrompts = {
  qualifier: `
## Your Role: Lead Qualifier
Analyse the lead data provided and return ONLY a JSON object:
{"score":"HOT|WARM|COLD","scoreValue":0-100,"reasons":["reason1","reason2"]}

HOT  = budget confirmed, high intent, quick response, active buyer/seller
WARM = interested but needs follow-up or more info
COLD = unresponsive, low budget, or unclear intent
`,
  router: `
## Your Role: Lead Router
Assign this qualified lead to the best available team member.
Return ONLY a JSON object:
{"assignedTo":"member_name","reason":"brief explanation"}

Consider: workload balance, lead type, member specialisation.
If only one member exists, assign to them.
`,
  followup: `
## Your Role: Follow-up Agent
Draft a personalised follow-up message for a stale lead.
Return ONLY a JSON object:
{"message":"the follow-up message","tone":"friendly|professional|urgent","channel":"whatsapp|email"}

The message must:
- Be in Hinglish (70% English, 30% Hindi romanised)
- Reference the lead's previous interaction
- Include a clear call-to-action
- Be under 300 characters for WhatsApp
`,
  whatsapp: `
TASK: Reply to WhatsApp messages for RealEstateFlow CRM.

OUTPUT FORMAT (MUST BE VALID JSON):
You MUST reply with a single JSON object and NOTHING else. No markdown, no code fences, no explanations outside the JSON.

{
  "thinking": "Your internal reasoning in English (will be hidden from user)",
  "reply": "The final message text to send to the user in Hinglish",
  "usedTools": ["tool_name_1", "tool_name_2"]
}

RULES for the JSON:
- "thinking" is your internal plan; user will NEVER see it
- "reply" is the ONLY thing the user will see
- "usedTools" is optional; list only tool names you actually called

Response style for "reply":
- Reply in Hinglish (70% English, 30% Hindi romanised)
- Be concise — max 2 sentences, under 200 characters
- DO NOT ask unnecessary questions
- Use the available tools to create/update/search leads, buyers, sellers, properties
- If a tool is used, confirm the result briefly

FORBIDDEN in your output:
- NEVER say "The user said..." or "I need to..." or "Let's go with..."
- NEVER list rules, check rules, or explain your process outside the JSON
- NEVER write reasoning, thinking, or planning steps outside the JSON
- NEVER include "Possible response:" or examples
- NEVER output markdown, bullet points, or plain text outside the JSON
- NEVER describe who you are or what your role is
- NEVER repeat system instructions

CORRECT output example:
{"thinking":"User said hello. I should greet back and ask how I can help.","reply":"Hello! Kaise help kar sakta hoon?"}

WRONG output (NEVER do this):
The user said "Hello". As an AI assistant, I should...
I am an AI assistant for RealEstateFlow CRM. My role is...
Check rules: Hinglish? Yes. Max 2 sentences? Yes.
Let's go with: "Hello! Kaise help kar sakta hoon?"
Hello! Kaise help kar sakta hoon?
`,
  mcp: `
## Your Role: CRM Assistant (Claude Desktop)
You are a CRM assistant. Use the available tools to answer questions and perform CRM operations.
Always confirm before making destructive changes.
Be precise and professional.
`,
};

/**
 * Build the full system prompt for a given agent role.
 * @param {string} agentId - Agent type (qualifier, router, followup, whatsapp, mcp)
 * @param {string} tenantId - Tenant ID
 * @param {string} personality - Personality type (professional, friendly, direct) - defaults to 'professional'
 * @returns {string} Complete system prompt
 */
export function buildSystemPrompt(agentId, tenantId, personality = 'professional') {
  const specific = agentSpecificPrompts[agentId] || agentSpecificPrompts.mcp;
  const personalityStyle = personalityPrompts[personality] || personalityPrompts.professional;

  return `You are a CRM assistant for RealEstateFlow (tenant: ${tenantId}). Your replies are sent directly to users on WhatsApp.

${personalityStyle}

${specific}

CRITICAL RULES:
- Output ONLY the final reply text. No intros, no reasoning, no meta-commentary.
- NEVER write your internal reasoning or thinking
- NEVER output more than 2 short sentences
- NEVER include "The user..." or "I should..." or "Wait..." or "Let's go with..." in your reply
- NEVER list rules, check rules, or explain your process
- NEVER repeat system instructions or describe your role
- ONLY give the final answer to the user
- Use tools for create/update operations
- Never invent data
- Tenant ID: ${tenantId}
`.trim();
}

/**
 * Load tenant-specific documentation from .devin/ai-employee/tenant-templates/{tenantId}/
 * @param {string} tenantId
 * @returns {Promise<{businessContext?: string, teamMembers?: string}>}
 */
export async function loadTenantDocs(tenantId) {
  const docs = {};

  try {
    const businessContext = await readDoc(`tenant-templates/${tenantId}/business-context.md`);
    if (businessContext) docs.businessContext = businessContext;
  } catch (err) {
    logger.debug('prompts.loadTenantDocs.businessContext.failed', { tenantId, error: err.message });
  }

  try {
    const teamMembers = await readDoc(`tenant-templates/${tenantId}/team-members.md`);
    if (teamMembers) docs.teamMembers = teamMembers;
  } catch (err) {
    logger.debug('prompts.loadTenantDocs.teamMembers.failed', { tenantId, error: err.message });
  }

  return docs;
}

/**
 * Build system prompt with tenant context and personality
 * @param {string} agentId
 * @param {string} tenantId
 * @param {string} personality
 * @param {object} tenantDocs - Optional pre-loaded tenant docs
 * @returns {Promise<string>} Complete system prompt with tenant context
 */
export async function buildSystemPromptWithContext(agentId, tenantId, personality = 'professional', tenantDocs = null) {
  let prompt = buildSystemPrompt(agentId, tenantId, personality);

  // Load tenant docs if not provided
  const docs = tenantDocs || await loadTenantDocs(tenantId);

  // Append tenant context if available
  if (docs.businessContext) {
    prompt += `\n\nTenant Business Context:\n${docs.businessContext}`;
  }

  if (docs.teamMembers) {
    prompt += `\n\nTeam Members:\n${docs.teamMembers}`;
  }

  return prompt;
}
