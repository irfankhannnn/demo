/**
 * Helper functions for managing post-transaction operations
 * Buyer purchases, Tenant rentals, Property listings
 */

import { docClient, CRM_TABLE_NAME } from './crmDynamodbService.js';
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
 * List a property for sale
 */
export async function listPropertyForSale(tenantId, propertyId, listedPrice) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, saleInfo = :saleInfo, updatedAt = :updatedAt, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'for-sale',
      ':listingStatus': 'active',
      ':saleInfo': {
        listedPrice: listedPrice || 0,
        soldPrice: null,
        soldDate: null,
        soldToBuyerId: null,
      },
      ':updatedAt': new Date().toISOString(),
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#for-sale`,
    },
  }));

  return { success: true };
}

/**
 * List a property for rent
 */
export async function listPropertyForRent(tenantId, propertyId, expectedRent, securityDeposit = 0) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, rentalInfo.expectedRent = :expectedRent, rentalInfo.securityDeposit = :securityDeposit, updatedAt = :updatedAt, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'for-rent',
      ':listingStatus': 'active',
      ':expectedRent': expectedRent || 0,
      ':securityDeposit': securityDeposit,
      ':updatedAt': new Date().toISOString(),
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#for-rent`,
    },
  }));

  return { success: true };
}

/**
 * Mark a property as sold (supports direct sale to buyer or third-party sale)
 */
export async function markPropertySold(tenantId, propertyId, soldPrice, buyerId = null, saleType = 'direct', reasonLost = null, notes = null, brokerageAmount = null, brokerageLost = null, sourceRef = null) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');

  // Dynamic import to avoid circular dependency
  const { 
    getProperty, 
    getBuyer, 
    getOwner
  } = await import('./crmDynamodbService.js');

  const property = await getProperty(tenantId, propertyId);
  if (!property) throw new Error('Property not found');

  const now = new Date().toISOString();
  let previousOwner = null;
  if (property.ownerId) {
    previousOwner = await getOwner(tenantId, property.ownerId);
  }

  // Keep the original seller as the property owner for historical records.
  // We do NOT auto-create an Owner for the buyer here.
  // Buyer -> Owner conversion happens only when the buyer explicitly lists the property.
  const newOwnerId = property.ownerId || null;
  const newOwnerName = previousOwner ? previousOwner.name : null;
  const newOwnerPhone = previousOwner ? previousOwner.phone : null;
  let finalBuyerId = buyerId;
  let buyerNameForHistory = null;

  // Handle direct sale
  if (saleType === 'direct') {
    if (!buyerId) {
      throw new Error('Buyer ID is required for a direct sale');
    }
    const buyer = await getBuyer(tenantId, buyerId);
    if (!buyer) throw new Error('Buyer not found');
    buyerNameForHistory = buyer.name;
  } else {
    // For third_party, buyerId is null
    finalBuyerId = null;
  }

  // Prepare new ownershipHistory entry for the property
  const newHistoryEntry = {
    fromOwnerId: property.ownerId || null,
    toOwnerId: null,
    fromOwnerName: previousOwner ? previousOwner.name : 'Unassigned',
    toOwnerName: saleType === 'direct' ? buyerNameForHistory : 'Third-Party / Lost',
    saleDate: now,
    salePrice: Number(soldPrice) || null,
    soldVia: saleType,
    buyerId: finalBuyerId,
    reasonLost: saleType === 'third_party' ? reasonLost : null,
    notes: notes || null
  };

  const updatedHistory = [...(property.ownershipHistory || []), newHistoryEntry];

  // 5. Update Property Profile
  const gsi1pk = newOwnerId 
    ? `TENANT#${tenantId}#OWNER#${newOwnerId}` 
    : `TENANT#${tenantId}#OWNER#UNASSIGNED`;

  const updatedSaleInfo = {
    listedPrice: property.saleInfo?.listedPrice || null,
    soldPrice: Number(soldPrice) || null,
    soldDate: now,
    soldToBuyerId: finalBuyerId,
    soldVia: saleType,
    brokeragePaid: brokerageAmount,
    brokerageLost: saleType === 'third_party' ? brokerageLost : null,
    reasonLost: saleType === 'third_party' ? reasonLost : null,
    thirdPartyNotes: saleType === 'third_party' ? notes : null
  };

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, ownerId = :ownerId, ownerName = :ownerName, ownerPhone = :ownerPhone, ownerSnapshot = :ownerSnapshot, saleInfo = :saleInfo, ownershipHistory = :ownershipHistory, GSI1PK = :gsi1pk, GSI2PK = :gsi2pk, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'sold',
      ':listingStatus': 'inactive',
      ':ownerId': newOwnerId || null,
      ':ownerName': newOwnerName,
      ':ownerPhone': newOwnerPhone,
      ':ownerSnapshot': newOwnerName || newOwnerPhone ? { name: newOwnerName, phone: newOwnerPhone } : null,
      ':saleInfo': updatedSaleInfo,
      ':ownershipHistory': updatedHistory,
      ':gsi1pk': gsi1pk,
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#sold`,
      ':updatedAt': now
    },
  }));

  // Auto-create Khata Book entry for property sale brokerage
  if (brokerageAmount && Number(brokerageAmount) > 0) {
    try {
      await createBrokerageKhataEntry(tenantId, {
        propertyId,
        partyId: saleType === 'direct' ? (newOwnerId || 'UNASSIGNED') : (property.ownerId || 'UNASSIGNED'),
        partyType: saleType === 'direct' ? 'BUYER' : 'SELLER',
        partyName: saleType === 'direct' ? (newOwnerName || 'Buyer') : (property.ownerSnapshot?.name || property.ownerName || 'Owner'),
        amount: Number(brokerageAmount),
        transactionType: 'TO_TAKE',
        sourceRef: sourceRef || `property-sale-mark-sold:${propertyId}`,
        description: `Brokerage for property sale: ${property.title || ''}`,
      });
    } catch (err) {
      console.error('Error creating sale brokerage khata entry in helper:', err);
    }
  } else if (saleType === 'third_party' && brokerageLost && Number(brokerageLost) > 0) {
    try {
      await createBrokerageKhataEntry(tenantId, {
        propertyId,
        partyId: property.ownerId || 'UNASSIGNED',
        partyType: 'SELLER',
        partyName: property.ownerSnapshot?.name || property.ownerName || 'Owner',
        amount: Number(brokerageLost),
        transactionType: 'TO_GIVE',
        sourceRef: sourceRef || `property-sale-lost:${propertyId}`,
        description: `Lost brokerage - property sold to third party: ${property.title || ''}`,
      });
    } catch (err) {
      console.error('Error creating lost brokerage khata entry in helper:', err);
    }
  }

  // Log contact activity for buyer (direct sale)
  if (saleType === 'direct' && buyerId) {
    try {
      const { logContactActivity } = await import('./crmDynamodbService.js');
      await logContactActivity(tenantId, {
        activityType: 'purchase_recorded',
        subjectEntityType: 'buyer',
        subjectEntityId: buyerId,
        subjectEntityName: buyerNameForHistory,
        title: `Property Purchased: ${property.title || 'Property'}`,
        description: `Purchased property for INR ${Number(soldPrice).toLocaleString()}. Brokerage: INR ${Number(brokerageAmount || 0).toLocaleString()}.`,
        performedBy: 'System',
        payload: { propertyId, propertyTitle: property.title, soldPrice, brokerageAmount },
      });
    } catch (logErr) {
      console.error('Error logging purchase_recorded contact activity:', logErr);
    }
  }

  // Log contact activity for property owner (seller)
  if (property.ownerId) {
    try {
      const { logContactActivity } = await import('./crmDynamodbService.js');
      await logContactActivity(tenantId, {
        activityType: 'property_sold',
        subjectEntityType: 'owner',
        subjectEntityId: property.ownerId,
        subjectEntityName: previousOwner ? previousOwner.name : 'Owner',
        title: `Property Sold: ${property.title || 'Property'}`,
        description: `Property sold for INR ${Number(soldPrice).toLocaleString()}. Brokerage: INR ${Number(brokerageAmount || 0).toLocaleString()}.`,
        performedBy: 'System',
        payload: { propertyId, propertyTitle: property.title, soldPrice, brokerageAmount, saleType },
      });
    } catch (logErr) {
      console.error('Error logging property_sold contact activity:', logErr);
    }
  }

  return { success: true, ownerId: newOwnerId };
}

/**
 * Mark a property as rented
 */
export async function markPropertyRented(tenantId, propertyId, customerId, rentalDetails, sourceRef = null) {
  if (!tenantId || !propertyId || !customerId) {
    throw new Error('Tenant ID, Property ID, and Customer ID are required');
  }

  // Fetch customer name for rental history entry
  const customerResult = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
  }));
  const customer = customerResult.Item;
  const tenantName = customer?.name || 'Unknown Tenant';

  const newRentalEntry = {
    tenantId: customerId,
    tenantName,
    leaseStartDate: rentalDetails.leaseStartDate || new Date().toISOString(),
    leaseEndDate: rentalDetails.leaseEndDate || null,
    monthlyRent: rentalDetails.monthlyRent || 0,
    securityDeposit: rentalDetails.securityDeposit || 0,
    brokeragePaid: rentalDetails.brokeragePaid || 0,
  };

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, tenantCustomerId = :tenantId, rentalInfo.currentRent = :currentRent, rentalInfo.currentTenantId = :tenantId, rentalInfo.leaseStartDate = :leaseStart, rentalInfo.leaseEndDate = :leaseEnd, rentalHistory = list_append(if_not_exists(rentalHistory, :emptyList), :newRentalEntry), updatedAt = :updatedAt, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'rented',
      ':listingStatus': 'inactive',
      ':currentRent': rentalDetails.monthlyRent || 0,
      ':tenantId': customerId,
      ':leaseStart': rentalDetails.leaseStartDate || new Date().toISOString(),
      ':leaseEnd': rentalDetails.leaseEndDate || null,
      ':emptyList': [],
      ':newRentalEntry': [newRentalEntry],
      ':updatedAt': new Date().toISOString(),
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#rented`,
    },
  }));

  // Auto-create Khata Book entry for rental brokerage
  if (rentalDetails.brokeragePaid > 0) {
    try {
      const { getProperty } = await import('./crmDynamodbService.js');
      const property = await getProperty(tenantId, propertyId);
      if (property) {
        await createBrokerageKhataEntry(tenantId, {
          propertyId,
          partyId: property.ownerId || 'UNASSIGNED',
          partyType: 'OWNER',
          partyName: property.ownerSnapshot?.name || property.ownerName || 'Owner',
          amount: Number(rentalDetails.brokeragePaid),
          transactionType: 'TO_TAKE',
          sourceRef: sourceRef || `property-rental-mark-rented:${propertyId}:${Date.now()}`,
          description: `Brokerage for renting property: ${property.title || ''}`,
        });
      }
    } catch (err) {
      console.error('Error creating rental brokerage khata entry in helper:', err);
    }
  }

  // Log contact activity for customer (tenant)
  try {
    const { logContactActivity, getProperty } = await import('./crmDynamodbService.js');
    const property = await getProperty(tenantId, propertyId);
    await logContactActivity(tenantId, {
      activityType: 'rental_started',
      subjectEntityType: 'customer',
      subjectEntityId: customerId,
      subjectEntityName: tenantName,
      title: `Rented Property: ${property?.title || 'Property'}`,
      description: `Started lease on property for INR ${Number(rentalDetails.monthlyRent).toLocaleString()}/month.`,
      performedBy: 'System',
      payload: { propertyId, propertyTitle: property?.title, rent: rentalDetails.monthlyRent, deposit: rentalDetails.securityDeposit, leaseStartDate: rentalDetails.leaseStartDate },
    });
  } catch (logErr) {
    console.error('Error logging rental_started contact activity:', logErr);
  }

  // Log contact activity for property owner (landlord)
  try {
    const { logContactActivity, getProperty, getOwner } = await import('./crmDynamodbService.js');
    const property = await getProperty(tenantId, propertyId);
    if (property?.ownerId) {
      const owner = await getOwner(tenantId, property.ownerId);
      await logContactActivity(tenantId, {
        activityType: 'property_rented',
        subjectEntityType: 'owner',
        subjectEntityId: property.ownerId,
        subjectEntityName: owner ? owner.name : 'Owner',
        title: `Property Rented Out: ${property.title || 'Property'}`,
        description: `Rented to ${tenantName} for INR ${Number(rentalDetails.monthlyRent).toLocaleString()}/month. Brokerage: INR ${Number(rentalDetails.brokeragePaid || 0).toLocaleString()}.`,
        performedBy: 'System',
        payload: { propertyId, propertyTitle: property.title, rent: rentalDetails.monthlyRent, tenantId: customerId, tenantName, brokeragePaid: rentalDetails.brokeragePaid },
      });
    }
  } catch (logErr) {
    console.error('Error logging property_rented contact activity:', logErr);
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
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, rentalInfo.currentRent = :null, rentalInfo.currentTenantId = :null, rentalInfo.leaseStartDate = :null, rentalInfo.leaseEndDate = :null, rentalHistory = :rentalHistory, updatedAt = :updatedAt, GSI2PK = :gsi2pk',
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
    createdBy: 'system',
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
      performedBy: 'System',
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
export async function createListingFromPurchase(tenantId, buyerId, propertyId, listingType, createdBy = 'System') {
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
    acquiredFromPurchaseId: propertyId,
    title: listingTitle,
    description: originalProperty?.description || buyer.notes || '',
    propertyType: originalProperty?.propertyType || 'apartment',
    bhk: originalProperty?.bhk ? Number(originalProperty.bhk) : 1,
    buildingName: originalProperty?.buildingName || '',
    flatNumber: originalProperty?.flatNumber || '',
    floor: originalProperty?.floor || '',
    furnishing: originalProperty?.furnishing || 'unfurnished',
    carpetArea: originalProperty?.carpetArea ? Number(originalProperty.carpetArea) : 0,
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

  return { property: newProperty, owner };
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
