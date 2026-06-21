/**
 * Lead Qualifier Handler — triggered by EventBridge 'lead.created'.
 * Invokes the agent runtime to score + qualify the lead.
 * Updates the lead with a real score extracted from agent output.
 * Idempotent: skips leads already qualified within the last 24 hours.
 */
import { invokeSkill } from '../skillInvoker.js';
import { invokeAgent } from '../agents/agentRuntime.js';
import { logger } from '../logger.js';

const QUALIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Extract a HOT/WARM/COLD label from the agent's text response.
 * Falls back to 'WARM' if nothing is found.
 */
function extractScoreLabel(text) {
  if (!text) return 'WARM';

  // Try JSON first (agent may return structured output)
  try {
    const parsed = JSON.parse(text);
    if (parsed.score && ['HOT', 'WARM', 'COLD'].includes(parsed.score.toUpperCase())) {
      return parsed.score.toUpperCase();
    }
  } catch (_) { /* not JSON */ }

  // Keyword matching (case-insensitive)
  const lower = String(text).toLowerCase();
  if (lower.includes('hot lead') || lower.includes('score: hot') || lower.includes('"hot"')) return 'HOT';
  if (lower.includes('cold lead') || lower.includes('score: cold') || lower.includes('"cold"')) return 'COLD';
  if (lower.includes('warm lead') || lower.includes('score: warm') || lower.includes('"warm"')) return 'WARM';

  // Numeric score extraction (e.g. "score: 85" → HOT if >70, COLD if <30)
  const numMatch = String(text).match(/score[:\s=]*(\d+)/i);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 70) return 'HOT';
    if (n < 30) return 'COLD';
    return 'WARM';
  }

  return 'WARM';
}

/**
 * Extract a 0-100 numeric score from the agent's text response.
 */
function extractScoreValue(text) {
  if (!text) return 50;

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.scoreValue === 'number') return Math.min(100, Math.max(0, parsed.scoreValue));
    if (typeof parsed.score_value === 'number') return Math.min(100, Math.max(0, parsed.score_value));
  } catch (_) { /* not JSON */ }

  const match = String(text).match(/score[:\s=]*(\d+)/i);
  if (match) return Math.min(100, Math.max(0, parseInt(match[1], 10)));

  return 50;
}

/**
 * Check if a lead was already qualified within the last 24 hours (idempotency).
 */
function isRecentlyQualified(lead) {
  if (!lead?.scoredAt) return false;
  const scoredMs = new Date(lead.scoredAt).getTime();
  return (Date.now() - scoredMs) < QUALIFY_COOLDOWN_MS;
}

export async function handler(event) {
  const records = event.Records || [event];
  const results = [];

  for (const record of records) {
    const detail = typeof record.detail === 'string' ? JSON.parse(record.detail) : record.detail;
    const { tenantId, leadId } = detail || {};

    if (!tenantId || !leadId) {
      logger.warn('leadQualifier: missing tenantId or leadId', { detail });
      continue;
    }

    try {
      // Fetch the lead
      const leadResult = await invokeSkill(tenantId, 'get_lead', { leadId });
      if (!leadResult.ok) {
        logger.warn('leadQualifier: could not fetch lead', { tenantId, leadId, error: leadResult.error });
        continue;
      }

      const lead = leadResult.data;

      // Idempotency check — skip if already qualified recently
      if (isRecentlyQualified(lead)) {
        logger.info('leadQualifier: skipped (already qualified recently)', { tenantId, leadId, scoredAt: lead.scoredAt });
        results.push({ tenantId, leadId, status: 'skipped', reason: 'recently_qualified' });
        continue;
      }

      // Invoke agent to qualify the lead
      const agentResult = await invokeAgent(tenantId, `Qualify this lead and respond with a JSON object containing fields: score (HOT/WARM/COLD), scoreValue (0-100), reasons (array of strings). Lead data: ${JSON.stringify(lead)}`, { leadId });

      if (!agentResult.ok) {
        logger.warn('leadQualifier: agent invocation failed', { tenantId, leadId, error: agentResult.error });
        results.push({ tenantId, leadId, status: 'failed', reason: 'agent_error' });
        continue;
      }

      // Extract score from agent response
      const responseText = agentResult.result?.text || '';
      const scoreLabel = extractScoreLabel(responseText);
      const scoreValue = extractScoreValue(responseText);

      // Parse reasons if present
      let scoreReasons = responseText.slice(0, 300);
      try {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed.reasons)) {
          scoreReasons = parsed.reasons.join('; ').slice(0, 300);
        }
      } catch (_) { /* use raw text */ }

      // Update lead with extracted score
      await invokeSkill(tenantId, 'update_lead', {
        leadId,
        score: scoreLabel,
        scoreValue,
        scoreReasons,
        scoredAt: new Date().toISOString(),
      });

      logger.info('leadQualifier.done', { tenantId, leadId, score: scoreLabel, scoreValue });
      results.push({ tenantId, leadId, status: 'qualified', score: scoreLabel, scoreValue });
    } catch (err) {
      logger.error('leadQualifier.failed', { tenantId, leadId, error: err.message });
      results.push({ tenantId, leadId, status: 'error', error: err.message });
    }
  }

  return { ok: true, results };
}
