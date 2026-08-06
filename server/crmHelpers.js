/**
 * Helper functions for managing post-transaction operations
 * Buyer purchases, Tenant rentals, Property listings
 */

import { docClient, CRM_TABLE_NAME } from './crmDynamodbService.js';
import { SERVICE_ACCOUNT_USER } from './utils/serviceAccount.js';
import { parsePropertyBhk, coerceFiniteNumber } from './services/leadConversionService.js';
import { GetCommand, UpdateCommand, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const KHATA_TABLE_NAME = process.env.KHATA_TABLE_NAME || 'cloudberry-real-estate-khata';

// ============== BUYER Purchase Management ==============

/**
 * Add a new purchase to an existing buyer
 */
export async function addPurchaseToBuyer(tenantId, buyerId, purchaseDetails) {
  if (!tenantId || !buyerId) throw new Error('Tenant ID and Buyer ID are required');
  if (!purchaseDetails.propertyId) throw new Error('Property ID is required');

  // Get existing buyer
  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
  }));

  const buyer = result.Item;
  if (!buyer) throw new Error('Buyer not found');

  const newPurchase = {
    propertyId: purchaseDetails.propertyId,
    purchaseDate: purchaseDetails.purchaseDate || new Date().toISOString(),
    saleAmount: purchaseDetails.saleAmount || 0,
    registrationDate: purchaseDetails.registrationDate || null,
    registrationNumber: purchaseDetails.registrationNumber || null,
    saleDeedS3Key: purchaseDetails.saleDeedS3Key || null,
    saleDeedUrl: purchaseDetails.saleDeedUrl || null,
    registrationDocS3Key: purchaseDetails.registrationDocS3Key || null,
    registrationDocUrl: purchaseDetails.registrationDocUrl || null,
    stampDutyPaid: purchaseDetails.stampDutyPaid || 0,
    registrationCharges: purchaseDetails.registrationCharges || 0,
    brokeragePaid: purchaseDetails.brokeragePaid || 0,
    loanDetails: purchaseDetails.loanDetails || null,
    notes: purchaseDetails.notes || '',
  };

  const updatedPurchases = [...(buyer.purchases || []), newPurchase];

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET purchases = :purchases, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':purchases': updatedPurchases,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  return newPurchase;
}

/**
 * Update a specific purchase record
 */
export async function updateBuyerPurchase(tenantId, buyerId, propertyId, updates) {
  if (!tenantId || !buyerId || !propertyId) {
    throw new Error('Tenant ID, Buyer ID, and Property ID are required');
  }

  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
  }));

  const buyer = result.Item;
  if (!buyer) throw new Error('Buyer not found');

  const purchases = buyer.purchases || [];
  const purchaseIndex = purchases.findIndex(p => p.propertyId === propertyId);
  
  if (purchaseIndex === -1) throw new Error('Purchase not found');

  purchases[purchaseIndex] = { ...purchases[purchaseIndex], ...updates };

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

  return purchases[purchaseIndex];
}

// ============== TENANT Rental Management ==============

/**
 * Update tenant's current rental details
 */
export async function updateCurrentRental(tenantId, customerId, rentalDetails) {
  if (!tenantId || !customerId) throw new Error('Tenant ID and Customer ID are required');

  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
  }));

  const customer = result.Item;
  if (!customer) throw new Error('Customer not found');

  const updatedRental = {
    ...(customer.currentRental || {}),
    ...rentalDetails,
  };

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET currentRental = :currentRental, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':currentRental': updatedRental,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  return updatedRental;
}

/**
 * Move tenant's current rental to history (when lease ends)
 */
export async function moveTenantToHistory(tenantId, customerId) {
  if (!tenantId || !customerId) throw new Error('Tenant ID and Customer ID are required');

  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
  }));

  const customer = result.Item;
  if (!customer) throw new Error('Customer not found');
  if (!customer.currentRental) throw new Error('No current rental to archive');

  const rentalHistory = [...(customer.rentalHistory || []), customer.currentRental];

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET currentRental = :null, rentalHistory = :history, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':null': null,
      ':history': rentalHistory,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  return { success: true, archivedRental: customer.currentRental };
}

// ============== PROPERTY Listing Management ==============

/**
 * List a property for sale — creates a Listing record and syncs Property marketing fields.
 */
export async function listPropertyForSale(tenantId, propertyId, listedPrice, performedBy = null) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');
  const { createListing } = await import('./services/listingService.js');
  const listing = await createListing(tenantId, {
    propertyId,
    listingType: 'sale',
    listedPrice,
    source: 'list_for_sale',
    performedBy: performedBy || SERVICE_ACCOUNT_USER,
  });
  return { success: true, listing };
}

/**
 * List a property for rent — creates a Listing record and syncs Property marketing fields.
 */
export async function listPropertyForRent(tenantId, propertyId, expectedRent, securityDeposit = 0, performedBy = null) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');
  const { createListing } = await import('./services/listingService.js');
  const listing = await createListing(tenantId, {
    propertyId,
    listingType: 'rent',
    expectedRent,
    securityDeposit,
    source: 'list_for_rent',
    performedBy: performedBy || SERVICE_ACCOUNT_USER,
  });
  return { success: true, listing };
}

/**
 * Mark a property as sold.
 * Delegates to transferOwnership() so Property.currentOwnerContactId
 * always reflects reality and SaleTransaction + history are written.
 */
export async function markPropertySold(tenantId, propertyId, soldPrice, buyerId = null, saleType = 'direct', reasonLost = null, notes = null, brokerageAmount = null, brokerageLost = null, sourceRef = null, performedBy = null) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');

  const { transferOwnership } = await import('./services/transferOwnership.js');

  const result = await transferOwnership(tenantId, {
    propertyId,
    soldPrice,
    buyerId,
    saleType: saleType || 'direct',
    reasonLost,
    notes,
    brokerageAmount,
    brokerageLost,
    source: sourceRef || 'mark_sold',
    performedBy: performedBy || SERVICE_ACCOUNT_USER,
  });

  return {
    success: true,
    ownerId: result.ownerId ?? null,
    currentOwnerContactId: result.currentOwnerContactId ?? null,
    saleTransactionId: result.saleTransaction?.saleTransactionId ?? null,
    property: result.property,
  };
}

/**
 * Mark a property as rented — syncs property, tenant, contact history, and clears marketing prices.
 */
export async function markPropertyRented(tenantId, propertyId, customerId, rentalDetails, sourceRef = null, performedBy = null) {
  if (!tenantId || !propertyId || !customerId) {
    throw new Error('Tenant ID, Property ID, and Customer ID are required');
  }

  const actor = performedBy || SERVICE_ACCOUNT_USER;
  const now = new Date().toISOString();

  const { getProperty, logContactActivity } = await import('./crmDynamodbService.js');

  const propertyResult = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
  }));
  const property = propertyResult.Item;
  if (!property) throw new Error('Property not found');

  const customerResult = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
  }));
  const customer = customerResult.Item;
  if (!customer) throw new Error('Customer not found');

  const tenantName = customer.name || 'Unknown Tenant';
  const leaseStart = rentalDetails.leaseStartDate || now;
  const leaseEnd = rentalDetails.leaseEndDate || null;
  const monthlyRent = Number(rentalDetails.monthlyRent) || 0;
  const securityDeposit = Number(rentalDetails.securityDeposit) || 0;
  const brokeragePaid = Number(rentalDetails.brokeragePaid) || 0;

  const propertyRentalEntry = {
    tenantId: customerId,
    tenantName,
    leaseStartDate: leaseStart,
    leaseEndDate: leaseEnd,
    monthlyRent,
    securityDeposit,
    brokeragePaid,
  };

  const tenantCurrentRental = {
    propertyId,
    propertyName: property.title || null,
    area: property.area || null,
    leaseStartDate: leaseStart,
    leaseEndDate: leaseEnd,
    monthlyRent,
    securityDeposit,
    brokeragePaid,
    notes: rentalDetails.notes || '',
  };

  const tenantRentalHistory = Array.isArray(customer.rentalHistory)
    ? [...customer.rentalHistory]
    : [];
  const historyHasActive = tenantRentalHistory.some(
    (entry) => entry.propertyId === propertyId && !entry.leaseEndDate,
  );
  if (!historyHasActive) {
    tenantRentalHistory.push(tenantCurrentRental);
  }

  const updatedRentalInfo = {
    ...(property.rentalInfo || {}),
    currentRent: monthlyRent,
    currentTenantId: customerId,
    leaseStartDate: leaseStart,
    leaseEndDate: leaseEnd,
    securityDeposit,
    expectedRent: null,
  };
  const updatedSaleInfo = {
    ...(property.saleInfo || {}),
    listedPrice: null,
  };

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: [
      'SET #status = :status',
      'listingStatus = :listingStatus',
      'tenantCustomerId = :tenantId',
      'rentAmount = :nullVal',
      'rentalInfo = :rentalInfo',
      'saleInfo = :saleInfo',
      'rentalHistory = list_append(if_not_exists(rentalHistory, :emptyList), :newRentalEntry)',
      'updatedAt = :updatedAt',
      'GSI2PK = :gsi2pk',
    ].join(', '),
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'rented',
      ':listingStatus': 'inactive',
      ':tenantId': customerId,
      ':nullVal': null,
      ':rentalInfo': updatedRentalInfo,
      ':saleInfo': updatedSaleInfo,
      ':emptyList': [],
      ':newRentalEntry': [propertyRentalEntry],
      ':updatedAt': now,
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#rented`,
    },
  }));

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET currentRental = :currentRental, rentalHistory = :rentalHistory, #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':currentRental': tenantCurrentRental,
      ':rentalHistory': tenantRentalHistory,
      ':status': 'active',
      ':updatedAt': now,
    },
  }));

  try {
    const { closeActiveRentListingsForProperty } = await import('./services/listingService.js');
    await closeActiveRentListingsForProperty(tenantId, propertyId);
  } catch (err) {
    console.error('markPropertyRented.closeListings.error', err.message);
  }

  // Auto-create Khata Book entry for rental brokerage
  if (brokeragePaid > 0) {
    try {
      await createBrokerageKhataEntry(tenantId, {
        propertyId,
        partyId: property.ownerId || 'UNASSIGNED',
        partyType: 'OWNER',
        partyName: property.ownerSnapshot?.name || property.ownerName || 'Owner',
        amount: brokeragePaid,
        transactionType: 'TO_TAKE',
        sourceRef: sourceRef || `property-rental-mark-rented:${propertyId}:${Date.now()}`,
        description: `Brokerage for renting property: ${property.title || ''}`,
      });
    } catch (err) {
      console.error('Error creating rental brokerage khata entry in helper:', err);
    }
  }

  const rentLabel = monthlyRent > 0
    ? `INR ${monthlyRent.toLocaleString()}/month`
    : 'terms recorded';

  // Tenant contact timeline
  try {
    await logContactActivity(tenantId, {
      activityType: 'rental_started',
      subjectEntityType: 'customer',
      subjectEntityId: customerId,
      subjectEntityName: tenantName,
      title: `Rented Property: ${property.title || 'Property'}`,
      description: `Lease started at ${rentLabel}.`,
      performedBy: actor,
      payload: {
        propertyId,
        propertyTitle: property.title,
        rent: monthlyRent,
        deposit: securityDeposit,
        leaseStartDate: leaseStart,
        leaseEndDate: leaseEnd,
      },
      relatedEntityType: 'property',
      relatedEntityId: propertyId,
      relatedEntityName: property.title || null,
    });
  } catch (logErr) {
    console.error('Error logging rental_started contact activity:', logErr);
  }

  // Owner / landlord contact timeline
  try {
    if (property.ownerId) {
      const { getOwner } = await import('./crmDynamodbService.js');
      const owner = await getOwner(tenantId, property.ownerId);
      await logContactActivity(tenantId, {
        activityType: 'property_rented',
        subjectEntityType: 'owner',
        subjectEntityId: property.ownerId,
        subjectEntityName: owner?.name || property.ownerName || 'Owner',
        title: `Property Rented Out: ${property.title || 'Property'}`,
        description: `Rented to ${tenantName} at ${rentLabel}.`,
        performedBy: actor,
        payload: {
          propertyId,
          propertyTitle: property.title,
          rent: monthlyRent,
          tenantId: customerId,
          tenantName,
          brokeragePaid,
        },
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        relatedEntityName: property.title || null,
      });
    }
  } catch (logErr) {
    console.error('Error logging property_rented contact activity:', logErr);
  }

  // Property owner contact via currentOwnerContactId when available
  try {
    const ownerContactId = property.currentOwnerContactId || property.ownerContactId;
    if (ownerContactId) {
      const { createContactActivity } = await import('./crmDynamodbService.js');
      await createContactActivity(tenantId, ownerContactId, {
        activityType: 'property_rented',
        subjectEntityType: 'contact',
        subjectEntityId: ownerContactId,
        title: `Property Now Occupied: ${property.title || 'Property'}`,
        description: `Tenant ${tenantName} moved in. Listing price cleared; status is Occupied.`,
        performedBy: actor,
        payload: {
          propertyId,
          propertyTitle: property.title,
          tenantId: customerId,
          tenantName,
          monthlyRent,
        },
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        relatedEntityName: property.title || null,
      });
    }
  } catch (logErr) {
    console.error('Error logging owner contact property_rented activity:', logErr);
  }

  return { success: true };
}

/**
 * Vacate a property (move tenant to history, set property to vacant)
 */
export async function vacateProperty(tenantId, propertyId) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');

  // Get property to find current tenant
  const propResult = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
  }));

  const property = propResult.Item;
  if (!property) throw new Error('Property not found');

  const currentTenantId = property.rentalInfo?.currentTenantId;
  const now = new Date().toISOString();

  // Move tenant to history if exists
  if (currentTenantId) {
    try {
      await moveTenantToHistory(tenantId, currentTenantId);
    } catch (error) {
      console.error('Failed to archive tenant rental:', error);
    }
  }

  // Update the last rentalHistory entry with leaseEndDate if exists
  const rentalHistory = property.rentalHistory || [];
  if (rentalHistory.length > 0) {
    const lastIndex = rentalHistory.length - 1;
    rentalHistory[lastIndex] = {
      ...rentalHistory[lastIndex],
      leaseEndDate: now,
    };
  }

  // Update property to vacant
  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, tenantCustomerId = :null, rentalInfo.currentRent = :null, rentalInfo.currentTenantId = :null, rentalInfo.leaseStartDate = :null, rentalInfo.leaseEndDate = :null, rentalHistory = :rentalHistory, updatedAt = :updatedAt, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'available',
      ':listingStatus': 'inactive',
      ':null': null,
      ':rentalHistory': rentalHistory,
      ':updatedAt': new Date().toISOString(),
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#available`,
    },
  }));

  return { success: true, archivedTenantId: currentTenantId };
}

// ============== Khata Book Brokerage Integration ==============

/**
 * Create a Khata Book entry for brokerage transactions.
 * Prevents duplicates by checking sourceRef.
 */
export async function createBrokerageKhataEntry(tenantId, {
  propertyId,
  partyId,
  partyType,
  partyName,
  amount,
  transactionType,
  sourceRef,
  description,
}) {
  if (!tenantId || !propertyId || !partyId || !partyType || !amount || amount <= 0) {
    return null;
  }

  // Prevent duplicate: check if entry with same sourceRef already exists
  if (sourceRef) {
    try {
      const scanResult = await docClient.send(new ScanCommand({
        TableName: KHATA_TABLE_NAME,
        FilterExpression: 'PK = :pk AND sourceRef = :sourceRef',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':sourceRef': sourceRef,
        },
      }));
      if (scanResult.Items && scanResult.Items.length > 0) {
        return scanResult.Items[0];
      }
    } catch (scanError) {
      console.error('Error checking for duplicate khata entry:', scanError);
      // Continue to create entry even if scan fails
    }
  }

  const entryId = uuidv4();
  const now = new Date().toISOString();

  const entry = {
    PK: `TENANT#${tenantId}`,
    SK: `ENTRY#${entryId}`,
    GSI1PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
    GSI1SK: 'PENDING',
    GSI2PK: `TENANT#${tenantId}`,
    GSI2SK: `PENDING#${now}`,
    entryId,
    tenantId,
    propertyId,
    partyType,
    partyId,
    partyName: partyName || 'Unknown',
    transactionType: transactionType || 'TO_TAKE',
    amount: Number(amount),
    categoryId: 'predefined-0',
    categoryName: 'Brokerage',
    lineItems: [{
      categoryId: 'predefined-0',
      categoryName: 'Brokerage',
      amount: Number(amount),
    }],
    description: description || '',
    settlementStatus: 'PENDING',
    sourceRef: sourceRef || null,
    createdAt: now,
    createdBy: SERVICE_ACCOUNT_USER,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: KHATA_TABLE_NAME,
    Item: entry,
  }));

  try {
    const { logContactActivity } = await import('./crmDynamodbService.js');
    let subjectType = 'contact';
    if (partyType === 'OWNER') subjectType = 'owner';
    else if (partyType === 'BUYER') subjectType = 'buyer';
    else if (partyType === 'SELLER') subjectType = 'owner';
    else if (partyType === 'TENANT') subjectType = 'customer';

    await logContactActivity(tenantId, {
      activityType: 'khata_entry',
      subjectEntityType: subjectType,
      subjectEntityId: partyId,
      subjectEntityName: partyName,
      title: `Financial Ledger Entry: ${transactionType === 'TO_TAKE' ? 'Brokerage Receivable' : 'Brokerage Payable'}`,
      description: `${description || 'Brokerage ledger entry recorded.'} Amount: INR ${Number(amount).toLocaleString()}.`,
      performedBy: SERVICE_ACCOUNT_USER,
      payload: { entryId, propertyId, partyType, partyName, amount, transactionType, sourceRef },
    });
  } catch (logErr) {
    console.error('Error logging khata_entry contact activity:', logErr);
  }

  return entry;
}

/**
 * Create a new Owner + Property listing from a buyer's previous purchase.
 * This is the explicit action a buyer takes when they decide to rent out or resell.
 */
export async function createListingFromPurchase(tenantId, buyerId, propertyId, listingType, createdBy = SERVICE_ACCOUNT_USER) {
  if (!tenantId || !buyerId || !propertyId) {
    throw new Error('Tenant ID, Buyer ID, and Property ID are required');
  }
  if (!['rent', 'sale'].includes(listingType)) {
    throw new Error("listingType must be 'rent' or 'sale'");
  }

  // Dynamic import to avoid circular dependency
  const {
    getBuyer,
    getProperty,
    createProperty,
    createOrUpdateOwnerByPhone,
    getContact,
    updateContact,
  } = await import('./crmDynamodbService.js');

  // 1. Get buyer (handles both legacy BUYER and unified CONTACT)
  const buyer = await getBuyer(tenantId, buyerId);
  if (!buyer) throw new Error('Buyer not found');

  // 2. Verify this property exists in their purchase history
  const purchaseHistory = buyer.purchaseHistory || buyer.purchases || [];
  const purchase = purchaseHistory.find((p) => p.propertyId === propertyId);
  if (!purchase) {
    throw new Error('Property not found in buyer purchase history');
  }

  // 3. Get original property details to copy for the new listing
  const originalProperty = await getProperty(tenantId, propertyId);
  if (!originalProperty) throw new Error('Original property not found');

  // 4. Create or update Owner for this person
  if (!buyer.phone) throw new Error('Buyer phone is required to create owner listing');
  const owner = await createOrUpdateOwnerByPhone(tenantId, {
    name: buyer.name,
    email: buyer.email,
    phone: buyer.phone,
    address: buyer.address || '',
    status: 'active',
    source: buyer.source || 'buyer-listing',
    notes: buyer.notes || '',
    createdBy,
  });

  // 5. Link owner role to unified CONTACT if applicable
  if (buyer.isFromContact && buyer.contactId) {
    const contact = await getContact(tenantId, buyer.contactId);
    if (contact) {
      await updateContact(tenantId, buyer.contactId, {
        roles: {
          ...(contact.roles || {}),
          owner: true,
        },
        linkedOwnerId: owner.ownerId,
      });
    }
  }

  // 6. Create new property listing
  const isRentOut = listingType === 'rent';
  const propertyStatus = isRentOut ? 'for-rent' : 'for-sale';
  const listingTitle = isRentOut
    ? `${originalProperty?.propertyType || 'Property'} for Rent${originalProperty?.area ? ` - ${originalProperty.area}` : ''}`
    : `${originalProperty?.propertyType || 'Property'} for Sale${originalProperty?.area ? ` - ${originalProperty.area}` : ''}`;

  const newProperty = await createProperty(tenantId, {
    ownerId: owner.ownerId,
    ownerName: owner.name,
    ownerPhone: owner.phone,
    ownerSnapshot: { name: owner.name, phone: owner.phone },
    currentOwnerContactId: buyer.contactId || null,
    ownerContactId: buyer.contactId || null,
    acquiredFromPurchaseId: propertyId,
    title: listingTitle,
    description: originalProperty?.description || buyer.notes || '',
    propertyType: originalProperty?.propertyType || 'apartment',
    bhk: parsePropertyBhk(originalProperty?.bhk),
    buildingName: originalProperty?.buildingName || '',
    flatNumber: originalProperty?.flatNumber || '',
    floor: originalProperty?.floor || '',
    furnishing: originalProperty?.furnishing || 'unfurnished',
    carpetArea: coerceFiniteNumber(originalProperty?.carpetArea, 0),
    area: originalProperty?.area || '',
    city: originalProperty?.city || buyer.city || 'Mumbai',
    address: originalProperty?.address || buyer.address || '',
    status: propertyStatus,
    listingStatus: 'active',
    ...(isRentOut
      ? {
          rentAmount: originalProperty?.rentAmount || 0,
          depositAmount: originalProperty?.depositAmount || 0,
          rentalInfo: {
            expectedRent: originalProperty?.rentAmount || 0,
            currentRent: null,
            currentTenantId: null,
            leaseStartDate: null,
            leaseEndDate: null,
            securityDeposit: originalProperty?.depositAmount || 0,
          },
        }
      : {
          saleInfo: {
            listedPrice: purchase.saleAmount || null,
            soldPrice: null,
            soldDate: null,
            soldToBuyerId: null,
          },
        }),
    createdBy,
  });

  // Phase 3: create Listing entity (property already set for-sale/for-rent)
  let listing = null;
  try {
    const { createListing } = await import('./services/listingService.js');
    listing = await createListing(tenantId, {
      propertyId: newProperty.propertyId,
      listingType: isRentOut ? 'rent' : 'sale',
      listedPrice: purchase.saleAmount || null,
      expectedRent: isRentOut ? (originalProperty?.rentAmount || 0) : null,
      securityDeposit: isRentOut ? (originalProperty?.depositAmount || 0) : 0,
      source: 'buyer_relist',
      performedBy: createdBy,
      skipPropertySync: true,
    });
  } catch (err) {
    console.error('createListingFromPurchase.listing.error', err.message);
  }

  return { property: newProperty, owner, listing };
}

export default {
  addPurchaseToBuyer,
  updateBuyerPurchase,
  updateCurrentRental,
  moveTenantToHistory,
  listPropertyForSale,
  listPropertyForRent,
  markPropertySold,
  markPropertyRented,
  vacateProperty,
  createBrokerageKhataEntry,
  createListingFromPurchase,
};
