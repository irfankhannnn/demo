/**
 * Lead Qualifier Handler — triggered by EventBridge 'lead.created'.
 * Invokes the agent runtime to score + qualify the lead.
 * Updates the lead with a score extracted from agent output.
 * Emits 'lead.qualified' EventBridge event for Lead Router.
 * Idempotent: skips leads already qualified within the last 24 hours.
 */
import { invokeSkill } from '../skillInvoker.js';
import { invokeAgent } from '../agents/agentRuntime.js';
import { getProvisioningByTenant } from '../aiEmployeeProvisioningService.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../logger.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const QUALIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function extractScoreLabel(text) {
  if (!text) return 'WARM';
  try {
    const parsed = JSON.parse(text);
    if (parsed.score && ['HOT', 'WARM', 'COLD'].includes(parsed.score.toUpperCase())) {
      return parsed.score.toUpperCase();
    }
  } catch (_) {}
  const lower = String(text).toLowerCase();
  if (lower.includes('hot lead') || lower.includes('"hot"') || lower.includes('score: hot')) return 'HOT';
  if (lower.includes('cold lead') || lower.includes('"cold"') || lower.includes('score: cold')) return 'COLD';
  const numMatch = String(text).match(/score[:\s=]*(\d+)/i);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 70) return 'HOT';
    if (n < 30) return 'COLD';
  }
  return 'WARM';
}

function extractScoreValue(text) {
  if (!text) return 50;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.scoreValue === 'number') return Math.min(100, Math.max(0, parsed.scoreValue));
    if (typeof parsed.score_value === 'number') return Math.min(100, Math.max(0, parsed.score_value));
  } catch (_) {}
  const match = String(text).match(/score[:\s=]*(\d+)/i);
  if (match) return Math.min(100, Math.max(0, parseInt(match[1], 10)));
  return 50;
}

function isRecentlyQualified(lead) {
  if (!lead?.scoredAt) return false;
  return (Date.now() - new Date(lead.scoredAt).getTime()) < QUALIFY_COOLDOWN_MS;
}

export async function handler(event) {
  const records = event.Records || [event];
  const results = [];

  for (const record of records) {
    // Parse EventBridge detail (may be string or object)
    const detail = typeof record.detail === 'string' ? JSON.parse(record.detail) : record.detail;
    const { tenantId, leadId } = detail || {};

    if (!tenantId || !leadId) {
      logger.warn('leadQualifier: missing tenantId or leadId', { detail });
      continue;
    }

    // Tenant opt-in check FIRST — skip silently if not subscribed
    const provisioning = await getProvisioningByTenant(tenantId).catch(() => null);
    if (!provisioning || provisioning.status !== 'live') {
      logger.info('leadQualifier: skipped (not provisioned)', { tenantId, leadId });
      results.push({ tenantId, leadId, status: 'skipped', reason: 'not_provisioned' });
      continue;
    }

    const agencyConfig = await getAgencyConfig(tenantId).catch(() => null);
    if (!agencyConfig?.aiEmployeeEnabled) {
      logger.info('leadQualifier: skipped (disabled by tenant)', { tenantId, leadId });
      results.push({ tenantId, leadId, status: 'skipped', reason: 'disabled_by_tenant' });
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

      // Idempotency — skip if already qualified recently
      if (isRecentlyQualified(lead)) {
        logger.info('leadQualifier: skipped (recently qualified)', { tenantId, leadId, scoredAt: lead.scoredAt });
        results.push({ tenantId, leadId, status: 'skipped', reason: 'recently_qualified' });
        continue;
      }

      // Invoke qualifier agent
      const agentResult = await invokeAgent(
        tenantId,
        'qualifier',
        `Qualify this lead. Return JSON: {"score":"HOT|WARM|COLD","scoreValue":0-100,"reasons":["..."]}. Lead data: ${JSON.stringify(lead)}`,
        { leadId }
      );

      if (!agentResult.ok) {
        logger.warn('leadQualifier: agent failed', { tenantId, leadId, error: agentResult.error });
        results.push({ tenantId, leadId, status: 'failed', reason: agentResult.error });
        continue;
      }

      const responseText = agentResult.result?.text || '';
      const scoreLabel = extractScoreLabel(responseText);
      const scoreValue = extractScoreValue(responseText);

      let scoreReasons = responseText.slice(0, 300);
      try {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed.reasons)) scoreReasons = parsed.reasons.join('; ').slice(0, 300);
      } catch (_) {}

      // Update lead with score
      await invokeSkill(tenantId, 'update_lead', {
        leadId,
        score: scoreLabel,
        scoreValue,
        scoreReasons,
        scoredAt: new Date().toISOString(),
      });

      // Emit lead.qualified event for Lead Router
      try {
        await eventBridge.send(new PutEventsCommand({
          Entries: [{
            Source: 'crm.leads',
            DetailType: 'lead.qualified',
            Detail: JSON.stringify({
              tenantId,
              leadId,
              score: scoreLabel,
              scoreValue,
              qualifiedAt: new Date().toISOString(),
            }),
          }],
        }));
        logger.info('lead.qualified.event.published', { tenantId, leadId, score: scoreLabel });
      } catch (ebErr) {
        logger.warn('lead.qualified.event.publish.failed', { tenantId, leadId, error: ebErr.message });
      }

      logger.info('leadQualifier.done', { tenantId, leadId, score: scoreLabel, scoreValue });
      results.push({ tenantId, leadId, status: 'qualified', score: scoreLabel, scoreValue });
    } catch (err) {
      logger.error('leadQualifier.failed', { tenantId, leadId, error: err.message });
      results.push({ tenantId, leadId, status: 'error', error: err.message });
    }
  }

  return { ok: true, results };
}
