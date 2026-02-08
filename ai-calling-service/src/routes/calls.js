// Call Management Routes

import express from 'express';
import * as callOrchestration from '../handlers/callOrchestration.js';
import * as db from '../services/dynamodbService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Middleware to extract tenant ID
const extractTenantId = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }
  req.tenantId = tenantId;
  next();
};

// Start a new AI call
router.post('/start', extractTenantId, async (req, res) => {
  try {
    const { leadId, leadName, leadPhone, callPurpose } = req.body;
    
    if (!leadPhone) {
      return res.status(400).json({ error: 'leadPhone is required' });
    }
    
    const result = await callOrchestration.startAICall({
      tenantId: req.tenantId,
      leadId,
      leadName,
      leadPhone,
      callPurpose,
    });
    
    res.status(201).json(result);
  } catch (error) {
    logger.error('Start call error', error);
    res.status(500).json({ error: error.message || 'Failed to start call' });
  }
});

// Get call status
router.get('/:callSessionId/status', extractTenantId, async (req, res) => {
  try {
    const status = await callOrchestration.getCallStatus(
      req.tenantId,
      req.params.callSessionId
    );
    
    if (!status) {
      return res.status(404).json({ error: 'Call session not found' });
    }
    
    res.json(status);
  } catch (error) {
    logger.error('Get call status error', error);
    res.status(500).json({ error: error.message || 'Failed to get call status' });
  }
});

// Get call transcript
router.get('/:callSessionId/transcript', extractTenantId, async (req, res) => {
  try {
    const transcript = await callOrchestration.getCallTranscript(
      req.tenantId,
      req.params.callSessionId
    );
    
    res.json({ transcript });
  } catch (error) {
    logger.error('Get transcript error', error);
    res.status(500).json({ error: error.message || 'Failed to get transcript' });
  }
});

// End a call
router.post('/:callSessionId/end', extractTenantId, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const result = await callOrchestration.endCall(
      req.tenantId,
      req.params.callSessionId,
      reason
    );
    
    res.json(result);
  } catch (error) {
    logger.error('End call error', error);
    res.status(500).json({ error: error.message || 'Failed to end call' });
  }
});

// Get call history
router.get('/', extractTenantId, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let calls;
    if (status) {
      calls = await db.getCallsByStatus(req.tenantId, status, parseInt(limit, 10));
    } else {
      calls = await db.getRecentCalls(req.tenantId, parseInt(limit, 10));
    }
    
    res.json(calls);
  } catch (error) {
    logger.error('Get calls error', error);
    res.status(500).json({ error: error.message || 'Failed to get calls' });
  }
});

// Get call details
router.get('/:callSessionId', extractTenantId, async (req, res) => {
  try {
    const session = await db.getCallSession(req.tenantId, req.params.callSessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Call session not found' });
    }
    
    res.json(session);
  } catch (error) {
    logger.error('Get call details error', error);
    res.status(500).json({ error: error.message || 'Failed to get call details' });
  }
});

// Get call metrics
router.get('/metrics/summary', extractTenantId, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const metrics = await db.getCallMetrics(req.tenantId, startDate, endDate);
    
    res.json(metrics);
  } catch (error) {
    logger.error('Get metrics error', error);
    res.status(500).json({ error: error.message || 'Failed to get metrics' });
  }
});

export default router;
