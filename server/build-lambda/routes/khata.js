import express from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { scheduleKhataReminder, cancelKhataReminder } from '../notificationDynamodbService.js';

const router = express.Router();

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const KHATA_TABLE = process.env.KHATA_TABLE_NAME || 'cloudberry-real-estate-khata';

// ============== Khata Categories ==============

// Get all categories for tenant
router.get('/categories', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    
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
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create new category
router.post('/categories', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
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
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Delete category
router.delete('/categories/:categoryId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
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
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ============== Khata Entries ==============

// Get all entries with optional filters
router.get('/entries', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
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

    // Apply filters
    if (partyType) {
      entries = entries.filter(e => e.partyType === partyType);
    }
    if (partyId) {
      entries = entries.filter(e => e.partyId === partyId);
    }
    if (transactionType) {
      entries = entries.filter(e => e.transactionType === transactionType);
    }
    if (settlementStatus) {
      entries = entries.filter(e => e.settlementStatus === settlementStatus);
    }
    if (categoryId) {
      entries = entries.filter(e => {
        if (Array.isArray(e.lineItems) && e.lineItems.length > 0) {
          return e.lineItems.some(li => li && li.categoryId === categoryId);
        }
        return e.categoryId === categoryId;
      });
    }

    // Sort by creation date (newest first)
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(entries);
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Get single entry
router.get('/entries/:entryId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
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
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Create new entry
router.post('/entries', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
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
      reminderNote
    } = req.body;

    // Validation
    if (!propertyId || !partyType || !partyId || !partyName || !transactionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['OWNER', 'TENANT'].includes(partyType)) {
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

    res.status(201).json(entry);
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// Update entry
router.put('/entries/:entryId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
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
      reminderNote
    } = req.body;

    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {
      ':updatedAt': new Date().toISOString()
    };

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
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Settle entry
router.post('/entries/:entryId/settle', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
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
    res.status(500).json({ error: 'Failed to settle entry' });
  }
});

// Unsettle entry (reopen)
router.post('/entries/:entryId/unsettle', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
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
    res.status(500).json({ error: 'Failed to unsettle entry' });
  }
});

// Delete entry
router.delete('/entries/:entryId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
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
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// ============== Summary & Analytics ==============

// Get overall summary
router.get('/summary', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';

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
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get property-wise bifurcation
router.get('/bifurcation', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const { settlementStatus } = req.query;

    const params = {
      TableName: KHATA_TABLE,
      FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':sk': 'ENTRY#'
      }
    };

    const result = await ddbDocClient.send(new ScanCommand(params));
    let entries = result.Items || [];

    // Filter by settlement status if specified
    if (settlementStatus) {
      entries = entries.filter(e => e.settlementStatus === settlementStatus);
    }

    // Group by property
    const propertyMap = {};

    entries.forEach(entry => {
      if (!propertyMap[entry.propertyId]) {
        propertyMap[entry.propertyId] = {
          propertyId: entry.propertyId,
          propertyTitle: entry.property?.title || 'Unknown Property',
          area: entry.property?.area || '',
          flatNumber: entry.property?.flatNumber,
          toGive: 0,
          toTake: 0,
          netBalance: 0,
          entriesCount: 0
        };
      }

      const prop = propertyMap[entry.propertyId];
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

    // Sort by net balance (highest first)
    bifurcation.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

    res.json(bifurcation);
  } catch (error) {
    console.error('Error fetching bifurcation:', error);
    res.status(500).json({ error: 'Failed to fetch bifurcation' });
  }
});

export default router;
