/**
 * Listing service — marketing state separate from Property ownership.
 *
 * Property = asset + currentOwnerContactId
 * Listing = how the asset is offered (sale / rent)
 *
 * Property.status / listingStatus stay in sync for backward-compatible UI filters.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  docClient,
  CRM_TABLE_NAME,
  getProperty,
  getContact,
  updateContact,
  findContactByPhone,
  createOrUpdateContactByPhone,
  getOwner,
} from '../crmDynamodbService.js';
import { SERVICE_ACCOUNT_USER } from '../utils/serviceAccount.js';
import {
  LISTING_STATUS,
  LISTING_TYPES,
  PROPERTY_STATUS,
  SELLER_LIFECYCLE,
  listingPk,
  buildSellerProfile,
  buildOwnerProfile,
  resolveCurrentOwnerContactId,
} from '../domain/crmDomainModel.js';

export function buildListingItem(tenantId, data = {}) {
  const listingId = data.listingId || uuidv4();
  const now = data.createdAt || new Date().toISOString();
  const listingType = LISTING_TYPES.includes(data.listingType) ? data.listingType : 'sale';
  const status = data.status || LISTING_STATUS.ACTIVE;

  return {
    PK: listingPk(tenantId, listingId),
    SK: 'PROFILE',
    EntityType: 'LISTING',
    tenantId,
    listingId,
    propertyId: data.propertyId,
    listingType,
    status,
    listedPrice: data.listedPrice != null ? Number(data.listedPrice) : null,
    expectedRent: data.expectedRent != null ? Number(data.expectedRent) : null,
    securityDeposit: data.securityDeposit != null ? Number(data.securityDeposit) : null,
    listedByContactId: data.listedByContactId || null,
    listedByOwnerId: data.listedByOwnerId || null,
    title: data.title || null,
    notes: data.notes || null,
    source: data.source || 'manual',
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt: now,
    updatedAt: now,
    closedAt: data.closedAt || null,
    // GSI2 — list by status
    GSI2PK: `TENANT#${tenantId}#LISTING_STATUS#${status}`,
    GSI2SK: `LISTING#${listingType}#${listingId}`,
    // GSI3 — search / property lookup
    GSI3PK: `TENANT#${tenantId}#SEARCH`,
    GSI3SK: `LISTING#${data.propertyId}#${listingId}`,
  };
}

async function resolveListingContact(tenantId, property) {
  const contactId = resolveCurrentOwnerContactId(property);
  if (contactId) {
    const contact = await getContact(tenantId, contactId);
    if (contact) return contact;
  }
  if (property?.ownerId) {
    const owner = await getOwner(tenantId, property.ownerId);
    if (owner?.contactId) {
      const linked = await getContact(tenantId, owner.contactId);
      if (linked) return linked;
    }
    if (owner?.phone) {
      const existing = await findContactByPhone(tenantId, owner.phone);
      if (existing) return existing;
      return createOrUpdateContactByPhone(tenantId, {
        name: owner.name,
        phone: owner.phone,
        email: owner.email || null,
        address: owner.address || '',
        roles: { owner: true, seller: true, buyer: false, tenant: false },
        ownerProfile: buildOwnerProfile({
          lifecycleStatus: 'active',
          ownedPropertyIds: property.propertyId ? [property.propertyId] : [],
          originalOwnerId: owner.ownerId,
        }),
        sellerProfile: buildSellerProfile({ lifecycleStatus: SELLER_LIFECYCLE.ACTIVE }),
        linkedOwnerId: owner.ownerId,
        source: 'listing',
      });
    }
  }
  return null;
}

async function syncSellerActiveListings(tenantId, contact, listingId, { add = true } = {}) {
  if (!contact?.contactId || !listingId) return;
  const ids = Array.isArray(contact.sellerProfile?.activeListingIds)
    ? [...contact.sellerProfile.activeListingIds]
    : [];
  let nextIds = ids;
  if (add && !ids.includes(listingId)) nextIds = [...ids, listingId];
  if (!add) nextIds = ids.filter((id) => id !== listingId);

  const stillSelling = nextIds.length > 0;
  const ownedIds = Array.isArray(contact.ownerProfile?.ownedPropertyIds)
    ? contact.ownerProfile.ownedPropertyIds
    : [];

  const sellerProfile = buildSellerProfile({
    ...(contact.sellerProfile || {}),
    lifecycleStatus: stillSelling
      ? SELLER_LIFECYCLE.ACTIVE
      : SELLER_LIFECYCLE.PAST,
    activeListingIds: nextIds,
  });

  const ownerProfile = buildOwnerProfile({
    ...(contact.ownerProfile || {}),
    lifecycleStatus: add || ownedIds.length > 0
      ? 'active'
      : (contact.ownerProfile?.lifecycleStatus || 'passive'),
    ownedPropertyIds: ownedIds,
  });

  await updateContact(tenantId, contact.contactId, {
    roles: {
      ...(contact.roles || {}),
      seller: stillSelling,
      owner: add || ownedIds.length > 0,
    },
    sellerProfile,
    ownerProfile,
  });

  // Activate legacy OWNER shell when they start listing
  if (add && contact.linkedOwnerId) {
    try {
      const { updateOwner } = await import('../crmDynamodbService.js');
      await updateOwner(tenantId, contact.linkedOwnerId, { status: 'active' });
    } catch (err) {
      console.error('listingService.activateOwner.error', err.message);
    }
  }
}

async function activateOwnerOnListing(tenantId, contact) {
  if (!contact?.contactId) return;
  const ownerProfile = buildOwnerProfile({
    ...(contact.ownerProfile || {}),
    lifecycleStatus: 'active',
    ownedPropertyIds: contact.ownerProfile?.ownedPropertyIds || [],
  });
  await updateContact(tenantId, contact.contactId, {
    roles: {
      ...(contact.roles || {}),
      owner: true,
    },
    ownerProfile,
  });
  if (contact.linkedOwnerId) {
    try {
      const { updateOwner } = await import('../crmDynamodbService.js');
      await updateOwner(tenantId, contact.linkedOwnerId, { status: 'active' });
    } catch (err) {
      console.error('listingService.activateOwner.error', err.message);
    }
  }
}

/**
 * Create a sale or rent listing and sync Property marketing fields.
 */
export async function createListing(tenantId, options = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const {
    propertyId,
    listingType = 'sale',
    listedPrice = null,
    expectedRent = null,
    securityDeposit = 0,
    notes = null,
    source = 'manual',
    performedBy = SERVICE_ACCOUNT_USER,
    skipPropertySync = false,
  } = options;

  if (!propertyId) throw new Error('Property ID is required');
  if (!LISTING_TYPES.includes(listingType)) {
    throw new Error(`Invalid listingType: ${listingType}`);
  }

  const property = await getProperty(tenantId, propertyId);
  if (!property) throw new Error('Property not found');

  // Withdraw any existing active listings for this property
  const existing = await getActiveListingsForProperty(tenantId, propertyId);
  for (const listing of existing) {
    await withdrawListing(tenantId, listing.listingId, {
      reason: 'replaced',
      performedBy,
      skipPropertySync: true,
    });
  }

  const contact = await resolveListingContact(tenantId, property);
  const listing = buildListingItem(tenantId, {
    propertyId,
    listingType,
    listedPrice: listingType === 'sale'
      ? (listedPrice ?? property.saleInfo?.listedPrice ?? null)
      : null,
    expectedRent: listingType === 'rent'
      ? (expectedRent ?? property.rentalInfo?.expectedRent ?? null)
      : null,
    securityDeposit: listingType === 'rent' ? securityDeposit : null,
    listedByContactId: contact?.contactId || null,
    listedByOwnerId: property.ownerId || contact?.linkedOwnerId || null,
    title: property.title || null,
    notes,
    source,
    createdBy: performedBy,
    status: LISTING_STATUS.ACTIVE,
  });

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: listing,
  }));

  if (!skipPropertySync) {
    const now = new Date().toISOString();
    if (listingType === 'sale') {
      await docClient.send(new UpdateCommand({
        TableName: CRM_TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: [
          'SET #status = :status',
          'listingStatus = :listingStatus',
          'activeListingId = :activeListingId',
          'saleInfo = :saleInfo',
          'updatedAt = :updatedAt',
          'GSI2PK = :gsi2pk',
        ].join(', '),
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': PROPERTY_STATUS.FOR_SALE,
          ':listingStatus': 'active',
          ':activeListingId': listing.listingId,
          ':saleInfo': {
            ...(property.saleInfo || {}),
            listedPrice: listing.listedPrice || 0,
            soldPrice: null,
            soldDate: null,
            soldToBuyerId: null,
          },
          ':updatedAt': now,
          ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#for-sale`,
        },
      }));
    } else {
      await docClient.send(new UpdateCommand({
        TableName: CRM_TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: [
          'SET #status = :status',
          'listingStatus = :listingStatus',
          'activeListingId = :activeListingId',
          'rentalInfo.expectedRent = :expectedRent',
          'rentalInfo.securityDeposit = :securityDeposit',
          'updatedAt = :updatedAt',
          'GSI2PK = :gsi2pk',
        ].join(', '),
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': PROPERTY_STATUS.FOR_RENT,
          ':listingStatus': 'active',
          ':activeListingId': listing.listingId,
          ':expectedRent': listing.expectedRent || 0,
          ':securityDeposit': listing.securityDeposit || 0,
          ':updatedAt': now,
          ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#for-rent`,
        },
      }));
    }
  } else {
    // Conversion path already set property status — attach listing pointer only
    await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET activeListingId = :activeListingId, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':activeListingId': listing.listingId,
        ':updatedAt': new Date().toISOString(),
      },
    }));
  }

  if (listingType === 'sale' && contact) {
    await syncSellerActiveListings(tenantId, contact, listing.listingId, { add: true });
  } else if (listingType === 'rent' && contact) {
    await activateOwnerOnListing(tenantId, contact);
  }

  // Contact activity: property listed for sale/rent
  if (contact?.contactId) {
    try {
      const { logContactActivity } = await import('../crmDynamodbService.js');
      await logContactActivity(tenantId, {
        activityType: 'property_listed',
        subjectEntityType: 'contact',
        subjectEntityId: contact.contactId,
        subjectEntityName: contact.name || null,
        title: `Property Listed for ${listingType === 'sale' ? 'Sale' : 'Rent'}: ${property.title || 'Property'}`,
        description: listingType === 'sale'
          ? `Listed for sale${listedPrice != null ? ` at INR ${Number(listedPrice).toLocaleString()}` : ''}.`
          : `Listed for rent${expectedRent != null ? ` at INR ${Number(expectedRent).toLocaleString()}/mo` : ''}.`,
        performedBy,
        payload: {
          propertyId,
          listingId: listing.listingId,
          listingType,
          listedPrice,
          expectedRent,
        },
      });
    } catch (err) {
      console.error('listingService.activity.error', err.message);
    }
  }

  return listing;
}

export async function getListing(tenantId, listingId) {
  if (!tenantId || !listingId) return null;
  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: listingPk(tenantId, listingId),
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

export async function getListings(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');

  let items = [];
  if (filters.status) {
    const result = await docClient.send(new QueryCommand({
      TableName: CRM_TABLE_NAME,
      IndexName: 'status-index',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}#LISTING_STATUS#${filters.status}`,
      },
    }));
    items = result.Items || [];
  } else {
    const result = await docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
      ExpressionAttributeValues: {
        ':type': 'LISTING',
        ':tenantId': tenantId,
      },
    }));
    items = result.Items || [];
  }

  if (filters.listingType) {
    items = items.filter((l) => l.listingType === filters.listingType);
  }
  if (filters.propertyId) {
    items = items.filter((l) => l.propertyId === filters.propertyId);
  }
  if (filters.listedByContactId) {
    items = items.filter((l) => l.listedByContactId === filters.listedByContactId);
  }

  items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return items;
}

export async function getActiveListingsForProperty(tenantId, propertyId) {
  const listings = await getListings(tenantId, { propertyId, status: LISTING_STATUS.ACTIVE });
  // Fallback scan if status-index miss (e.g. older env without GSI populate)
  if (listings.length === 0) {
    const all = await getListings(tenantId, { propertyId });
    return all.filter((l) => l.status === LISTING_STATUS.ACTIVE);
  }
  return listings;
}

export async function withdrawListing(tenantId, listingId, options = {}) {
  if (!tenantId || !listingId) throw new Error('Tenant ID and Listing ID are required');
  const {
    reason = 'withdrawn',
    performedBy = SERVICE_ACCOUNT_USER,
    skipPropertySync = false,
  } = options;

  const listing = await getListing(tenantId, listingId);
  if (!listing) throw new Error('Listing not found');
  if (listing.status !== LISTING_STATUS.ACTIVE) {
    return listing;
  }

  const now = new Date().toISOString();
  const nextStatus = reason === 'sold'
    ? LISTING_STATUS.SOLD
    : reason === 'rented'
      ? LISTING_STATUS.RENTED
      : reason === 'replaced'
        ? LISTING_STATUS.WITHDRAWN
        : LISTING_STATUS.WITHDRAWN;

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: listingPk(tenantId, listingId),
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, closedAt = :closedAt, updatedAt = :updatedAt, closeReason = :reason, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': nextStatus,
      ':closedAt': now,
      ':updatedAt': now,
      ':reason': reason,
      ':gsi2pk': `TENANT#${tenantId}#LISTING_STATUS#${nextStatus}`,
    },
  }));

  if (listing.listedByContactId) {
    const contact = await getContact(tenantId, listing.listedByContactId);
    if (contact) {
      await syncSellerActiveListings(tenantId, contact, listingId, { add: false });
    }
  }

  if (!skipPropertySync && listing.propertyId) {
    const property = await getProperty(tenantId, listing.propertyId);
    if (property && property.activeListingId === listingId) {
      await docClient.send(new UpdateCommand({
        TableName: CRM_TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}#PROPERTY#${listing.propertyId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: [
          'SET listingStatus = :listingStatus',
          'activeListingId = :null',
          '#status = :status',
          'updatedAt = :updatedAt',
          'GSI2PK = :gsi2pk',
        ].join(', '),
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':listingStatus': 'inactive',
          ':null': null,
          ':status': PROPERTY_STATUS.NOT_LISTED,
          ':updatedAt': now,
          ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#${PROPERTY_STATUS.NOT_LISTED}`,
        },
      }));
    }
  }

  return { ...listing, status: nextStatus, closedAt: now, updatedBy: performedBy };
}

/**
 * Close active sale listings when ownership transfers.
 */
export async function closeActiveSaleListingsForProperty(tenantId, propertyId, { saleTransactionId = null } = {}) {
  const active = await getActiveListingsForProperty(tenantId, propertyId);
  const closed = [];
  for (const listing of active) {
    if (listing.listingType !== 'sale') continue;
    const result = await withdrawListing(tenantId, listing.listingId, {
      reason: 'sold',
      skipPropertySync: true,
    });
    if (saleTransactionId) {
      await docClient.send(new UpdateCommand({
        TableName: CRM_TABLE_NAME,
        Key: {
          PK: listingPk(tenantId, listing.listingId),
          SK: 'PROFILE',
        },
        UpdateExpression: 'SET saleTransactionId = :saleTransactionId',
        ExpressionAttributeValues: { ':saleTransactionId': saleTransactionId },
      }));
    }
    closed.push(result);
  }
  return closed;
}

/**
 * Heal stale seller Contacts (e.g. sold everything but roles.seller still true
 * because activeListingIds retained closed listing / property IDs).
 * Returns the possibly-updated contact.
 */
export async function reconcileSellerContact(tenantId, contact) {
  if (!contact?.contactId || !contact.roles?.seller) return contact;

  const claimedIds = Array.isArray(contact.sellerProfile?.activeListingIds)
    ? contact.sellerProfile.activeListingIds
    : [];
  const ownedIds = Array.isArray(contact.ownerProfile?.ownedPropertyIds)
    ? contact.ownerProfile.ownedPropertyIds
    : [];

  // Keep only listing IDs that still exist and are ACTIVE sale listings
  const liveListingIds = [];
  for (const id of claimedIds) {
    const listing = await getListing(tenantId, id).catch(() => null);
    if (listing && listing.status === LISTING_STATUS.ACTIVE && listing.listingType === 'sale') {
      liveListingIds.push(id);
    }
  }

  const stillSelling = liveListingIds.length > 0;
  const stillOwning = ownedIds.length > 0;
  const alreadyClean =
    stillSelling === Boolean(contact.roles?.seller)
    && liveListingIds.length === claimedIds.length
    && (contact.sellerProfile?.lifecycleStatus === (stillSelling ? SELLER_LIFECYCLE.ACTIVE : SELLER_LIFECYCLE.PAST));

  if (alreadyClean && stillSelling) return contact;
  if (stillSelling && liveListingIds.length === claimedIds.length) return contact;

  // Nothing left to sell → demote seller (and owner if no portfolio)
  if (!stillSelling) {
    const updated = await updateContact(tenantId, contact.contactId, {
      roles: {
        ...(contact.roles || {}),
        seller: false,
        owner: stillOwning,
      },
      sellerProfile: buildSellerProfile({
        ...(contact.sellerProfile || {}),
        lifecycleStatus: SELLER_LIFECYCLE.PAST,
        activeListingIds: [],
      }),
      ownerProfile: buildOwnerProfile({
        ...(contact.ownerProfile || {}),
        ownedPropertyIds: ownedIds,
        lifecycleStatus: stillOwning ? 'active' : 'passive',
      }),
    });
    if (!stillOwning && contact.linkedOwnerId) {
      try {
        const { updateOwner } = await import('../crmDynamodbService.js');
        await updateOwner(tenantId, contact.linkedOwnerId, { status: 'inactive' });
      } catch {
        /* best-effort */
      }
    }
    return updated || { ...contact, roles: { ...contact.roles, seller: false, owner: stillOwning } };
  }

  // Still selling but IDs were stale — rewrite live set
  const updated = await updateContact(tenantId, contact.contactId, {
    sellerProfile: buildSellerProfile({
      ...(contact.sellerProfile || {}),
      lifecycleStatus: SELLER_LIFECYCLE.ACTIVE,
      activeListingIds: liveListingIds,
    }),
  });
  return updated || contact;
}

export async function closeActiveRentListingsForProperty(tenantId, propertyId) {
  const active = await getActiveListingsForProperty(tenantId, propertyId);
  const closed = [];
  for (const listing of active) {
    if (listing.listingType !== 'rent') continue;
    const result = await withdrawListing(tenantId, listing.listingId, {
      reason: 'rented',
      skipPropertySync: true,
    });
    closed.push(result);
  }
  return closed;
}

export default {
  buildListingItem,
  createListing,
  getListing,
  getListings,
  getActiveListingsForProperty,
  withdrawListing,
  closeActiveSaleListingsForProperty,
  closeActiveRentListingsForProperty,
  reconcileSellerContact,
};
