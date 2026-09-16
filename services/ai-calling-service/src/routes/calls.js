// Call Management Routes
//
// Called by the CRM backend only, never the browser. Authenticated as a
// service with CRM_CALLER_API_KEY; req.tenantId comes from the header the
// authenticated CRM sets from its own validated session. See
// ../middleware/internalAuth.js for the trust boundary.

import express from 'express';
import * as callOrchestration from '../handlers/callOrchestration.js';
import * as db from '../services/dynamodbService.js';
import { authenticateCrmCaller } from '../middleware/internalAuth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.use(authenticateCrmCaller);

// Start a new AI call
router.post('/start', async (req, res) => {
  try {
    // `context` and `metadata` are optional follow-up extras (CONTRACTS.md
    // 2.1) — the orchestrator trims them to the fields the prompt uses.
    const { leadId, leadName, leadPhone, callPurpose, context, metadata } = req.body;

    if (!leadPhone) {
      return res.status(400).json({ error: 'leadPhone is required' });
    }

    const result = await callOrchestration.startAICall({
      tenantId: req.tenantId,
      leadId,
      leadName,
      leadPhone,
      callPurpose,
      context,
      metadata,
    });

    res.status(201).json(result);
  } catch (error) {
    // Bad input (unparseable phone, unconfigured agent) is the caller's
    // problem, not a server fault — answer 400 so the CRM can show the
    // reason instead of a generic failure.
    if (error?.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Start call error', error);
    res.status(500).json({ error: 'Failed to start call', details: error.message });
  }
});

// Click-to-call: bridge a team member to a contact through Exotel (no agent).
// Declared before the /:callSessionId routes so "connect" is never read as an id.
router.post('/connect', async (req, res) => {
  try {
    const { fromPhone, toPhone, entityType, entityId, initiatedByUserId, initiatedByName } =
      req.body || {};

    if (!fromPhone) return res.status(400).json({ error: 'fromPhone is required' });
    if (!toPhone) return res.status(400).json({ error: 'toPhone is required' });

    const result = await callOrchestration.connectCall({
      tenantId: req.tenantId,
      fromPhone,
      toPhone,
      entityType,
      entityId,
      initiatedByUserId,
      initiatedByName,
    });

    res.status(201).json(result);
  } catch (error) {
    // 503 = EXOTEL_CALLER_ID is blank on this deployment; the CRM shows
    // "not enabled" rather than "failed".
    if (error?.statusCode === 503) {
      return res.status(503).json({ error: error.message });
    }
    if (error?.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Connect call error', error);
    res.status(500).json({ error: 'Failed to connect call', details: error.message });
  }
});

// Get call status
router.get('/:callSessionId/status', async (req, res) => {
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
router.get('/:callSessionId/transcript', async (req, res) => {
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
router.post('/:callSessionId/end', async (req, res) => {
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
router.get('/', async (req, res) => {
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
router.get('/:callSessionId', async (req, res) => {
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
router.get('/metrics/summary', async (req, res) => {
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
