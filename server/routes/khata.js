import express from 'express';
import { z } from 'zod';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { scheduleKhataReminder, cancelKhataReminder } from '../notificationDynamodbService.js';
import validateToken from '../middleware/validateToken.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { extractTenantId } from '../tenantMiddleware.js';
import validateBody from '../middleware/validateBody.js';
import {
  createKhataEntrySchema,
  updateKhataEntrySchema,
  settleKhataEntrySchema,
} from '../validation/otherSchemas.js';

const router = express.Router();

// Apply auth middleware to all khata routes
router.use(validateToken);
router.use(extractTenantId);

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const KHATA_TABLE = process.env.KHATA_TABLE_NAME || 'cloudberry-real-estate-khata';

// ============== Khata Categories ==============

// Get all categories for tenant
// Search parties (owners, tenants, buyers, sellers) by name or phone
router.get('/parties/search', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { query, partyType } = req.query;
    const rawQuery = typeof query === 'string'
      ? query
      : Array.isArray(query)
        ? query.join(' ')
        : String(query || '');

    if (!rawQuery.trim()) {
      return res.json([]);
    }

    const validPartyTypes = ['OWNER', 'TENANT', 'BUYER', 'SELLER'];
    const normalizedPartyType = partyType ? String(partyType).toUpperCase() : null;

    if (normalizedPartyType && !validPartyTypes.includes(normalizedPartyType)) {
      return res.status(400).json({ error: 'Invalid party type' });
    }

    const searchQuery = rawQuery.toLowerCase().trim();
    const numericQuery = searchQuery.replace(/\D/g, '');

    const matchesSearch = (party) => {
      const name = String(party?.name || '').toLowerCase();
      const phone = String(party?.phone || '');
      const phoneDigits = phone.replace(/\D/g, '');

      return (
        name.includes(searchQuery) ||
        phone.toLowerCase().includes(searchQuery) ||
        (numericQuery.length > 0 && phoneDigits.includes(numericQuery))
      );
    };

    // Import CRM service
    const crmService = await import('../crmDynamodbService.js');

    let results = [];

    // Search based on party type
    if (!normalizedPartyType || normalizedPartyType === 'OWNER') {
      const [ownersResult, contacts] = await Promise.all([
        crmService.getOwners(tenantId),
        crmService.getContacts(tenantId).catch(() => []),
      ]);
      const owners = ownersResult.owners || [];

      const matchingOwners = owners
        .filter(matchesSearch)
        .map((owner) => ({
          id: owner.ownerId,
          name: owner.name,
          phone: owner.phone,
          type: 'OWNER',
        }));

      const matchingOwnerContacts = (contacts || [])
        .filter((contact) => contact?.roles?.owner)
        .filter(matchesSearch)
        .map((contact) => ({
          id: contact.contactId,
          name: contact.name,
          phone: contact.phone,
          type: 'OWNER',
        }));

      results.push(...matchingOwners, ...matchingOwnerContacts);
    }

    if (!normalizedPartyType || normalizedPartyType === 'TENANT') {
      const [tenantsResult, contacts] = await Promise.all([
        crmService.getCustomers(tenantId),
        crmService.getContacts(tenantId).catch(() => []),
      ]);
      const tenants = tenantsResult.customers || [];

      const matchingTenants = tenants
        .filter(matchesSearch)
        .map((tenant) => ({
          id: tenant.customerId,
          name: tenant.name,
          phone: tenant.phone,
          type: 'TENANT',
        }));

      const matchingTenantContacts = (contacts || [])
        .filter((contact) => contact?.roles?.tenant)
        .filter(matchesSearch)
        .map((contact) => ({
          id: contact.contactId,
          name: contact.name,
          phone: contact.phone,
          type: 'TENANT',
        }));

      results.push(...matchingTenants, ...matchingTenantContacts);
    }

    if (!normalizedPartyType || normalizedPartyType === 'BUYER') {
      const buyersResult = await crmService.getBuyers(tenantId);
      const buyers = buyersResult.buyers || [];
      const matchingBuyers = buyers
        .filter(matchesSearch)
        .map((buyer) => ({
          id: buyer.buyerId,
          name: buyer.name,
          phone: buyer.phone,
          type: 'BUYER',
        }));
      results.push(...matchingBuyers);
    }

    // Seller is represented by owners with for-sale/sold properties
    if (!normalizedPartyType || normalizedPartyType === 'SELLER') {
      const [ownersResult, propertiesResult, contacts] = await Promise.all([
        crmService.getOwners(tenantId),
        crmService.getProperties(tenantId),
        crmService.getContacts(tenantId).catch(() => []),
      ]);
      const owners = ownersResult.owners || [];
      const properties = propertiesResult.properties || [];

      const sellerOwnerIds = new Set(
        (properties || [])
          .filter((property) => ['for-sale', 'sold'].includes(property?.status))
          .flatMap((property) => [property?.ownerId, property?.ownerContactId])
          .filter(Boolean)
      );

      const matchingSellers = owners
        .filter((owner) => sellerOwnerIds.has(owner.ownerId))
        .filter(matchesSearch)
        .map((sellerOwner) => ({
          id: sellerOwner.ownerId,
          name: sellerOwner.name,
          phone: sellerOwner.phone,
          type: 'SELLER',
        }));

      const matchingSellerContacts = (contacts || [])
        .filter((contact) => contact?.roles?.seller || contact?.roles?.owner)
        .filter((contact) => sellerOwnerIds.has(contact.contactId))
        .filter(matchesSearch)
        .map((contact) => ({
          id: contact.contactId,
          name: contact.name,
          phone: contact.phone,
          type: 'SELLER',
        }));

      results.push(...matchingSellers, ...matchingSellerContacts);
    }

    // De-duplicate and return sorted
    const uniqueResults = Array.from(
      new Map(results.map((party) => [`${party.type}:${party.id}`, party])).values()
    ).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    res.json(uniqueResults);
  } catch (error) {
    console.error('Error searching parties:', error);
    return res.status(500).json({ error: 'Failed to search parties' });
  }
});

// Get properties associated with a party
router.get('/parties/:partyType/:partyId/properties', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { partyType, partyId } = req.params;

    const normalizedPartyType = String(partyType || '').toUpperCase();
    if (!['OWNER', 'TENANT', 'BUYER', 'SELLER'].includes(normalizedPartyType)) {
      return res.status(400).json({ error: 'Invalid party type' });
    }

    const crmService = await import('../crmDynamodbService.js');
    let properties = [];

    if (normalizedPartyType === 'OWNER') {
      const [ownerProperties, allPropertiesResult] = await Promise.all([
        crmService.getPropertiesByOwner(tenantId, partyId).catch(() => []),
        crmService.getProperties(tenantId),
      ]);
      const allProperties = allPropertiesResult.properties || [];

      const contactOwnedProperties = (allProperties || []).filter(
        (property) => property?.ownerContactId === partyId
      );

      properties = Array.from(
        new Map(
          [...(ownerProperties || []), ...contactOwnedProperties]
            .filter((property) => property?.propertyId)
            .map((property) => [property.propertyId, property])
        ).values()
      );
    } else if (normalizedPartyType === 'TENANT') {
      const allPropertiesResult = await crmService.getProperties(tenantId);
      const allProperties = allPropertiesResult.properties || [];
      properties = (allProperties || []).filter(
        (property) =>
          property?.tenantCustomerId === partyId ||
          property?.tenantContactId === partyId ||
          property?.rentalInfo?.currentTenantId === partyId
      );
    } else if (normalizedPartyType === 'BUYER') {
      const [buyer, buyersResult, allPropertiesResult] = await Promise.all([
        crmService.getBuyer(tenantId, partyId).catch(() => null),
        crmService.getBuyers(tenantId).catch(() => ({ buyers: [] })),
        crmService.getProperties(tenantId),
      ]);
      const buyers = buyersResult.buyers || [];
      const allProperties = allPropertiesResult.properties || [];

      const buyerFromList = (buyers || []).find((candidate) => candidate?.buyerId === partyId) || null;

      const purchasedPropertyIds = new Set(
        Array.isArray(buyer?.purchases || buyerFromList?.purchases)
          ? (buyer?.purchases || buyerFromList?.purchases)
              .map((purchase) => purchase?.propertyId)
              .filter(Boolean)
          : []
      );

      if (purchasedPropertyIds.size > 0) {
        properties = (allProperties || []).filter((property) =>
          purchasedPropertyIds.has(property?.propertyId)
        );
      } else {
        const soldToBuyer = (allProperties || []).filter(
          (property) => property?.saleInfo?.soldToBuyerId === partyId
        );

        if (soldToBuyer.length > 0) {
          properties = soldToBuyer;
        } else {
          // Fallback to sale inventory when buyer has no linked purchases yet
          properties = (allProperties || []).filter(
            (property) => property?.status === 'for-sale' || property?.listingStatus === 'active'
          );
        }
      }
    } else if (normalizedPartyType === 'SELLER') {
      // Seller maps to owner/contact; prefer sale-related properties, fallback to all linked properties
      const [ownerProperties, allPropertiesResult] = await Promise.all([
        crmService.getPropertiesByOwner(tenantId, partyId).catch(() => []),
        crmService.getProperties(tenantId),
      ]);
      const allProperties = allPropertiesResult.properties || [];

      const contactOwnerProperties = (allProperties || []).filter(
        (property) => property?.ownerContactId === partyId
      );

      const linkedProperties = Array.from(
        new Map(
          [...(ownerProperties || []), ...contactOwnerProperties]
            .filter((property) => property?.propertyId)
            .map((property) => [property.propertyId, property])
        ).values()
      );

      const saleRelated = linkedProperties.filter((property) =>
        ['for-sale', 'sold'].includes(property?.status)
      );
      properties = saleRelated.length > 0 ? saleRelated : linkedProperties;
    }

    res.json(properties || []);
  } catch (error) {
    console.error('Error fetching party properties:', error);
    return res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const params = {
      TableName: KHATA_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':sk': 'CATEGORY#'
      }
    };

    const result = await ddbDocClient.send(new QueryCommand(params));
    
    res.json(result.Items || []);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create new category
router.post('/categories', validateBody(z.object({ name: z.string().min(1).max(200) })), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const categoryId = uuidv4();
    const now = new Date().toISOString();

    const category = {
      PK: `TENANT#${tenantId}`,
      SK: `CATEGORY#${categoryId}`,
      categoryId,
      tenantId,
      name: name.trim(),
      isDefault: false,
      createdAt: now,
      updatedAt: now
    };

    await ddbDocClient.send(new PutCommand({
      TableName: KHATA_TABLE,
      Item: category
    }));

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({ error: 'Failed to create category' });
  }
});

// Delete category
router.delete('/categories/:categoryId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { categoryId } = req.params;

    await ddbDocClient.send(new DeleteCommand({
      TableName: KHATA_TABLE,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `CATEGORY#${categoryId}`
      }
    }));

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ============== Khata Entries ==============

// Get all entries with optional filters
router.get('/entries', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { propertyId, partyType, partyId, transactionType, settlementStatus, categoryId } = req.query;

    let params;

    // Query by property if specified
    if (propertyId) {
      params = {
        TableName: KHATA_TABLE,
        IndexName: 'property-settlement-index',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}#PROPERTY#${propertyId}`
        }
      };
    } else {
      // Scan all entries for tenant
      params = {
        TableName: KHATA_TABLE,
        FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':sk': 'ENTRY#'
        }
      };
    }

    const result = await ddbDocClient.send(propertyId ? new QueryCommand(params) : new ScanCommand(params));
    let entries = result.Items || [];

    // Populate property details for each entry
    const crmService = await import('../crmDynamodbService.js');
    const enrichedEntries = await Promise.all(entries.map(async (entry) => {
      if (entry.propertyId) {
        try {
          const property = await crmService.getProperty(tenantId, entry.propertyId);
          if (property) {
            entry.property = {
              propertyId: property.propertyId,
              title: property.title,
              area: property.area,
              flatNumber: property.flatNumber,
            };
          }
        } catch (error) {
          console.error(`Error fetching property ${entry.propertyId}:`, error);
        }
      }
      return entry;
    }));

    // Apply filters
    let filteredEntries = enrichedEntries;
    if (partyType) {
      filteredEntries = filteredEntries.filter(e => e.partyType === partyType);
    }
    if (partyId) {
      filteredEntries = filteredEntries.filter(e => e.partyId === partyId);
    }
    if (transactionType) {
      filteredEntries = filteredEntries.filter(e => e.transactionType === transactionType);
    }
    if (settlementStatus) {
      filteredEntries = filteredEntries.filter(e => e.settlementStatus === settlementStatus);
    }
    if (categoryId) {
      filteredEntries = filteredEntries.filter(e => {
        if (Array.isArray(e.lineItems) && e.lineItems.length > 0) {
          return e.lineItems.some(li => li && li.categoryId === categoryId);
        }
        return e.categoryId === categoryId;
      });
    }

    // Sort by creation date (newest first)
    filteredEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(filteredEntries);
  } catch (error) {
    console.error('Error fetching entries:', error);
    return res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Get single entry
router.get('/entries/:entryId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { entryId } = req.params;

    const result = await ddbDocClient.send(new GetCommand({
      TableName: KHATA_TABLE,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `ENTRY#${entryId}`
      }
    }));

    if (!result.Item) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(result.Item);
  } catch (error) {
    console.error('Error fetching entry:', error);
    return res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Create new entry
router.post('/entries', validateBody(createKhataEntrySchema), async (req, res) => {
  try {
    const { precheckCredits, chargeCreditsForAction, handleCreditError } = await import('../middleware/meterCredits.js');
    const tenantId = req.tenantId;
    await precheckCredits(tenantId, 'khata_entry');
    const username = req.user?.username || 'system';
    const {
      propertyId,
      partyType,
      partyId,
      partyName,
      transactionType,
      amount,
      categoryId,
      categoryName,
      lineItems,
      description,
      reminderAt,
      reminderNote,
      sourceRef
    } = req.body;

    // Validation
    if (!propertyId || !partyType || !partyId || !partyName || !transactionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['OWNER', 'TENANT', 'BUYER', 'SELLER'].includes(partyType)) {
      return res.status(400).json({ error: 'Invalid party type' });
    }

    if (!['TO_GIVE', 'TO_TAKE'].includes(transactionType)) {
      return res.status(400).json({ error: 'Invalid transaction type' });
    }

    let normalizedLineItems = null;
    if (Array.isArray(lineItems) && lineItems.length > 0) {
      normalizedLineItems = lineItems
        .filter(li => li && li.categoryId && Number(li.amount) > 0)
        .map(li => ({
          categoryId: String(li.categoryId),
          categoryName: String(li.categoryName || ''),
          amount: Number(li.amount)
        }));

      if (normalizedLineItems.length === 0) {
        return res.status(400).json({ error: 'At least one valid line item is required' });
      }
    } else {
      if (!categoryId || !categoryName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (amount === undefined || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
      }
    }

    const computedAmount = normalizedLineItems
      ? normalizedLineItems.reduce((sum, li) => sum + Number(li.amount || 0), 0)
      : Number(amount);

    if (computedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Check for duplicate sourceRef to ensure idempotency
    if (sourceRef) {
      try {
        const checkResult = await ddbDocClient.send(new ScanCommand({
          TableName: KHATA_TABLE,
          FilterExpression: 'PK = :pk AND sourceRef = :sourceRef',
          ExpressionAttributeValues: {
            ':pk': `TENANT#${tenantId}`,
            ':sourceRef': sourceRef,
          },
        }));
        if (checkResult.Items && checkResult.Items.length > 0) {
          return res.json(checkResult.Items[0]);
        }
      } catch (checkError) {
        console.error('Error checking duplicate entry:', checkError);
      }
    }

    const primaryCategoryId = normalizedLineItems ? normalizedLineItems[0].categoryId : categoryId;
    const primaryCategoryName = normalizedLineItems ? (normalizedLineItems[0].categoryName || categoryName) : categoryName;

    const entryId = uuidv4();
    const now = new Date().toISOString();

    const entry = {
      PK: `TENANT#${tenantId}`,
      SK: `ENTRY#${entryId}`,
      GSI1PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      GSI1SK: `PENDING`,
      GSI2PK: `TENANT#${tenantId}`,
      GSI2SK: `PENDING#${now}`,
      entryId,
      tenantId,
      propertyId,
      partyType,
      partyId,
      partyName,
      transactionType,
      amount: Number(computedAmount),
      categoryId: primaryCategoryId,
      categoryName: primaryCategoryName,
      ...(normalizedLineItems ? { lineItems: normalizedLineItems } : {}),
      description: description || '',
      settlementStatus: 'PENDING',
      reminderAt: reminderAt || null,
      reminderNote: reminderNote || null,
      sourceRef: sourceRef || null,
      createdAt: now,
      createdBy: username,
      updatedAt: now
    };

    await ddbDocClient.send(new PutCommand({
      TableName: KHATA_TABLE,
      Item: entry
    }));

    // Schedule reminder if reminderAt is set
    if (reminderAt) {
      try {
        await scheduleKhataReminder(tenantId, entry);
      } catch (reminderError) {
        console.error('Error scheduling khata reminder:', reminderError);
        // Don't fail the entry creation if reminder scheduling fails
      }
    }

    const creditResult = await chargeCreditsForAction(tenantId, 'khata_entry', { recordId: entryId });
    res.status(201).json({ ...entry, creditsRemaining: creditResult.balance });
  } catch (error) {
    const { handleCreditError } = await import('../middleware/meterCredits.js');
    if (handleCreditError(error, res)) return;
    console.error('Error creating entry:', error);
    return res.status(500).json({ error: 'Failed to create entry' });
  }
});

// Update entry
router.put('/entries/:entryId', validateBody(updateKhataEntrySchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { entryId } = req.params;
    const {
      propertyId,
      partyType,
      partyId,
      partyName,
      transactionType,
      amount,
      categoryId,
      categoryName,
      lineItems,
      description,
      reminderAt,
      reminderNote,
      sourceRef
    } = req.body;

    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {
      ':updatedAt': new Date().toISOString()
    };

    if (sourceRef !== undefined) {
      updateExpressions.push('sourceRef = :sourceRef');
      expressionAttributeValues[':sourceRef'] = sourceRef || null;
    }

    if (propertyId !== undefined) {
      updateExpressions.push('#propertyId = :propertyId');
      expressionAttributeNames['#propertyId'] = 'propertyId';
      expressionAttributeValues[':propertyId'] = propertyId;
      
      updateExpressions.push('GSI1PK = :gsi1pk');
      expressionAttributeValues[':gsi1pk'] = `TENANT#${tenantId}#PROPERTY#${propertyId}`;
    }

    if (partyType !== undefined) {
      updateExpressions.push('partyType = :partyType');
      expressionAttributeValues[':partyType'] = partyType;
    }

    if (partyId !== undefined) {
      updateExpressions.push('partyId = :partyId');
      expressionAttributeValues[':partyId'] = partyId;
    }

    if (partyName !== undefined) {
      updateExpressions.push('partyName = :partyName');
      expressionAttributeValues[':partyName'] = partyName;
    }

    if (transactionType !== undefined) {
      updateExpressions.push('transactionType = :transactionType');
      expressionAttributeValues[':transactionType'] = transactionType;
    }

    if (Array.isArray(lineItems)) {
      const normalizedLineItems = lineItems
        .filter(li => li && li.categoryId && Number(li.amount) > 0)
        .map(li => ({
          categoryId: String(li.categoryId),
          categoryName: String(li.categoryName || ''),
          amount: Number(li.amount)
        }));

      if (normalizedLineItems.length === 0) {
        return res.status(400).json({ error: 'At least one valid line item is required' });
      }

      const computedAmount = normalizedLineItems.reduce((sum, li) => sum + Number(li.amount || 0), 0);
      if (computedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
      }

      updateExpressions.push('lineItems = :lineItems');
      expressionAttributeValues[':lineItems'] = normalizedLineItems;

      updateExpressions.push('amount = :amount');
      expressionAttributeValues[':amount'] = Number(computedAmount);

      updateExpressions.push('categoryId = :categoryId');
      expressionAttributeValues[':categoryId'] = normalizedLineItems[0].categoryId;

      updateExpressions.push('categoryName = :categoryName');
      expressionAttributeValues[':categoryName'] = normalizedLineItems[0].categoryName || '';
    } else if (amount !== undefined) {
      updateExpressions.push('amount = :amount');
      expressionAttributeValues[':amount'] = Number(amount);
    }

    if (!Array.isArray(lineItems)) {
      if (categoryId !== undefined) {
        updateExpressions.push('categoryId = :categoryId');
        expressionAttributeValues[':categoryId'] = categoryId;
      }

      if (categoryName !== undefined) {
        updateExpressions.push('categoryName = :categoryName');
        expressionAttributeValues[':categoryName'] = categoryName;
      }
    }

    if (description !== undefined) {
      updateExpressions.push('description = :description');
      expressionAttributeValues[':description'] = description;
    }

    // Handle reminder fields
    if (reminderAt !== undefined) {
      updateExpressions.push('reminderAt = :reminderAt');
      expressionAttributeValues[':reminderAt'] = reminderAt || null;
    }

    if (reminderNote !== undefined) {
      updateExpressions.push('reminderNote = :reminderNote');
      expressionAttributeValues[':reminderNote'] = reminderNote || null;
    }

    updateExpressions.push('updatedAt = :updatedAt');

    const params = {
      TableName: KHATA_TABLE,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `ENTRY#${entryId}`
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    const result = await ddbDocClient.send(new UpdateCommand(params));

    // Handle reminder scheduling
    if (reminderAt !== undefined) {
      try {
        if (reminderAt) {
          // Schedule new reminder
          await scheduleKhataReminder(tenantId, {
            ...result.Attributes,
            entryId,
          });
        } else {
          // Cancel existing reminder if reminderAt is cleared
          await cancelKhataReminder(tenantId, entryId);
        }
      } catch (reminderError) {
        console.error('Error updating khata reminder:', reminderError);
        // Don't fail the entry update if reminder scheduling fails
      }
    }

    res.json(result.Attributes);
  } catch (error) {
    console.error('Error updating entry:', error);
    return res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Settle entry
router.post('/entries/:entryId/settle', validateBody(settleKhataEntrySchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const username = req.user?.username || 'system';
    const { entryId } = req.params;
    const { settlementNotes } = req.body;

    const now = new Date().toISOString();

    const params = {
      TableName: KHATA_TABLE,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `ENTRY#${entryId}`
      },
      UpdateExpression: 'SET settlementStatus = :settled, settledAt = :now, settledBy = :user, settlementNotes = :notes, updatedAt = :now, GSI1SK = :gsi1sk, GSI2SK = :gsi2sk',
      ExpressionAttributeValues: {
        ':settled': 'SETTLED',
        ':now': now,
        ':user': username,
        ':notes': settlementNotes || '',
        ':gsi1sk': 'SETTLED',
        ':gsi2sk': `SETTLED#${now}`
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await ddbDocClient.send(new UpdateCommand(params));

    // Cancel any pending reminder when entry is settled
    try {
      await cancelKhataReminder(tenantId, entryId);
    } catch (reminderError) {
      console.error('Error cancelling khata reminder on settle:', reminderError);
    }

    res.json(result.Attributes);
  } catch (error) {
    console.error('Error settling entry:', error);
    return res.status(500).json({ error: 'Failed to settle entry' });
  }
});

// Unsettle entry (reopen)
router.post('/entries/:entryId/unsettle', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { entryId } = req.params;
    const now = new Date().toISOString();

    const params = {
      TableName: KHATA_TABLE,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `ENTRY#${entryId}`
      },
      UpdateExpression: 'SET settlementStatus = :pending, updatedAt = :now, GSI1SK = :gsi1sk, GSI2SK = :gsi2sk REMOVE settledAt, settledBy, settlementNotes',
      ExpressionAttributeValues: {
        ':pending': 'PENDING',
        ':now': now,
        ':gsi1sk': 'PENDING',
        ':gsi2sk': `PENDING#${now}`
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await ddbDocClient.send(new UpdateCommand(params));

    res.json(result.Attributes);
  } catch (error) {
    console.error('Error unsettling entry:', error);
    return res.status(500).json({ error: 'Failed to unsettle entry' });
  }
});

// Delete entry
router.delete('/entries/:entryId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { entryId } = req.params;

    await ddbDocClient.send(new DeleteCommand({
      TableName: KHATA_TABLE,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `ENTRY#${entryId}`
      }
    }));

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting entry:', error);
    return res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// ============== Summary & Analytics ==============

// Get overall summary
router.get('/summary', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const params = {
      TableName: KHATA_TABLE,
      FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':sk': 'ENTRY#'
      }
    };

    const result = await ddbDocClient.send(new ScanCommand(params));
    const entries = result.Items || [];

    const summary = {
      totalToGive: 0,
      totalToTake: 0,
      netBalance: 0,
      pendingEntries: 0,
      settledEntries: 0
    };

    entries.forEach(entry => {
      if (entry.settlementStatus === 'PENDING') {
        summary.pendingEntries++;
        if (entry.transactionType === 'TO_GIVE') {
          summary.totalToGive += entry.amount;
        } else {
          summary.totalToTake += entry.amount;
        }
      } else {
        summary.settledEntries++;
      }
    });

    summary.netBalance = summary.totalToTake - summary.totalToGive;

    res.json(summary);
  } catch (error) {
    console.error('Error fetching summary:', error);
    return res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ============== Helper: Fetch all khata entries for tenant ==============
async function fetchAllKhataEntries(tenantId) {
  const params = {
    TableName: KHATA_TABLE,
    FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}`,
      ':sk': 'ENTRY#'
    }
  };
  const result = await ddbDocClient.send(new ScanCommand(params));
  return result.Items || [];
}

// ============== Helper: Enrich entries with property data ==============
async function enrichEntriesWithPropertyData(tenantId, entries) {
  const crmService = await import('../crmDynamodbService.js');

  // Collect unique propertyIds to avoid redundant lookups
  const uniquePropertyIds = [...new Set(entries.map(e => e.propertyId).filter(Boolean))];

  // Fetch all properties in parallel (one call per unique property)
  const propertyCache = {};
  await Promise.all(uniquePropertyIds.map(async (propertyId) => {
    try {
      const property = await crmService.getProperty(tenantId, propertyId);
      if (property) {
        propertyCache[propertyId] = {
          propertyId: property.propertyId,
          title: property.title,
          area: property.area,
          flatNumber: property.flatNumber,
        };
      }
    } catch (error) {
      console.error(`Error fetching property ${propertyId}:`, error);
    }
  }));

  return propertyCache;
}

// Get property-wise bifurcation
router.get('/bifurcation', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { settlementStatus } = req.query;

    let entries = await fetchAllKhataEntries(tenantId);

    // Filter by settlement status if specified
    if (settlementStatus) {
      entries = entries.filter(e => e.settlementStatus === settlementStatus);
    }

    if (entries.length === 0) {
      return res.json([]);
    }

    // Enrich with property data (batched, deduplicated)
    const propertyCache = await enrichEntriesWithPropertyData(tenantId, entries);

    // Group by property
    const propertyMap = {};

    entries.forEach(entry => {
      const pid = entry.propertyId;
      if (!propertyMap[pid]) {
        const propData = propertyCache[pid];
        propertyMap[pid] = {
          propertyId: pid,
          propertyTitle: propData?.title || 'Unknown Property',
          area: propData?.area || '',
          flatNumber: propData?.flatNumber || null,
          toGive: 0,
          toTake: 0,
          netBalance: 0,
          entriesCount: 0
        };
      }

      const prop = propertyMap[pid];
      prop.entriesCount++;

      if (entry.transactionType === 'TO_GIVE') {
        prop.toGive += entry.amount;
      } else {
        prop.toTake += entry.amount;
      }
    });

    // Calculate net balance for each property
    const bifurcation = Object.values(propertyMap).map(prop => ({
      ...prop,
      netBalance: prop.toTake - prop.toGive
    }));

    // Sort by absolute net balance (highest first)
    bifurcation.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

    res.json(bifurcation);
  } catch (error) {
    console.error('Error fetching bifurcation:', error);
    return res.status(500).json({ error: 'Failed to fetch bifurcation' });
  }
});

// ============== Settlement Intelligence ==============

// Consolidated settlement endpoint: /settlement/:type (aging, trends, history)
router.get('/settlement/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const tenantId = req.tenantId;
    const entries = await fetchAllKhataEntries(tenantId);

    if (type === 'aging') {
      const now = new Date();
      const pendingEntries = entries.filter(e => e.settlementStatus === 'PENDING');

      if (pendingEntries.length === 0) {
        return res.json({
          buckets: [
            { bucket: '0-30', label: '0-30 days', count: 0, amount: 0, entries: [] },
            { bucket: '31-60', label: '31-60 days', count: 0, amount: 0, entries: [] },
            { bucket: '61-90', label: '61-90 days', count: 0, amount: 0, entries: [] },
            { bucket: '90+', label: '90+ days', count: 0, amount: 0, entries: [] },
          ],
          totalPending: 0,
          totalAmount: 0,
          avgDaysPending: 0,
          oldestEntryDays: 0,
        });
      }

      const propertyCache = await enrichEntriesWithPropertyData(tenantId, pendingEntries);
      const buckets = {
        '0-30':  { bucket: '0-30',  label: '0-30 days',  count: 0, amount: 0, entries: [] },
        '31-60': { bucket: '31-60', label: '31-60 days', count: 0, amount: 0, entries: [] },
        '61-90': { bucket: '61-90', label: '61-90 days', count: 0, amount: 0, entries: [] },
        '90+':   { bucket: '90+',   label: '90+ days',   count: 0, amount: 0, entries: [] },
      };

      let totalDaysPending = 0;
      let oldestDays = 0;

      pendingEntries.forEach(entry => {
        const createdAt = new Date(entry.createdAt);
        const daysPending = Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));

        totalDaysPending += daysPending;
        if (daysPending > oldestDays) oldestDays = daysPending;

        let bucketKey;
        if (daysPending <= 30) bucketKey = '0-30';
        else if (daysPending <= 60) bucketKey = '31-60';
        else if (daysPending <= 90) bucketKey = '61-90';
        else bucketKey = '90+';

        const propData = propertyCache[entry.propertyId];
        const enrichedEntry = {
          entryId: entry.entryId,
          propertyId: entry.propertyId,
          propertyTitle: propData?.title || 'Unknown Property',
          partyName: entry.partyName,
          partyType: entry.partyType,
          transactionType: entry.transactionType,
          amount: entry.amount,
          categoryName: entry.categoryName,
          daysPending,
          createdAt: entry.createdAt,
          reminderAt: entry.reminderAt || null,
        };

        buckets[bucketKey].count++;
        buckets[bucketKey].amount += entry.amount;
        buckets[bucketKey].entries.push(enrichedEntry);
      });

      Object.values(buckets).forEach(b => {
        b.entries.sort((a, b) => b.daysPending - a.daysPending);
      });

      return res.json({
        buckets: Object.values(buckets),
        totalPending: pendingEntries.length,
        totalAmount: pendingEntries.reduce((sum, e) => sum + e.amount, 0),
        avgDaysPending: Math.round(totalDaysPending / pendingEntries.length),
        oldestEntryDays: oldestDays,
      });
    }

    if (type === 'trends') {
      const settledEntries = entries.filter(e => e.settlementStatus === 'SETTLED' && e.settledAt);
      const pendingEntries = entries.filter(e => e.settlementStatus === 'PENDING');

      const monthlyMap = {};

      settledEntries.forEach(entry => {
        const settledDate = new Date(entry.settledAt);
        const monthKey = `${settledDate.getFullYear()}-${String(settledDate.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
            settledCount: 0,
            settledAmount: 0,
            totalDaysToSettle: 0,
          };
        }

        const m = monthlyMap[monthKey];
        m.settledCount++;
        m.settledAmount += entry.amount;

        if (entry.createdAt) {
          const created = new Date(entry.createdAt);
          const settled = new Date(entry.settledAt);
          const daysToSettle = Math.max(0, Math.floor((settled - created) / (1000 * 60 * 60 * 24)));
          m.totalDaysToSettle += daysToSettle;
        }
      });

      const trends = Object.values(monthlyMap).map(m => ({
        month: m.month,
        settledCount: m.settledCount,
        settledAmount: m.settledAmount,
        avgDaysToSettle: m.settledCount > 0 ? Math.round(m.totalDaysToSettle / m.settledCount) : 0,
      }));

      trends.sort((a, b) => b.month.localeCompare(a.month));
      const last12 = trends.slice(0, 12).reverse();

      const totalDaysAll = settledEntries.reduce((sum, e) => {
        if (e.createdAt && e.settledAt) {
          return sum + Math.max(0, Math.floor((new Date(e.settledAt) - new Date(e.createdAt)) / (1000 * 60 * 60 * 24)));
        }
        return sum;
      }, 0);
      const overallAvgDays = settledEntries.length > 0 ? Math.round(totalDaysAll / settledEntries.length) : 0;

      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

      const currentMonth = monthlyMap[currentMonthKey] || { settledCount: 0, settledAmount: 0 };
      const previousMonth = monthlyMap[lastMonthKey] || { settledCount: 0, settledAmount: 0 };

      const totalEntries = entries.length;
      const settlementRate = totalEntries > 0 ? Math.round((settledEntries.length / totalEntries) * 100) : 0;

      return res.json({
        trends: last12,
        overallAvgDaysToSettle: overallAvgDays,
        settlementRate,
        totalSettled: settledEntries.length,
        totalPending: pendingEntries.length,
        currentMonth: {
          month: currentMonthKey,
          settledCount: currentMonth.settledCount,
          settledAmount: currentMonth.settledAmount,
        },
        previousMonth: {
          month: lastMonthKey,
          settledCount: previousMonth.settledCount,
          settledAmount: previousMonth.settledAmount || 0,
        },
      });
    }

    if (type === 'history') {
      const { limit: queryLimit } = req.query;
      const resultLimit = Math.min(parseInt(queryLimit) || 20, 50);

      const settledEntries = entries.filter(e => e.settlementStatus === 'SETTLED' && e.settledAt);

      if (settledEntries.length === 0) {
        return res.json({ history: [], total: 0 });
      }

      const propertyCache = await enrichEntriesWithPropertyData(tenantId, settledEntries);
      settledEntries.sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt));

      const limited = settledEntries.slice(0, resultLimit);

      const history = limited.map(entry => {
        const propData = propertyCache[entry.propertyId];
        const daysToSettle = (entry.createdAt && entry.settledAt)
          ? Math.max(0, Math.floor((new Date(entry.settledAt) - new Date(entry.createdAt)) / (1000 * 60 * 60 * 24)))
          : 0;

        return {
          entryId: entry.entryId,
          propertyId: entry.propertyId,
          propertyTitle: propData?.title || 'Unknown Property',
          partyName: entry.partyName,
          partyType: entry.partyType,
          transactionType: entry.transactionType,
          amount: entry.amount,
          categoryName: entry.categoryName,
          createdAt: entry.createdAt,
          settledAt: entry.settledAt,
          settledBy: entry.settledBy || 'Unknown',
          settlementNotes: entry.settlementNotes || '',
          daysToSettle,
        };
      });

      return res.json({
        history,
        total: settledEntries.length,
      });
    }

    return res.status(400).json({ error: 'Invalid type. Use: aging, trends, or history' });
  } catch (error) {
    console.error('Error fetching settlement data:', error);
    return res.status(500).json({ error: 'Failed to fetch settlement data' });
  }
});

export default router;
