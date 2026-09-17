/**
 * Internal API for followup-agent-service (CONTRACTS.md section 3.1–3.3).
 *
 * The follow-up service calls back into the CRM three times per job: once to
 * pull everything the voice agent needs about a lead before dialling
 * (snapshot), and later to write down what happened (notes) or to hand the
 * lead to a human (escalations).
 *
 * Auth follows routes/adapterIngestionInternal.js: its own shared secret
 * (FOLLOWUP_INTERNAL_API_KEY, compared in constant time) plus an explicit
 * tenant header, never a user JWT — the caller is a service. A separate key
 * from the AI-calling and adapter ones, so compromising the follow-up stack
 * grants neither of the others' access. Fails closed (500) when the key is
 * unset rather than letting every request through.
 *
 * Mounted at /api/internal/followups, BEFORE the generic /api/internal router
 * in server.js: that one applies the AI-calling key check via router.use to
 * everything under it and would reject this traffic first.
 *
 * Internal routes are never phone-masked (CONTRACTS.md 7): the snapshot's
 * lead.phone is what the service dials.
 *
 * Dependency injection: `createFollowupInternalRouter(deps)` builds a router
 * with explicit collaborators so it can be unit-tested with fakes under any
 * runner; the default export is the production router. Data-layer modules are
 * loaded lazily on first use so importing this module stays cheap.
 */

import express from 'express';
import { logger } from '../logger.js';
import { safeKeyEquals } from './adapterIngestionInternal.js';
import { resolveFollowupConfig } from '../utils/followupConfig.js';
import { toAgentPropertyContext } from '../utils/propertyProjection.js';

export const FOLLOWUP_NOTE_TYPES = ['followup_call', 'visit_feedback', 'followup_status'];
export const ESCALATION_REASONS = ['max_attempts_exhausted', 'callback_requested', 'open_actions', 'error'];
const NOTE_AUTHOR = 'AI Follow-up Agent';
const OPEN_MEETING_STATUSES = new Set(['scheduled', 'rescheduled']);

async function loadCrm() {
  return import('../crmDynamodbService.js');
}
async function loadAgencyConfig() {
  return import('../agencyConfigService.js');
}
async function loadNotifications() {
  return import('../leadNotifications.js');
}
async function loadLeadSummary() {
  const mod = await import('./aiCallingInternal.js');
  return mod.buildLeadSummary;
}

/** "YYYY-MM-DD" + "HH:MM" as a sortable key; missing parts sort first. */
function meetingSortKey(m) {
  return `${m?.meetingDate || ''}T${m?.meetingTime || ''}`;
}

/** The meeting shape in CONTRACTS.md 3.1. */
export function projectMeeting(m) {
  if (!m) return null;
  return {
    meetingId: m.meetingId,
    title: m.title || null,
    meetingDate: m.meetingDate || null,
    meetingTime: m.meetingTime || null,
    location: m.location || null,
    status: m.status || null,
    meetingType: m.meetingType || null,
    propertyId: m.propertyId || null,
    propertyName: m.propertyName || null,
    confirmedAt: m.confirmedAt || null,
  };
}

/**
 * Pick the meeting to confirm and the visit to ask about from a lead's
 * meetings (any order; getMeetingsByEntity returns newest first).
 *
 * Upcoming = the earliest still-open meeting on or after `today`; if none is
 * in the future, the most recent open one — a visit scheduled for yesterday
 * that nobody closed is still the one the customer expects to be asked about.
 * Last completed = the most recent completed meeting.
 */
export function pickMeetings(meetings, today = new Date().toISOString().slice(0, 10)) {
  const list = Array.isArray(meetings) ? meetings : [];
  const open = list.filter((m) => OPEN_MEETING_STATUSES.has(m?.status)).sort((a, b) => meetingSortKey(a).localeCompare(meetingSortKey(b)));
  const future = open.filter((m) => (m.meetingDate || '') >= today);
  const upcoming = future[0] || open[open.length - 1] || null;
  const completed = list.filter((m) => m?.status === 'completed').sort((a, b) => meetingSortKey(b).localeCompare(meetingSortKey(a)));
  return { upcoming, lastCompleted: completed[0] || null };
}

function memberContact(m) {
  return m ? { userId: m.userId, name: m.name || null, email: m.email || null, phone: m.phone || null } : null;
}

export function createFollowupInternalRouter(deps = {}) {
  const crm = deps.crm || loadCrm;
  const agencyConfig = deps.agencyConfig || loadAgencyConfig;
  const notifications = deps.notifications || loadNotifications;
  const leadSummary = deps.leadSummary || loadLeadSummary;
  const log = deps.log || logger;
  const env = deps.env || process.env;
  const today = deps.today || (() => new Date().toISOString().slice(0, 10));

  const router = express.Router();

  const validateFollowupApiKey = (req, res, next) => {
    const expectedKey = env.FOLLOWUP_INTERNAL_API_KEY;

    if (!expectedKey) {
      log.error('followupInternal.not_configured', {});
      return res.status(500).json({ error: 'Follow-up internal API not configured' });
    }
    if (!safeKeyEquals(req.headers['x-api-key'], expectedKey)) {
      log.warn('followupInternal.unauthorized', {});
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  const extractTenantId = (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'x-tenant-id header is required' });
    }
    req.tenantId = tenantId;
    next();
  };

  router.use(validateFollowupApiKey);
  router.use(extractTenantId);

  // ============== 3.1 Lead snapshot ==============

  router.get('/leads/:leadId/snapshot', async (req, res) => {
    const { tenantId } = req;
    const { leadId } = req.params;
    try {
      const { getLead, getMeetingsByEntity, getProperty } = await crm();

      const lead = await getLead(tenantId, leadId);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Each side-lookup degrades to "unknown" on its own; the call can still
      // go ahead with just the lead, and the service copes with nulls.
      const [meetings, config, members, buildLeadSummary] = await Promise.all([
        getMeetingsByEntity(tenantId, 'LEAD', leadId).catch((err) => {
          log.warn('followupInternal.snapshot.meetings_failed', { tenantId, leadId, error: err.message });
          return [];
        }),
        agencyConfig().then((m) => m.getAgencyConfig(tenantId)).catch((err) => {
          log.warn('followupInternal.snapshot.config_failed', { tenantId, leadId, error: err.message });
          return null;
        }),
        notifications().then((m) => m.listTeamMembers(tenantId)).catch((err) => {
          log.warn('followupInternal.snapshot.team_failed', { tenantId, leadId, error: err.message });
          return [];
        }),
        leadSummary(),
      ]);

      const { upcoming, lastCompleted } = pickMeetings(meetings, today());

      const propertyId = upcoming?.propertyId || lastCompleted?.propertyId || null;
      let property = null;
      if (propertyId) {
        try {
          property = toAgentPropertyContext(await getProperty(tenantId, propertyId));
        } catch (err) {
          log.warn('followupInternal.snapshot.property_failed', { tenantId, leadId, propertyId, error: err.message });
        }
      }

      const { isAdminMember } = await notifications();
      const assignee = members.find((m) => m.userId === lead.assignedTo) || null;
      const admins = members.filter(isAdminMember);

      res.json({
        lead: {
          leadId: lead.leadId,
          name: lead.name || null,
          phone: lead.phone || null,
          status: lead.status || null,
          leadType: lead.leadType || null,
          assignedTo: lead.assignedTo || null,
          source: lead.source || null,
          sourceAdapter: lead.sourceAdapter || null,
          requirementSummary: buildLeadSummary(lead),
          notes: lead.notes || '',
        },
        assignee: memberContact(assignee),
        admins: admins.map(memberContact),
        upcomingMeeting: projectMeeting(upcoming),
        lastCompletedMeeting: projectMeeting(lastCompleted),
        property,
        agencyName: config?.agencyName || null,
        followupConfig: resolveFollowupConfig(config),
        aiEmployeeEnabled: Boolean(config?.aiEmployeeEnabled),
      });
    } catch (error) {
      log.error('followupInternal.snapshot.error', { tenantId, leadId, error: error.message });
      res.status(500).json({ error: error.message || 'Failed to build lead snapshot' });
    }
  });

  // ============== 3.2 Escalations ==============

  router.post('/escalations', async (req, res) => {
    const { tenantId } = req;
    const body = req.body || {};
    try {
      const { leadId, jobId, jobType, reason, summary, targetUserIds, details, attempts, lastCallSessionId } = body;
      if (!leadId || !jobId) {
        return res.status(400).json({ error: 'leadId and jobId are required' });
      }
      if (targetUserIds !== undefined && !Array.isArray(targetUserIds)) {
        return res.status(400).json({ error: 'targetUserIds must be an array' });
      }

      const { getLead } = await crm();
      const lead = await getLead(tenantId, leadId);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Audience = assignee + every admin + the tenant's configured extras,
      // unioned with whatever the service asked for. Computed here rather than
      // trusted from the body so a stale service-side list can never leave the
      // owner out.
      const [config, members] = await Promise.all([
        agencyConfig().then((m) => m.getAgencyConfig(tenantId)).catch(() => null),
        notifications().then((m) => m.listTeamMembers(tenantId)).catch(() => []),
      ]);
      const { isAdminMember, notifyFollowupEscalation } = await notifications();
      const targets = new Set((targetUserIds || []).filter((id) => typeof id === 'string' && id));
      if (lead.assignedTo) targets.add(lead.assignedTo);
      for (const m of members) if (isAdminMember(m)) targets.add(m.userId);
      for (const id of resolveFollowupConfig(config).escalationUserIds) targets.add(id);

      const { notified } = await notifyFollowupEscalation(tenantId, {
        lead,
        jobId,
        jobType: jobType || null,
        reason: ESCALATION_REASONS.includes(reason) ? reason : (reason ? String(reason).slice(0, 60) : 'error'),
        summary: summary ? String(summary) : '',
        targetUserIds: Array.from(targets),
        details: {
          ...(details && typeof details === 'object' ? details : {}),
          attempts: attempts ?? null,
          lastCallSessionId: lastCallSessionId || null,
        },
      });

      log.info('followupInternal.escalated', { tenantId, leadId, jobId, reason, notified: notified.length });
      res.json({ ok: true, notified });
    } catch (error) {
      log.error('followupInternal.escalation.error', { tenantId, leadId: body.leadId || null, error: error.message });
      res.status(500).json({ error: error.message || 'Failed to record escalation' });
    }
  });

  // ============== 3.3 Notes ==============

  router.post('/notes', async (req, res) => {
    const { tenantId } = req;
    const body = req.body || {};
    try {
      const { leadId, jobId, callSessionId, type, content, data } = body;
      if (!leadId) {
        return res.status(400).json({ error: 'leadId is required' });
      }
      if (!FOLLOWUP_NOTE_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${FOLLOWUP_NOTE_TYPES.join(', ')}` });
      }
      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'content is required' });
      }

      const { getLead, createLeadNote } = await crm();
      const lead = await getLead(tenantId, leadId);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const label = {
        followup_call: 'AI Follow-up call',
        visit_feedback: 'Site visit feedback',
        followup_status: 'AI Follow-up',
      }[type];
      const extras = [];
      if (data && typeof data === 'object') {
        // Structured feedback (liked / issues / clarifications / token
        // timeline) as a compact trailer so it is readable in the notes list.
        for (const [key, value] of Object.entries(data)) {
          if (value === undefined || value === null || value === '') continue;
          extras.push(`${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
        }
      }
      const noteContent = [
        `[${label}] ${content.trim().slice(0, 2000)}`,
        extras.length ? extras.join(' | ') : null,
      ].filter(Boolean).join('\n');

      // createLeadNote also appends the lead's history and logs the contact
      // activity, so one call covers "note + activity" (CONTRACTS.md 3.3).
      const note = await createLeadNote(tenantId, leadId, {
        content: noteContent,
        createdBy: NOTE_AUTHOR,
      });

      log.info('followupInternal.note_added', { tenantId, leadId, jobId: jobId || null, callSessionId: callSessionId || null, type });
      res.json({ ok: true, noteId: note.noteId });
    } catch (error) {
      log.error('followupInternal.note.error', { tenantId, leadId: body.leadId || null, error: error.message });
      res.status(500).json({ error: error.message || 'Failed to add note' });
    }
  });

  return router;
}

export default createFollowupInternalRouter();
