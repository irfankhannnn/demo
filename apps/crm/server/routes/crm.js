import express from 'express';
import { logger } from '../logger.js';
import multer from 'multer';
import { requireAdminOrManager, requireCrmMemberOrAbove } from '../middleware/requireRole.js';
import {
  getDaysUntilLeaseExpiry,
  resolveLeaseEndDate,
  resolvePropertyMonthlyRent,
} from '../businessAnalyticsHelpers.js';
import {
  createCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
    createCustomerNote,
  getCustomerNotes,
  updateCustomerNote,
  deleteCustomerNote,
  createOwnerNote,
  getOwnerNotes,
  updateOwnerNote,
  deleteOwnerNote,
  createOwner,
  getOwners,
  getOwner,
  updateOwner,
    createProperty,
  getProperties,
  getPropertiesByStatus,
  getPropertiesByOwner,
  getProperty,
  updateProperty,
    incrementPropertyViews,
  getCRMMetrics,
  // New: Agreement, Verification, Document operations
  createPropertyAgreement,
  getPropertyAgreements,
  updatePropertyAgreement,
  createPropertyVerification,
  getPropertyVerifications,
  updatePropertyVerification,
  createPropertyDocument,
  getPropertyDocuments,
  deletePropertyDocument,
  getPropertiesWithDetails,
  // Lookup by phone
  getOwnerByPhone,
  getCustomerByPhone,
  createOrUpdateOwnerByPhone,
  createOrUpdateCustomerByPhone,
  getContacts,
  getContact,
  updateContact,
  findContactByPhone,
  // Meeting/Calendar operations
  createMeeting,
  getMeetings,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  getMeetingsByEntity,
  getUpcomingMeetings,
  getMeetingMetrics,
  getMeetingHistory,
  // Search operations
  searchOwners,
  searchCustomers,
  searchProperties,
} from '../crmDynamodbService.js';
import {
  listPropertyForSale,
  listPropertyForRent,
  markPropertySold,
  markPropertyRented,
  vacateProperty,
  addPurchaseToBuyer,
  updateBuyerPurchase,
  updateCurrentRental,
  moveTenantToHistory,
} from '../crmHelpers.js';
import validateToken from '../middleware/validateToken.js';
import apiKeyAuth from '../middleware/apiKeyAuth.js';
import { uploadToS3, deleteFromS3, getSignedUrl as getS3SignedUrl } from '../s3Service.js';
import { extractTenantId, extractTenantIdOptional } from '../tenantMiddleware.js';
import validateBody from '../middleware/validateBody.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createOwnerSchema,
  updateOwnerSchema,
  createPropertySchema,
  updatePropertySchema,
  createMeetingSchema,
  updateMeetingSchema,
} from '../validation/crmSchemas.js';
import { propertyIsCurrentlyOwnedBy } from '../domain/crmDomainModel.js';
import { withCreateActor, withUpdateActor, resolveRequestActor } from '../utils/requestActor.js';
import { attachMeetingReminderRecipients } from '../meetingReminderRecipients.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  },
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos (API Gateway REST caps at 10MB)
    files: 10 // Max 10 files at once
  }
});

/** Multer / upload validation errors → 400 JSON */
export function handleCrmUploadErrors(err, req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError || String(err.message || '').includes('not allowed')) {
    return res.status(400).json({ error: err.message || 'Invalid upload' });
  }
  return next(err);
}

// ============== Customer Routes ==============

// Get all customers
router.get('/customers', validateToken, extractTenantId, async (req, res) => {
  try {
    const { area, status, search, source, tag, hasCurrentRental, hasRentalHistory, leaseEndingWithinDays, propertyId, monthlyRentMin, monthlyRentMax, createdFrom, createdTo, sortBy, sortOrder, limit, offset } = req.query;

    const dbFilters = {};
    if (area) dbFilters.area = area;
    if (status) dbFilters.status = status;
    if (search) dbFilters.search = search;
    if (source) dbFilters.source = source;
    if (tag) dbFilters.tag = tag;
    if (hasCurrentRental) dbFilters.hasCurrentRental = hasCurrentRental;
    if (hasRentalHistory) dbFilters.hasRentalHistory = hasRentalHistory;
    if (leaseEndingWithinDays) dbFilters.leaseEndingWithinDays = leaseEndingWithinDays;
    if (propertyId) dbFilters.propertyId = propertyId;
    if (monthlyRentMin) dbFilters.monthlyRentMin = monthlyRentMin;
    if (monthlyRentMax) dbFilters.monthlyRentMax = monthlyRentMax;
    if (createdFrom) dbFilters.createdFrom = createdFrom;
    if (createdTo) dbFilters.createdTo = createdTo;
    if (sortBy) dbFilters.sortBy = sortBy;
    if (sortOrder) dbFilters.sortOrder = sortOrder;
    if (limit) dbFilters.limit = limit;
    if (offset) dbFilters.offset = offset;

    const { customers, total, limit: appliedLimit, offset: appliedOffset } = await getCustomers(req.tenantId, dbFilters);

    res.json({ customers, total, limit: appliedLimit, offset: appliedOffset });
  } catch (error) {
    logger.error('crm.get_customers_error_', { message: 'Get customers error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single customer
router.get('/customers/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const customer = await getCustomer(req.tenantId, req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    logger.error('crm.get_customer_error_', { message: 'Get customer error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create customer
router.post('/customers', validateToken, extractTenantId, requireCrmMemberOrAbove, validateBody(createCustomerSchema), async (req, res) => {
  try {
    const { precheckCredits, chargeCreditsForAction, handleCreditError } = await import('../middleware/meterCredits.js');
    await precheckCredits(req.tenantId, 'tenant_add');
    const customer = await createCustomer(req.tenantId, withCreateActor(req.user, req.body));
    const creditResult = await chargeCreditsForAction(req.tenantId, 'tenant_add', { recordId: customer.customerId });
    res.status(201).json({ ...customer, creditsRemaining: creditResult.balance });
  } catch (error) {
    const { handleCreditError } = await import('../middleware/meterCredits.js');
    if (handleCreditError(error, res)) return;
    logger.error('crm.create_customer_error_', { message: 'Create customer error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update customer
router.put('/customers/:id', validateToken, extractTenantId, requireCrmMemberOrAbove, validateBody(updateCustomerSchema), async (req, res) => {
  try {
    const customer = await updateCustomer(req.tenantId, req.params.id, withUpdateActor(req.user, req.body));
    res.json(customer);
  } catch (error) {
    logger.error('crm.update_customer_error_', { message: 'Update customer error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get customer notes
router.get('/customers/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const notes = await getCustomerNotes(req.tenantId, req.params.id);
    res.json(notes);
  } catch (error) {
    logger.error('crm.get_customer_notes_error_', { message: 'Get customer notes error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create customer note
router.post('/customers/:id/notes', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const note = await createCustomerNote(req.tenantId, req.params.id, withCreateActor(req.user, req.body));
    res.status(201).json(note);
  } catch (error) {
    logger.error('crm.create_customer_note_error_', { message: 'Create customer note error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/customers/:id/notes/:noteId', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const updated = await updateCustomerNote(req.tenantId, req.params.id, req.params.noteId, withUpdateActor(req.user, req.body));
    res.json(updated);
  } catch (error) {
    logger.error('crm.update_customer_note_error_', { message: 'Update customer note error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/customers/:id/notes/:noteId', validateToken, extractTenantId, requireAdminOrManager, async (req, res) => {
  try {
    await deleteCustomerNote(req.tenantId, req.params.id, req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    logger.error('crm.delete_customer_note_error_', { message: 'Delete customer note error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Owner Routes ==============

// Get all owners (query-first API)
router.get('/owners', validateToken, extractTenantId, async (req, res) => {
  try {
    const {
      status, source, area, search,
      createdFrom, createdTo,
      hasProperties, seller,
      propertyType, listingType, bhk, furnishing,
      minProperties, maxProperties,
      tag,
      hasPAN, hasAadhar, hasBankDetails,
      sortBy, sortOrder,
      limit, offset
    } = req.query;

    const defaultCountryPrefix = (process.env.DEFAULT_COUNTRY_CODE || '').replace(/^\+/, '');
    const normalizePhone = (phone) => {
      const digits = String(phone || '').replace(/[^0-9]/g, '');
      const withoutPrefix = digits.startsWith(defaultCountryPrefix) && digits.length === 10 + defaultCountryPrefix.length
        ? digits.slice(defaultCountryPrefix.length)
        : digits;
      return /^[6-9]\d{9}$/.test(withoutPrefix) ? withoutPrefix : '';
    };

    // Build DB filters (pre-property-count)
    const dbFilters = {};
    if (status && status !== 'all') dbFilters.status = status;
    if (source) dbFilters.source = source;
    if (area) dbFilters.area = area;
    if (search) dbFilters.search = search;
    if (createdFrom) dbFilters.createdFrom = createdFrom;
    if (createdTo) dbFilters.createdTo = createdTo;
    if (tag) dbFilters.tag = tag;
    if (sortBy) dbFilters.sortBy = sortBy;
    if (sortOrder) dbFilters.sortOrder = sortOrder;

    // Fetch all matching owners (no pagination yet � we need to compute counts first)
    const [ownersInitial, propertiesResult, ownerContacts, sellerContacts] = await Promise.all([
      getOwners(req.tenantId, dbFilters),
      getProperties(req.tenantId),
      getContacts(req.tenantId, { role: 'owner' }),
      getContacts(req.tenantId, { role: 'seller' }),
    ]);
    const properties = propertiesResult.properties || [];

    // Backfill: Contact with active owner role → OWNER shell (copy KYC, link ids)
    // Do not backfill seller-only / past-seller contacts that are not current owners.
    const ownersByPhone = new Set((ownersInitial.owners || []).map((o) => normalizePhone(o.phone)).filter(Boolean));
    const contactsToBackfill = (ownerContacts || []).filter((c) => {
      if (!c?.roles?.owner) return false;
      const phone = normalizePhone(c.phone);
      if (!phone || ownersByPhone.has(phone)) return false;
      // Prefer contacts that currently own something, or have ownedPropertyIds
      const ownedIds = c.ownerProfile?.ownedPropertyIds || [];
      return ownedIds.length > 0;
    });

    if (contactsToBackfill.length) {
      await Promise.all(contactsToBackfill.map(async (c) => {
        const owner = await createOrUpdateOwnerByPhone(req.tenantId, {
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.address || '',
          notes: c.notes || '',
          status: c.status || 'active',
          source: c.source || 'contact:owner',
          panNumber: c.panNumber || null,
          aadharNumber: c.aadharNumber || null,
          panDocS3Key: c.panDocS3Key || null,
          aadharDocS3Key: c.aadharDocS3Key || null,
          photoS3Key: c.photoS3Key || null,
        });
        if (owner?.ownerId && c.contactId && c.linkedOwnerId !== owner.ownerId) {
          try {
            await updateContact(req.tenantId, c.contactId, { linkedOwnerId: owner.ownerId });
          } catch (err) {
            logger.warn('crm.owners.backfill_link_failed', { contactId: c.contactId, error: err.message });
          }
        }
      }));
    }

    // Re-fetch after backfill with same filters
    const ownersResult = contactsToBackfill.length
      ? await getOwners(req.tenantId, dbFilters)
      : ownersInitial;
    let owners = ownersResult.owners;

    // Map contacts by phone for ownership resolution
    const allContacts = [...(ownerContacts || []), ...(sellerContacts || [])];
    const contactByPhone = new Map();
    for (const c of allContacts) {
      const phone = normalizePhone(c.phone);
      if (phone) contactByPhone.set(phone, c);
    }

    // Compute property counts using Contact ownership (canonical) + legacy ownerId
    const propertyCounts = {};
    for (const owner of owners) {
      const contact = contactByPhone.get(normalizePhone(owner.phone));
      const contactId = contact?.contactId || owner.contactId || null;
      propertyCounts[owner.ownerId] = (properties || []).filter((p) =>
        propertyIsCurrentlyOwnedBy(p, { ownerId: owner.ownerId, contactId }),
      ).length;
    }

    // Identify sellers: prefer Contact.sellerProfile, fall back to for-sale/sold join
    const forSaleProperties = properties.filter(p => p.status === 'for-sale' || p.status === 'sold');
    const sellerOwnerIds = new Set(forSaleProperties.map(p => p.ownerId).filter(Boolean));
    const sellerContactPhones = new Set(
      (sellerContacts || [])
        .filter((c) => c.roles?.seller)
        .map((c) => normalizePhone(c.phone))
        .filter(Boolean)
    );

    // Attach counts + merge KYC from Contact when OWNER is missing it
    owners = owners.map((owner) => {
      const contact = contactByPhone.get(normalizePhone(owner.phone));
      return {
        ...owner,
        panNumber: owner.panNumber || contact?.panNumber || null,
        aadharNumber: owner.aadharNumber || contact?.aadharNumber || null,
        propertyCount: propertyCounts[owner.ownerId] || 0,
        isSeller: sellerOwnerIds.has(owner.ownerId)
          || sellerContactPhones.has(normalizePhone(owner.phone)),
        sellerLifecycle: contact?.sellerProfile?.lifecycleStatus
          || (sellerContacts || []).find(
            (c) => normalizePhone(c.phone) === normalizePhone(owner.phone),
          )?.sellerProfile?.lifecycleStatus
          || null,
        contactId: contact?.contactId
          || owner.contactId
          || null,
      };
    });

    // Apply post-DB filters
    // Owners module: only people who currently own ≥1 property (zero-property shells stay Contacts)
    if (!seller || seller !== 'true') {
      owners = owners.filter((o) => (o.propertyCount || 0) > 0);
    }
    // Optional status filter only when explicitly requested (default = all current owners)
    if (status === 'active') {
      owners = owners.filter((o) => o.status === 'active');
    } else if (status === 'inactive') {
      owners = owners.filter((o) => o.status === 'inactive');
    }
    if (hasProperties === 'true') {
      owners = owners.filter(o => o.propertyCount > 0);
    }
    if (seller === 'true') {
      owners = owners.filter((o) => {
        if (o.sellerLifecycle) return o.sellerLifecycle === 'active';
        return o.isSeller;
      });
    }

    // Property-attribute filters (join against properties)
    if (propertyType || listingType || bhk || furnishing) {
      const matchingOwnerIds = new Set(
        properties.filter(p => {
          if (propertyType && p.propertyType !== propertyType) return false;
          if (listingType && p.listingType !== listingType) return false;
          if (bhk && String(p.bhk) !== String(bhk)) return false;
          if (furnishing && p.furnishing !== furnishing) return false;
          return true;
        }).map(p => p.ownerId).filter(Boolean)
      );
      owners = owners.filter(o => matchingOwnerIds.has(o.ownerId));
    }

    // Property-count filters
    if (minProperties !== undefined) {
      const min = parseInt(minProperties);
      if (!isNaN(min)) owners = owners.filter(o => o.propertyCount >= min);
    }
    if (maxProperties !== undefined) {
      const max = parseInt(maxProperties);
      if (!isNaN(max)) owners = owners.filter(o => o.propertyCount <= max);
    }

    // Document / KYC filters
    if (hasPAN === 'true') owners = owners.filter(o => !!o.panNumber);
    if (hasAadhar === 'true') owners = owners.filter(o => !!o.aadharNumber);
    if (hasBankDetails === 'true') {
      owners = owners.filter(o => !!(o.bankName && o.accountNumber && o.ifscCode));
    }

    const total = owners.length;
    const pageLimit = parseInt(limit) || parseInt(process.env.DEFAULT_PAGE_LIMIT || '50', 10);
    const pageOffset = parseInt(offset) || 0;
    const paginated = owners.slice(pageOffset, pageOffset + pageLimit);

    res.json({
      owners: paginated,
      total,
      limit: pageLimit,
      offset: pageOffset,
      sellerCount: owners.filter(o => o.isSeller).length,
    });
  } catch (error) {
    logger.error('crm.get_owners_error_', { message: 'Get owners error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single owner
router.get('/owners/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const owner = await getOwner(req.tenantId, req.params.id);
    if (!owner) {
      return res.status(404).json({ error: 'Owner not found' });
    }
    // Enrich KYC from Contact when OWNER shell is missing it
    try {
      const contact = owner.phone ? await findContactByPhone(req.tenantId, owner.phone) : null;
      if (contact) {
        owner.panNumber = owner.panNumber || contact.panNumber || null;
        owner.aadharNumber = owner.aadharNumber || contact.aadharNumber || null;
        owner.contactId = contact.contactId;
        const props = await getPropertiesByOwner(req.tenantId, owner.ownerId);
        owner.propertyCount = props.length;
      }
    } catch (err) {
      logger.warn('crm.get_owner.enrich_failed', { ownerId: req.params.id, error: err.message });
    }
    res.json(owner);
  } catch (error) {
    logger.error('crm.get_owner_error_', { message: 'Get owner error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create owner
router.post('/owners', validateToken, extractTenantId, requireCrmMemberOrAbove, validateBody(createOwnerSchema), async (req, res) => {
  try {
    const { precheckCredits, chargeCreditsForAction, handleCreditError } = await import('../middleware/meterCredits.js');
    await precheckCredits(req.tenantId, 'owner_add');
    const owner = await createOwner(req.tenantId, withCreateActor(req.user, req.body));
    const creditResult = await chargeCreditsForAction(req.tenantId, 'owner_add', { recordId: owner.ownerId });
    res.status(201).json({ ...owner, creditsRemaining: creditResult.balance });
  } catch (error) {
    const { handleCreditError } = await import('../middleware/meterCredits.js');
    if (handleCreditError(error, res)) return;
    logger.error('crm.create_owner_error_', { message: 'Create owner error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update owner
router.put('/owners/:id', validateToken, extractTenantId, requireCrmMemberOrAbove, validateBody(updateOwnerSchema), async (req, res) => {
  try {
    const owner = await updateOwner(req.tenantId, req.params.id, withUpdateActor(req.user, req.body));
    res.json(owner);
  } catch (error) {
    logger.error('crm.update_owner_error_', { message: 'Update owner error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Owner notes
router.get('/owners/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const notes = await getOwnerNotes(req.tenantId, req.params.id);
    res.json(notes);
  } catch (error) {
    logger.error('crm.get_owner_notes_error_', { message: 'Get owner notes error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/owners/:id/notes', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const note = await createOwnerNote(req.tenantId, req.params.id, withCreateActor(req.user, req.body));
    res.status(201).json(note);
  } catch (error) {
    logger.error('crm.create_owner_note_error_', { message: 'Create owner note error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/owners/:id/notes/:noteId', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const updated = await updateOwnerNote(req.tenantId, req.params.id, req.params.noteId, withUpdateActor(req.user, req.body));
    res.json(updated);
  } catch (error) {
    logger.error('crm.update_owner_note_error_', { message: 'Update owner note error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/owners/:id/notes/:noteId', validateToken, extractTenantId, requireAdminOrManager, async (req, res) => {
  try {
    await deleteOwnerNote(req.tenantId, req.params.id, req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    logger.error('crm.delete_owner_note_error_', { message: 'Delete owner note error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete owner - DISABLED: Delete operations are not allowed
// router.delete('/owners/:id', validateToken, extractTenantId, async (req, res) => {
//   res.status(403).json({ error: 'Delete operations are not allowed' });
// });

// Lookup owner by phone number (for auto-fill)
router.get('/owners/lookup/by-phone', validateToken, extractTenantId, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const owner = await getOwnerByPhone(req.tenantId, phone);
    if (!owner) {
      return res.json({ found: false, owner: null });
    }
    
    // Also get document URLs if available
    const ownerWithUrls = {
      ...owner,
      photoUrl: owner.photoS3Key ? await getS3SignedUrl(owner.photoS3Key) : null,
      panDocUrl: owner.panDocS3Key ? await getS3SignedUrl(owner.panDocS3Key) : null,
      aadharDocUrl: owner.aadharDocS3Key ? await getS3SignedUrl(owner.aadharDocS3Key) : null,
    };
    
    res.json({ found: true, owner: ownerWithUrls });
  } catch (error) {
    logger.error('crm.lookup_owner_by_phone_error_', { message: 'Lookup owner by phone error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Lookup customer/tenant by phone number (for auto-fill)
router.get('/customers/lookup/by-phone', validateToken, extractTenantId, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const customer = await getCustomerByPhone(req.tenantId, phone);
    if (!customer) {
      return res.json({ found: false, customer: null });
    }
    
    res.json({ found: true, customer });
  } catch (error) {
    logger.error('crm.lookup_customer_by_phone_error_', { message: 'Lookup customer by phone error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get properties by owner
router.get('/owners/:id/properties', validateToken, extractTenantId, async (req, res) => {
  try {
    let properties = await getPropertiesByOwner(req.tenantId, req.params.id);

    // Portfolio view: legacy "sold"/"available"/"inactive" → not-listed (owned, not marketing)
    properties = await Promise.all(
      (properties || []).map(async (property) => {
        const needsRepair = ['sold', 'available', 'inactive'].includes(property.status)
          && property.listingStatus !== 'active';
        if (!needsRepair) return property;
        try {
          const repaired = await updateProperty(req.tenantId, property.propertyId, {
            status: 'not-listed',
            listingStatus: 'inactive',
            GSI2PK: `TENANT#${req.tenantId}#PROPERTY_STATUS#not-listed`,
          });
          return repaired || { ...property, status: 'not-listed', listingStatus: 'inactive' };
        } catch {
          return { ...property, status: 'not-listed', listingStatus: 'inactive' };
        }
      }),
    );
    
    // Generate signed URLs for images and videos
    const propertiesWithUrls = await Promise.all(
      properties.map(async (property) => {
        const images = await Promise.all(
          (property.images || []).map(async (key) => ({
            key,
            url: await getS3SignedUrl(key),
          }))
        );
        const videos = await Promise.all(
          (property.videos || []).map(async (key) => ({
            key,
            url: await getS3SignedUrl(key),
          }))
        );
        return { ...property, images, videos };
      })
    );
    
    res.json(propertiesWithUrls);
  } catch (error) {
    logger.error('crm.get_owner_properties_error_', { message: 'Get owner properties error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Property Routes ==============

// Get all properties (query-first API)
router.get('/properties', validateToken, extractTenantId, async (req, res) => {
  try {
    const {
      status, propertyType, bhk, furnishing,
      area, city, ownerId, search,
      minRent, maxRent, minSalePrice, maxSalePrice,
      createdFrom, createdTo, tag,
      sortBy, sortOrder,
      limit, offset
    } = req.query;

    const dbFilters = {};
    if (status) dbFilters.status = status;
    if (propertyType) dbFilters.propertyType = propertyType;
    if (bhk) dbFilters.bhk = bhk;
    if (furnishing) dbFilters.furnishing = furnishing;
    if (area) dbFilters.area = area;
    if (city) dbFilters.city = city;
    if (ownerId) dbFilters.ownerId = ownerId;
    if (search) dbFilters.search = search;
    if (minRent) dbFilters.minRent = minRent;
    if (maxRent) dbFilters.maxRent = maxRent;
    if (minSalePrice) dbFilters.minSalePrice = minSalePrice;
    if (maxSalePrice) dbFilters.maxSalePrice = maxSalePrice;
    if (createdFrom) dbFilters.createdFrom = createdFrom;
    if (createdTo) dbFilters.createdTo = createdTo;
    if (tag) dbFilters.tag = tag;
    if (sortBy) dbFilters.sortBy = sortBy;
    if (sortOrder) dbFilters.sortOrder = sortOrder;
    if (limit) dbFilters.limit = limit;
    if (offset) dbFilters.offset = offset;

    const { properties, total } = await getProperties(req.tenantId, dbFilters);

    // Default list: show all inventory including Not Listed (owned, not marketing).
    // Hide only archived unless explicitly filtered.
    let visibleProperties = properties;
    let visibleTotal = total;
    if (!status) {
      visibleProperties = properties.filter((p) => p.status !== 'archived' && p.status !== 'out-of-stock');
      visibleTotal = visibleProperties.length;
    }

    // Light enrichment: owner name/phone only (avoid N+1 signed URLs for lists)
    const { owners } = await getOwners(req.tenantId);
    const ownerMap = new Map(owners.map(o => [o.ownerId, o]));

    const enriched = visibleProperties.map(p => {
      const owner = ownerMap.get(p.ownerId);
      return {
        ...p,
        ownerName: owner?.name || p.ownerName || null,
        ownerPhone: owner?.phone || p.ownerPhone || null,
      };
    });

    const pageLimit = parseInt(limit) || parseInt(process.env.DEFAULT_PAGE_LIMIT || '50', 10);
    const pageOffset = parseInt(offset) || 0;

    res.json({
      properties: enriched,
      total: visibleTotal,
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (error) {
    logger.error('crm.get_properties_error_', { message: 'Get properties error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get public properties (for /properties page - NO owner info)
router.get('/properties/public/list', apiKeyAuth, extractTenantIdOptional, async (req, res) => {
  try {
    // Tenant ID is optional for public endpoint, but if provided, filter by it
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required for public properties' });
    }

    // By default, include all properties for map display.
    // If a status query is provided, filter by that status.
    const { status } = req.query;
    const { properties } = status
      ? await getProperties(req.tenantId, { status })
      : await getProperties(req.tenantId);
    
    // Generate signed URLs but DON'T include owner data
    const publicProperties = await Promise.all(
      properties.map(async (property) => {
        const images = await Promise.all(
          (property.images || []).map(async (key) => ({
            key,
            url: await getS3SignedUrl(key),
          }))
        );
        const videos = await Promise.all(
          (property.videos || []).map(async (key) => ({
            key,
            url: await getS3SignedUrl(key),
          }))
        );
        
        // Remove owner info and sensitive data — the same strip as the
        // public detail route below. ownerName/ownerPhone/ownerSnapshot are
        // the owner's contact details and tenantCustomerId links to the
        // sitting tenant; none of them belong on a public listing.
        const { ownerId, ownerName, ownerPhone, ownerSnapshot, tenantCustomerId, ...publicData } = property;
        return {
          ...publicData,
          images,
          videos,
        };
      })
    );
    
    res.json(publicProperties);
  } catch (error) {
    logger.error('crm.get_public_properties_error_', { message: 'Get public properties error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get public property details — MUST be registered before /properties/:id
router.get('/properties/public/:id', apiKeyAuth, extractTenantIdOptional, async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required for public property' });
    }

    const property = await getProperty(req.tenantId, req.params.id);
    if (!property || !['available', 'for-sale', 'for-rent'].includes(property.status)) {
      return res.status(404).json({ error: 'Property not found' });
    }

    await incrementPropertyViews(req.tenantId, req.params.id);

    const images = await Promise.all(
      (property.images || []).map(async (key) => ({
        key,
        url: await getS3SignedUrl(key),
      }))
    );
    const videos = await Promise.all(
      (property.videos || []).map(async (key) => ({
        key,
        url: await getS3SignedUrl(key),
      }))
    );

    const { ownerId, ownerName, ownerPhone, ownerSnapshot, tenantCustomerId, ...publicData } = property;
    res.json({
      ...publicData,
      images,
      videos,
    });
  } catch (error) {
    logger.error('crm.get_public_property_error_', { message: 'Get public property error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single property
router.get('/properties/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    let property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Legacy: buyer now owns it but status still sold/available/inactive → not-listed
    if (
      property.currentOwnerContactId
      && ['sold', 'available', 'inactive'].includes(property.status)
      && property.listingStatus !== 'active'
    ) {
      try {
        const repaired = await updateProperty(req.tenantId, property.propertyId, {
          status: 'not-listed',
          listingStatus: 'inactive',
          GSI2PK: `TENANT#${req.tenantId}#PROPERTY_STATUS#not-listed`,
        });
        property = repaired || { ...property, status: 'not-listed', listingStatus: 'inactive' };
      } catch {
        property = { ...property, status: 'not-listed', listingStatus: 'inactive' };
      }
    }
    
    // Get owner, tenant data and signed URLs (handle null/unassigned owner)
    let owner = property.ownerId 
      ? await getOwner(req.tenantId, property.ownerId)
      : null;
    if (!owner && property.currentOwnerContactId) {
      const contact = await getContact(req.tenantId, property.currentOwnerContactId);
      if (contact?.linkedOwnerId) {
        owner = await getOwner(req.tenantId, contact.linkedOwnerId);
        if (owner && !property.ownerId) {
          property = { ...property, ownerId: owner.ownerId };
        }
      }
      if (!owner && contact) {
        owner = {
          ownerId: contact.linkedOwnerId || contact.contactId,
          name: contact.name,
          phone: contact.phone,
          status: 'inactive',
        };
      }
    }
    const tenant = property.tenantCustomerId
      ? await getCustomer(req.tenantId, property.tenantCustomerId)
      : null;
    const images = await Promise.all(
      (property.images || []).map(async (key) => ({
        key,
        url: await getS3SignedUrl(key),
      }))
    );
    const videos = await Promise.all(
      (property.videos || []).map(async (key) => ({
        key,
        url: await getS3SignedUrl(key),
      }))
    );
    
    res.json({
      ...property,
      ownerName: owner?.name || property.ownerName || null,
      ownerPhone: owner?.phone || property.ownerPhone || null,
      owner,
      tenant,
      images,
      videos,
    });
  } catch (error) {
    logger.error('crm.get_property_error_', { message: 'Get property error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get property rental history
router.get('/properties/:id/rental-history', validateToken, extractTenantId, async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({
      rentalHistory: property.rentalHistory || [],
      currentRental: property.rentalInfo?.currentTenantId ? {
        tenantId: property.rentalInfo.currentTenantId,
        leaseStartDate: property.rentalInfo.leaseStartDate,
        leaseEndDate: property.rentalInfo.leaseEndDate,
        monthlyRent: property.rentalInfo.currentRent,
      } : null,
    });
  } catch (error) {
    logger.error('crm.get_property_rental_history_error_', { message: 'Get property rental history error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create property
router.post('/properties', validateToken, extractTenantId, requireCrmMemberOrAbove, validateBody(createPropertySchema), async (req, res) => {
  try {
    const { precheckCredits, chargeCreditsForAction, handleCreditError } = await import('../middleware/meterCredits.js');
    await precheckCredits(req.tenantId, 'property_add');
    const property = await createProperty(req.tenantId, withCreateActor(req.user, req.body));
    const creditResult = await chargeCreditsForAction(req.tenantId, 'property_add', { recordId: property.propertyId });
    res.status(201).json({ ...property, creditsRemaining: creditResult.balance });
  } catch (error) {
    const { handleCreditError } = await import('../middleware/meterCredits.js');
    if (handleCreditError(error, res)) return;
    logger.error('crm.create_property_error_', { message: 'Create property error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update property
router.put('/properties/:id', validateToken, extractTenantId, requireCrmMemberOrAbove, validateBody(updatePropertySchema), async (req, res) => {
  try {
    const property = await updateProperty(req.tenantId, req.params.id, withUpdateActor(req.user, req.body));
    res.json(property);
  } catch (error) {
    logger.error('crm.update_property_error_', { message: 'Update property error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Upload property images
router.post('/properties/:id/images', validateToken, extractTenantId, requireCrmMemberOrAbove, upload.array('images', 10), async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    const uploadPromises = req.files.map(file => 
      uploadToS3(file.buffer, file.originalname, file.mimetype, 'crm/properties/images', req.tenantId)
    );
    
    const uploadedKeys = await Promise.all(uploadPromises);
    const currentImages = property.images || [];
    const updatedImages = [...currentImages, ...uploadedKeys];
    
    await updateProperty(req.tenantId, req.params.id, { images: updatedImages });
    
    res.json({ 
      message: 'Images uploaded successfully',
      images: uploadedKeys,
    });
  } catch (error) {
    logger.error('crm.upload_property_images_error_', { message: 'Upload property images error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Upload property videos
router.post('/properties/:id/videos', validateToken, extractTenantId, requireCrmMemberOrAbove, upload.array('videos', 5), async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    const uploadPromises = req.files.map(file => 
      uploadToS3(file.buffer, file.originalname, file.mimetype, 'crm/properties/videos', req.tenantId)
    );
    
    const uploadedKeys = await Promise.all(uploadPromises);
    const currentVideos = property.videos || [];
    const updatedVideos = [...currentVideos, ...uploadedKeys];
    
    await updateProperty(req.tenantId, req.params.id, { videos: updatedVideos });
    
    res.json({ 
      message: 'Videos uploaded successfully',
      videos: uploadedKeys,
    });
  } catch (error) {
    logger.error('crm.upload_property_videos_error_', { message: 'Upload property videos error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete property image
router.delete('/properties/:id/images/:key', validateToken, extractTenantId, requireAdminOrManager, async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    const imageKey = decodeURIComponent(req.params.key);
    await deleteFromS3(imageKey);
    
    const updatedImages = (property.images || []).filter(key => key !== imageKey);
    await updateProperty(req.tenantId, req.params.id, { images: updatedImages });
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    logger.error('crm.delete_property_image_error_', { message: 'Delete property image error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete property video
router.delete('/properties/:id/videos/:key', validateToken, extractTenantId, requireAdminOrManager, async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    const videoKey = decodeURIComponent(req.params.key);
    await deleteFromS3(videoKey);
    
    const updatedVideos = (property.videos || []).filter(key => key !== videoKey);
    await updateProperty(req.tenantId, req.params.id, { videos: updatedVideos });
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    logger.error('crm.delete_property_video_error_', { message: 'Delete property video error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Owner Document Upload Routes ==============

// Upload owner documents (photo, PAN, Aadhar)
router.post('/owners/:id/documents', validateToken, extractTenantId, requireCrmMemberOrAbove, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'aadhar', maxCount: 1 }
]), async (req, res) => {
  try {
    const owner = await getOwner(req.tenantId, req.params.id);
    if (!owner) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    const updateData = {};

    if (req.files) {
      if (req.files.photo?.[0]) {
        const s3Key = await uploadToS3(
          req.files.photo[0].buffer,
          req.files.photo[0].originalname,
          req.files.photo[0].mimetype,
          'crm/owners/photos',
          req.tenantId
        );
        updateData.photoS3Key = s3Key;
      }
      if (req.files.pan?.[0]) {
        const s3Key = await uploadToS3(
          req.files.pan[0].buffer,
          req.files.pan[0].originalname,
          req.files.pan[0].mimetype,
          'crm/owners/documents',
          req.tenantId
        );
        updateData.panDocS3Key = s3Key;
      }
      if (req.files.aadhar?.[0]) {
        const s3Key = await uploadToS3(
          req.files.aadhar[0].buffer,
          req.files.aadhar[0].originalname,
          req.files.aadhar[0].mimetype,
          'crm/owners/documents',
          req.tenantId
        );
        updateData.aadharDocS3Key = s3Key;
      }
    }

    const updatedOwner = await updateOwner(req.tenantId, req.params.id, updateData);

    // Return with presigned URLs
    const ownerWithUrls = {
      ...updatedOwner,
      photoUrl: updatedOwner.photoS3Key ? await getS3SignedUrl(updatedOwner.photoS3Key) : null,
      panDocUrl: updatedOwner.panDocS3Key ? await getS3SignedUrl(updatedOwner.panDocS3Key) : null,
      aadharDocUrl: updatedOwner.aadharDocS3Key ? await getS3SignedUrl(updatedOwner.aadharDocS3Key) : null,
    };

    res.json(ownerWithUrls);
  } catch (error) {
    logger.error('crm.upload_owner_documents_error_', { message: 'Upload owner documents error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get owner with documents and presigned URLs
router.get('/owners/:id/with-documents', validateToken, extractTenantId, async (req, res) => {
  try {
    const owner = await getOwner(req.tenantId, req.params.id);
    if (!owner) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    let panNumber = owner.panNumber || null;
    let aadharNumber = owner.aadharNumber || null;
    let contactId = owner.contactId || null;
    try {
      const contact = owner.phone ? await findContactByPhone(req.tenantId, owner.phone) : null;
      if (contact) {
        contactId = contact.contactId;
        panNumber = panNumber || contact.panNumber || null;
        aadharNumber = aadharNumber || contact.aadharNumber || null;
        // Persist KYC onto OWNER shell when Contact has it
        const kycPatch = {};
        if (!owner.panNumber && contact.panNumber) kycPatch.panNumber = contact.panNumber;
        if (!owner.aadharNumber && contact.aadharNumber) kycPatch.aadharNumber = contact.aadharNumber;
        if (Object.keys(kycPatch).length) {
          await updateOwner(req.tenantId, owner.ownerId, kycPatch);
        }
      }
    } catch (err) {
      logger.warn('crm.get_owner_with_documents.enrich_failed', { ownerId: req.params.id, error: err.message });
    }

    const ownerWithUrls = {
      ...owner,
      contactId,
      panNumber,
      aadharNumber,
      photoUrl: owner.photoS3Key ? await getS3SignedUrl(owner.photoS3Key) : null,
      panDocUrl: owner.panDocS3Key ? await getS3SignedUrl(owner.panDocS3Key) : null,
      aadharDocUrl: owner.aadharDocS3Key ? await getS3SignedUrl(owner.aadharDocS3Key) : null,
    };

    res.json(ownerWithUrls);
  } catch (error) {
    logger.error('crm.get_owner_with_documents_error_', { message: 'Get owner with documents error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Customer/Tenant Document Upload Routes ==============

// Upload customer documents (photo, PAN, Aadhar)
router.post('/customers/:id/documents', validateToken, extractTenantId, requireCrmMemberOrAbove, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'aadhar', maxCount: 1 }
]), async (req, res) => {
  try {
    const customer = await getCustomer(req.tenantId, req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updateData = {};

    if (req.files) {
      if (req.files.photo?.[0]) {
        const s3Key = await uploadToS3(
          req.files.photo[0].buffer,
          req.files.photo[0].originalname,
          req.files.photo[0].mimetype,
          'crm/customers/photos',
          req.tenantId
        );
        updateData.photoS3Key = s3Key;
      }
      if (req.files.pan?.[0]) {
        const s3Key = await uploadToS3(
          req.files.pan[0].buffer,
          req.files.pan[0].originalname,
          req.files.pan[0].mimetype,
          'crm/customers/documents',
          req.tenantId
        );
        updateData.panDocS3Key = s3Key;
      }
      if (req.files.aadhar?.[0]) {
        const s3Key = await uploadToS3(
          req.files.aadhar[0].buffer,
          req.files.aadhar[0].originalname,
          req.files.aadhar[0].mimetype,
          'crm/customers/documents',
          req.tenantId
        );
        updateData.aadharDocS3Key = s3Key;
      }
    }

    const updatedCustomer = await updateCustomer(req.tenantId, req.params.id, updateData);

    // Return with presigned URLs
    const customerWithUrls = {
      ...updatedCustomer,
      photoUrl: updatedCustomer.photoS3Key ? await getS3SignedUrl(updatedCustomer.photoS3Key) : null,
      panDocUrl: updatedCustomer.panDocS3Key ? await getS3SignedUrl(updatedCustomer.panDocS3Key) : null,
      aadharDocUrl: updatedCustomer.aadharDocS3Key ? await getS3SignedUrl(updatedCustomer.aadharDocS3Key) : null,
    };

    res.json(customerWithUrls);
  } catch (error) {
    logger.error('crm.upload_customer_documents_error_', { message: 'Upload customer documents error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get customer with documents and presigned URLs
router.get('/customers/:id/with-documents', validateToken, extractTenantId, async (req, res) => {
  try {
    const customer = await getCustomer(req.tenantId, req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerWithUrls = {
      ...customer,
      photoUrl: customer.photoS3Key ? await getS3SignedUrl(customer.photoS3Key) : null,
      panDocUrl: customer.panDocS3Key ? await getS3SignedUrl(customer.panDocS3Key) : null,
      aadharDocUrl: customer.aadharDocS3Key ? await getS3SignedUrl(customer.aadharDocS3Key) : null,
    };

    res.json(customerWithUrls);
  } catch (error) {
    logger.error('crm.get_customer_with_documents_error_', { message: 'Get customer with documents error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Property Agreement Routes ==============

// Get property agreements
router.get('/properties/:id/agreements', validateToken, extractTenantId, async (req, res) => {
  try {
    const agreements = await getPropertyAgreements(req.tenantId, req.params.id);
    
    // Add signed URLs for documents
    const agreementsWithUrls = await Promise.all(
      agreements.map(async (agreement) => ({
        ...agreement,
        documentUrl: agreement.documentS3Key ? await getS3SignedUrl(agreement.documentS3Key) : null,
      }))
    );
    
    res.json(agreementsWithUrls);
  } catch (error) {
    logger.error('crm.get_property_agreements_error_', { message: 'Get property agreements error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create property agreement
router.post('/properties/:id/agreements', validateToken, extractTenantId, requireCrmMemberOrAbove, upload.single('document'), async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const agreementData = JSON.parse(req.body.data || '{}');

    if (req.file) {
      const s3Key = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        'crm/properties/agreements',
        req.tenantId
      );
      agreementData.documentS3Key = s3Key;
      agreementData.documentName = req.file.originalname;
    }

    const agreement = await createPropertyAgreement(req.tenantId, req.params.id, agreementData);
    res.status(201).json(agreement);
  } catch (error) {
    logger.error('crm.create_property_agreement_error_', { message: 'Create property agreement error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update property agreement
router.put('/properties/:id/agreements/:agreementId', validateToken, extractTenantId, requireCrmMemberOrAbove, upload.single('document'), async (req, res) => {
  try {
    const agreementData = JSON.parse(req.body.data || '{}');

    if (req.file) {
      const s3Key = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        'crm/properties/agreements',
        req.tenantId
      );
      agreementData.documentS3Key = s3Key;
      agreementData.documentName = req.file.originalname;
    }

    await updatePropertyAgreement(req.tenantId, req.params.id, req.params.agreementId, agreementData);
    res.json({ success: true });
  } catch (error) {
    logger.error('crm.update_property_agreement_error_', { message: 'Update property agreement error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Property Verification Routes ==============

// Get property verifications
router.get('/properties/:id/verifications', validateToken, extractTenantId, async (req, res) => {
  try {
    const verifications = await getPropertyVerifications(req.tenantId, req.params.id);
    
    // Add signed URLs for documents
    const verificationsWithUrls = await Promise.all(
      verifications.map(async (verification) => ({
        ...verification,
        documentUrl: verification.documentS3Key ? await getS3SignedUrl(verification.documentS3Key) : null,
      }))
    );
    
    res.json(verificationsWithUrls);
  } catch (error) {
    logger.error('crm.get_property_verifications_error_', { message: 'Get property verifications error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create property verification
router.post('/properties/:id/verifications', validateToken, extractTenantId, requireCrmMemberOrAbove, upload.single('document'), async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const verificationData = JSON.parse(req.body.data || '{}');

    if (req.file) {
      const s3Key = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        'crm/properties/verifications',
        req.tenantId
      );
      verificationData.documentS3Key = s3Key;
      verificationData.documentName = req.file.originalname;
    }

    const verification = await createPropertyVerification(req.tenantId, req.params.id, verificationData);
    res.status(201).json(verification);
  } catch (error) {
    logger.error('crm.create_property_verification_error_', { message: 'Create property verification error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update property verification
router.put('/properties/:id/verifications/:verificationId', validateToken, extractTenantId, requireCrmMemberOrAbove, upload.single('document'), async (req, res) => {
  try {
    const verificationData = JSON.parse(req.body.data || '{}');

    if (req.file) {
      const s3Key = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        'crm/properties/verifications',
        req.tenantId
      );
      verificationData.documentS3Key = s3Key;
      verificationData.documentName = req.file.originalname;
    }

    await updatePropertyVerification(req.tenantId, req.params.id, req.params.verificationId, verificationData);
    res.json({ success: true });
  } catch (error) {
    logger.error('crm.update_property_verification_error_', { message: 'Update property verification error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Property Document Routes ==============

// Get property documents
router.get('/properties/:id/documents', validateToken, extractTenantId, async (req, res) => {
  try {
    const documents = await getPropertyDocuments(req.tenantId, req.params.id);
    
    // Add signed URLs
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: doc.s3Key ? await getS3SignedUrl(doc.s3Key) : null,
      }))
    );
    
    res.json(documentsWithUrls);
  } catch (error) {
    logger.error('crm.get_property_documents_error_', { message: 'Get property documents error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Upload property document
router.post('/properties/:id/documents/upload', validateToken, extractTenantId, requireCrmMemberOrAbove, upload.fields([
  { name: 'files', maxCount: 20 },
  { name: 'file', maxCount: 1 },
]), async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const files = [
      ...((req.files && req.files.files) || []),
      ...((req.files && req.files.file) || []),
    ];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const documentType = req.body.documentType || 'OTHER';
    const description = req.body.description || '';

    const created = await Promise.all(
      files.map(async (f) => {
        const s3Key = await uploadToS3(
          f.buffer,
          f.originalname,
          f.mimetype,
          'crm/properties/documents',
          req.tenantId
        );

        const documentData = {
          s3Key,
          fileName: f.originalname,
          fileSize: f.size,
          mimeType: f.mimetype,
          documentType,
          description,
        };

        const document = await createPropertyDocument(req.tenantId, req.params.id, documentData);
        return {
          ...document,
          url: await getS3SignedUrl(s3Key),
        };
      })
    );

    res.status(201).json(created);
  } catch (error) {
    logger.error('crm.upload_property_document_error_', { message: 'Upload property document error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete property document
router.delete('/properties/:id/documents/:documentId', validateToken, extractTenantId, requireAdminOrManager, async (req, res) => {
  try {
    const documents = await getPropertyDocuments(req.tenantId, req.params.id);
    const document = documents.find(d => d.documentId === req.params.documentId);
    
    if (document && document.s3Key) {
      await deleteFromS3(document.s3Key);
    }
    
    await deletePropertyDocument(req.tenantId, req.params.id, req.params.documentId);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('crm.delete_property_document_error_', { message: 'Delete property document error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Properties with Full Details (for Dashboard) ==============

router.get('/properties/list/detailed', validateToken, extractTenantId, async (req, res) => {
  try {
    const properties = await getPropertiesWithDetails(req.tenantId);
    
    // Generate signed URLs for images and videos
    const propertiesWithUrls = await Promise.all(
      properties.map(async (property) => {
        const images = await Promise.all(
          (property.images || []).map(async (key) => ({
            key,
            url: await getS3SignedUrl(key),
          }))
        );
        const videos = await Promise.all(
          (property.videos || []).map(async (key) => ({
            key,
            url: await getS3SignedUrl(key),
          }))
        );
        return { ...property, images, videos };
      })
    );
    
    res.json(propertiesWithUrls);
  } catch (error) {
    logger.error('crm.get_detailed_properties_error_', { message: 'Get detailed properties error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Metrics Route ==============

router.get('/metrics', validateToken, extractTenantId, async (req, res) => {
  try {
    const metrics = await getCRMMetrics(req.tenantId);
    res.json(metrics);
  } catch (error) {
    logger.error('crm.get_crm_metrics_error_', { message: 'Get CRM metrics error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Business Analytics Route ==============

router.get('/analytics/business', validateToken, extractTenantId, async (req, res) => {
  try {
    // Get all properties with basic details
    const [{ properties }, { customers }, { owners }] = await Promise.all([
      getProperties(req.tenantId),
      getCustomers(req.tenantId),
      getOwners(req.tenantId),
    ]);

    // Create maps for quick lookup
    const ownerMap = new Map(owners.map(o => [o.ownerId, o]));
    const customerMap = new Map(customers.map(c => [c.customerId, c]));
    
    // Fetch all agreements and verifications in parallel (fallback when property fields are unset)
    const [allAgreements, allVerifications] = await Promise.all([
      Promise.all(properties.map(p => getPropertyAgreements(req.tenantId, p.propertyId))),
      Promise.all(properties.map(p => getPropertyVerifications(req.tenantId, p.propertyId))),
    ]);

    const agreementsByProperty = new Map();
    const verificationsByProperty = new Map();
    properties.forEach((p, i) => {
      agreementsByProperty.set(p.propertyId, allAgreements[i]);
      verificationsByProperty.set(p.propertyId, allVerifications[i]);
    });
    
    let totalRevenue = 0;
    let activeProperties = 0;
    let expiringThisMonth = 0;
    let expiringNextMonth = 0;
    let expiredAgreements = 0;
    let pendingAgreements = 0;
    let completedAgreements = 0;
    let pendingVerifications = 0;
    let completedVerifications = 0;
    
    const agreementExpiries = [];
    const verificationStatus = [];
    
    for (const property of properties) {
      const tenantId = property.tenantCustomerId || property.rentalInfo?.currentTenantId;
      const isOccupied = property.status === 'rented' || !!tenantId;
      const monthlyRent = resolvePropertyMonthlyRent(property);

      if (isOccupied) {
        activeProperties++;
        if (monthlyRent > 0) {
          totalRevenue += monthlyRent;
        }
      }
      
      const agreements = agreementsByProperty.get(property.propertyId) || [];
      const verifications = verificationsByProperty.get(property.propertyId) || [];
      const latestAgreement = agreements.length > 0 ? agreements[agreements.length - 1] : null;
      const latestVerification = verifications.length > 0 ? verifications[verifications.length - 1] : null;
      
      const owner = ownerMap.get(property.ownerId);
      const tenant = tenantId ? customerMap.get(tenantId) : null;
      
      const ownerName = owner ? owner.name : 'N/A';
      const tenantName = tenant ? tenant.name : 'N/A';
      const propertyAddress = `${property.title || ''}, ${property.area || ''}, ${property.city || ''}`.trim().replace(/^,\s*|,\s*$/g, '') || 'N/A';
      
      const agreementStatus = property.agreementStatus
        || latestAgreement?.status
        || 'not_started';
      const agreementDate = property.rentalInfo?.leaseStartDate
        || property.tenantMoveInDate
        || latestAgreement?.startDate
        || latestAgreement?.createdAt
        || null;
      
      if (agreementStatus === 'done') {
        completedAgreements++;
      } else if (agreementStatus === 'pending') {
        pendingAgreements++;
      }

      const verificationStatusValue = property.verificationStatus
        || latestVerification?.status
        || 'not_started';
      const verificationDate = latestVerification?.verificationDate
        || latestVerification?.createdAt
        || null;

      if (verificationStatusValue === 'done') {
        completedVerifications++;
      } else if (verificationStatusValue === 'pending') {
        pendingVerifications++;
      }

      const leaseEndDate = resolveLeaseEndDate(property, latestAgreement);
      const daysUntilExpiry = getDaysUntilLeaseExpiry(leaseEndDate);

      if (isOccupied && leaseEndDate && daysUntilExpiry !== null) {
        let expiryStatus = 'active';
        if (daysUntilExpiry < 0) {
          expiredAgreements++;
          expiryStatus = 'expired';
        } else if (daysUntilExpiry <= 30) {
          expiringThisMonth++;
          expiryStatus = 'expiring_soon';
        } else if (daysUntilExpiry <= 60) {
          expiringNextMonth++;
        }

        agreementExpiries.push({
          propertyId: property.propertyId,
          propertyAddress,
          tenantName,
          ownerName,
          agreementEndDate: leaseEndDate,
          daysUntilExpiry,
          monthlyRent,
          status: expiryStatus,
        });
      }
      
      verificationStatus.push({
        propertyId: property.propertyId,
        propertyAddress,
        tenantName,
        agreementStatus,
        policeVerificationStatus: verificationStatusValue,
        agreementDate,
        verificationDate,
      });
    }
    
    const occupancyRate = properties.length > 0
      ? Math.round((activeProperties / properties.length) * 100)
      : 0;
    
    const averageRent = activeProperties > 0
      ? Math.round(totalRevenue / activeProperties)
      : 0;
    
    // Count all customers as tenants (dashboard treats all customers as tenants)
    const totalTenants = customers.length;
    
    const analytics = {
      metrics: {
        totalRevenue,
        activeProperties,
        expiringThisMonth,
        expiringNextMonth,
        expiredAgreements,
        pendingAgreements,
        completedAgreements,
        pendingVerifications,
        completedVerifications,
        occupancyRate,
        averageRent,
        totalTenants,
        revenueGrowth: 0,
      },
      agreementExpiries: agreementExpiries.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
      verificationStatus,
      monthlyRevenue: [],
      propertyStatusDistribution: [
        { status: 'available', count: properties.filter(p => p.status === 'available').length },
        { status: 'for-sale', count: properties.filter(p => p.status === 'for-sale').length },
        { status: 'for-rent', count: properties.filter(p => p.status === 'for-rent').length },
        { status: 'rented', count: properties.filter(p => p.status === 'rented').length },
        { status: 'sold', count: properties.filter(p => p.status === 'sold').length },
        { status: 'on-hold', count: properties.filter(p => p.status === 'on-hold').length },
        { status: 'out-of-stock', count: properties.filter(p => p.status === 'out-of-stock').length },
      ],
    };
    
    res.json(analytics);
  } catch (error) {
    logger.error('crm.get_business_analytics_error_', { message: 'Get business analytics error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Meeting/Calendar Routes ==============

// Get all meetings (with optional filters)
router.get('/meetings', validateToken, extractTenantId, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (status) filters.status = status;
    
    const meetings = await getMeetings(req.tenantId, filters);
    res.json(meetings);
  } catch (error) {
    logger.error('crm.get_meetings_error_', { message: 'Get meetings error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get upcoming meetings
router.get('/meetings/upcoming', validateToken, extractTenantId, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const meetings = await getUpcomingMeetings(req.tenantId, days);
    res.json(meetings);
  } catch (error) {
    logger.error('crm.get_upcoming_meetings_error_', { message: 'Get upcoming meetings error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get meeting metrics
router.get('/meetings/metrics', validateToken, extractTenantId, async (req, res) => {
  try {
    const metrics = await getMeetingMetrics(req.tenantId);
    res.json(metrics);
  } catch (error) {
    logger.error('crm.get_meeting_metrics_error_', { message: 'Get meeting metrics error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get meetings by entity (customer, owner, enquiry, etc.)
router.get('/meetings/entity/:entityType/:entityId', validateToken, extractTenantId, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const meetings = await getMeetingsByEntity(req.tenantId, entityType, entityId);
    res.json(meetings);
  } catch (error) {
    logger.error('crm.get_meetings_by_entity_error_', { message: 'Get meetings by entity error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single meeting
router.get('/meetings/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const meeting = await getMeeting(req.tenantId, req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json(meeting);
  } catch (error) {
    logger.error('crm.get_meeting_error_', { message: 'Get meeting error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get meeting history/events
router.get('/meetings/:id/history', validateToken, extractTenantId, async (req, res) => {
  try {
    const history = await getMeetingHistory(req.tenantId, req.params.id);
    res.json(history);
  } catch (error) {
    logger.error('crm.get_meeting_history_error_', { message: 'Get meeting history error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create meeting
router.post('/meetings', validateToken, extractTenantId, requireCrmMemberOrAbove, validateBody(createMeetingSchema), async (req, res) => {
  try {
    const meeting = await createMeeting(req.tenantId, withCreateActor(req.user, req.body));

    // Resolve the assignee + agency owner and attach them to the reminder
    // scheduleMeetingReminder() already created, so the 15-minute-before
    // push/email goes to them — never the customer. Awaited (not
    // fire-and-forget) because Lambda can freeze the execution environment
    // right after the response is sent, silently dropping any work still
    // in flight; failures here are swallowed so they never fail the request.
    try {
      await attachMeetingReminderRecipients(req.tenantId, meeting);
    } catch (err) {
      logger.warn('crm.meetings.attach_recipients_failed', { tenantId: req.tenantId, meetingId: meeting.meetingId, error: err.message });
    }

    res.status(201).json(meeting);
  } catch (error) {
    logger.error('crm.create_meeting_error_', { message: 'Create meeting error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update meeting
router.put('/meetings/:id', validateToken, extractTenantId, requireCrmMemberOrAbove, validateBody(updateMeetingSchema), async (req, res) => {
  try {
    const meeting = await updateMeeting(req.tenantId, req.params.id, withUpdateActor(req.user, req.body));

    // A reschedule (date/time change) makes updateMeeting() re-create the
    // scheduled reminder via cancelMeetingReminder+scheduleMeetingReminder —
    // re-attach recipients so the new row keeps the resolved audience too.
    // Awaited (not fire-and-forget) — see the POST /meetings comment above
    // for why: Lambda can freeze right after the response is sent.
    try {
      await attachMeetingReminderRecipients(req.tenantId, meeting);
    } catch (err) {
      logger.warn('crm.meetings.attach_recipients_failed', { tenantId: req.tenantId, meetingId: meeting.meetingId, error: err.message });
    }

    res.json(meeting);
  } catch (error) {
    logger.error('crm.update_meeting_error_', { message: 'Update meeting error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete meeting
router.delete('/meetings/:id', validateToken, extractTenantId, requireAdminOrManager, async (req, res) => {
  try {
    await deleteMeeting(req.tenantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('crm.delete_meeting_error_', { message: 'Delete meeting error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Search Routes ==============

// Search owners by name or phone
router.get('/search/owners', validateToken, extractTenantId, async (req, res) => {
  try {
    const { q } = req.query;
    const results = await searchOwners(req.tenantId, q);
    res.json(results);
  } catch (error) {
    logger.error('crm.search_owners_error_', { message: 'Search owners error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Search customers/tenants by name or phone
router.get('/search/customers', validateToken, extractTenantId, async (req, res) => {
  try {
    const { q } = req.query;
    const results = await searchCustomers(req.tenantId, q);
    res.json(results);
  } catch (error) {
    logger.error('crm.search_customers_error_', { message: 'Search customers error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Search properties with filters
router.get('/search/properties', validateToken, extractTenantId, async (req, res) => {
  try {
    const { q, status, propertyType, bhk, furnishing, minRent, maxRent } = req.query;
    const filters = { status, propertyType, bhk, furnishing, minRent, maxRent };
    const results = await searchProperties(req.tenantId, q, filters);
    res.json(results);
  } catch (error) {
    logger.error('crm.search_properties_error_', { message: 'Search properties error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Property Status Management ==============

// List property for sale
router.post('/properties/:id/list-for-sale', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const { listedPrice } = req.body;
    if (!listedPrice) {
      return res.status(400).json({ error: 'Listed price is required' });
    }
    const result = await listPropertyForSale(
      req.tenantId,
      req.params.id,
      listedPrice,
      resolveRequestActor(req.user).actorName,
    );
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json({ ...updatedProperty, listing: result.listing || null });
  } catch (error) {
    logger.error('crm.list_property_for_sale_error_', { message: 'List property for sale error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// List property for rent
router.post('/properties/:id/list-for-rent', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const { expectedRent, securityDeposit } = req.body;
    if (!expectedRent) {
      return res.status(400).json({ error: 'Expected rent is required' });
    }
    const result = await listPropertyForRent(
      req.tenantId,
      req.params.id,
      expectedRent,
      securityDeposit || 0,
      resolveRequestActor(req.user).actorName,
    );
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json({ ...updatedProperty, listing: result.listing || null });
  } catch (error) {
    logger.error('crm.list_property_for_rent_error_', { message: 'List property for rent error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Listings API
router.get('/listings', validateToken, extractTenantId, async (req, res) => {
  try {
    const { createListing: _c, getListings, withdrawListing: _w } = await import('../services/listingService.js');
    const { status, listingType, propertyId, listedByContactId } = req.query;
    const listings = await getListings(req.tenantId, {
      status: status || undefined,
      listingType: listingType || undefined,
      propertyId: propertyId || undefined,
      listedByContactId: listedByContactId || undefined,
    });
    res.json({ listings, total: listings.length });
  } catch (error) {
    logger.error('crm.get_listings_error', { message: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/listings/:id/withdraw', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const { withdrawListing } = await import('../services/listingService.js');
    const listing = await withdrawListing(req.tenantId, req.params.id, {
      reason: req.body?.reason || 'withdrawn',
      performedBy: resolveRequestActor(req.user).actorName,
    });
    res.json(listing);
  } catch (error) {
    logger.error('crm.withdraw_listing_error', { message: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Mark property as sold
router.post('/properties/:id/mark-sold', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const { soldPrice, buyerId, saleType, reasonLost, notes, brokerageAmount, brokerageLost } = req.body;
    
    // Validate request
    if (!soldPrice) {
      return res.status(400).json({ error: 'Sold price is required' });
    }
    
    const type = saleType || 'direct';
    if (type === 'direct' && !buyerId) {
      return res.status(400).json({ error: 'Buyer ID is required for a direct sale' });
    }

    await markPropertySold(
      req.tenantId,
      req.params.id,
      soldPrice,
      buyerId || null,
      type,
      reasonLost || null,
      notes || null,
      brokerageAmount || null,
      brokerageLost || null,
      null,
      resolveRequestActor(req.user).actorName,
    );
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json(updatedProperty);
  } catch (error) {
    logger.error('crm.mark_property_sold_error_', { message: 'Mark property sold error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Mark property as rented
router.post('/properties/:id/mark-rented', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const { customerId, rentalDetails } = req.body;
    if (!customerId || !rentalDetails) {
      return res.status(400).json({ error: 'Customer ID and rental details are required' });
    }
    await markPropertyRented(
      req.tenantId,
      req.params.id,
      customerId,
      rentalDetails,
      null,
      resolveRequestActor(req.user).actorName,
    );
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json(updatedProperty);
  } catch (error) {
    logger.error('crm.mark_property_rented_error_', { message: 'Mark property rented error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Vacate property
router.post('/properties/:id/vacate', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const result = await vacateProperty(req.tenantId, req.params.id);
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json({ ...result, property: updatedProperty });
  } catch (error) {
    logger.error('crm.vacate_property_error_', { message: 'Vacate property error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Buyer Purchase Management ==============

// Add purchase to buyer
router.post('/buyers/:id/purchases', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const purchaseDetails = req.body;
    if (!purchaseDetails.propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }
    const purchase = await addPurchaseToBuyer(req.tenantId, req.params.id, purchaseDetails);
    res.status(201).json(purchase);
  } catch (error) {
    logger.error('crm.add_purchase_to_buyer_error_', { message: 'Add purchase to buyer error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update buyer purchase
router.put('/buyers/:id/purchases/:propertyId', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const updates = req.body;
    const updatedPurchase = await updateBuyerPurchase(
      req.tenantId,
      req.params.id,
      req.params.propertyId,
      updates
    );
    res.json(updatedPurchase);
  } catch (error) {
    logger.error('crm.update_buyer_purchase_error_', { message: 'Update buyer purchase error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Tenant Rental Management ==============

// Update tenant's current rental
router.put('/customers/:id/current-rental', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const rentalDetails = req.body;
    const updatedRental = await updateCurrentRental(req.tenantId, req.params.id, rentalDetails);
    res.json(updatedRental);
  } catch (error) {
    logger.error('crm.update_current_rental_error_', { message: 'Update current rental error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Archive tenant's current rental to history
router.post('/customers/:id/archive-rental', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const result = await moveTenantToHistory(req.tenantId, req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('crm.archive_rental_error_', { message: 'Archive rental error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get tenant rental history
router.get('/customers/:id/rental-history', validateToken, extractTenantId, async (req, res) => {
  try {
    const customer = await getCustomer(req.tenantId, req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({
      currentRental: customer.currentRental || null,
      rentalHistory: customer.rentalHistory || [],
    });
  } catch (error) {
    logger.error('crm.get_rental_history_error_', { message: 'Get rental history error:', error: error?.message });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.use(handleCrmUploadErrors);

export default router;
