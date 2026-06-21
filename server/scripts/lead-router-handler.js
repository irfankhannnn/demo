/**
 * Lead Router Handler — triggered by EventBridge 'lead.qualified' events.
 * Routes qualified leads to the most appropriate team member based on assignment rules.
 * AGENTS_ENABLED=false: placeholder run only.
 */
import { logger } from '../logger.js';
import { shutdownPostHog } from '../lib/posthog.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Route a single qualified lead to the appropriate team member.
 * Current implementation is a placeholder; full routing logic requires
 * AGENTS_ENABLED=true and tenant member roster access.
 */
async function routeLead(tenantId, leadId) {
  if (process.env.AGENTS_ENABLED !== 'true') {
    logger.info('lead-router: AGENTS_ENABLED=false — skipping routing', { tenantId, leadId });
    return { routed: false, reason: 'agents_disabled' };
  }

  // TODO: Implement full routing when agents are enabled
  // 1. Get tenant member roster from Subscriptions table
  // 2. Apply round-robin or load-based assignment
  // 3. Update lead.assignedTo in CRM table
  // 4. Notify assigned member via email/WhatsApp
  logger.info('lead-router: routing not yet implemented', { tenantId, leadId });
  return { routed: false, reason: 'not_yet_implemented' };
}

export async function handler(event) {
  const results = [];

  // Handles both EventBridge event format and SQS batch format
  const records = event.Records || [event];

  for (const record of records) {
    try {
      const detail = record.detail
        ? (typeof record.detail === 'string' ? JSON.parse(record.detail) : record.detail)
        : record;
      const { tenantId, leadId } = detail;

      if (!tenantId || !leadId) {
        logger.warn('lead-router: missing tenantId or leadId', { detail });
        continue;
      }

      const result = await routeLead(tenantId, leadId);
      results.push({ tenantId, leadId, ...result });
    } catch (err) {
      logger.error('lead-router: failed for record', { error: err.message });
      results.push({ error: err.message });
    }
  }

  try {
    await shutdownPostHog();
  } catch (_) {}

  return { statusCode: 200, body: JSON.stringify({ results }) };
}

// Direct execution (for local testing only)
if (process.argv[1] && process.argv[1].includes('lead-router-handler')) {
  handler({ detail: { tenantId: 'test-tenant', leadId: 'test-lead' } })
    .then(r => { console.log(r); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
