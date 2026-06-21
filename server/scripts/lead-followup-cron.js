/**
 * Lead Followup Cron — runs daily at 04:00 IST via EventBridge.
 * Finds stale leads (no activity in 1-7 days) and either:
 *   - draft mode: creates a draft note for admin review
 *   - autosend mode: sends message via WhatsApp/Email automatically
 */
import { invokeSkill } from '../skillInvoker.js';
import { invokeAgent } from '../agents/agentRuntime.js';
import { getAgencyConfig, scanAgencyConfigs } from '../agencyConfigService.js';
import { logger } from '../logger.js';
import { shutdownPostHog } from '../lib/posthog.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const STALE_MIN_DAYS = 1;
const STALE_MAX_DAYS = 7;

function isStaleForFollowup(lead) {
  const ref = lead.lastActivityAt || lead.updatedAt || lead.createdAt;
  if (!ref) return false;
  const ageMs = Date.now() - new Date(ref).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  return ageDays >= STALE_MIN_DAYS && ageDays <= STALE_MAX_DAYS;
}

async function sendViaWhatsApp(phone, message) {
  const { isBaileyEnabled, sendWhatsAppMessage } = await import('../bailey.js');
  if (!isBaileyEnabled() || !phone) return false;
  await sendWhatsAppMessage(phone, message);
  return true;
}

async function sendViaEmail(email, message) {
  const { sendEmail } = await import('../emailService.js');
  if (!email) return false;
  await sendEmail({ to: email, subject: 'Follow-up from your CRM', text: message });
  return true;
}

async function processFollowupForTenant(tenantId) {
  const agencyConfig = await getAgencyConfig(tenantId);
  if (!agencyConfig?.aiEmployeeEnabled) return { skipped: true, reason: 'disabled' };

  const mode = agencyConfig.followupAgentMode || 'draft';
  const channels = agencyConfig.followupAgentAutoSendChannels || ['whatsapp'];

  // Get active leads that may need follow-up (new, contacted, qualified, negotiating)
  const FOLLOWUP_STATUSES = ['new', 'contacted', 'qualified', 'negotiating'];
  const leadsResults = await Promise.all(
    FOLLOWUP_STATUSES.map(status => invokeSkill(tenantId, 'search_leads', { status }).catch(() => ({ ok: true, data: [] })))
  );
  const allLeads = leadsResults.flatMap(r => (r.ok ? (r.data?.items || r.data || []) : []));
  // Deduplicate by leadId
  const seen = new Set();
  const leads = [];
  for (const lead of allLeads) {
    const id = lead.id || lead.leadId;
    if (id && !seen.has(id)) {
      seen.add(id);
      leads.push(lead);
    }
  }
  if (!leads.length) return { processed: 0, skipped: true, reason: 'no_eligible_leads' };

  const leads = (leadsResult.data?.items || leadsResult.data || []).filter(isStaleForFollowup);
  logger.info('leadFollowup: stale leads found', { tenantId, count: leads.length, mode });

  let draftCount = 0;
  let sentCount = 0;
  let errorCount = 0;

  for (const lead of leads) {
    try {
      const agentResult = await invokeAgent(
        tenantId,
        'followup',
        `Draft a follow-up for this lead. Return JSON: {"message":"...","tone":"friendly|professional|urgent","channel":"whatsapp|email"}\n\nLead: ${JSON.stringify(lead)}`,
        { leadId: lead.id || lead.leadId }
      );

      if (!agentResult.ok) {
        errorCount++;
        continue;
      }

      let message = agentResult.result?.text || '';
      let channel = 'whatsapp';
      try {
        const parsed = JSON.parse(message);
        message = parsed.message || message;
        channel = parsed.channel || 'whatsapp';
      } catch (_) {}

      if (!message) { errorCount++; continue; }

      if (mode === 'draft') {
        // Store as lead note
        await invokeSkill(tenantId, 'create_lead_note', {
          leadId: lead.id || lead.leadId,
          content: `[DRAFT FOLLOWUP] ${message}`,
          type: 'draft_followup',
          createdBy: 'ai-employee',
        });
        draftCount++;
      } else if (mode === 'autosend') {
        let sent = false;
        if (channels.includes('whatsapp') && lead.phone) {
          try { sent = await sendViaWhatsApp(lead.phone, message); } catch (_) {}
        }
        if (!sent && channels.includes('email') && lead.email) {
          try { sent = await sendViaEmail(lead.email, message); } catch (_) {}
        }
        if (sent) sentCount++;
        else errorCount++;
      }
    } catch (err) {
      logger.warn('leadFollowup: lead processing failed', { tenantId, leadId: lead.id, error: err.message });
      errorCount++;
    }
  }

  return { processed: leads.length, draftCount, sentCount, errorCount, mode };
}

export async function handler(event) {
  if (process.env.AGENTS_ENABLED !== 'true') {
    logger.info('lead-followup-cron: AGENTS_ENABLED=false — skipping');
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'agents_disabled' }) };
  }

  try {
    // Get all tenants with AI Employee enabled
    const tenants = await scanAgencyConfigs({ aiEmployeeEnabled: true });
    logger.info('lead-followup-cron: processing tenants', { count: tenants.length });

    const results = [];
    for (const tenantId of tenants) {
      try {
        const result = await processFollowupForTenant(tenantId);
        results.push({ tenantId, ...result });
        logger.info('leadFollowup.tenant.done', { tenantId, ...result });
      } catch (err) {
        logger.error('leadFollowup.tenant.failed', { tenantId, error: err.message });
        results.push({ tenantId, error: err.message });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ results }) };
  } catch (err) {
    logger.error('lead-followup-cron: fatal error', { error: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    try { await shutdownPostHog(); } catch (_) {}
  }
}
