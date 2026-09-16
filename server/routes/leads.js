import express from 'express';
import axios from 'axios';
import validateToken from '../middleware/validateToken.js';
import { getAuthServiceBaseUrl, getAiCallingServiceBaseUrl } from '../config/serviceUrls.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireAdminOrManager, requireCrmMemberOrAbove } from '../middleware/requireRole.js';
import {
  createLead,
  getLeads,
  getLead,
  updateLead,
  deleteLead,
  convertLead,
  createLeadNote,
  getLeadNotes,
  updateLeadNote,
  deleteLeadNote,
  searchLeads,
  getContacts,
  unwrapLeadsList,
  isLeadConverted,
  getLeadConversionSnapshots,
  getLeadConversionSnapshotsByLeadId,
} from '../crmDynamodbService.js';
import { projectLeadFromConversionSnapshot } from '../services/leadConversionService.js';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../logger.js';
import { SERVICE_ACCOUNT_USER } from '../utils/serviceAccount.js';
import { resolveRequestActor } from '../utils/requestActor.js';
import { notifyNewLead, notifyLeadAssigned, notifyHotLead } from '../leadNotifications.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { hasCreditForAiCall } from '../aiCallBilling.js';
import {
  createFollowupJob,
  listFollowupJobs,
  stripPhoneFields,
  FollowupServiceError,
  FOLLOWUP_JOB_TYPES,
  DEFAULT_FOLLOWUP_JOB_TYPE,
} from '../services/followupService.js';

const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const router = express.Router();

async function fetchTeamMemberMap(req) {
  const map = {};
  try {
    if (!process.env.AUTH_SERVICE_DOMAIN_NAME) return map;
    const authServiceUrl = getAuthServiceBaseUrl();

    const response = await axios.get(`${authServiceUrl}/users`, {
      headers: { Authorization: req.headers.authorization },
      timeout: parseInt(process.env.AUTH_SERVICE_TIMEOUT_MS || '5000', 10),
    });

    const users = response.data?.users || response.data || [];
    for (const user of users) {
      if (user.userId) {
        map[user.userId] = user.displayName || user.username || user.email || 'Team member';
      }
    }
  } catch (error) {
    logger.warn('leads.team_member_map.fetch_failed', { error: error.message, tenantId: req.tenantId });
    const currentUser = req.user;
    const currentId = currentUser?.userId || currentUser?.sub;
    if (currentId) {
      map[currentId] = currentUser?.displayName || currentUser?.username || currentUser?.email || SERVICE_ACCOUNT_USER;
    }
  }
  return map;
}

// ============== Lead CRUD Routes ==============

// Get all leads with optional filters + pagination
router.get('/', validateToken, extractTenantId, async (req, res) => {
  try {
    const { leadType, status, temperature, excludeConverted, limit, offset, sortBy, sortOrder, fromDate, toDate, minBudget, maxBudget, area, city, search, assignedTo, unassigned, source, propertyType, propertySubType, createdBy, updatedBy, converted } = req.query;
    const filters = {};
    if (leadType) filters.leadType = leadType;
    if (status) filters.status = status;
    if (temperature) filters.temperature = temperature; // hot | warm | cold | unscored
    if (excludeConverted === 'true') filters.excludeConverted = true;
    if (limit) filters.limit = limit;
    if (offset) filters.offset = offset;
    if (sortBy) filters.sortBy = sortBy;
    if (sortOrder) filters.sortOrder = sortOrder;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;
    if (minBudget) filters.minBudget = minBudget;
    if (maxBudget) filters.maxBudget = maxBudget;
    if (area) filters.area = area;
    if (search) filters.search = search;
    if (assignedTo) filters.assignedTo = assignedTo;
    if (unassigned === 'true') filters.unassigned = true;
    if (source) filters.source = source;
    if (city) filters.city = city;
    if (propertyType) filters.propertyType = propertyType;
    if (propertySubType) filters.propertySubType = propertySubType;
    if (createdBy) filters.createdBy = createdBy;
    if (updatedBy) filters.updatedBy = updatedBy;
    if (converted === 'true') filters.converted = true;

    const leads = await getLeads(req.tenantId, filters);
    res.json(leads);
  } catch (error) {
    logger.error('leads.get.error', { tenantId: req.tenantId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Search leads by name, phone, or email
router.get('/search', validateToken, extractTenantId, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json([]);
    }
    const results = await searchLeads(req.tenantId, q);
    res.json(results);
  } catch (error) {
    logger.error('leads.search.error', { tenantId: req.tenantId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get available agents for assignedTo dropdown
router.get('/agents', validateToken, extractTenantId, async (req, res) => {
  try {
    let authServiceUrl;
    try {
      authServiceUrl = getAuthServiceBaseUrl();
    } catch (configError) {
      return res.status(500).json({ error: 'Auth service not configured', details: configError.message });
    }
    const authHeader = req.headers.authorization;

    const response = await axios.get(`${authServiceUrl}/users`, {
      headers: { Authorization: authHeader },
      timeout: parseInt(process.env.AUTH_SERVICE_TIMEOUT_MS || '5000', 10),
    });

    const users = response.data?.users || response.data || [];
    const activeUsers = users.filter(u => u.status === 'ACTIVE');
    const members = activeUsers.map(u => ({
      userId: u.userId,
      username: u.displayName || u.username || u.email || 'Unknown',
      label: u.displayName || u.username || u.email || 'Unknown',
      role: u.role,
    }));

    res.json(members);
  } catch (error) {
    logger.error('leads.agents.fetch_failed', { error: error.message, tenantId: req.tenantId });
    // Fallback to current user so the UI still works if auth service is down
    const currentUser = req.user;
    res.json([{
      userId: currentUser?.userId || currentUser?.sub || 'admin',
      username: currentUser?.displayName || currentUser?.username || currentUser?.email || SERVICE_ACCOUNT_USER,
      label: currentUser?.displayName || currentUser?.username || currentUser?.email || SERVICE_ACCOUNT_USER,
      role: currentUser?.role,
    }]);
  }
});

// Get leads by type (convenience endpoints)
router.get('/buyers', validateToken, extractTenantId, async (req, res) => {
  try {
    const { status, excludeConverted } = req.query;
    const filters = { leadType: 'buyer' };
    if (status) filters.status = status;
    if (excludeConverted === 'true') filters.excludeConverted = true;

    const leads = await getLeads(req.tenantId, filters);
    res.json(leads);
  } catch (error) {
    logger.error('leads.buyers.get.error', { tenantId: req.tenantId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/sellers', validateToken, extractTenantId, async (req, res) => {
  try {
    const { status, excludeConverted } = req.query;
    const filters = { leadType: 'seller' };
    if (status) filters.status = status;
    if (excludeConverted === 'true') filters.excludeConverted = true;

    const leads = await getLeads(req.tenantId, filters);
    res.json(leads);
  } catch (error) {
    logger.error('leads.sellers.get.error', { tenantId: req.tenantId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/tenants', validateToken, extractTenantId, async (req, res) => {
  try {
    const { status, excludeConverted } = req.query;
    const filters = { leadType: 'tenant' };
    if (status) filters.status = status;
    if (excludeConverted === 'true') filters.excludeConverted = true;

    const leads = await getLeads(req.tenantId, filters);
    res.json(leads);
  } catch (error) {
    logger.error('leads.tenants.get.error', { tenantId: req.tenantId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/owners', validateToken, extractTenantId, async (req, res) => {
  try {
    const { status, excludeConverted } = req.query;
    const filters = { leadType: 'owner' };
    if (status) filters.status = status;
    if (excludeConverted === 'true') filters.excludeConverted = true;

    const leads = await getLeads(req.tenantId, filters);
    res.json(leads);
  } catch (error) {
    logger.error('leads.owners.get.error', { tenantId: req.tenantId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get lead metrics
router.get('/metrics', validateToken, extractTenantId, async (req, res) => {
  try {
    const { from, to } = req.query;
    let allLeads = unwrapLeadsList(await getLeads(req.tenantId, {}));
    if (from) {
      allLeads = allLeads.filter(l => l.createdAt >= from);
    }
    if (to) {
      allLeads = allLeads.filter(l => l.createdAt <= to);
    }

    let conversions = await getLeadConversionSnapshots(req.tenantId, {});
    if (from) {
      conversions = conversions.filter((c) => (c.convertedAt || '') >= from);
    }
    if (to) {
      conversions = conversions.filter((c) => (c.convertedAt || '') <= to);
    }

    const metrics = {
      total: allLeads.length + conversions.length,
      byType: {
        buyer: 0,
        seller: 0,
        tenant: 0,
        owner: 0,
      },
      byStatus: {
        new: 0,
        contacted: 0,
        qualified: 0,
        negotiating: 0,
        converted: conversions.length,
        lost: 0,
      },
      byTemperature: {
        hot: 0,
        warm: 0,
        cold: 0,
        unscored: 0,
      },
      conversionRate: 0,
    };

    allLeads.forEach(lead => {
      if (metrics.byType[lead.leadType] !== undefined) {
        metrics.byType[lead.leadType]++;
      }
      const statusKey = isLeadConverted(lead) ? 'converted' : (lead.status || 'new');
      if (metrics.byStatus[statusKey] !== undefined) {
        metrics.byStatus[statusKey]++;
      }
      const temperatureKey = lead.score ? String(lead.score).toLowerCase() : 'unscored';
      if (metrics.byTemperature[temperatureKey] !== undefined) {
        metrics.byTemperature[temperatureKey]++;
      }
    });

    conversions.forEach((snap) => {
      const lt = snap.leadType || snap.role;
      if (lt && metrics.byType[lt] !== undefined) {
        metrics.byType[lt]++;
      }
    });

    const denom = allLeads.length + conversions.length;
    if (denom > 0) {
      metrics.conversionRate = Math.round((metrics.byStatus.converted / denom) * 100);
    }

    res.json(metrics);
  } catch (error) {
    logger.error('leads.metrics.get.error', { tenantId: req.tenantId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Conversion history MUST be registered before /:id
router.get('/conversions/history', validateToken, extractTenantId, async (req, res) => {
  try {
    const { leadType, search } = req.query;
    const snapshots = await getLeadConversionSnapshots(req.tenantId, { leadType, search });
    res.json({ conversions: snapshots, total: snapshots.length });
  } catch (error) {
    logger.error('leads.conversions.history.error', { tenantId: req.tenantId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single lead (falls back to immutable conversion snapshot after convert)
router.get('/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const lead = await getLead(req.tenantId, req.params.id);
    if (lead) {
      return res.json(lead);
    }

    const snapshots = await getLeadConversionSnapshotsByLeadId(req.tenantId, req.params.id);
    const archived = projectLeadFromConversionSnapshot(snapshots[0]);
    if (archived) {
      return res.json(archived);
    }

    return res.status(404).json({ error: 'Lead not found' });
  } catch (error) {
    logger.error('leads.get_one.error', { tenantId: req.tenantId, leadId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

import { creditActionRateLimit } from '../middleware/rateLimiter.js';

// Create lead — all members can create
router.post('/', validateToken, extractTenantId, requireCrmMemberOrAbove, creditActionRateLimit, async (req, res) => {
  const { precheckCredits, chargeCreditsForAction, handleCreditError } = await import('../middleware/meterCredits.js');
  const { refundCredits } = await import('../creditService.js');
  let creditCharge = null;
  let leadAddCost = 0;

  try {
    await precheckCredits(req.tenantId, 'lead_add');

    // Store the lead_add cost before creating for potential refund
    const { getCosts } = await import('../creditConfig.js');
    const costs = await getCosts();
    leadAddCost = costs['lead_add'] || 0;

    const { name, leadType } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!leadType || !['buyer', 'seller', 'tenant', 'owner'].includes(leadType)) {
      return res.status(400).json({ error: 'leadType must be buyer, seller, tenant, or owner' });
    }
    const assigneeLabelMap = await fetchTeamMemberMap(req);
    const { actorName, actorUserId } = resolveRequestActor(req.user, assigneeLabelMap);
    const leadData = {
      ...req.body,
      createdBy: actorName,
      createdByUserId: actorUserId,
    };
    const lead = await createLead(req.tenantId, leadData);

    // Charge credits immediately after successful create
    creditCharge = await chargeCreditsForAction(req.tenantId, 'lead_add', { recordId: lead.leadId });

    // Notify the tenant a new lead came in — independent of AI qualification,
    // always fires so a human knows to follow up.
    notifyNewLead(req.tenantId, lead).catch((err) =>
      logger.warn('leads.create.notify_failed', { tenantId: req.tenantId, leadId: lead.leadId, error: err.message })
    );

    // Publish lead.created event for AI qualification (non-blocking)
    if (process.env.AGENTS_ENABLED !== 'true') {
      res.status(201).json({ ...lead, creditsRemaining: creditCharge.balance });
      return;
    }

    try {
      await eventBridge.send(new PutEventsCommand({
        Entries: [{
          Source: 'crm.leads',
          DetailType: 'lead.created',
          Detail: JSON.stringify({
            tenantId: req.tenantId,
            leadId: lead.id || lead.leadId,
            leadType: lead.leadType,
            name: lead.name,
            phone: lead.phone,
            createdAt: new Date().toISOString(),
          }),
        }],
      }));
      logger.info('lead.created.event.published', { tenantId: req.tenantId, leadId: lead.id || lead.leadId });
    } catch (ebErr) {
      logger.warn('lead.created.event.publish.failed', { tenantId: req.tenantId, error: ebErr.message });
      // Non-blocking — don't fail the request
    }

    res.status(201).json({ ...lead, creditsRemaining: creditCharge.balance });
  } catch (error) {
    // If credits were charged but the handler subsequently failed, refund them (blocking)
    if (creditCharge?.ledgerId && leadAddCost > 0) {
      try {
        await refundCredits(req.tenantId, leadAddCost, 'lead_add', {
          ledgerId: creditCharge.ledgerId,
          reason: 'create_lead_failed_post_charge',
        });
        logger.info('leads.refund.succeeded', { tenantId: req.tenantId, ledgerId: creditCharge.ledgerId, amount: leadAddCost });
      } catch (refundErr) {
        // Critical: refund failed — credits are lost. Log with high severity and alert.
        logger.error('leads.refund.failed.critical', {
          tenantId: req.tenantId,
          ledgerId: creditCharge.ledgerId,
          amount: leadAddCost,
          error: refundErr.message,
          // Flag for manual reconciliation
          requiresManualRefund: true,
        });
        // Still return error to client, but include refund failure info
        if (handleCreditError(error, res)) return;
        return res.status(500).json({
          error: 'Internal server error',
          details: 'Credit refund failed — please contact support',
          refundFailed: true,
          ledgerId: creditCharge.ledgerId,
        });
      }
    }
    if (handleCreditError(error, res)) return;
    logger.error('leads.create.error', { tenantId: req.tenantId, error: error.message });
    if (error.message && error.message.startsWith('A lead with this phone number already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update lead — all members can update
router.put('/:id', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const assigneeLabelMap = await fetchTeamMemberMap(req);
    const { actorName, actorUserId } = resolveRequestActor(req.user, assigneeLabelMap);
    const before = await getLead(req.tenantId, req.params.id);

    const updateData = { ...req.body };
    // `priority` is retired on the Lead entity — accept it for backward
    // compatibility with any not-yet-updated client, but never persist it.
    delete updateData.priority;
    // A client-set `score` is always a human override — scoreSource/scoredAt
    // are stamped server-side, not accepted from the request body, so the
    // "who set this" trail can't be spoofed.
    delete updateData.scoreSource;
    if (updateData.score !== undefined) {
      updateData.scoreSource = 'manual';
      updateData.scoredAt = new Date().toISOString();
    }
    updateData.updatedBy = actorName;
    updateData.updatedByUserId = actorUserId;

    const lead = await updateLead(req.tenantId, req.params.id, updateData, { assigneeLabelMap });
    res.json(lead);

    if (before && lead.assignedTo && lead.assignedTo !== before.assignedTo) {
      notifyLeadAssigned(req.tenantId, lead, lead.assignedTo).catch((err) =>
        logger.warn('leads.update.notify_assigned_failed', { tenantId: req.tenantId, leadId: lead.leadId, error: err.message })
      );
    }
    if (before && lead.score === 'HOT' && before.score !== 'HOT') {
      notifyHotLead(req.tenantId, lead).catch((err) =>
        logger.warn('leads.update.notify_hot_failed', { tenantId: req.tenantId, leadId: lead.leadId, error: err.message })
      );
    }
  } catch (error) {
    logger.error('leads.update.error', { tenantId: req.tenantId, leadId: req.params.id, error: error.message });
    if (error.message === 'Cannot update a converted lead') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message?.includes("' to update its ")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Trigger an on-demand AI qualification call — "Call now to qualify" in the
// Lead Drawer. Proxies to ai-calling-service; the actual score gets written
// back later via ai-calling-service -> POST /api/internal/leads/:id/call-outcome.
router.post('/:id/qualify-call', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const lead = await getLead(req.tenantId, req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!lead.phone) {
      return res.status(400).json({ error: 'Lead has no phone number to call' });
    }

    const agencyConfig = await getAgencyConfig(req.tenantId).catch(() => null);
    if (!agencyConfig?.aiEmployeeEnabled) {
      return res.status(409).json({ error: 'AI calling not enabled for this tenant' });
    }

    // Includes ai-calling-service's /api/ai-calling prefix; null when unset.
    const aiCallingServiceUrl = getAiCallingServiceBaseUrl();
    // The service's management API authenticates this backend as a service and
    // fails closed, so without the key every call would 401. Log presence only.
    const aiCallingApiKey = process.env.CRM_CALLER_API_KEY;
    if (!aiCallingServiceUrl || !aiCallingApiKey) {
      logger.warn('leads.qualifyCall.not_configured', {
        tenantId: req.tenantId,
        hasBaseUrl: Boolean(aiCallingServiceUrl),
        hasApiKey: Boolean(aiCallingApiKey),
      });
      return res.status(503).json({ error: 'AI calling service not configured' });
    }

    // AI calls are billed per started minute once the call settles
    // (aiCallBilling.js). Because that charge happens after the fact, this is
    // the only point where we can refuse a call the tenant cannot pay for —
    // require at least one minute's worth of credit before dialling.
    const credit = await hasCreditForAiCall(req.tenantId);
    if (!credit.ok) {
      return res.status(402).json({
        error: 'insufficient_credits',
        balance: credit.balance,
        required: credit.required,
        message: 'Out of credits. Buy more to start an AI call.',
      });
    }

    const response = await axios.post(
      `${aiCallingServiceUrl}/calls/start`,
      {
        leadId: lead.leadId,
        leadName: lead.name,
        leadPhone: lead.phone,
        callPurpose: 'lead_qualification',
      },
      {
        headers: {
          'x-api-key': aiCallingApiKey,
          'x-tenant-id': req.tenantId,
        },
        timeout: parseInt(process.env.AI_CALLING_SERVICE_TIMEOUT_MS || '10000', 10),
      }
    );

    res.status(202).json({ callSessionId: response.data.callSessionId, status: response.data.status });
  } catch (error) {
    logger.error('leads.qualifyCall.error', { tenantId: req.tenantId, leadId: req.params.id, error: error.message });
    if (error.response) {
      return res.status(error.response.status || 502).json({ error: error.response.data?.error || 'AI calling service error' });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== AI Follow-up Calls (CONTRACTS.md section 5) ==============
//
// Thin proxies to followup-agent-service. Same trust boundary as
// /:id/qualify-call: the browser names a lead, the tenant comes from the
// session, and the lead's phone never appears in a response — the service
// dials it later, out of band. A job the service returns is passed through
// with phone-shaped keys stripped, belt and braces.

function handleFollowupError(res, req, label, error) {
  if (error instanceof FollowupServiceError) {
    if (error.code === 'not_configured') {
      return res.status(503).json({ error: 'Follow-up service not configured' });
    }
    logger.error(`leads.${label}.service_error`, { tenantId: req.tenantId, leadId: req.params.id, status: error.status, error: error.message });
    return res.status(error.status || 502).json({ error: error.message || 'Follow-up service error' });
  }
  logger.error(`leads.${label}.error`, { tenantId: req.tenantId, leadId: req.params.id, error: error.message });
  return res.status(500).json({ error: error.message || 'Internal server error' });
}

// Schedule an AI follow-up call (site-visit confirmation by default).
router.post('/:id/followup-call', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const { jobType, note } = req.body || {};
    if (jobType !== undefined && !FOLLOWUP_JOB_TYPES.includes(jobType)) {
      return res.status(400).json({ error: `jobType must be one of: ${FOLLOWUP_JOB_TYPES.join(', ')}` });
    }

    const lead = await getLead(req.tenantId, req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!lead.phone) {
      return res.status(400).json({ error: 'Lead has no phone number to call' });
    }

    const agencyConfig = await getAgencyConfig(req.tenantId).catch(() => null);
    if (!agencyConfig?.aiEmployeeEnabled) {
      return res.status(409).json({ error: 'AI calling not enabled for this tenant' });
    }

    const { actorUserId, actorName } = resolveRequestActor(req.user);
    const context = {};
    if (typeof note === 'string' && note.trim()) context.note = note.trim().slice(0, 1000);

    const { job, duplicate } = await createFollowupJob(req.tenantId, {
      leadId: lead.leadId,
      jobType: jobType || DEFAULT_FOLLOWUP_JOB_TYPE,
      context,
      requestedBy: actorUserId || actorName || 'crm-user',
      source: 'api',
    });

    res.status(duplicate ? 200 : 201).json({ job: stripPhoneFields(job), duplicate: Boolean(duplicate) });
  } catch (error) {
    handleFollowupError(res, req, 'followupCall', error);
  }
});

// Follow-up jobs for a lead (timeline in the lead drawer).
router.get('/:id/followups', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const lead = await getLead(req.tenantId, req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { status, limit } = req.query;
    const { jobs } = await listFollowupJobs(req.tenantId, { leadId: lead.leadId, status, limit });
    res.json({ jobs: stripPhoneFields(jobs) });
  } catch (error) {
    handleFollowupError(res, req, 'followups', error);
  }
});

// Convert lead — all members can convert (atomic: succeeds completely or fails completely)
router.post('/:id/convert', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const {
      existingContactId,
      purchaseDetails,
      leaseDetails,
      kycDetails,
      createPropertyListing,
    } = req.body;

    const assigneeLabelMap = await fetchTeamMemberMap(req);
    const { actorName, actorUserId } = resolveRequestActor(req.user, assigneeLabelMap);

    const options = {
      existingContactId,
      convertedBy: actorName,
      convertedByUserId: actorUserId,
      purchaseDetails,
      leaseDetails,
      kycDetails,
      createPropertyListing,
    };

    const result = await convertLead(req.tenantId, req.params.id, options);
    res.json(result);
  } catch (error) {
    logger.error('leads.convert.error', { tenantId: req.tenantId, leadId: req.params.id, code: error.code, error: error.message });

    if (error.code === 'ALREADY_CONVERTED' || error.message === 'Lead already converted' || error.message === 'Lead has already been converted') {
      return res.status(409).json({
        error: error.message,
        code: 'ALREADY_CONVERTED',
        convertedTo: error.convertedTo || null,
        conversionSnapshotId: error.conversionSnapshotId || null,
      });
    }
    if (error.code === 'CONVERSION_TOO_LARGE' || error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    if (error.message === 'Specified contact not found' || error.message === 'Lead not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error', code: error.code || 'CONVERSION_FAILED' });
  }
});

router.get('/:id/conversion', validateToken, extractTenantId, async (req, res) => {
  try {
    const snapshots = await getLeadConversionSnapshotsByLeadId(req.tenantId, req.params.id);
    if (!snapshots.length) {
      return res.status(404).json({ error: 'Conversion snapshot not found' });
    }
    const archived = projectLeadFromConversionSnapshot(snapshots[0]);
    res.json({ ...snapshots[0], archivedLead: archived });
  } catch (error) {
    logger.error('leads.conversion.get.error', { tenantId: req.tenantId, leadId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get contacts for linking during conversion
router.get('/:id/matching-contacts', validateToken, extractTenantId, async (req, res) => {
  try {
    const lead = await getLead(req.tenantId, req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Find contacts that might match this lead (by phone)
    const allContacts = await getContacts(req.tenantId);
    
    const matchingContacts = allContacts.filter(contact => {
      if (!lead.phone || !contact.phone) return false;
      const leadPhone = lead.phone.replace(/[^0-9]/g, '').slice(-10);
      const contactPhone = contact.phone.replace(/[^0-9]/g, '').slice(-10);
      return !!leadPhone && leadPhone === contactPhone;
    });

    res.json(matchingContacts);
  } catch (error) {
    logger.error('leads.matching_contacts.get.error', { tenantId: req.tenantId, leadId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete lead
router.delete('/:id', validateToken, extractTenantId, requireAdminOrManager, async (req, res) => {
  try {
    await deleteLead(req.tenantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('leads.delete.error', { tenantId: req.tenantId, leadId: req.params.id, error: error.message });
    if (error.message === 'Cannot delete a converted lead' || error.message === 'Lead not found') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Lead Notes Routes ==============

router.get('/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const lead = await getLead(req.tenantId, req.params.id);
    if (lead) {
      const notes = await getLeadNotes(req.tenantId, req.params.id);
      return res.json(notes);
    }

    const snapshots = await getLeadConversionSnapshotsByLeadId(req.tenantId, req.params.id);
    const archived = projectLeadFromConversionSnapshot(snapshots[0]);
    if (archived) {
      return res.json(archived.snapshotNotes || []);
    }

    res.json([]);
  } catch (error) {
    logger.error('leads.notes.get.error', { tenantId: req.tenantId, leadId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/:id/notes', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const assigneeLabelMap = await fetchTeamMemberMap(req);
    const { actorName, actorUserId } = resolveRequestActor(req.user, assigneeLabelMap);
    const noteData = {
      ...req.body,
      createdBy: actorName,
      createdByUserId: actorUserId,
    };
    const note = await createLeadNote(req.tenantId, req.params.id, noteData);
    res.status(201).json(note);
  } catch (error) {
    logger.error('leads.notes.create.error', { tenantId: req.tenantId, leadId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/:id/notes/:noteId', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const assigneeLabelMap = await fetchTeamMemberMap(req);
    const { actorName, actorUserId } = resolveRequestActor(req.user, assigneeLabelMap);
    const note = await updateLeadNote(req.tenantId, req.params.id, req.params.noteId, {
      content,
      updatedBy: actorName,
      updatedByUserId: actorUserId,
    });
    res.json(note);
  } catch (error) {
    logger.error('leads.notes.update.error', { tenantId: req.tenantId, leadId: req.params.id, noteId: req.params.noteId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/:id/notes/:noteId', validateToken, extractTenantId, requireAdminOrManager, async (req, res) => {
  try {
    await deleteLeadNote(req.tenantId, req.params.id, req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    logger.error('leads.notes.delete.error', { tenantId: req.tenantId, leadId: req.params.id, noteId: req.params.noteId, error: error.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
