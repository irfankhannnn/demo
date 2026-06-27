/**
 * Real integration test: calls invokeAgent with the live LLM and CRM tools.
 * Reads .env for credentials, DynamoDB config, and Gemini API key.
 *
 * Run with:
 *   node test-ai-integration.js
 *
 * This will consume one Gemini API call and read from your dev DynamoDB tables.
 * It does NOT write or delete any CRM data.
 */

import 'dotenv/config';
import { invokeAgent } from './agents/agentRuntime.js';

const TENANT_ID = process.env.TEST_TENANT_ID || 'acme-corporation-edc6e9feb8';
const CONTACT_PHONE = process.env.TEST_CONTACT_PHONE || '918291537522';

const TEST_PROMPTS = [
  'Leads ki list dikhao',
  'Show all the leads',
  'Kurla ke leads dikhao',
  'Kurla ke leads ki details do',
  'Owners batao',
  'Tenants dikhao',
  'Properties dikhao',
  'Buyers dikhao',
  'Contacts dikhao',
  'Meetings dikhao',
  'Hello',
];

async function runTest(prompt) {
  console.log(`\n>>> PROMPT: "${prompt}"`);
  process.env.AGENTS_ENABLED = 'true';

  try {
    const result = await invokeAgent(TENANT_ID, 'whatsapp', prompt, {
      contactPhone: CONTACT_PHONE,
      userId: 'test-user-001',
    });

    if (!result.ok) {
      console.log(`ERROR: ${result.error}`);
      return;
    }

    console.log(`Tool calls: ${result.result.toolResults?.map(t => t.tool).join(', ') || 'none'}`);
    console.log(`Duration: ${result.result.durationMs}ms`);
    console.log('--- FINAL WHATSAPP REPLY ---');
    console.log(result.result.text);
    console.log('--- END ---');
  } catch (err) {
    console.log(`EXCEPTION: ${err.message}`);
    console.log(err.stack);
  }
}

(async () => {
  console.log('=== REAL INTEGRATION TEST ===');
  console.log(`Tenant: ${TENANT_ID}`);
  console.log(`LLM Provider: ${process.env.LLM_PROVIDER || 'bedrock'}`);
  console.log(`Gemini Model: ${process.env.GEMINI_MODEL || 'default'}`);
  console.log('');

  for (const prompt of TEST_PROMPTS) {
    await runTest(prompt);
  }

  console.log('\n=== DONE ===');
})();
