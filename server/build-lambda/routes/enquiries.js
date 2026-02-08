import express from 'express';
import {
  createEnquiry,
  getEnquiries,
  getEnquiriesByStatus,
  getEnquiry,
  updateEnquiry,
  getEnquiryMetrics,
  createEnquiryNote,
  getEnquiryNotes,
  updateEnquiryNote,
  deleteEnquiryNote,
} from '../enquiryDynamodbService.js';
import {
  createOwner,
  createCustomer,
  createCustomerNote,
  getCustomers,
  getOwners,
  getOwnerByPhone,
  getCustomerByPhone,
  createOrUpdateOwnerByPhone,
  createOrUpdateCustomerByPhone,
  createOwnerNote,
} from '../crmDynamodbService.js';
import { authenticateToken } from '../middleware/auth.js';
import { extractTenantId, extractTenantIdOptional } from '../tenantMiddleware.js';

const router = express.Router();

// ============== Public Enquiry Submission Routes ==============

/**
 * Submit contact form enquiry (public - no auth required)
 * POST /api/enquiries/contact
 */
router.post('/contact', extractTenantIdOptional, async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const { name, email, phone, message, userType, propertyType, wantPropertyManagement } = req.body;

    if (!name || !phone || !message) {
      return res.status(400).json({ error: 'Name, phone, and message are required' });
    }

    const enquiry = await createEnquiry(req.tenantId, {
      formType: 'contact',
      name,
      email,
      phone,
      message,
      userType,
      propertyType,
      wantPropertyManagement: wantPropertyManagement || false,
      source: 'contact_page',
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you within 24 hours.',
      enquiryId: enquiry.enquiryId,
    });
  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit enquiry' });
  }
});

// Enquiry notes routes
router.get('/:id/notes', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const notes = await getEnquiryNotes(req.tenantId, req.params.id);
    res.json(notes);
  } catch (error) {
    console.error('Get enquiry notes error:', error);
    res.status(500).json({ error: error.message || 'Failed to get enquiry notes' });
  }
});

router.post('/:id/notes', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const note = await createEnquiryNote(req.tenantId, req.params.id, req.body);
    res.status(201).json(note);
  } catch (error) {
    console.error('Create enquiry note error:', error);
    res.status(500).json({ error: error.message || 'Failed to create enquiry note' });
  }
});

router.put('/:id/notes/:noteId', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const updated = await updateEnquiryNote(req.tenantId, req.params.id, req.params.noteId, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Update enquiry note error:', error);
    res.status(500).json({ error: error.message || 'Failed to update enquiry note' });
  }
});

router.delete('/:id/notes/:noteId', authenticateToken, extractTenantId, async (req, res) => {
  try {
    await deleteEnquiryNote(req.tenantId, req.params.id, req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete enquiry note error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete enquiry note' });
  }
});

/**
 * Submit consultation form enquiry (public - no auth required)
 * POST /api/enquiries/consultation
 */
router.post('/consultation', extractTenantIdOptional, async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const { name, mobile, requirement } = req.body;

    if (!name || !mobile || !requirement) {
      return res.status(400).json({ error: 'Name, mobile, and requirement are required' });
    }

    const enquiry = await createEnquiry(req.tenantId, {
      formType: 'consultation',
      name,
      phone: mobile,
      message: requirement,
      source: 'homepage_consultation',
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Our team will contact you within 24 hours.',
      enquiryId: enquiry.enquiryId,
    });
  } catch (error) {
    console.error('Consultation form submission error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit enquiry' });
  }
});

// ============== Protected CRM Routes ==============

/**
 * Create an enquiry manually (CRM - auth required)
 * POST /api/enquiries
 */
router.post('/', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const {
      formType,
      name,
      email,
      phone,
      message,
      userType,
      propertyType,
      wantPropertyManagement,
      source,
      notes,
      status,
      assignedTo,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const enquiry = await createEnquiry(req.tenantId, {
      formType: formType || 'contact',
      name,
      email: email || null,
      phone,
      message: message || null,
      userType: userType || null,
      propertyType: propertyType || null,
      wantPropertyManagement: wantPropertyManagement || false,
      source: source || 'crm_manual',
      notes: notes || null,
      status: status || 'new',
      assignedTo: assignedTo || null,
    });

    res.status(201).json(enquiry);
  } catch (error) {
    console.error('Create enquiry (manual) error:', error);
    res.status(500).json({ error: error.message || 'Failed to create enquiry' });
  }
});

/**
 * Get all enquiries (CRM - auth required)
 * GET /api/enquiries
 */
router.get('/', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const { status } = req.query;
    
    let enquiries;
    if (status) {
      enquiries = await getEnquiriesByStatus(req.tenantId, status);
    } else {
      enquiries = await getEnquiries(req.tenantId);
    }

    // Defensive: ensure only enquiry PROFILE items are returned (exclude ENQUIRY_NOTE rows)
    const filtered = (Array.isArray(enquiries) ? enquiries : []).filter(
      (e) => e && e.EntityType === 'ENQUIRY' && e.enquiryId
    );

    res.json(filtered);
  } catch (error) {
    console.error('Get enquiries error:', error);
    res.status(500).json({ error: error.message || 'Failed to get enquiries' });
  }
});

/**
 * Get enquiry metrics (CRM - auth required)
 * GET /api/enquiries/metrics
 */
router.get('/metrics', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const metrics = await getEnquiryMetrics(req.tenantId);
    res.json(metrics);
  } catch (error) {
    console.error('Get enquiry metrics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get metrics' });
  }
});

/**
 * Get single enquiry (CRM - auth required)
 * GET /api/enquiries/:id
 */
router.get('/:id', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const enquiry = await getEnquiry(req.tenantId, req.params.id);
    
    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json(enquiry);
  } catch (error) {
    console.error('Get enquiry error:', error);
    res.status(500).json({ error: error.message || 'Failed to get enquiry' });
  }
});

/**
 * Update enquiry status/notes (CRM - auth required)
 * PUT /api/enquiries/:id
 */
router.put('/:id', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const { status, notes, assignedTo } = req.body;
    
    const enquiry = await updateEnquiry(req.tenantId, req.params.id, {
      status,
      notes,
      assignedTo,
    });

    res.json(enquiry);
  } catch (error) {
    console.error('Update enquiry error:', error);
    res.status(500).json({ error: error.message || 'Failed to update enquiry' });
  }
});

/**
 * Convert enquiry to Owner or Tenant (CRM - auth required)
 * Uses upsert logic - if owner/tenant with same phone exists, updates them instead of creating duplicate
 * POST /api/enquiries/:id/convert
 */
router.post('/:id/convert', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const { convertTo } = req.body; // 'owner' or 'tenant'
    
    if (!convertTo || !['owner', 'tenant'].includes(convertTo)) {
      return res.status(400).json({ error: 'Invalid conversion type. Must be "owner" or "tenant"' });
    }
    
    // Get the enquiry
    const enquiry = await getEnquiry(req.tenantId, req.params.id);
    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    
    // If enquiry is already converted, do not convert again
    if (enquiry.status === 'converted' && enquiry.convertedTo && enquiry.convertedId) {
      return res.status(400).json({
        error: `Enquiry already converted to ${enquiry.convertedTo}.`,
        alreadyConverted: true,
        convertedTo: enquiry.convertedTo,
        convertedId: enquiry.convertedId,
      });
    }
    
    const phone = enquiry.phone;
    
    let createdRecord;
    let wasExisting = false;
    
    const now = new Date();
    const convertedAtIso = now.toISOString();
    const convertedAtDisplay = now.toLocaleString('en-IN');

    // Fetch ALL discussion notes from the enquiry
    const enquiryNotes = await getEnquiryNotes(req.tenantId, req.params.id);

    // Build conversion summary note
    const conversionSummaryNote = [
      `[${convertedAtDisplay}] Converted from enquiry`,
      '',
      `Original message: ${enquiry.message || 'N/A'}`,
      '',
      `Enquiry notes: ${enquiry.notes || 'N/A'}`,
    ].join('\n');
    
    if (convertTo === 'owner') {
      // Check if this person exists as a tenant - fetch their details for auto-fill
      const existingTenant = await getCustomerByPhone(req.tenantId, phone);
      
      // Create or update owner (upsert by phone)
      createdRecord = await createOrUpdateOwnerByPhone(req.tenantId, {
        name: enquiry.name,
        email: enquiry.email || null,
        phone: enquiry.phone,
        // Append notes to existing notes if updating
        source: `enquiry_${enquiry.formType}`,
        status: 'active',
      });
      wasExisting = createdRecord.wasExisting;
      
      // Append conversion summary to existing notes field
      const existingNotes = createdRecord.notes || '';
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${conversionSummaryNote}` 
        : conversionSummaryNote;
      
      // Update with conversion summary
      const { updateOwner } = await import('../crmDynamodbService.js');
      await updateOwner(req.tenantId, createdRecord.ownerId, { notes: updatedNotes });
      createdRecord.notes = updatedNotes;
      
      // Transfer ALL discussion notes from enquiry to owner timeline
      try {
        // First, create the conversion summary note
        await createOwnerNote(req.tenantId, createdRecord.ownerId, {
          content: conversionSummaryNote,
          createdBy:
            (req.user && (req.user.username || req.user.email || req.user.id)) ||
            'System',
        });
        
        // Then, transfer each enquiry discussion note
        for (const note of enquiryNotes) {
          // Skip the synthetic PROFILE_NOTES entry
          if (note.noteId === 'PROFILE_NOTES') continue;
          
          await createOwnerNote(req.tenantId, createdRecord.ownerId, {
            content: note.content,
            createdBy: note.createdBy || 'System',
            // Preserve original timestamp in the note content
            createdAt: note.createdAt,
          });
        }
      } catch (noteError) {
        console.error('Failed to transfer notes from enquiry to owner:', noteError);
      }
      
    } else {
      // Check if this person exists as an owner - fetch their details for auto-fill
      const existingOwner = await getOwnerByPhone(req.tenantId, phone);
      
      // Create or update tenant/customer (upsert by phone)
      createdRecord = await createOrUpdateCustomerByPhone(req.tenantId, {
        name: enquiry.name,
        email: enquiry.email || null,
        phone: enquiry.phone,
        requirement: enquiry.message || enquiry.propertyType || '',
        preferredArea: '',
        source: `enquiry_${enquiry.formType}`,
        status: 'active',
        priority: 'medium',
      });
      wasExisting = createdRecord.wasExisting;

      // Append conversion summary to existing notes field
      const existingNotes = createdRecord.notes || '';
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${conversionSummaryNote}` 
        : conversionSummaryNote;
      
      // Update with conversion summary
      const { updateCustomer } = await import('../crmDynamodbService.js');
      await updateCustomer(req.tenantId, createdRecord.customerId, { notes: updatedNotes });
      createdRecord.notes = updatedNotes;

      // Transfer ALL discussion notes from enquiry to tenant timeline
      try {
        // First, create the conversion summary note
        await createCustomerNote(req.tenantId, createdRecord.customerId, {
          content: conversionSummaryNote,
          createdBy:
            (req.user && (req.user.username || req.user.email || req.user.id)) ||
            'System',
        });
        
        // Then, transfer each enquiry discussion note
        for (const note of enquiryNotes) {
          // Skip the synthetic PROFILE_NOTES entry
          if (note.noteId === 'PROFILE_NOTES') continue;
          
          await createCustomerNote(req.tenantId, createdRecord.customerId, {
            content: note.content,
            createdBy: note.createdBy || 'System',
            // Preserve original timestamp in the note content
            createdAt: note.createdAt,
          });
        }
      } catch (noteError) {
        console.error('Failed to transfer notes from enquiry to tenant:', noteError);
      }
    }
    
    // Update enquiry status to converted and store conversion metadata
    // Note: The enquiry keeps its own notes intact for reference
    const updatedEnquiry = await updateEnquiry(req.tenantId, req.params.id, {
      status: 'converted',
      convertedTo: convertTo,
      convertedId: convertTo === 'owner' ? createdRecord.ownerId : createdRecord.customerId,
      convertedAt: convertedAtIso,
    });
    
    // Also add a note to the enquiry timeline recording the conversion
    try {
      await createEnquiryNote(req.tenantId, req.params.id, {
        content: `Converted to ${convertTo} on ${convertedAtDisplay}`,
        createdBy:
          (req.user && (req.user.username || req.user.email || req.user.id)) ||
          'System',
      });
    } catch (noteError) {
      console.error('Failed to create enquiry conversion note:', noteError);
    }
    
    res.json({
      success: true,
      message: wasExisting 
        ? `Enquiry linked to existing ${convertTo} (updated their records)` 
        : `Enquiry converted to new ${convertTo} successfully`,
      enquiry: updatedEnquiry,
      createdRecord,
      wasExisting,
    });
  } catch (error) {
    console.error('Convert enquiry error:', error);
    res.status(500).json({ error: error.message || 'Failed to convert enquiry' });
  }
});

/**
 * Close enquiry (CRM - auth required)
 * PUT /api/enquiries/:id/close
 */
router.put('/:id/close', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const enquiry = await getEnquiry(req.tenantId, req.params.id);
    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    
    const closeNote = `[${new Date().toLocaleString('en-IN')}] Lead closed${reason ? `: ${reason}` : ''}`;
    const existingNotes = enquiry.notes || '';
    const updatedNotes = existingNotes ? `${existingNotes}\n\n${closeNote}` : closeNote;
    
    const updatedEnquiry = await updateEnquiry(req.tenantId, req.params.id, {
      status: 'closed',
      notes: updatedNotes,
      closedAt: new Date().toISOString(),
      closeReason: reason || null,
    });
    
    res.json({
      success: true,
      message: 'Enquiry closed successfully',
      enquiry: updatedEnquiry,
    });
  } catch (error) {
    console.error('Close enquiry error:', error);
    res.status(500).json({ error: error.message || 'Failed to close enquiry' });
  }
});

/**
 * Reopen closed enquiry (CRM - auth required)
 * PUT /api/enquiries/:id/reopen
 */
router.put('/:id/reopen', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const enquiry = await getEnquiry(req.tenantId, req.params.id);
    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    
    const reopenNote = `[${new Date().toLocaleString('en-IN')}] Lead reopened`;
    const existingNotes = enquiry.notes || '';
    const updatedNotes = existingNotes ? `${existingNotes}\n\n${reopenNote}` : reopenNote;
    
    const updatedEnquiry = await updateEnquiry(req.tenantId, req.params.id, {
      status: 'new',
      notes: updatedNotes,
      reopenedAt: new Date().toISOString(),
    });
    
    res.json({
      success: true,
      message: 'Enquiry reopened successfully',
      enquiry: updatedEnquiry,
    });
  } catch (error) {
    console.error('Reopen enquiry error:', error);
    res.status(500).json({ error: error.message || 'Failed to reopen enquiry' });
  }
});

export default router;
