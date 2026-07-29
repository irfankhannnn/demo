/**
 * transferOwnership — single atomic sale / ownership-transfer service.
 *
 * Every sale path (mark-sold, lead conversion purchase, manual transfer)
 * must call this so Property.currentOwnerContactId always reflects reality.
 */

import { v4 as uuidv4 } from 'uuid';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  SALE_VIA,
  SELLER_LIFECYCLE,
  OWNER_LIFECYCLE,
  BUYER_STATUS,
  PROPERTY_STATUS,
  saleTransactionPk,
  propertyOwnerGsi1Pk,
  propertyOwnerLegacyGsi1Pk,
  resolveCurrentOwnerContactId,
  buildSellerProfile,
  buildOwnerProfile,
  buildBuyerProfile,
  buildOwnershipTransferEntry,
  buildClearedMarketingPricesPatch,
} from '../domain/crmDomainModel.js';
import {
  docClient,
  CRM_TABLE_NAME,
  getProperty,
  getBuyer,
  getOwner,
  getContact,
  findContactByPhone,
  createOrUpdateContactByPhone,
  createOrUpdateOwnerByPhone,
  updateContact,
  updateContactRole,
  logContactActivity,
} from '../crmDynamodbService.js';
import { SERVICE_ACCOUNT_USER } from '../utils/serviceAccount.js';

function amountLabel(price) {
  if (price == null || Number.isNaN(Number(price))) return null;
  return `₹${Number(price).toLocaleString('en-IN')}`;
}

/**
 * Resolve a Contact for the seller (previous owner) of a property.
 */
async function resolveSellerContact(tenantId, property) {
  const existingContactId = resolveCurrentOwnerContactId(property);
  if (existingContactId) {
    const contact = await getContact(tenantId, existingContactId);
    if (contact) return contact;
  }

  if (property.ownerId) {
    const owner = await getOwner(tenantId, property.ownerId);
    if (owner?.phone) {
      const byPhone = await findContactByPhone(tenantId, owner.phone);
      if (byPhone) return byPhone;

      // Create minimal seller/owner contact from legacy owner
      return createOrUpdateContactByPhone(tenantId, {
        name: owner.name,
        phone: owner.phone,
        email: owner.email || null,
        address: owner.address || '',
        roles: { owner: true, seller: true, buyer: false, tenant: false },
        ownerProfile: buildOwnerProfile({
          lifecycleStatus: OWNER_LIFECYCLE.ACTIVE,
          ownedPropertyIds: property.propertyId ? [property.propertyId] : [],
          originalOwnerId: owner.ownerId,
          migratedFrom: 'OWNER',
        }),
        sellerProfile: buildSellerProfile({ lifecycleStatus: SELLER_LIFECYCLE.ACTIVE }),
        linkedOwnerId: owner.ownerId,
        source: 'ownership-transfer',
      });
    }
  }

  return null;
}

/**
 * Resolve / ensure a Contact for the buyer (new owner on direct sale).
 */
async function resolveBuyerContact(tenantId, buyerId) {
  if (!buyerId) return null;

  const buyer = await getBuyer(tenantId, buyerId);
  if (!buyer) throw new Error('Buyer not found');

  // Already a CONTACT-as-buyer
  if (buyer.isFromContact && buyer.contactId) {
    const contact = await getContact(tenantId, buyer.contactId);
    if (contact) return contact;
  }

  // Buyer ID is actually a contactId
  if (buyer.contactId) {
    const contact = await getContact(tenantId, buyer.contactId);
    if (contact) return contact;
  }

  const contactById = await getContact(tenantId, buyerId);
  if (contactById) return contactById;

  if (!buyer.phone) {
    throw new Error('Buyer phone is required to establish ownership contact');
  }

  return createOrUpdateContactByPhone(tenantId, {
    name: buyer.name,
    phone: buyer.phone,
    email: buyer.email || null,
    address: buyer.address || '',
    roles: { buyer: true, owner: true, seller: false, tenant: false },
    buyerProfile: buildBuyerProfile({
      budget: buyer.budget,
      preferredArea: buyer.preferredArea,
      propertyType: buyer.propertyType,
      bhk: buyer.bhk,
      requirement: buyer.requirement,
    }),
    ownerProfile: buildOwnerProfile({ lifecycleStatus: OWNER_LIFECYCLE.ACTIVE }),
    source: 'ownership-transfer',
  });
}

/**
 * Persist a SaleTransaction record.
 */
async function putSaleTransaction(tenantId, sale) {
  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: {
      PK: saleTransactionPk(tenantId, sale.saleTransactionId),
      SK: 'PROFILE',
      EntityType: 'SALE_TRANSACTION',
      tenantId,
      ...sale,
      GSI3PK: `TENANT#${tenantId}#SEARCH`,
      GSI3SK: `SALE#${sale.propertyId}#${sale.soldAt}`,
    },
  }));
  return sale;
}

/**
 * Append purchase to buyer (legacy BUYER entity or CONTACT purchaseHistory).
 */
async function appendBuyerPurchase(tenantId, buyerId, buyerContact, purchase) {
  if (buyerContact?.contactId) {
    const history = Array.isArray(buyerContact.purchaseHistory)
      ? [...buyerContact.purchaseHistory]
      : [];
    history.push(purchase);
    await updateContact(tenantId, buyerContact.contactId, {
      purchaseHistory: history,
      roles: {
        ...(buyerContact.roles || {}),
        buyer: true,
        owner: true,
      },
    });
    return;
  }

  if (!buyerId) return;

  // Legacy BUYER purchases array via UpdateCommand
  const buyer = await getBuyer(tenantId, buyerId);
  if (!buyer || buyer.isFromContact) return;

  const purchases = [...(buyer.purchases || []), purchase];
  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET purchases = :purchases, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':purchases': purchases,
      ':updatedAt': new Date().toISOString(),
    },
  }));
}

/**
 * Update seller Contact profile after a sale.
 */
async function updateSellerAfterSale(tenantId, sellerContact, propertyId) {
  if (!sellerContact?.contactId) return;

  const existingSeller = sellerContact.sellerProfile || {};
  const soldIds = Array.isArray(existingSeller.soldPropertyIds)
    ? [...existingSeller.soldPropertyIds]
    : [];
  if (propertyId && !soldIds.includes(propertyId)) soldIds.push(propertyId);

  // Drop propertyId and any listingIds that belong to this property
  // (convertLead historically stored propertyId in activeListingIds)
  const listingIdsForProperty = new Set();
  if (propertyId) {
    try {
      const { getListings } = await import('./listingService.js');
      const related = await getListings(tenantId, { propertyId });
      for (const listing of related || []) {
        if (listing?.listingId) listingIdsForProperty.add(listing.listingId);
      }
    } catch (err) {
      console.error('transferOwnership.sellerListingsLookup.error', err.message);
    }
  }

  let activeListingIds = Array.isArray(existingSeller.activeListingIds)
    ? existingSeller.activeListingIds.filter(
      (id) => id !== propertyId && !listingIdsForProperty.has(id),
    )
    : [];

  const existingOwner = sellerContact.ownerProfile || {};
  const ownedIds = Array.isArray(existingOwner.ownedPropertyIds)
    ? existingOwner.ownedPropertyIds.filter((id) => id !== propertyId)
    : [];

  // Still an active seller only if they have remaining live listings
  const stillSelling = activeListingIds.length > 0;
  // Still an owner only if they still hold other properties
  const stillOwning = ownedIds.length > 0;

  if (!stillSelling) {
    activeListingIds = [];
  }

  const sellerProfile = buildSellerProfile({
    ...existingSeller,
    lifecycleStatus: stillSelling
      ? SELLER_LIFECYCLE.ACTIVE
      : SELLER_LIFECYCLE.PAST,
    soldPropertyIds: soldIds,
    activeListingIds,
  });

  const ownerProfile = buildOwnerProfile({
    ...existingOwner,
    ownedPropertyIds: ownedIds,
    lifecycleStatus: stillOwning
      ? OWNER_LIFECYCLE.ACTIVE
      : OWNER_LIFECYCLE.PASSIVE,
  });

  await updateContact(tenantId, sellerContact.contactId, {
    roles: {
      ...(sellerContact.roles || {}),
      // Nothing left to sell/own → Contact-only (history preserved on Contact)
      seller: stillSelling,
      owner: stillOwning,
    },
    sellerProfile,
    ownerProfile,
  });

  // Deactivate legacy OWNER shell when they no longer own anything
  const linkedOwnerId = sellerContact.linkedOwnerId;
  if (linkedOwnerId && !stillOwning) {
    try {
      const { updateOwner } = await import('../crmDynamodbService.js');
      await updateOwner(tenantId, linkedOwnerId, { status: 'inactive' });
    } catch (err) {
      console.error('transferOwnership.deactivateSellerOwner.error', err.message);
    }
  }
}

/**
 * Ensure buyer has a legacy OWNER row (for Owners UI) linked from Contact, with KYC copied.
 */
async function ensureBuyerOwnerEntity(tenantId, buyerContact) {
  if (!buyerContact?.contactId || !buyerContact.phone) return null;

  if (buyerContact.linkedOwnerId) {
    const existing = await getOwner(tenantId, buyerContact.linkedOwnerId);
    if (existing) {
      const { updateOwner } = await import('../crmDynamodbService.js');
      const patch = { status: 'inactive' };
      if (buyerContact.panNumber && !existing.panNumber) patch.panNumber = buyerContact.panNumber;
      if (buyerContact.aadharNumber && !existing.aadharNumber) patch.aadharNumber = buyerContact.aadharNumber;
      await updateOwner(tenantId, existing.ownerId, patch);
      return { ...existing, ...patch };
    }
  }

  const owner = await createOrUpdateOwnerByPhone(tenantId, {
    name: buyerContact.name,
    phone: buyerContact.phone,
    email: buyerContact.email || null,
    address: buyerContact.address || '',
    panNumber: buyerContact.panNumber || null,
    aadharNumber: buyerContact.aadharNumber || null,
    // BRD: buyer owns property but is passive until they explicitly list
    status: 'inactive',
    source: 'ownership-transfer',
  });

  if (owner?.ownerId && buyerContact.linkedOwnerId !== owner.ownerId) {
    await updateContact(tenantId, buyerContact.contactId, {
      linkedOwnerId: owner.ownerId,
    });
  }

  return owner;
}

/**
 * Update buyer Contact as new owner after purchase.
 * BUYER → purchased (stays in Buyers module). OWNER shell → active (stays in Owners).
 */
async function updateBuyerAsOwner(tenantId, buyerContact, propertyId, buyerEntityId = null) {
  if (!buyerContact?.contactId) return;

  const existingOwner = buyerContact.ownerProfile || {};
  const ownedIds = Array.isArray(existingOwner.ownedPropertyIds)
    ? [...existingOwner.ownedPropertyIds]
    : [];
  if (propertyId && !ownedIds.includes(propertyId)) ownedIds.push(propertyId);

  const existingBuyer = buyerContact.buyerProfile || buildBuyerProfile();

  await updateContact(tenantId, buyerContact.contactId, {
    status: 'active',
    roles: {
      ...(buyerContact.roles || {}),
      buyer: true,
      owner: true,
    },
    ownerProfile: buildOwnerProfile({
      ...existingOwner,
      lifecycleStatus: OWNER_LIFECYCLE.INACTIVE,
      ownedPropertyIds: ownedIds,
    }),
    buyerProfile: {
      ...existingBuyer,
      purchaseStatus: BUYER_STATUS.PURCHASED,
    },
  });

  // BUYER module: purchased (not inactive — agency retains relationship)
  try {
    const { updateBuyer, findBuyerByPhone } = await import('../crmDynamodbService.js');
    let resolvedBuyerId = buyerEntityId || null;
    if (!resolvedBuyerId && buyerContact.phone) {
      const byPhone = await findBuyerByPhone(tenantId, buyerContact.phone).catch(() => null);
      resolvedBuyerId = byPhone?.buyerId || null;
    }
    if (resolvedBuyerId) {
      await updateBuyer(tenantId, resolvedBuyerId, { status: BUYER_STATUS.PURCHASED });
    }
  } catch (err) {
    console.error('transferOwnership.markBuyerPurchased.error', err.message);
  }

  // OWNER shell: active — currently owns property
  const ownerShellId = buyerContact.linkedOwnerId;
  if (ownerShellId) {
    try {
      const { updateOwner } = await import('../crmDynamodbService.js');
      await updateOwner(tenantId, ownerShellId, { status: 'inactive' });
    } catch (err) {
      console.error('transferOwnership.deactivateBuyerOwner.error', err.message);
    }
  }
}

/**
 * Transfer ownership of a property.
 *
 * @param {string} tenantId
 * @param {object} options
 * @param {string} options.propertyId
 * @param {number} options.soldPrice
 * @param {string|null} [options.buyerId] - Buyer entity id or Contact id
 * @param {'direct'|'third_party'} [options.saleType]
 * @param {string|null} [options.reasonLost]
 * @param {string|null} [options.notes]
 * @param {number|null} [options.brokerageAmount]
 * @param {number|null} [options.brokerageLost]
 * @param {string} [options.source] - mark_sold | lead_conversion | manual | import
 * @param {string} [options.performedBy]
 * @param {boolean} [options.skipPropertyUpdate] - property already sold (e.g. convertLead txn)
 * @param {boolean} [options.skipBuyerPurchase] - buyer purchase already recorded
 * @returns {Promise<{ property, saleTransaction, sellerContact, buyerContact }>}
 */
export async function transferOwnership(tenantId, options = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');

  const {
    propertyId,
    soldPrice,
    buyerId = null,
    saleType = SALE_VIA.DIRECT,
    reasonLost = null,
    notes = null,
    brokerageAmount = null,
    brokerageLost = null,
    source = 'mark_sold',
    performedBy = SERVICE_ACCOUNT_USER,
    skipPropertyUpdate = false,
    skipBuyerPurchase = false,
  } = options;

  if (!propertyId) throw new Error('Property ID is required');
  if (soldPrice === undefined || soldPrice === null || soldPrice === '') {
    throw new Error('Sold price is required');
  }

  const type = saleType === SALE_VIA.THIRD_PARTY ? SALE_VIA.THIRD_PARTY : SALE_VIA.DIRECT;
  if (type === SALE_VIA.DIRECT && !buyerId) {
    throw new Error('Buyer ID is required for a direct sale');
  }

  const property = await getProperty(tenantId, propertyId);
  if (!property) throw new Error('Property not found');

  const now = new Date().toISOString();
  const saleTransactionId = uuidv4();
  const price = Number(soldPrice) || 0;

  // Resolve parties
  const sellerContact = await resolveSellerContact(tenantId, property);
  const previousOwner = property.ownerId
    ? await getOwner(tenantId, property.ownerId).catch(() => null)
    : null;

  let buyerContact = null;
  let finalBuyerId = null;
  let buyerNameForHistory = null;
  let buyerOwnerEntity = null;

  if (type === SALE_VIA.DIRECT) {
    buyerContact = await resolveBuyerContact(tenantId, buyerId);
    finalBuyerId = buyerContact?.contactId || buyerId;
    buyerNameForHistory = buyerContact?.name || null;
    if (buyerContact) {
      buyerOwnerEntity = await ensureBuyerOwnerEntity(tenantId, buyerContact);
    }
  }

  const fromContactId = sellerContact?.contactId || null;
  const toContactId = type === SALE_VIA.DIRECT ? (buyerContact?.contactId || null) : null;
  const buyerOwnerId = buyerOwnerEntity?.ownerId || buyerContact?.linkedOwnerId || null;

  const historyEntry = buildOwnershipTransferEntry({
    fromContactId,
    toContactId,
    fromOwnerId: property.ownerId || null,
    // Direct sale: set toOwnerId to buyer's linked OWNER when available
    toOwnerId: type === SALE_VIA.DIRECT ? buyerOwnerId : null,
    fromOwnerName: sellerContact?.name || previousOwner?.name || property.ownerName || 'Unassigned',
    toOwnerName: type === SALE_VIA.DIRECT
      ? (buyerNameForHistory || 'Buyer')
      : 'Third-Party / Lost',
    buyerId: finalBuyerId,
    buyerContactId: toContactId,
    sellerContactId: fromContactId,
    saleTransactionId,
    saleDate: now,
    salePrice: price,
    soldVia: type,
    reasonLost: type === SALE_VIA.THIRD_PARTY ? reasonLost : null,
    notes,
  });

  const updatedHistory = [...(property.ownershipHistory || []), historyEntry];

  const updatedSaleInfo = {
    listedPrice: null,
    soldPrice: price,
    soldDate: now,
    soldToBuyerId: finalBuyerId,
    soldToBuyerContactId: toContactId,
    soldVia: type,
    saleTransactionId,
    brokeragePaid: brokerageAmount != null ? Number(brokerageAmount) : null,
    brokerageLost: type === SALE_VIA.THIRD_PARTY && brokerageLost != null
      ? Number(brokerageLost)
      : null,
    reasonLost: type === SALE_VIA.THIRD_PARTY ? reasonLost : null,
    thirdPartyNotes: type === SALE_VIA.THIRD_PARTY ? notes : null,
  };

  // Current owner = buyer contact on direct sale; otherwise clear / keep unknown
  const newCurrentOwnerContactId = type === SALE_VIA.DIRECT ? toContactId : null;
  // Keep legacy seller ownerId as previousOwnerId; set ownerId to buyer's OWNER when known
  const sellerOwnerId = property.ownerId || sellerContact?.linkedOwnerId || null;
  const newOwnerId = type === SALE_VIA.DIRECT ? (buyerOwnerId || null) : null;

  const gsi1pk = newCurrentOwnerContactId
    ? propertyOwnerGsi1Pk(tenantId, newCurrentOwnerContactId)
    : propertyOwnerLegacyGsi1Pk(tenantId, newOwnerId);

  if (!skipPropertyUpdate) {
    const clearedMarketing = buildClearedMarketingPricesPatch(property);
    await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: [
        'SET #status = :status',
        'listingStatus = :listingStatus',
        'currentOwnerContactId = :currentOwnerContactId',
        'ownerContactId = :ownerContactId',
        'previousOwnerContactId = :previousOwnerContactId',
        'previousOwnerId = :previousOwnerId',
        'ownerId = :ownerId',
        'ownerName = :ownerName',
        'ownerPhone = :ownerPhone',
        'ownerSnapshot = :ownerSnapshot',
        'saleInfo = :saleInfo',
        'rentAmount = :rentAmount',
        'rentalInfo = :rentalInfo',
        'ownershipHistory = :ownershipHistory',
        'latestSaleTransactionId = :latestSaleTransactionId',
        'GSI1PK = :gsi1pk',
        'GSI2PK = :gsi2pk',
        'updatedAt = :updatedAt',
      ].join(', '),
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        // Owned by buyer, not actively listed (listing row separately marked sold)
        ':status': PROPERTY_STATUS.NOT_LISTED,
        ':listingStatus': 'inactive',
        ':currentOwnerContactId': newCurrentOwnerContactId,
        ':ownerContactId': newCurrentOwnerContactId,
        ':previousOwnerContactId': fromContactId,
        ':previousOwnerId': sellerOwnerId,
        // Point legacy ownerId at buyer's OWNER (not seller; not null)
        ':ownerId': newOwnerId,
        ':ownerName': buyerContact?.name || null,
        ':ownerPhone': buyerContact?.phone || null,
        ':ownerSnapshot': buyerContact
          ? { name: buyerContact.name, phone: buyerContact.phone, contactId: buyerContact.contactId }
          : null,
        ':saleInfo': updatedSaleInfo,
        ':rentAmount': clearedMarketing.rentAmount,
        ':rentalInfo': {
          ...(property.rentalInfo || {}),
          expectedRent: null,
        },
        ':ownershipHistory': updatedHistory,
        ':latestSaleTransactionId': saleTransactionId,
        ':gsi1pk': gsi1pk,
        ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#${PROPERTY_STATUS.NOT_LISTED}`,
        ':updatedAt': now,
      },
    }));
  } else {
    // Property already sold in convertLead txn — attach saleTransactionId only
    await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET latestSaleTransactionId = :latestSaleTransactionId, saleInfo.saleTransactionId = :saleTransactionId, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':latestSaleTransactionId': saleTransactionId,
        ':saleTransactionId': saleTransactionId,
        ':updatedAt': now,
      },
    }));
  }

  const saleTransaction = await putSaleTransaction(tenantId, {
    saleTransactionId,
    propertyId,
    propertyTitle: property.title || null,
    sellerContactId: fromContactId,
    sellerOwnerId,
    buyerContactId: toContactId,
    buyerId: finalBuyerId,
    soldPrice: price,
    soldAt: now,
    soldVia: type,
    brokerageAmount: brokerageAmount != null ? Number(brokerageAmount) : null,
    brokerageLost: type === SALE_VIA.THIRD_PARTY && brokerageLost != null
      ? Number(brokerageLost)
      : null,
    reasonLost: type === SALE_VIA.THIRD_PARTY ? reasonLost : null,
    notes,
    source,
    createdBy: performedBy,
    createdAt: now,
    updatedAt: now,
  });

  // Close listings first so activeListingIds are cleared before seller demotion
  try {
    const { closeActiveSaleListingsForProperty } = await import('./listingService.js');
    await closeActiveSaleListingsForProperty(tenantId, propertyId, { saleTransactionId });
  } catch (err) {
    console.error('transferOwnership.closeListings.error', err.message);
  }

  if (type === SALE_VIA.DIRECT && buyerContact) {
    // Always keep Contact.purchaseHistory current (Contact = permanent history).
    // skipBuyerPurchase only skips legacy BUYER.purchases (already written in convertLead txn).
    if (buyerContact.contactId) {
      const history = Array.isArray(buyerContact.purchaseHistory)
        ? [...buyerContact.purchaseHistory]
        : [];
      const already = history.some(
        (p) => p.propertyId === propertyId && p.saleTransactionId === saleTransactionId,
      );
      if (!already) {
        history.push({
          propertyId,
          propertyName: property.title || null,
          area: property.area || null,
          saleAmount: price,
          purchaseDate: now,
          brokeragePaid: brokerageAmount != null ? Number(brokerageAmount) : 0,
          saleTransactionId,
          notes: notes || '',
        });
        await updateContact(tenantId, buyerContact.contactId, {
          purchaseHistory: history,
        }).catch((err) => {
          console.error('transferOwnership.contactPurchaseHistory.error', err.message);
        });
      }
    }
    if (!skipBuyerPurchase) {
      await appendBuyerPurchase(tenantId, buyerId, null, {
        propertyId,
        propertyName: property.title || null,
        area: property.area || null,
        saleAmount: price,
        purchaseDate: now,
        brokeragePaid: brokerageAmount != null ? Number(brokerageAmount) : 0,
        saleTransactionId,
        notes: notes || '',
      });
    }
    // Re-read contact in case ensureBuyerOwnerEntity linked an OWNER
    const freshBuyer = await getContact(tenantId, buyerContact.contactId).catch(() => buyerContact);
    const buyerForUpdate = freshBuyer || buyerContact;
    if (buyerOwnerEntity?.ownerId && !buyerForUpdate.linkedOwnerId) {
      buyerForUpdate.linkedOwnerId = buyerOwnerEntity.ownerId;
    }
    await updateBuyerAsOwner(tenantId, buyerForUpdate, propertyId, buyerId);
  }

  if (sellerContact?.contactId) {
    const freshSeller = await getContact(tenantId, sellerContact.contactId).catch(() => sellerContact);
    await updateSellerAfterSale(tenantId, freshSeller || sellerContact, propertyId);
  }

  // Activity logs (best-effort) — human-readable seller/buyer story
  const sellerNameForHistory = sellerContact?.name || previousOwner?.name || property.ownerName || null;
  const propertyTitle = property.title || 'Property';

  if (type === SALE_VIA.DIRECT && (buyerContact || buyerId)) {
    try {
      await logContactActivity(tenantId, {
        activityType: 'purchase_recorded',
        subjectEntityType: buyerContact ? 'contact' : 'buyer',
        subjectEntityId: buyerContact?.contactId || buyerId,
        subjectEntityName: buyerNameForHistory,
        title: `Purchased ${propertyTitle}`,
        description: [
          amountLabel(price),
          sellerNameForHistory ? `from ${sellerNameForHistory}` : null,
        ].filter(Boolean).join(' · ') || `Purchased ${propertyTitle}.`,
        performedBy,
        payload: {
          propertyId,
          propertyTitle,
          soldPrice: price,
          saleAmount: price,
          brokerageAmount,
          saleTransactionId,
          buyerId: finalBuyerId,
          buyerContactId: toContactId,
          buyerName: buyerNameForHistory,
          sellerContactId: fromContactId,
          sellerName: sellerNameForHistory,
          fromOwnerName: sellerNameForHistory,
          toOwnerName: buyerNameForHistory,
        },
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        relatedEntityName: propertyTitle,
      });
    } catch (err) {
      console.error('transferOwnership.buyerActivity.error', err.message);
    }
  }

  if (sellerContact || property.ownerId) {
    try {
      await logContactActivity(tenantId, {
        activityType: 'property_sold',
        subjectEntityType: sellerContact ? 'contact' : 'owner',
        subjectEntityId: sellerContact?.contactId || property.ownerId,
        subjectEntityName: sellerNameForHistory || 'Owner',
        title: `Sold ${propertyTitle}`,
        description: [
          type === SALE_VIA.DIRECT && buyerNameForHistory ? `to ${buyerNameForHistory}` : null,
          type === SALE_VIA.THIRD_PARTY ? 'to a third party' : null,
          amountLabel(price),
        ].filter(Boolean).join(' · ') || `Sold ${propertyTitle}.`,
        performedBy,
        payload: {
          propertyId,
          propertyTitle,
          soldPrice: price,
          saleAmount: price,
          brokerageAmount,
          saleType: type,
          saleTransactionId,
          buyerId: finalBuyerId,
          buyerContactId: toContactId,
          buyerName: buyerNameForHistory,
          sellerContactId: fromContactId,
          sellerName: sellerNameForHistory,
          fromOwnerName: sellerNameForHistory,
          toOwnerName: type === SALE_VIA.DIRECT ? buyerNameForHistory : 'Third-Party / Lost',
        },
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        relatedEntityName: propertyTitle,
      });
    } catch (err) {
      console.error('transferOwnership.sellerActivity.error', err.message);
    }
  }

  // Ownership change event on both parties
  try {
    if (buyerContact?.contactId) {
      await logContactActivity(tenantId, {
        activityType: 'ownership_changed',
        subjectEntityType: 'contact',
        subjectEntityId: buyerContact.contactId,
        subjectEntityName: buyerNameForHistory,
        title: `Became owner of ${propertyTitle}`,
        description: sellerNameForHistory
          ? `Ownership received from ${sellerNameForHistory}${price ? ` for ${amountLabel(price)}` : ''}.`
          : `Ownership transferred to this contact.`,
        performedBy,
        payload: {
          propertyId,
          propertyTitle,
          saleTransactionId,
          soldPrice: price,
          fromContactId,
          toContactId,
          sellerName: sellerNameForHistory,
          buyerName: buyerNameForHistory,
          fromOwnerName: sellerNameForHistory,
          toOwnerName: buyerNameForHistory,
        },
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        relatedEntityName: propertyTitle,
      });
    }
    if (sellerContact?.contactId) {
      await logContactActivity(tenantId, {
        activityType: 'ownership_changed',
        subjectEntityType: 'contact',
        subjectEntityId: sellerContact.contactId,
        subjectEntityName: sellerContact.name,
        title: `Transferred ${propertyTitle}`,
        description: buyerNameForHistory
          ? `No longer the owner — transferred to ${buyerNameForHistory}${price ? ` for ${amountLabel(price)}` : ''}.`
          : `No longer the current owner of this property.`,
        performedBy,
        payload: {
          propertyId,
          propertyTitle,
          saleTransactionId,
          soldPrice: price,
          fromContactId,
          toContactId,
          sellerName: sellerNameForHistory,
          buyerName: buyerNameForHistory,
          fromOwnerName: sellerNameForHistory,
          toOwnerName: type === SALE_VIA.DIRECT ? buyerNameForHistory : 'Third-Party / Lost',
        },
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        relatedEntityName: propertyTitle,
      });
    }
  } catch (err) {
    console.error('transferOwnership.ownershipChangedActivity.error', err.message);
  }

  // Optional Khata brokerage (reuse helper if available)
  if (brokerageAmount && Number(brokerageAmount) > 0) {
    try {
      const { createBrokerageKhataEntry } = await import('../crmHelpers.js');
      await createBrokerageKhataEntry(tenantId, {
        propertyId,
        partyId: type === SALE_VIA.DIRECT
          ? (toContactId || finalBuyerId || 'UNASSIGNED')
          : (fromContactId || property.ownerId || 'UNASSIGNED'),
        partyType: type === SALE_VIA.DIRECT ? 'BUYER' : 'SELLER',
        partyName: type === SALE_VIA.DIRECT
          ? (buyerContact?.name || 'Buyer')
          : (sellerContact?.name || property.ownerName || 'Owner'),
        amount: Number(brokerageAmount),
        transactionType: 'TO_TAKE',
        sourceRef: `property-sale-transfer:${saleTransactionId}`,
        description: `Brokerage for property sale: ${property.title || ''}`,
      });
    } catch (err) {
      console.error('transferOwnership.khata.error', err.message);
    }
  } else if (type === SALE_VIA.THIRD_PARTY && brokerageLost && Number(brokerageLost) > 0) {
    try {
      const { createBrokerageKhataEntry } = await import('../crmHelpers.js');
      await createBrokerageKhataEntry(tenantId, {
        propertyId,
        partyId: fromContactId || property.ownerId || 'UNASSIGNED',
        partyType: 'SELLER',
        partyName: sellerContact?.name || property.ownerName || 'Owner',
        amount: Number(brokerageLost),
        transactionType: 'TO_GIVE',
        sourceRef: `property-sale-lost:${saleTransactionId}`,
        description: `Lost brokerage - property sold to third party: ${property.title || ''}`,
      });
    } catch (err) {
      console.error('transferOwnership.khataLost.error', err.message);
    }
  }

  const updatedProperty = await getProperty(tenantId, propertyId);

  return {
    success: true,
    property: updatedProperty,
    saleTransaction,
    sellerContact,
    buyerContact,
    ownerId: null,
    currentOwnerContactId: newCurrentOwnerContactId,
  };
}

export default { transferOwnership };
