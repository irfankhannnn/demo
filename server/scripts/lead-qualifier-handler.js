import { invokeSkill } from '../skillInvoker.js';
import { invokeAgent } from '../agents/agentRuntime.js';
import { logger } from '../logger.js';

export async function handler(event) {
  for (const record of event.Records || []) {
    const detail = typeof record.detail === 'string' ? JSON.parse(record.detail) : record.detail;
    const { tenantId, leadId } = detail;
    if (!tenantId || !leadId) continue;

    try {
      const leadResult = await invokeSkill(tenantId, 'get_lead', { leadId });
      if (!leadResult.ok) continue;

      const agentResult = await invokeAgent(tenantId, `Qualify this lead: ${JSON.stringify(leadResult.data)}`, { leadId });
      if (agentResult.ok) {
        await invokeSkill(tenantId, 'update_lead', {
          leadId,
          score: 'WARM',
          scoreReasons: agentResult.result?.text?.slice(0, 200),
          scoredAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.error('leadQualifier.failed', { tenantId, leadId, error: err.message });
    }
  }
  return { ok: true };
}
