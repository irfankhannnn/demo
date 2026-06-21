/**
 * Agent system prompt builder.
 * Reads from ai-employee/ docs directory and composes per-agent system prompts.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AI_EMPLOYEE_DIR = path.join(__dirname, '../../ai-employee');

function readDoc(filename) {
  try {
    return fs.readFileSync(path.join(AI_EMPLOYEE_DIR, filename), 'utf-8');
  } catch (_) {
    return '';
  }
}

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
## Your Role: WhatsApp CRM Assistant
Process natural language CRM queries from WhatsApp.
Reply in Hinglish (70% English, 30% Hindi romanised).
Be concise — WhatsApp messages should be under 500 characters.

Examples you can handle:
- "Show me all leads in Mumbai with budget above 5 crore"
- "Create a new buyer named Rahul, 9876543210"
- "What's my conversion rate this month?"
- "Assign lead #123 to Priya"
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
 */
export function buildSystemPrompt(agentId, tenantId) {
  const soul = readDoc('SOUL.md');
  const identity = readDoc('IDENTITY.md');
  const agentsDoc = readDoc('AGENTS.md');
  const toolsDoc = readDoc('TOOLS.md');

  const specific = agentSpecificPrompts[agentId] || agentSpecificPrompts.mcp;

  return `You are SyncBot, an AI assistant for RealEstateFlow CRM (tenant: ${tenantId}).

${soul ? `## Core Principles\n${soul}\n` : ''}
${identity ? `## Identity\n${identity}\n` : ''}
${agentsDoc ? `## Operating Rules\n${agentsDoc}\n` : ''}
${toolsDoc ? `## Available Tools\n${toolsDoc}\n` : ''}
${specific}

IMPORTANT RULES:
- Never invent CRM data, leads, or contacts
- Always use tools for mutations (create/update)
- Return only what was asked — no verbose explanations
- Tenant ID is ${tenantId} — never mix with other tenants
`.trim();
}
