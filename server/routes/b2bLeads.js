import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId, extractTenantIdOptional } from '../tenantMiddleware.js';
import { requireAdminOrManager, requireCrmMemberOrAbove } from '../middleware/requireRole.js';
import apiKeyAuth from '../middleware/apiKeyAuth.js';
import { strictRateLimit } from '../middleware/rateLimiter.js';
import { wrapAwsClient } from '../awsClientWrapper.js';
import { SERVICE_ACCOUNT_USER } from '../utils/serviceAccount.js';
import { collectAllPages } from '../utils/dynamoPagination.js';

const router = express.Router();

const client = wrapAwsClient(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' }),
  'DynamoDB',
  { tableName: process.env.B2B_LEADS_TABLE || 'cloudberry-real-estate-b2b-details' }
);
const docClient = DynamoDBDocumentClient.from(client);

const B2B_LEADS_TABLE = process.env.B2B_LEADS_TABLE || 'cloudberry-real-estate-b2b-details';

const sanitizeString = (value, maxLength) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!maxLength || maxLength <= 0) return trimmed;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const isValidEmail = (email) => {
  if (!email) return true;
  const value = String(email).trim();
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const isValidMobile = (mobile) => {
  if (!mobile) return false;
  const value = String(mobile).trim();
  return /^[0-9+\-\s]{7,20}$/.test(value);
};

const isValidDate = (date) => {
  if (!date) return true;
  const value = String(date).trim();
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
};

const isValidTime = (time) => {
  if (!time) return true;
  const value = String(time).trim();
  if (!value) return true;
  return /^\d{2}:\d{2}$/.test(value);
};

// Submit B2B lead (public — tenant from API key only)
router.post('/b2b-leads', strictRateLimit, apiKeyAuth, extractTenantIdOptional, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const {
      name: rawName,
      role: rawRole,
      mobile: rawMobile,
      email: rawEmail,
      availableDate: rawAvailableDate,
      availableTime: rawAvailableTime,
      pagePath: rawPagePath,
    } = req.body || {};

    const name = sanitizeString(rawName, 100);
    const role = sanitizeString(rawRole, 100);
    const mobile = sanitizeString(rawMobile, 25);
    const email = sanitizeString(rawEmail, 254);
    const availableDate = sanitizeString(rawAvailableDate, 20);
    const availableTime = sanitizeString(rawAvailableTime, 10);
    const pagePath = sanitizeString(rawPagePath, 200);

    const errors = [];

    if (!name) errors.push('Name is required');
    if (!role) errors.push('Role is required');
    if (!mobile) errors.push('Mobile is required');
    if (!pagePath) errors.push('pagePath is required');

    if (mobile && !isValidMobile(mobile)) {
      errors.push('Mobile number format is invalid');
    }

    if (email && !isValidEmail(email)) {
      errors.push('Email format is invalid');
    }

    if (!isValidDate(availableDate)) {
      errors.push('availableDate must be in YYYY-MM-DD format');
    }

    if (!isValidTime(availableTime)) {
      errors.push('availableTime must be in HH:MM format');
    }

    if (pagePath && (!pagePath.startsWith('/') || pagePath.length > 200)) {
      errors.push('pagePath must be a valid internal path');
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid input', details: errors });
    }

    const leadId = uuidv4();
    const timestamp = new Date().toISOString();

    const lead = {
      leadId,
      tenantId,
      name,
      role,
      mobile,
      email: email || undefined,
      availableDate: availableDate || undefined,
      availableTime: availableTime || undefined,
      pagePath,
      status: 'new',
      priority: 'medium',
      notes: '',
      submittedAt: timestamp,
      updatedAt: timestamp,
      history: [
        {
          timestamp,
          action: 'Lead Submitted',
          details: `New lead submitted from ${pagePath}`,
          updatedBy: SERVICE_ACCOUNT_USER
        }
      ]
    };

    await docClient.send(new PutCommand({
      TableName: B2B_LEADS_TABLE,
      Item: lead
    }));

    res.status(201).json({
      success: true,
      leadId,
      message: 'Lead submitted successfully'
    });
  } catch (error) {
    console.error('Error creating B2B lead:', error);
    res.status(500).json({ error: 'Failed to submit lead' });
  }
});

// Get all B2B leads (CRM - requires auth)
router.get('/b2b-leads', validateToken, extractTenantId, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const items = await collectAllPages(docClient, ScanCommand, {
      TableName: B2B_LEADS_TABLE,
      FilterExpression: 'tenantId = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId
      }
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching B2B leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single B2B lead (CRM - requires auth)
router.get('/b2b-leads/:leadId', validateToken, extractTenantId, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { leadId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const command = new GetCommand({
      TableName: B2B_LEADS_TABLE,
      Key: { leadId }
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (result.Item.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(result.Item);
  } catch (error) {
    console.error('Error fetching B2B lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Update B2B lead (CRM - requires auth)
router.put('/b2b-leads/:leadId', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { leadId } = req.params;
    const { status, priority, notes } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // First, get the existing lead to verify tenant ownership
    const getCommand = new GetCommand({
      TableName: B2B_LEADS_TABLE,
      Key: { leadId }
    });

    const existingLead = await docClient.send(getCommand);

    if (!existingLead.Item) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (existingLead.Item.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const timestamp = new Date().toISOString();
    const updates = [];
    const expressionAttributeValues = {
      ':updatedAt': timestamp
    };
    const expressionAttributeNames = {};

    // Build update expressions dynamically
    if (status !== undefined) {
      updates.push('#status = :status');
      expressionAttributeValues[':status'] = status;
      expressionAttributeNames['#status'] = 'status';
    }

    if (priority !== undefined) {
      updates.push('priority = :priority');
      expressionAttributeValues[':priority'] = priority;
    }

    if (notes !== undefined) {
      updates.push('#notes = :notes');
      expressionAttributeValues[':notes'] = notes;
      expressionAttributeNames['#notes'] = 'notes';
    }

    // Add history entry
    const historyEntry = {
      timestamp,
      action: 'Lead Updated',
      details: `Status: ${status || existingLead.Item.status}, Priority: ${priority || existingLead.Item.priority}`,
      updatedBy: req.user?.username || SERVICE_ACCOUNT_USER
    };

    const history = existingLead.Item.history || [];
    history.push(historyEntry);

    updates.push('history = :history');
    expressionAttributeValues[':history'] = history;

    const updateExpression = `SET ${updates.join(', ')}, updatedAt = :updatedAt`;

    const updateCommand = new UpdateCommand({
      TableName: B2B_LEADS_TABLE,
      Key: { leadId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ReturnValues: 'ALL_NEW'
    });

    const result = await docClient.send(updateCommand);

    res.json(result.Attributes);
  } catch (error) {
    console.error('Error updating B2B lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Add note to B2B lead (CRM - requires auth)
router.post('/b2b-leads/:leadId/notes', validateToken, extractTenantId, requireCrmMemberOrAbove, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { leadId } = req.params;
    const { note } = req.body;
    
    if (!tenantId || !note) {
      return res.status(400).json({ error: 'Tenant ID and note are required' });
    }

    // First, get the existing lead
    const getCommand = new GetCommand({
      TableName: B2B_LEADS_TABLE,
      Key: { leadId }
    });

    const existingLead = await docClient.send(getCommand);

    if (!existingLead.Item) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (existingLead.Item.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const timestamp = new Date().toISOString();
    
    // Add note to history
    const historyEntry = {
      timestamp,
      action: 'Note Added',
      details: note,
      updatedBy: req.user?.username || SERVICE_ACCOUNT_USER
    };

    const history = existingLead.Item.history || [];
    history.push(historyEntry);

    // Append note to existing notes
    const currentNotes = existingLead.Item.notes || '';
    const updatedNotes = currentNotes ? `${currentNotes}\n\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`;

    const updateCommand = new UpdateCommand({
      TableName: B2B_LEADS_TABLE,
      Key: { leadId },
      UpdateExpression: 'SET #notes = :notes, history = :history, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#notes': 'notes'
      },
      ExpressionAttributeValues: {
        ':notes': updatedNotes,
        ':history': history,
        ':updatedAt': timestamp
      },
      ReturnValues: 'ALL_NEW'
    });

    const result = await docClient.send(updateCommand);

    res.json(result.Attributes);
  } catch (error) {
    console.error('Error adding note to B2B lead:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

export default router;
