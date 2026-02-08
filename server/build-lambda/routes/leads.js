import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
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
  getContacts,
} from '../crmDynamodbService.js';

const router = express.Router();

// ============== Lead CRUD Routes ==============

// Get all leads with optional filters
router.get('/', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const { leadType, status, priority, excludeConverted } = req.query;
    const filters = {};
    if (leadType) filters.leadType = leadType;
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (excludeConverted === 'true') filters.excludeConverted = true;

    const leads = await getLeads(req.tenantId, filters);
    res.json(leads);
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get leads by type (convenience endpoints)
router.get('/buyers', authenticateToken, extractTenantId, async (req, res) => {
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

router.get('/sellers', authenticateToken, extractTenantId, async (req, res) => {
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

router.get('/tenants', authenticateToken, extractTenantId, async (req, res) => {
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

router.get('/owners', authenticateToken, extractTenantId, async (req, res) => {
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
router.get('/metrics', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const allLeads = await getLeads(req.tenantId);

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
router.get('/:id', authenticateToken, extractTenantId, async (req, res) => {
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
router.post('/', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const leadData = {
      ...req.body,
      createdBy: req.user?.username || 'Admin',
    };
    const lead = await createLead(req.tenantId, leadData);
    res.status(201).json(lead);
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update lead
router.put('/:id', authenticateToken, extractTenantId, async (req, res) => {
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
router.post('/:id/convert', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const { 
      existingContactId,
      purchaseDetails,    // Required for buyer conversion
      leaseDetails,       // Required for tenant conversion
      kycDetails,         // Optional KYC info during conversion
      createPropertyListing // For seller-type leads (default true)
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
router.get('/:id/matching-contacts', authenticateToken, extractTenantId, async (req, res) => {
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
router.delete('/:id', authenticateToken, extractTenantId, async (req, res) => {
  try {
    await deleteLead(req.tenantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Lead Notes Routes ==============

router.get('/:id/notes', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const notes = await getLeadNotes(req.tenantId, req.params.id);
    res.json(notes);
  } catch (error) {
    console.error('Get lead notes error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/:id/notes', authenticateToken, extractTenantId, async (req, res) => {
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

export default router;
