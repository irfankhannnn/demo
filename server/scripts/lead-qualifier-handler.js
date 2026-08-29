/**
 * Lead Qualifier Handler — triggered by EventBridge 'lead.created'.
 * Text-only LLM fallback for the Hot/Warm/Cold rubric: gives every new lead a
 * fast initial temperature within seconds, using whatever was captured on
 * intake (no phone call). If an AI qualification call later runs on the same
 * lead (routes/aiCallingInternal.js call-outcome), its result is more
 * authoritative and overwrites this one — that's why scoreSource distinguishes
 * 'llm_text' from 'ai_call'.
 * Emits 'lead.qualified' EventBridge event for Lead Router.
 * Idempotent: skips leads already qualified within the last 24 hours.
 */
import { invokeSkill } from '../skillInvoker.js';
import { invokeAgent } from '../agents/agentRuntime.js';
import { getProvisioningByTenant } from '../aiEmployeeProvisioningService.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../logger.js';
import { buildQualifierPrompt, parseQualifierOutput, QUALIFIER_RESPONSE_SCHEMA } from '../utils/leadRubric.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const QUALIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

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
      const leadResult = await invokeSkill(tenantId, 'get_lead', { leadId }, { source: 'cron.lead_qualifier' });
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

      // Invoke qualifier agent against the shared Hot/Warm/Cold rubric
      const agentResult = await invokeAgent(
        tenantId,
        'qualifier',
        buildQualifierPrompt(lead),
        // Phase 5b: constrain the model to the rubric's shape rather than
        // parsing whatever prose comes back. This flow writes a lead score
        // with nobody watching.
        { leadId, responseSchema: QUALIFIER_RESPONSE_SCHEMA }
      );

      if (!agentResult.ok) {
        logger.warn('leadQualifier: agent failed', { tenantId, leadId, error: agentResult.error });
        results.push({ tenantId, leadId, status: 'failed', reason: agentResult.error });
        continue;
      }

      const responseText = agentResult.result?.text || '';
      const { score: scoreLabel, scoreValue, reasons: scoreReasons, parsed } = parseQualifierOutput(responseText);

      if (!parsed) {
        // The neutral WARM default is a placeholder, not a judgement. Say so in
        // the logs -- silently storing it as if the model had decided would
        // make a broken qualifier indistinguishable from a working one.
        logger.warn('leadQualifier.unparseable_output', {
          tenantId, leadId, length: responseText.length,
        });
      }

      // Update lead with score — 'llm_text' source so a later AI call
      // (scoreSource: 'ai_call') is understood as more authoritative and
      // free to overwrite this initial guess.
      await invokeSkill(tenantId, 'update_lead', {
        leadId,
        score: scoreLabel,
        scoreValue,
        scoreReasons,
        scoredAt: new Date().toISOString(),
        scoreSource: 'llm_text',
      }, { source: 'cron.lead_qualifier' });

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
