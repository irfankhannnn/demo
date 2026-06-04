import express from 'express';
import multer from 'multer';
import {
  createCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  // deleteCustomer, // DISABLED: Delete operations not allowed
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
  // deleteOwner, // DISABLED: Delete operations not allowed
  createProperty,
  getProperties,
  getPropertiesByStatus,
  getPropertiesByOwner,
  getProperty,
  updateProperty,
  // deleteProperty, // DISABLED: Delete operations not allowed
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
import { uploadToS3, deleteFromS3, getSignedUrl as getS3SignedUrl } from '../s3Service.js';
import { extractTenantId, extractTenantIdOptional } from '../tenantMiddleware.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
    files: 10 // Max 10 files at once
  }
});

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
    console.error('Get customers error:', error);
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
    console.error('Get customer error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create customer
router.post('/customers', validateToken, extractTenantId, async (req, res) => {
  try {
    const customer = await createCustomer(req.tenantId, req.body);
    res.status(201).json(customer);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update customer
router.put('/customers/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const customer = await updateCustomer(req.tenantId, req.params.id, req.body);
    res.json(customer);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete customer - DISABLED: Delete operations are not allowed
// router.delete('/customers/:id', validateToken, extractTenantId, async (req, res) => {
//   res.status(403).json({ error: 'Delete operations are not allowed' });
// });

// Get customer notes
router.get('/customers/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const notes = await getCustomerNotes(req.tenantId, req.params.id);
    res.json(notes);
  } catch (error) {
    console.error('Get customer notes error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create customer note
router.post('/customers/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const note = await createCustomerNote(req.tenantId, req.params.id, req.body);
    res.status(201).json(note);
  } catch (error) {
    console.error('Create customer note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/customers/:id/notes/:noteId', validateToken, extractTenantId, async (req, res) => {
  try {
    const updated = await updateCustomerNote(req.tenantId, req.params.id, req.params.noteId, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Update customer note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/customers/:id/notes/:noteId', validateToken, extractTenantId, async (req, res) => {
  try {
    await deleteCustomerNote(req.tenantId, req.params.id, req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer note error:', error);
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

    const normalizePhone = (phone) => String(phone || '').replace(/[^0-9]/g, '').slice(-10);

    // Build DB filters (pre-property-count)
    const dbFilters = {};
    if (status) dbFilters.status = status;
    if (source) dbFilters.source = source;
    if (area) dbFilters.area = area;
    if (search) dbFilters.search = search;
    if (createdFrom) dbFilters.createdFrom = createdFrom;
    if (createdTo) dbFilters.createdTo = createdTo;
    if (tag) dbFilters.tag = tag;
    if (sortBy) dbFilters.sortBy = sortBy;
    if (sortOrder) dbFilters.sortOrder = sortOrder;

    // Fetch all matching owners (no pagination yet — we need to compute counts first)
    const [ownersInitial, properties, ownerContacts, sellerContacts] = await Promise.all([
      getOwners(req.tenantId, dbFilters),
      getProperties(req.tenantId),
      getContacts(req.tenantId, { role: 'owner' }),
      getContacts(req.tenantId, { role: 'seller' }),
    ]);

    // Backfill: ensure converted leads stored as CONTACT are visible
    const ownersByPhone = new Set((ownersInitial.owners || []).map((o) => normalizePhone(o.phone)).filter(Boolean));
    const allContactsToCheck = [...(ownerContacts || []), ...(sellerContacts || [])];
    const contactsToBackfill = allContactsToCheck.filter((c) => {
      const phone = normalizePhone(c.phone);
      return !!phone && !ownersByPhone.has(phone);
    });

    if (contactsToBackfill.length) {
      await Promise.all(contactsToBackfill.map((c) =>
        createOrUpdateOwnerByPhone(req.tenantId, {
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.address || '',
          notes: c.notes || '',
          status: c.status || 'active',
          source: c.source || `contact:${c.roles?.owner ? 'owner' : 'seller'}`,
        })
      ));
    }

    // Re-fetch after backfill with same filters
    const ownersResult = contactsToBackfill.length
      ? await getOwners(req.tenantId, dbFilters)
      : ownersInitial;
    let owners = ownersResult.owners;

    // Compute property counts
    const propertyCounts = properties.reduce((acc, property) => {
      const ownerId = property.ownerId;
      if (!ownerId) return acc;
      acc[ownerId] = (acc[ownerId] || 0) + 1;
      return acc;
    }, {});

    // Identify sellers (owners with for-sale/sold properties)
    const forSaleProperties = properties.filter(p => p.status === 'for-sale' || p.status === 'sold');
    const sellerOwnerIds = new Set(forSaleProperties.map(p => p.ownerId).filter(Boolean));

    // Attach counts
    owners = owners.map((owner) => ({
      ...owner,
      propertyCount: propertyCounts[owner.ownerId] || 0,
      isSeller: sellerOwnerIds.has(owner.ownerId),
    }));

    // Apply post-DB filters
    if (hasProperties === 'true') {
      owners = owners.filter(o => o.propertyCount > 0);
    }
    if (seller === 'true') {
      owners = owners.filter(o => o.isSeller);
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
    const pageLimit = parseInt(limit) || 50;
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
    console.error('Get owners error:', error);
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
    res.json(owner);
  } catch (error) {
    console.error('Get owner error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create owner
router.post('/owners', validateToken, extractTenantId, async (req, res) => {
  try {
    const owner = await createOwner(req.tenantId, req.body);
    res.status(201).json(owner);
  } catch (error) {
    console.error('Create owner error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update owner
router.put('/owners/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const owner = await updateOwner(req.tenantId, req.params.id, req.body);
    res.json(owner);
  } catch (error) {
    console.error('Update owner error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Owner notes
router.get('/owners/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const notes = await getOwnerNotes(req.tenantId, req.params.id);
    res.json(notes);
  } catch (error) {
    console.error('Get owner notes error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/owners/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const note = await createOwnerNote(req.tenantId, req.params.id, req.body);
    res.status(201).json(note);
  } catch (error) {
    console.error('Create owner note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/owners/:id/notes/:noteId', validateToken, extractTenantId, async (req, res) => {
  try {
    const updated = await updateOwnerNote(req.tenantId, req.params.id, req.params.noteId, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Update owner note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/owners/:id/notes/:noteId', validateToken, extractTenantId, async (req, res) => {
  try {
    await deleteOwnerNote(req.tenantId, req.params.id, req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete owner note error:', error);
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
    console.error('Lookup owner by phone error:', error);
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
    console.error('Lookup customer by phone error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get properties by owner
router.get('/owners/:id/properties', validateToken, extractTenantId, async (req, res) => {
  try {
    const properties = await getPropertiesByOwner(req.tenantId, req.params.id);
    
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
    console.error('Get owner properties error:', error);
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

    // Light enrichment: owner name/phone only (avoid N+1 signed URLs for lists)
    const { owners } = await getOwners(req.tenantId);
    const ownerMap = new Map(owners.map(o => [o.ownerId, o]));

    const enriched = properties.map(p => {
      const owner = ownerMap.get(p.ownerId);
      return {
        ...p,
        ownerName: owner?.name || p.ownerName || null,
        ownerPhone: owner?.phone || p.ownerPhone || null,
      };
    });

    const pageLimit = parseInt(limit) || 50;
    const pageOffset = parseInt(offset) || 0;

    res.json({
      properties: enriched,
      total,
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get public properties (for /properties page - NO owner info)
router.get('/properties/public/list', extractTenantIdOptional, async (req, res) => {
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
        
        // Remove owner info and sensitive data
        const { ownerId, ...publicData } = property;
        return {
          ...publicData,
          images,
          videos,
        };
      })
    );
    
    res.json(publicProperties);
  } catch (error) {
    console.error('Get public properties error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single property
router.get('/properties/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Get owner, tenant data and signed URLs (handle null/unassigned owner)
    const owner = property.ownerId 
      ? await getOwner(req.tenantId, property.ownerId)
      : null;
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
    console.error('Get property error:', error);
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
    console.error('Get property rental history error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get public property details
router.get('/properties/public/:id', extractTenantIdOptional, async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required for public property' });
    }
    
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property || !['available', 'for-sale', 'for-rent'].includes(property.status)) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Increment view count
    await incrementPropertyViews(req.tenantId, req.params.id);
    
    // Generate signed URLs but DON'T include owner data
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
    
    // Remove owner info
    const { ownerId, ...publicData } = property;
    res.json({ ...publicData, images, videos });
  } catch (error) {
    console.error('Get public property error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create property
router.post('/properties', validateToken, extractTenantId, async (req, res) => {
  try {
    const property = await createProperty(req.tenantId, req.body);
    res.status(201).json(property);
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update property
router.put('/properties/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const property = await updateProperty(req.tenantId, req.params.id, req.body);
    res.json(property);
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete property - DISABLED: Delete operations are not allowed
// router.delete('/properties/:id', validateToken, extractTenantId, async (req, res) => {
//   res.status(403).json({ error: 'Delete operations are not allowed' });
// });

// Upload property images
router.post('/properties/:id/images', validateToken, extractTenantId, upload.array('images', 10), async (req, res) => {
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
    console.error('Upload property images error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Upload property videos
router.post('/properties/:id/videos', validateToken, extractTenantId, upload.array('videos', 5), async (req, res) => {
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
    console.error('Upload property videos error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete property image
router.delete('/properties/:id/images/:key', validateToken, extractTenantId, async (req, res) => {
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
    console.error('Delete property image error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete property video
router.delete('/properties/:id/videos/:key', validateToken, extractTenantId, async (req, res) => {
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
    console.error('Delete property video error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Owner Document Upload Routes ==============

// Upload owner documents (photo, PAN, Aadhar)
router.post('/owners/:id/documents', validateToken, extractTenantId, upload.fields([
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
    console.error('Upload owner documents error:', error);
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

    const ownerWithUrls = {
      ...owner,
      photoUrl: owner.photoS3Key ? await getS3SignedUrl(owner.photoS3Key) : null,
      panDocUrl: owner.panDocS3Key ? await getS3SignedUrl(owner.panDocS3Key) : null,
      aadharDocUrl: owner.aadharDocS3Key ? await getS3SignedUrl(owner.aadharDocS3Key) : null,
    };

    res.json(ownerWithUrls);
  } catch (error) {
    console.error('Get owner with documents error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Customer/Tenant Document Upload Routes ==============

// Upload customer documents (photo, PAN, Aadhar)
router.post('/customers/:id/documents', validateToken, extractTenantId, upload.fields([
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
    console.error('Upload customer documents error:', error);
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
    console.error('Get customer with documents error:', error);
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
    console.error('Get property agreements error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create property agreement
router.post('/properties/:id/agreements', validateToken, extractTenantId, upload.single('document'), async (req, res) => {
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
    console.error('Create property agreement error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update property agreement
router.put('/properties/:id/agreements/:agreementId', validateToken, extractTenantId, upload.single('document'), async (req, res) => {
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
    console.error('Update property agreement error:', error);
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
    console.error('Get property verifications error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create property verification
router.post('/properties/:id/verifications', validateToken, extractTenantId, upload.single('document'), async (req, res) => {
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
    console.error('Create property verification error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update property verification
router.put('/properties/:id/verifications/:verificationId', validateToken, extractTenantId, upload.single('document'), async (req, res) => {
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
    console.error('Update property verification error:', error);
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
    console.error('Get property documents error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Upload property document
router.post('/properties/:id/documents/upload', validateToken, extractTenantId, upload.fields([
  { name: 'files', maxCount: 20 },
  { name: 'file', maxCount: 1 },
]), async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.id);
    if (!property) {
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
      });
      return res.status(404).json({ error: 'Property not found' });
    }

    const files = [
      ...((req.files && req.files.files) || []),
      ...((req.files && req.files.file) || []),
    ];

    if (!files || files.length === 0) {
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
      });
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
    console.error('Upload property document error:', error);
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
    });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete property document
router.delete('/properties/:id/documents/:documentId', validateToken, extractTenantId, async (req, res) => {
  try {
    const documents = await getPropertyDocuments(req.tenantId, req.params.id);
    const document = documents.find(d => d.documentId === req.params.documentId);
    
    if (document && document.s3Key) {
      await deleteFromS3(document.s3Key);
    }
    
    await deletePropertyDocument(req.tenantId, req.params.id, req.params.documentId);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete property document error:', error);
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
    console.error('Get detailed properties error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Metrics Route ==============

router.get('/metrics', validateToken, extractTenantId, async (req, res) => {
  try {
    const metrics = await getCRMMetrics(req.tenantId);
    res.json(metrics);
  } catch (error) {
    console.error('Get CRM metrics error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Business Analytics Route ==============

router.get('/analytics/business', validateToken, extractTenantId, async (req, res) => {
  try {
    // Get all properties with basic details
    const { properties } = await getProperties(req.tenantId);
    const { customers } = await getCustomers(req.tenantId);
    const { owners } = await getOwners(req.tenantId);

    // Create maps for quick lookup
    const ownerMap = new Map(owners.map(o => [o.ownerId, o]));
    const customerMap = new Map(customers.map(c => [c.customerId, c]));
    
    // Calculate business metrics
    const now = new Date();
    
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
    
    // Process each property and fetch its agreements and verifications
    for (const property of properties) {
      // Calculate revenue for rented properties
      if ((property.status === 'rented') && property.monthlyRent) {
        totalRevenue += property.monthlyRent;
        activeProperties++;
      }
      
      // Fetch agreements and verifications for this property
      const agreements = await getPropertyAgreements(req.tenantId, property.propertyId);
      const verifications = await getPropertyVerifications(req.tenantId, property.propertyId);
      
      // Get owner and tenant names
      const owner = ownerMap.get(property.ownerId);
      const tenant = property.tenantCustomerId ? customerMap.get(property.tenantCustomerId) : null;
      
      const ownerName = owner ? owner.name : 'N/A';
      const tenantName = tenant ? tenant.name : 'N/A';
      const propertyAddress = `${property.title || ''}, ${property.area || ''}, ${property.city || ''}`.trim().replace(/^,\s*|,\s*$/g, '') || 'N/A';
      
      // Process agreements
      let agreementStatus = 'not_started';
      let agreementDate = null;
      
      if (agreements && agreements.length > 0) {
        const latestAgreement = agreements[agreements.length - 1];
        agreementStatus = latestAgreement.status || 'not_started';
        agreementDate = latestAgreement.createdAt;
        
        if (latestAgreement.status === 'done') {
          completedAgreements++;
          
          // Check for expiry
          if (latestAgreement.endDate) {
            const endDate = new Date(latestAgreement.endDate);
            const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            
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
              agreementEndDate: latestAgreement.endDate,
              daysUntilExpiry,
              monthlyRent: property.monthlyRent || 0,
              status: expiryStatus,
            });
          }
        } else if (latestAgreement.status === 'pending') {
          pendingAgreements++;
        }
      }
      
      // Process verifications
      let verificationStatusValue = 'not_started';
      let verificationDate = null;
      
      if (verifications && verifications.length > 0) {
        const latestVerification = verifications[verifications.length - 1];
        verificationStatusValue = latestVerification.status || 'not_started';
        verificationDate = latestVerification.createdAt;
        
        if (latestVerification.status === 'done') {
          completedVerifications++;
        } else if (latestVerification.status === 'pending') {
          pendingVerifications++;
        }
      }
      
      // Add to verification status tracking
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
    
    const totalTenants = customers.filter(c => c.status === 'active').length;
    
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
    console.error('Get business analytics error:', error);
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
    });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Meeting/Calendar Routes ==============

// OPTIONS for CORS preflight (no auth required)
router.options('/meetings', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  });
  res.sendStatus(200);
});

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
    console.error('Get meetings error:', error);
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
    console.error('Get upcoming meetings error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// OPTIONS for /meetings/metrics (no auth required)
router.options('/meetings/metrics', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  });
  res.sendStatus(200);
});

// Get meeting metrics
router.get('/meetings/metrics', validateToken, extractTenantId, async (req, res) => {
  try {
    const metrics = await getMeetingMetrics(req.tenantId);
    res.json(metrics);
  } catch (error) {
    console.error('Get meeting metrics error:', error);
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
    console.error('Get meetings by entity error:', error);
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
    console.error('Get meeting error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get meeting history/events
router.get('/meetings/:id/history', validateToken, extractTenantId, async (req, res) => {
  try {
    const history = await getMeetingHistory(req.tenantId, req.params.id);
    res.json(history);
  } catch (error) {
    console.error('Get meeting history error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create meeting
router.post('/meetings', validateToken, extractTenantId, async (req, res) => {
  try {
    const meeting = await createMeeting(req.tenantId, req.body);
    res.status(201).json(meeting);
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update meeting
router.put('/meetings/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const meeting = await updateMeeting(req.tenantId, req.params.id, req.body);
    res.json(meeting);
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete meeting
router.delete('/meetings/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    await deleteMeeting(req.tenantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete meeting error:', error);
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
    console.error('Search owners error:', error);
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
    console.error('Search customers error:', error);
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
    console.error('Search properties error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Property Status Management ==============

// List property for sale
router.post('/properties/:id/list-for-sale', validateToken, extractTenantId, async (req, res) => {
  try {
    const { listedPrice } = req.body;
    if (!listedPrice) {
      return res.status(400).json({ error: 'Listed price is required' });
    }
    await listPropertyForSale(req.tenantId, req.params.id, listedPrice);
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json(updatedProperty);
  } catch (error) {
    console.error('List property for sale error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// List property for rent
router.post('/properties/:id/list-for-rent', validateToken, extractTenantId, async (req, res) => {
  try {
    const { expectedRent, securityDeposit } = req.body;
    if (!expectedRent) {
      return res.status(400).json({ error: 'Expected rent is required' });
    }
    await listPropertyForRent(req.tenantId, req.params.id, expectedRent, securityDeposit || 0);
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json(updatedProperty);
  } catch (error) {
    console.error('List property for rent error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Mark property as sold
router.post('/properties/:id/mark-sold', validateToken, extractTenantId, async (req, res) => {
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

    await markPropertySold(req.tenantId, req.params.id, soldPrice, buyerId || null, type, reasonLost || null, notes || null, brokerageAmount || null, brokerageLost || null);
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json(updatedProperty);
  } catch (error) {
    console.error('Mark property sold error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Mark property as rented
router.post('/properties/:id/mark-rented', validateToken, extractTenantId, async (req, res) => {
  try {
    const { customerId, rentalDetails } = req.body;
    if (!customerId || !rentalDetails) {
      return res.status(400).json({ error: 'Customer ID and rental details are required' });
    }
    await markPropertyRented(req.tenantId, req.params.id, customerId, rentalDetails);
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json(updatedProperty);
  } catch (error) {
    console.error('Mark property rented error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Vacate property
router.post('/properties/:id/vacate', validateToken, extractTenantId, async (req, res) => {
  try {
    const result = await vacateProperty(req.tenantId, req.params.id);
    const updatedProperty = await getProperty(req.tenantId, req.params.id);
    res.json({ ...result, property: updatedProperty });
  } catch (error) {
    console.error('Vacate property error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Buyer Purchase Management ==============

// Add purchase to buyer
router.post('/buyers/:id/purchases', validateToken, extractTenantId, async (req, res) => {
  try {
    const purchaseDetails = req.body;
    if (!purchaseDetails.propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }
    const purchase = await addPurchaseToBuyer(req.tenantId, req.params.id, purchaseDetails);
    res.status(201).json(purchase);
  } catch (error) {
    console.error('Add purchase to buyer error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update buyer purchase
router.put('/buyers/:id/purchases/:propertyId', validateToken, extractTenantId, async (req, res) => {
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
    console.error('Update buyer purchase error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Tenant Rental Management ==============

// Update tenant's current rental
router.put('/customers/:id/current-rental', validateToken, extractTenantId, async (req, res) => {
  try {
    const rentalDetails = req.body;
    const updatedRental = await updateCurrentRental(req.tenantId, req.params.id, rentalDetails);
    res.json(updatedRental);
  } catch (error) {
    console.error('Update current rental error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Archive tenant's current rental to history
router.post('/customers/:id/archive-rental', validateToken, extractTenantId, async (req, res) => {
  try {
    const result = await moveTenantToHistory(req.tenantId, req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Archive rental error:', error);
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
    console.error('Get rental history error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
