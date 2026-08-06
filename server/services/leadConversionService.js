/**
 * Lead Conversion Domain — contracts, builders, and TransactWrite planners.
 *
 * Canonical identity target (Phase 4+): Contact + role profiles.
 * Legacy storage (compat bridge during transition):
 *   buyer  → BUYER (+ Contact.buyerProfile)
 *   seller → OWNER (role=seller) + optional for-sale property (+ Contact.sellerProfile + Listing)
 *   tenant → CUSTOMER (+ Contact.tenantProfile)
 *   owner  → OWNER + optional for-rent property (+ Contact.ownerProfile + Listing)
 *
 * Lossless rule: every lead field is preserved verbatim in sourceLeadSnapshot
 * and conversion provenance. Operational fields are derived separately.
 */

import { v4 as uuidv4 } from 'uuid';
import { SERVICE_ACCOUNT_USER } from '../utils/serviceAccount.js';

export const DYNAMO_TRANSACT_MAX_ITEMS = 100;
export const LEAD_CONVERSION_ENTITY = 'LEAD_CONVERSION';

/**
 * Reconstruct a read-only lead view from an immutable conversion snapshot
 * (active LEAD PROFILE is deleted after successful conversion).
 */
export function projectLeadFromConversionSnapshot(snapshot) {
  if (!snapshot) return null;
  const source = snapshot.sourceLeadSnapshot?.lead || {};
  return {
    ...source,
    leadId: snapshot.leadId || source.leadId,
    leadType: snapshot.leadType || source.leadType,
    name: source.name || 'Converted lead',
    status: 'converted',
    convertedAt: snapshot.convertedAt || source.convertedAt,
    convertedTo: {
      entityType: snapshot.entityType,
      entityId: snapshot.entityId,
      role: snapshot.role,
    },
    conversionSnapshotId: snapshot.conversionSnapshotId,
    archivedFromSnapshot: true,
    snapshotNotes: snapshot.sourceLeadSnapshot?.notes || [],
    snapshotMeetings: snapshot.sourceLeadSnapshot?.meetings || [],
  };
}

export const CONVERSION_SYSTEM_KEYS = Object.freeze([
  'convertedAt',
  'convertedTo',
  'convertingLockAt',
  'conversionSnapshotId',
  'PK',
  'SK',
  'EntityType',
  'tenantId',
  'GSI3PK',
  'GSI3SK',
]);

/** Deep clone JSON-safe values for immutable snapshots. */
export function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

/** Strip DynamoDB/system keys from a lead profile for the lossless snapshot. */
export function buildSourceLeadSnapshot(lead, notes = [], meetings = []) {
  const clone = deepClone(lead) || {};
  for (const key of CONVERSION_SYSTEM_KEYS) {
    delete clone[key];
  }
  delete clone.PK;
  delete clone.SK;
  return {
    lead: clone,
    notes: deepClone(notes) || [],
    meetings: (deepClone(meetings) || []).map((m) => ({
      meetingId: m.meetingId,
      title: m.title,
      description: m.description,
      meetingDate: m.meetingDate,
      meetingTime: m.meetingTime,
      location: m.location,
      status: m.status,
      duration: m.duration,
      attendeeName: m.attendeeName,
      attendeeEmail: m.attendeeEmail,
      attendeePhone: m.attendeePhone,
      notes: m.notes,
      outcome: m.outcome,
      relatedEntityType: m.relatedEntityType,
      relatedEntityId: m.relatedEntityId,
    })),
  };
}

export function normalizePhoneDigits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  const withoutPrefix = digits.startsWith('91') && digits.length === 12
    ? digits.slice(2)
    : digits.startsWith('910') && digits.length === 13
      ? digits.slice(3)
      : digits;
  if (/^[6-9]\d{9}$/.test(withoutPrefix)) return withoutPrefix;
  return digits.slice(-10);
}

export function phonesMatch(a, b) {
  const na = normalizePhoneDigits(a);
  const nb = normalizePhoneDigits(b);
  return !!(na && nb && na === nb);
}

export function validateConvertLeadOptions(options = {}) {
  const out = {
    existingContactId: options.existingContactId || null,
    convertedBy: options.convertedBy || SERVICE_ACCOUNT_USER,
    convertedByUserId: options.convertedByUserId || null,
    purchaseDetails: options.purchaseDetails || null,
    leaseDetails: options.leaseDetails || null,
    kycDetails: options.kycDetails && typeof options.kycDetails === 'object'
      ? options.kycDetails
      : {},
    createPropertyListing: options.createPropertyListing !== false,
  };

  if (out.purchaseDetails && !out.purchaseDetails.propertyId) {
    const err = new Error('purchaseDetails.propertyId is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (out.leaseDetails && !out.leaseDetails.propertyId) {
    const err = new Error('leaseDetails.propertyId is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return out;
}

export function buildKycFields(kycDetails = {}) {
  if (!kycDetails || typeof kycDetails !== 'object') return {};
  const out = {};
  if (kycDetails.panNumber) out.panNumber = String(kycDetails.panNumber).trim();
  if (kycDetails.aadharNumber) out.aadharNumber = String(kycDetails.aadharNumber).trim();
  return out;
}

/** Coerce to a finite number; DynamoDB rejects NaN/Infinity. */
export function coerceFiniteNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/** Coerce optional numeric field — returns null when missing or invalid. */
export function coerceOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Map lead BHK labels ("3 BHK", "2.5 BHK", "Studio") to property numeric bhk.
 * Lead forms store human-readable labels; property records use numbers.
 */
export function parsePropertyBhk(bhk, fallback = 1) {
  if (bhk === null || bhk === undefined || bhk === '') return fallback;
  if (typeof bhk === 'number' && Number.isFinite(bhk)) return bhk;
  const str = String(bhk).trim();
  if (!str) return fallback;
  if (/^studio$/i.test(str)) return 0;
  const match = str.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : fallback;
  }
  return fallback;
}

/**
 * Map leadType → canonical module entity type returned to clients.
 * Storage may use OWNER/CUSTOMER for seller/tenant compatibility.
 */
export function canonicalEntityTypeForLeadType(leadType) {
  switch (leadType) {
    case 'buyer': return 'buyer';
    case 'seller': return 'seller';
    case 'tenant': return 'tenant';
    case 'owner': return 'owner';
    default: {
      const err = new Error(`Unknown lead type: ${leadType}`);
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
  }
}

/** Storage EntityType used in DynamoDB. */
export function storageEntityTypeForLeadType(leadType) {
  switch (leadType) {
    case 'buyer': return 'BUYER';
    case 'seller': return 'OWNER';
    case 'tenant': return 'CUSTOMER';
    case 'owner': return 'OWNER';
    default: return null;
  }
}

function baseIdentityFromLead(lead, options, kycFields) {
  return {
    name: lead.name,
    email: lead.email || null,
    phone: lead.phone,
    address: lead.address || '',
    notes: lead.notes || '',
    assignedTo: lead.assignedTo || null,
    source: `lead:${lead.leadId}`,
    createdFrom: `lead:${lead.leadId}`,
    createdBy: options.convertedBy || SERVICE_ACCOUNT_USER,
    status: 'active',
    ...kycFields,
  };
}

/**
 * Build a new or merged BUYER record (operational fields + provenance).
 */
export function buildBuyerEntity(lead, options, existingBuyer = null) {
  const kyc = buildKycFields(options.kycDetails);
  const req = lead.buyerRequirement || {};
  const now = new Date().toISOString();
  const buyerId = existingBuyer?.buyerId || uuidv4();
  const identity = baseIdentityFromLead(lead, options, kyc);

  const operational = {
    budget: req.budget ?? existingBuyer?.budget ?? null,
    propertyType: req.propertyType ?? existingBuyer?.propertyType ?? null,
    preferredArea: req.preferredArea ?? existingBuyer?.preferredArea ?? null,
    requirement: req.requirement ?? existingBuyer?.requirement ?? null,
    bhk: req.bhk ?? existingBuyer?.bhk ?? null,
    furnishing: req.furnishing ?? existingBuyer?.furnishing ?? null,
    priority: lead.priority || existingBuyer?.priority || 'medium',
    purchases: existingBuyer?.purchases || [],
    tags: existingBuyer?.tags || [],
  };

  // Merge: prefer existing non-empty human-entered values for identity conflicts
  const merged = existingBuyer
    ? {
        ...existingBuyer,
        ...identity,
        name: existingBuyer.name || identity.name,
        email: existingBuyer.email || identity.email,
        address: existingBuyer.address || identity.address,
        notes: existingBuyer.notes || identity.notes,
        assignedTo: existingBuyer.assignedTo || identity.assignedTo,
        ...operational,
        // Prefer incoming requirement fields when provided
        budget: req.budget != null ? req.budget : (existingBuyer.budget ?? null),
        propertyType: req.propertyType || existingBuyer.propertyType || null,
        preferredArea: req.preferredArea || existingBuyer.preferredArea || null,
        requirement: req.requirement || existingBuyer.requirement || null,
        bhk: req.bhk != null ? req.bhk : (existingBuyer.bhk ?? null),
        furnishing: req.furnishing || existingBuyer.furnishing || null,
        updatedAt: now,
        wasExisting: true,
      }
    : {
        PK: undefined, // filled by planner
        SK: 'PROFILE',
        EntityType: 'BUYER',
        buyerId,
        ...identity,
        ...operational,
        createdAt: now,
        updatedAt: now,
        wasExisting: false,
      };

  return {
    entityType: 'buyer',
    storageType: 'BUYER',
    entityId: buyerId,
    idField: 'buyerId',
    item: merged,
    wasExisting: !!existingBuyer,
  };
}

export function buildOwnerEntity(lead, options, existingOwner = null, { asSeller = false } = {}) {
  const kyc = buildKycFields(options.kycDetails);
  const now = new Date().toISOString();
  const ownerId = existingOwner?.ownerId || uuidv4();
  const identity = baseIdentityFromLead(lead, options, kyc);
  const profileKey = asSeller ? 'sellerProfile' : 'ownerProfile';
  const profileData = asSeller
    ? (lead.sellerProperty || {})
    : (lead.ownerProperty || {});

  const merged = existingOwner
    ? {
        ...existingOwner,
        ...identity,
        name: existingOwner.name || identity.name,
        email: existingOwner.email || identity.email,
        address: existingOwner.address || identity.address,
        notes: existingOwner.notes || identity.notes,
        assignedTo: existingOwner.assignedTo || identity.assignedTo,
        [profileKey]: {
          ...(existingOwner[profileKey] || {}),
          ...profileData,
        },
        convertedAsSeller: asSeller || existingOwner.convertedAsSeller || false,
        updatedAt: now,
        wasExisting: true,
      }
    : {
        SK: 'PROFILE',
        EntityType: 'OWNER',
        ownerId,
        ...identity,
        bankDetails: null,
        bankName: null,
        accountNumber: null,
        ifscCode: null,
        tags: [],
        [profileKey]: profileData,
        convertedAsSeller: asSeller,
        createdAt: now,
        updatedAt: now,
        wasExisting: false,
      };

  return {
    entityType: asSeller ? 'seller' : 'owner',
    storageType: 'OWNER',
    entityId: ownerId,
    idField: 'ownerId',
    item: merged,
    wasExisting: !!existingOwner,
  };
}

export function buildTenantEntity(lead, options, existingCustomer = null) {
  const kyc = buildKycFields(options.kycDetails);
  const now = new Date().toISOString();
  const customerId = existingCustomer?.customerId || uuidv4();
  const identity = baseIdentityFromLead(lead, options, kyc);
  const req = lead.tenantRequirement || {};

  const merged = existingCustomer
    ? {
        ...existingCustomer,
        ...identity,
        name: existingCustomer.name || identity.name,
        email: existingCustomer.email || identity.email,
        address: existingCustomer.address || identity.address,
        notes: existingCustomer.notes || identity.notes,
        assignedTo: existingCustomer.assignedTo || identity.assignedTo,
        tenantRequirement: {
          ...(existingCustomer.tenantRequirement || {}),
          ...req,
        },
        updatedAt: now,
        wasExisting: true,
      }
    : {
        SK: 'PROFILE',
        EntityType: 'CUSTOMER',
        customerId,
        ...identity,
        currentRental: null,
        rentalHistory: [],
        tags: [],
        tenantRequirement: req,
        createdAt: now,
        updatedAt: now,
        wasExisting: false,
      };

  return {
    entityType: 'tenant',
    storageType: 'CUSTOMER',
    entityId: customerId,
    idField: 'customerId',
    item: merged,
    wasExisting: !!existingCustomer,
  };
}

export function buildTargetEntity(lead, options, existingByPhone = null) {
  const role = lead.leadType;
  if (role === 'buyer') return buildBuyerEntity(lead, options, existingByPhone);
  if (role === 'seller') return buildOwnerEntity(lead, options, existingByPhone, { asSeller: true });
  if (role === 'tenant') return buildTenantEntity(lead, options, existingByPhone);
  if (role === 'owner') return buildOwnerEntity(lead, options, existingByPhone, { asSeller: false });
  const err = new Error(`Unknown lead type: ${role}`);
  err.code = 'VALIDATION_ERROR';
  throw err;
}

export function buildForSalePropertyItem(tenantId, lead, owner, options) {
  const sp = lead.sellerProperty || {};
  const propertyId = uuidv4();
  const propertyType = sp.propertyType || 'apartment';
  const area = sp.area || '';
  const city = sp.city || lead.city || 'Mumbai';
  const listedPrice = coerceOptionalNumber(sp.expectedPrice);
  const now = new Date().toISOString();

  return {
    propertyId,
    item: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
      EntityType: 'PROPERTY',
      tenantId,
      propertyId,
      ownerId: owner.ownerId,
      ownerName: owner.name,
      ownerPhone: owner.phone,
      ownerSnapshot: { name: owner.name, phone: owner.phone },
      convertedFromLeadId: lead.leadId,
      title: sp.title || `${propertyType} for Sale${area ? ` - ${area}` : ''}`,
      description: sp.description || lead.notes || '',
      propertyType,
      bhk: parsePropertyBhk(sp.bhk),
      buildingName: sp.buildingName || '',
      flatNumber: sp.flatNumber || '',
      floor: sp.floor || '',
      furnishing: sp.furnishing || 'unfurnished',
      carpetArea: coerceFiniteNumber(sp.carpetArea, 0),
      area,
      city,
      address: sp.address || lead.address || '',
      status: 'for-sale',
      listingStatus: 'active',
      saleInfo: {
        listedPrice,
        soldPrice: null,
        soldDate: null,
        soldToBuyerId: null,
      },
      // Preserve full seller property blob losslessly
      sourceSellerProperty: deepClone(sp),
      createdBy: options.convertedBy || SERVICE_ACCOUNT_USER,
      createdAt: now,
      updatedAt: now,
      GSI1PK: `TENANT#${tenantId}#OWNER#${owner.ownerId}`,
      GSI2PK: `TENANT#${tenantId}#PROPERTY_STATUS#for-sale`,
      GSI3PK: `TENANT#${tenantId}#SEARCH`,
      GSI3SK: `PROPERTY#${(sp.title || propertyType).toLowerCase()}#${area.toLowerCase()}`,
    },
  };
}

export function buildForRentPropertyItem(tenantId, lead, owner, options) {
  const op = lead.ownerProperty || {};
  if (!(op.propertyType || op.area || op.rentExpected)) return null;

  const propertyId = uuidv4();
  const propertyType = op.propertyType || 'apartment';
  const area = op.area || '';
  const city = op.city || lead.city || 'Mumbai';
  const expectedRent = coerceFiniteNumber(op.rentExpected, 0);
  const securityDeposit = coerceFiniteNumber(op.securityDeposit, 0);
  const now = new Date().toISOString();

  return {
    propertyId,
    item: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
      EntityType: 'PROPERTY',
      tenantId,
      propertyId,
      ownerId: owner.ownerId,
      ownerName: owner.name,
      ownerPhone: owner.phone,
      ownerSnapshot: { name: owner.name, phone: owner.phone },
      convertedFromLeadId: lead.leadId,
      title: op.title || `${propertyType} for Rent${area ? ` - ${area}` : ''}`,
      description: op.description || lead.notes || '',
      propertyType,
      bhk: parsePropertyBhk(op.bhk),
      buildingName: op.buildingName || '',
      flatNumber: op.flatNumber || '',
      floor: op.floor || '',
      furnishing: op.furnishing || 'unfurnished',
      carpetArea: coerceFiniteNumber(op.carpetArea, 0),
      area,
      city,
      address: op.address || lead.address || '',
      status: 'for-rent',
      listingStatus: 'active',
      rentAmount: expectedRent,
      depositAmount: securityDeposit,
      rentalInfo: {
        expectedRent,
        currentRent: null,
        currentTenantId: null,
        leaseStartDate: null,
        leaseEndDate: null,
        securityDeposit,
      },
      sourceOwnerProperty: deepClone(op),
      createdBy: options.convertedBy || SERVICE_ACCOUNT_USER,
      createdAt: now,
      updatedAt: now,
      GSI1PK: `TENANT#${tenantId}#OWNER#${owner.ownerId}`,
      GSI2PK: `TENANT#${tenantId}#PROPERTY_STATUS#for-rent`,
      GSI3PK: `TENANT#${tenantId}#SEARCH`,
      GSI3SK: `PROPERTY#${(op.title || propertyType).toLowerCase()}#${area.toLowerCase()}`,
    },
  };
}

export function buildConversionSnapshotItem(tenantId, {
  conversionSnapshotId,
  lead,
  notes,
  meetings,
  entityType,
  entityId,
  role,
  options,
  convertedAt,
}) {
  const sourceLeadSnapshot = buildSourceLeadSnapshot(lead, notes, meetings);
  return {
    PK: `TENANT#${tenantId}#LEAD_CONVERSION#${conversionSnapshotId}`,
    SK: 'SNAPSHOT',
    EntityType: LEAD_CONVERSION_ENTITY,
    tenantId,
    conversionSnapshotId,
    leadId: lead.leadId,
    leadType: lead.leadType,
    role,
    entityType,
    entityId,
    convertedAt,
    convertedBy: options.convertedBy || SERVICE_ACCOUNT_USER,
    convertedByUserId: options.convertedByUserId || null,
    sourceLeadSnapshot,
    // Secondary lookup keys
    GSI3PK: `TENANT#${tenantId}#SEARCH`,
    GSI3SK: `LEAD_CONVERSION#${lead.leadId}#${(lead.name || '').toLowerCase()}`,
    // Lead-id reverse lookup (scan/filter friendly)
    sourceLeadId: lead.leadId,
  };
}

/**
 * Estimate TransactWrite item count for preflight.
 * notes: put+delete each; meetings: update each; + snapshot + entity + lead delete
 * + optional property + optional property update + optional contact
 */
export function estimateTransactItemCount({
  noteCount = 0,
  meetingCount = 0,
  includeProperty = false,
  includePropertyUpdate = false,
  includeContact = false,
}) {
  let count = 1 /* snapshot */ + 1 /* entity */ + 1 /* lead delete */;
  count += noteCount * 2;
  count += meetingCount;
  if (includeProperty) count += 1;
  if (includePropertyUpdate) count += 1;
  if (includeContact) count += 1;
  return count;
}

export function assertTransactSizeOk(count) {
  if (count > DYNAMO_TRANSACT_MAX_ITEMS) {
    const err = new Error(
      `Conversion requires ${count} DynamoDB actions which exceeds the ${DYNAMO_TRANSACT_MAX_ITEMS} transaction limit. Reduce notes/meetings or split the conversion.`,
    );
    err.code = 'CONVERSION_TOO_LARGE';
    throw err;
  }
}

/**
 * Build note items for migration (Put on target + Delete on lead).
 */
export function buildNoteMigrationActions(tenantId, leadId, notes, target) {
  const actions = [];
  for (const note of notes) {
    const noteId = note.noteId || note.SK?.replace(/^NOTE#/, '') || null;
    if (!noteId || noteId === 'PROFILE_NOTES') continue;
    let pk;
    if (target.storageType === 'BUYER') {
      pk = `TENANT#${tenantId}#BUYER#${target.entityId}`;
    } else if (target.storageType === 'OWNER') {
      pk = `TENANT#${tenantId}#OWNER#${target.entityId}`;
    } else if (target.storageType === 'CUSTOMER') {
      pk = `TENANT#${tenantId}#CUSTOMER#${target.entityId}`;
    } else {
      continue;
    }

    actions.push({
      Put: {
        Item: {
          PK: pk,
          SK: `NOTE#${noteId}`,
          EntityType: 'NOTE',
          tenantId,
          noteId,
          [target.idField]: target.entityId,
          content: note.content,
          createdBy: note.createdBy || SERVICE_ACCOUNT_USER,
          createdAt: note.createdAt || new Date().toISOString(),
          migratedFromLeadId: leadId,
          migratedFromNoteId: note.noteId || null,
        },
      },
    });
    actions.push({
      Delete: {
        Key: {
          PK: `TENANT#${tenantId}#LEAD#${leadId}`,
          SK: `NOTE#${noteId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
      },
    });
  }
  return actions;
}

export function buildMeetingRelinkUpdates(tenantId, meetings, entityType, entityId, entityName, entityPhone) {
  return meetings.map((meeting) => ({
    Update: {
      Key: {
        PK: `TENANT#${tenantId}#MEETING#${meeting.meetingId}`,
        SK: 'PROFILE',
      },
      UpdateExpression:
        'SET relatedEntityType = :ret, relatedEntityId = :reid, relatedEntityName = :ren, relatedEntityPhone = :rep, updatedAt = :ua',
      ExpressionAttributeValues: {
        ':ret': entityType,
        ':reid': entityId,
        ':ren': entityName || null,
        ':rep': entityPhone || null,
        ':ua': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(PK)',
    },
  }));
}

/**
 * Build ConvertLeadResult shape returned by the API.
 */
export function buildConvertLeadResult({
  entity,
  entityType,
  conversionSnapshotId,
  convertedAt,
  leadId,
  role,
  contactId = null,
  contact = null,
}) {
  return {
    entity,
    entityType,
    conversionSnapshotId,
    convertedAt,
    leadId,
    role,
    contactId,
    contact,
    // lead is intentionally omitted — active lead is deleted after conversion
    lead: null,
  };
}
