import express from 'express';
import multer from 'multer';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { uploadToS3, getSignedUrl } from '../s3Service.js';
import {
  createContact,
  getContacts,
  getContact,
  updateContact,
  deleteContact,
  findContactByPhone,
  createOrUpdateContactByPhone,
  updateContactRole,
  createContactNote,
  getContactNotes,
  updateContactNote,
  deleteContactNote,
  migrateOwnerToContact,
  migrateCustomerToContact,
  getPropertyContacts,
  getOwners,
  getCustomers,
  getContactActivityTimeline,
  getContactIdForEntity,
} from '../crmDynamodbService.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ============== Contact CRUD Routes ==============

// Get all contacts with optional filters
router.get('/', validateToken, extractTenantId, async (req, res) => {
  try {
    const { role, status, area } = req.query;
    const filters = {};
    if (role) filters.role = role;
    if (status) filters.status = status;
    if (area) filters.area = area;

    const contacts = await getContacts(req.tenantId, filters);
    res.json(contacts);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get contacts by role (convenience endpoints)
router.get('/owners', validateToken, extractTenantId, async (req, res) => {
  try {
    const contacts = await getContacts(req.tenantId, { role: 'owner' });
    res.json(contacts);
  } catch (error) {
    console.error('Get owner contacts error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/sellers', validateToken, extractTenantId, async (req, res) => {
  try {
    const contacts = await getContacts(req.tenantId, { role: 'seller' });
    res.json(contacts);
  } catch (error) {
    console.error('Get seller contacts error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/buyers', validateToken, extractTenantId, async (req, res) => {
  try {
    const contacts = await getContacts(req.tenantId, { role: 'buyer' });
    res.json(contacts);
  } catch (error) {
    console.error('Get buyer contacts error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/tenants', validateToken, extractTenantId, async (req, res) => {
  try {
    const contacts = await getContacts(req.tenantId, { role: 'tenant' });
    res.json(contacts);
  } catch (error) {
    console.error('Get tenant contacts error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Lookup contact by phone
router.get('/lookup/by-phone', validateToken, extractTenantId, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    const contact = await findContactByPhone(req.tenantId, phone);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    console.error('Lookup contact by phone error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single contact
router.get('/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const contact = await getContact(req.tenantId, req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get contact with signed document URLs
router.get('/:id/with-documents', validateToken, extractTenantId, async (req, res) => {
  try {
    const contact = await getContact(req.tenantId, req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Generate signed URLs for documents
    const result = { ...contact };
    if (contact.photoS3Key) {
      result.photoUrl = await getSignedUrl(contact.photoS3Key);
    }
    if (contact.panDocS3Key) {
      result.panDocUrl = await getSignedUrl(contact.panDocS3Key);
    }
    if (contact.aadharDocS3Key) {
      result.aadharDocUrl = await getSignedUrl(contact.aadharDocS3Key);
    }

    res.json(result);
  } catch (error) {
    console.error('Get contact with documents error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create contact
router.post('/', validateToken, extractTenantId, async (req, res) => {
  try {
    const contact = await createContact(req.tenantId, req.body);
    res.status(201).json(contact);
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create or update contact by phone (dedupe)
router.post('/upsert-by-phone', validateToken, extractTenantId, async (req, res) => {
  try {
    const contact = await createOrUpdateContactByPhone(req.tenantId, req.body);
    res.status(contact.wasExisting ? 200 : 201).json(contact);
  } catch (error) {
    console.error('Upsert contact error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update contact
router.put('/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const contact = await updateContact(req.tenantId, req.params.id, req.body);
    res.json(contact);
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update contact role
router.put('/:id/role', validateToken, extractTenantId, async (req, res) => {
  try {
    const { role, enabled, profileData } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }
    const contact = await updateContactRole(
      req.tenantId, 
      req.params.id, 
      role, 
      enabled !== false, 
      profileData
    );
    res.json(contact);
  } catch (error) {
    console.error('Update contact role error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete contact
router.delete('/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    await deleteContact(req.tenantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Contact Document Upload Routes ==============

// Upload contact documents (photo, PAN, Aadhar)
router.post('/:id/documents', validateToken, extractTenantId, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'aadhar', maxCount: 1 }
]), async (req, res) => {
  try {
    const contactId = req.params.id;
    const updateData = {};

    if (req.files?.photo) {
      const s3Key = await uploadToS3(
        req.files.photo[0].buffer,
        req.files.photo[0].originalname,
        req.files.photo[0].mimetype,
        'crm/contacts/photos',
        req.tenantId
      );
      updateData.photoS3Key = s3Key;
    }
    if (req.files?.pan) {
      const s3Key = await uploadToS3(
        req.files.pan[0].buffer,
        req.files.pan[0].originalname,
        req.files.pan[0].mimetype,
        'crm/contacts/documents',
        req.tenantId
      );
      updateData.panDocS3Key = s3Key;
    }
    if (req.files?.aadhar) {
      const s3Key = await uploadToS3(
        req.files.aadhar[0].buffer,
        req.files.aadhar[0].originalname,
        req.files.aadhar[0].mimetype,
        'crm/contacts/documents',
        req.tenantId
      );
      updateData.aadharDocS3Key = s3Key;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const contact = await updateContact(req.tenantId, contactId, updateData);

    // Return with signed URLs
    const result = { ...contact };
    if (contact.photoS3Key) {
      result.photoUrl = await getSignedUrl(contact.photoS3Key);
    }
    if (contact.panDocS3Key) {
      result.panDocUrl = await getSignedUrl(contact.panDocS3Key);
    }
    if (contact.aadharDocS3Key) {
      result.aadharDocUrl = await getSignedUrl(contact.aadharDocS3Key);
    }

    res.json(result);
  } catch (error) {
    console.error('Upload contact documents error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Contact Notes Routes ==============

router.get('/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const notes = await getContactNotes(req.tenantId, req.params.id);
    res.json(notes);
  } catch (error) {
    console.error('Get contact notes error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const note = await createContactNote(req.tenantId, req.params.id, req.body);
    res.status(201).json(note);
  } catch (error) {
    console.error('Create contact note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/:id/notes/:noteId', validateToken, extractTenantId, async (req, res) => {
  try {
    const updated = await updateContactNote(req.tenantId, req.params.id, req.params.noteId, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Update contact note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/:id/notes/:noteId', validateToken, extractTenantId, async (req, res) => {
  try {
    await deleteContactNote(req.tenantId, req.params.id, req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete contact note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Migration Routes ==============

// Migrate a single owner to contact
router.post('/migrate/owner/:ownerId', validateToken, extractTenantId, async (req, res) => {
  try {
    const contact = await migrateOwnerToContact(req.tenantId, req.params.ownerId);
    res.json(contact);
  } catch (error) {
    console.error('Migrate owner error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Migrate a single customer to contact
router.post('/migrate/customer/:customerId', validateToken, extractTenantId, async (req, res) => {
  try {
    const contact = await migrateCustomerToContact(req.tenantId, req.params.customerId);
    res.json(contact);
  } catch (error) {
    console.error('Migrate customer error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Migrate all owners and customers to contacts
router.post('/migrate/all', validateToken, extractTenantId, async (req, res) => {
  try {
    const results = {
      owners: { migrated: 0, errors: [] },
      customers: { migrated: 0, errors: [] },
    };

    // Migrate owners
    const ownersResult = await getOwners(req.tenantId);
    const owners = ownersResult.owners || [];
    for (const owner of owners) {
      try {
        await migrateOwnerToContact(req.tenantId, owner.ownerId);
        results.owners.migrated++;
      } catch (err) {
        results.owners.errors.push({ ownerId: owner.ownerId, error: err.message });
      }
    }

    // Migrate customers
    const { customers } = await getCustomers(req.tenantId);
    for (const customer of customers) {
      try {
        await migrateCustomerToContact(req.tenantId, customer.customerId);
        results.customers.migrated++;
      } catch (err) {
        results.customers.errors.push({ customerId: customer.customerId, error: err.message });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Migrate all error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Contact Activity Timeline Route ==============

router.get('/:id/activity', validateToken, extractTenantId, async (req, res) => {
  try {
    const { id } = req.params;
    const { entityType, entityId } = req.query;

    let contactId = id;

    // If entityType and entityId are provided, resolve the contactId
    if (entityType && entityId) {
      const resolvedContactId = await getContactIdForEntity(req.tenantId, entityType, entityId);
      if (resolvedContactId) {
        contactId = resolvedContactId;
      } else {
        // If no contactId resolved, return empty array
        res.json([]);
        return;
      }
    }

    const activity = await getContactActivityTimeline(req.tenantId, contactId, entityType, entityId);
    res.json(activity);
  } catch (error) {
    console.error('Get contact activity error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
