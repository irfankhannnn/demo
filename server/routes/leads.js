import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
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
} from '../crmDynamodbService.js';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../logger.js';

const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const router = express.Router();

// ============== Lead CRUD Routes ==============

// Get all leads with optional filters + pagination
router.get('/', validateToken, extractTenantId, async (req, res) => {
  try {
    const { leadType, status, priority, excludeConverted, limit, offset, sortBy, sortOrder, fromDate, toDate, minBudget, maxBudget, area, city, search, assignedTo, source, propertyType, propertySubType, createdBy, updatedBy, converted } = req.query;
    const filters = {};
    if (leadType) filters.leadType = leadType;
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
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
    console.error('Get leads error:', error);
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
    console.error('Search leads error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get available agents for assignedTo dropdown
router.get('/agents', validateToken, extractTenantId, async (req, res) => {
  try {
    const username = req.user?.username || 'Admin';
    res.json([{ username, label: username }]);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
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
    console.error('Get buyer leads error:', error);
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
    console.error('Get seller leads error:', error);
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
    console.error('Get tenant leads error:', error);
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
    console.error('Get owner leads error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get lead metrics
router.get('/metrics', validateToken, extractTenantId, async (req, res) => {
  try {
    const { from, to } = req.query;
    let allLeads = await getLeads(req.tenantId);
    if (from) {
      allLeads = allLeads.filter(l => l.createdAt >= from);
    }
    if (to) {
      allLeads = allLeads.filter(l => l.createdAt <= to);
    }

    const metrics = {
      total: allLeads.length,
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
        converted: 0,
        lost: 0,
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
      },
      conversionRate: 0,
    };

    allLeads.forEach(lead => {
      // Count by type
      if (metrics.byType[lead.leadType] !== undefined) {
        metrics.byType[lead.leadType]++;
      }
      // Count by status
      if (metrics.byStatus[lead.status] !== undefined) {
        metrics.byStatus[lead.status]++;
      }
      // Count by priority
      if (metrics.byPriority[lead.priority] !== undefined) {
        metrics.byPriority[lead.priority]++;
      }
    });

    // Calculate conversion rate
    if (metrics.total > 0) {
      metrics.conversionRate = Math.round((metrics.byStatus.converted / metrics.total) * 100);
    }

    res.json(metrics);
  } catch (error) {
    console.error('Get lead metrics error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single lead
router.get('/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const lead = await getLead(req.tenantId, req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create lead
router.post('/', validateToken, extractTenantId, async (req, res) => {
  const { precheckCredits, chargeCreditsForAction, handleCreditError } = await import('../middleware/meterCredits.js');
  const { refundCredits } = await import('../creditService.js');
  let creditCharge = null;

  try {
    await precheckCredits(req.tenantId, 'lead_add');

    const { name, leadType } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!leadType || !['buyer', 'seller', 'tenant', 'owner'].includes(leadType)) {
      return res.status(400).json({ error: 'leadType must be buyer, seller, tenant, or owner' });
    }
    const leadData = {
      ...req.body,
      createdBy: req.user?.username || 'Admin',
    };
    const lead = await createLead(req.tenantId, leadData);

    // Store the lead_add cost before charging for potential refund
    const { getCosts } = await import('../creditConfig.js');
    const costs = await getCosts();
    const leadAddCost = costs['lead_add'] || 0;

    // Charge credits immediately after successful create
    creditCharge = await chargeCreditsForAction(req.tenantId, 'lead_add', { recordId: lead.leadId });

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
    // If credits were charged but the handler subsequently failed, refund them
    if (creditCharge?.ledgerId && leadAddCost > 0) {
      refundCredits(req.tenantId, leadAddCost, 'lead_add', {
        ledgerId: creditCharge.ledgerId,
        reason: 'create_lead_failed_post_charge',
      }).catch(refundErr => console.error('refund.failed', refundErr.message));
    }
    if (handleCreditError(error, res)) return;
    console.error('Create lead error:', error);
    if (error.message && error.message.startsWith('A lead with this phone number already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update lead
router.put('/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || 'Admin',
    };
    const lead = await updateLead(req.tenantId, req.params.id, updateData);
    res.json(lead);
  } catch (error) {
    console.error('Update lead error:', error);
    if (error.message === 'Cannot update a converted lead') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Convert lead to buyer/tenant/owner
// IMPORTANT: Buyer and Tenant conversions now require transaction details
router.post('/:id/convert', validateToken, extractTenantId, async (req, res) => {
  try {
    const {
      existingContactId,
      purchaseDetails,    // Required for buyer conversion
      leaseDetails,       // Required for tenant conversion
      kycDetails,         // Optional KYC info during conversion
      createPropertyListing, // For seller-type leads (default true)
    } = req.body;

    const options = {
      existingContactId,
      convertedBy: req.user?.username || 'Admin',
      purchaseDetails,
      leaseDetails,
      kycDetails,
      createPropertyListing,
    };

    const result = await convertLead(req.tenantId, req.params.id, options);
    res.json(result);
  } catch (error) {
    console.error('Convert lead error:', error);
    if (error.message === 'Lead has already been converted') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Specified contact not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
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
    console.error('Get matching contacts error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete lead
router.delete('/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    await deleteLead(req.tenantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    if (error.message === 'Cannot delete a converted lead' || error.message === 'Lead not found') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Lead Notes Routes ==============

router.get('/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const notes = await getLeadNotes(req.tenantId, req.params.id);
    res.json(notes);
  } catch (error) {
    console.error('Get lead notes error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const noteData = {
      ...req.body,
      createdBy: req.user?.username || 'Admin',
    };
    const note = await createLeadNote(req.tenantId, req.params.id, noteData);
    res.status(201).json(note);
  } catch (error) {
    console.error('Create lead note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/:id/notes/:noteId', validateToken, extractTenantId, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const note = await updateLeadNote(req.tenantId, req.params.id, req.params.noteId, { content });
    res.json(note);
  } catch (error) {
    console.error('Update lead note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/:id/notes/:noteId', validateToken, extractTenantId, async (req, res) => {
  try {
    await deleteLeadNote(req.tenantId, req.params.id, req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete lead note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
