// Knowledge Management Routes

import express from 'express';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as db from '../services/dynamodbService.js';
import { logger } from '../utils/logger.js';
import { KNOWLEDGE_CATEGORIES, DOCUMENT_STATUS } from '../config/constants.js';

const router = express.Router();

const REGION = process.env.AWS_REGION || 'ap-south-1';
const KNOWLEDGE_BUCKET = process.env.AI_CALLING_KNOWLEDGE_BUCKET;

const s3Client = new S3Client({ region: REGION });

// Middleware to extract tenant ID
const extractTenantId = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }
  req.tenantId = tenantId;
  next();
};

// Get upload URL for knowledge document
router.post('/upload-url', extractTenantId, async (req, res) => {
  try {
    const { fileName, fileType, category } = req.body;
    
    if (!fileName || !category) {
      return res.status(400).json({ error: 'fileName and category are required' });
    }
    
    if (!Object.values(KNOWLEDGE_CATEGORIES).includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category',
        validCategories: Object.values(KNOWLEDGE_CATEGORIES),
      });
    }
    
    // Generate S3 key with tenant isolation
    const s3Key = `${req.tenantId}/${category}/${Date.now()}-${fileName}`;
    
    // Create document record first
    const document = await db.createKnowledgeDocument(req.tenantId, {
      name: fileName,
      category,
      s3Key,
      fileType: fileType || 'application/octet-stream',
      fileSize: 0, // Will be updated after upload
      uploadedBy: req.headers['x-user'] || 'system',
    });
    
    // Generate presigned URL
    const command = new PutObjectCommand({
      Bucket: KNOWLEDGE_BUCKET,
      Key: s3Key,
      ContentType: fileType || 'application/octet-stream',
      Metadata: {
        tenant_id: req.tenantId,
        category,
        document_id: document.documentId,
      },
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    res.json({
      documentId: document.documentId,
      uploadUrl,
      s3Key,
    });
  } catch (error) {
    logger.error('Get upload URL error', error);
    res.status(500).json({ error: error.message || 'Failed to get upload URL' });
  }
});

// Confirm document upload (triggers indexing)
router.post('/:documentId/confirm', extractTenantId, async (req, res) => {
  try {
    const { fileSize } = req.body;
    
    await db.updateKnowledgeDocument(req.tenantId, req.params.documentId, {
      status: DOCUMENT_STATUS.PROCESSING,
      fileSize: fileSize || 0,
    });
    
    // Note: In production, this would trigger a Lambda function to:
    // 1. Extract text from document
    // 2. Chunk the text
    // 3. Generate embeddings
    // 4. Store in Bedrock Knowledge Base
    
    // For now, we simulate async processing
    setTimeout(async () => {
      try {
        await db.updateKnowledgeDocument(req.tenantId, req.params.documentId, {
          status: DOCUMENT_STATUS.INDEXED,
          chunksCreated: Math.ceil((fileSize || 1000) / 1000),
        });
      } catch (err) {
        logger.error('Failed to update document status', err);
      }
    }, 5000);
    
    res.json({ success: true, status: DOCUMENT_STATUS.PROCESSING });
  } catch (error) {
    logger.error('Confirm upload error', error);
    res.status(500).json({ error: error.message || 'Failed to confirm upload' });
  }
});

// List knowledge documents
router.get('/', extractTenantId, async (req, res) => {
  try {
    const { category } = req.query;
    
    const documents = await db.getKnowledgeDocuments(req.tenantId, category);
    
    res.json(documents);
  } catch (error) {
    logger.error('List documents error', error);
    res.status(500).json({ error: error.message || 'Failed to list documents' });
  }
});

// Get document details
router.get('/:documentId', extractTenantId, async (req, res) => {
  try {
    const document = await db.getKnowledgeDocument(req.tenantId, req.params.documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(document);
  } catch (error) {
    logger.error('Get document error', error);
    res.status(500).json({ error: error.message || 'Failed to get document' });
  }
});

// Delete document
router.delete('/:documentId', extractTenantId, async (req, res) => {
  try {
    const document = await db.getKnowledgeDocument(req.tenantId, req.params.documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Delete from S3
    if (document.s3Key) {
      const command = new DeleteObjectCommand({
        Bucket: KNOWLEDGE_BUCKET,
        Key: document.s3Key,
      });
      await s3Client.send(command);
    }
    
    // Delete from DynamoDB
    await db.deleteKnowledgeDocument(req.tenantId, req.params.documentId);
    
    // Note: In production, also remove from Bedrock Knowledge Base
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete document error', error);
    res.status(500).json({ error: error.message || 'Failed to delete document' });
  }
});

// Get categories
router.get('/categories/list', (req, res) => {
  res.json(KNOWLEDGE_CATEGORIES);
});

export default router;
