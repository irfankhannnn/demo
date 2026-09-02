// Agent Configuration Routes

import express from 'express';
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

// Get agent configuration
router.get('/agent', extractTenantId, async (req, res) => {
  try {
    const config = await db.getAgentConfig(req.tenantId);
    
    if (!config) {
      return res.json({
        configured: false,
        message: 'Agent not configured. Please set up Exotel number and agent settings.',
      });
    }
    
    res.json({
      configured: true,
      ...config,
    });
  } catch (error) {
    logger.error('Get agent config error', error);
    res.status(500).json({ error: error.message || 'Failed to get agent config' });
  }
});

// Save agent configuration
router.put('/agent', extractTenantId, async (req, res) => {
  try {
    const {
      agencyName,
      agentId,
      agentPhoneNumberId,
      agentVoice,
      agentPersonality,
      greeting,
      fallbackMessage,
      exotelNumber,
      maxCallDuration,
      enableRecording,
      escalationPhone,
    } = req.body;

    if (!agencyName) {
      return res.status(400).json({ error: 'agencyName is required' });
    }

    const config = await db.saveAgentConfig(req.tenantId, {
      agencyName,
      agentId,
      agentPhoneNumberId,
      agentVoice,
      agentPersonality,
      greeting,
      fallbackMessage,
      exotelNumber,
      maxCallDuration,
      enableRecording,
      escalationPhone,
    });
    
    res.json(config);
  } catch (error) {
    logger.error('Save agent config error', error);
    res.status(500).json({ error: error.message || 'Failed to save agent config' });
  }
});

// Get intent configuration
router.get('/intents', extractTenantId, async (req, res) => {
  try {
    const config = await db.getIntentConfig(req.tenantId);
    
    res.json(config || {});
  } catch (error) {
    logger.error('Get intent config error', error);
    res.status(500).json({ error: error.message || 'Failed to get intent config' });
  }
});

// Save intent configuration
router.put('/intents', extractTenantId, async (req, res) => {
  try {
    const { intents } = req.body;
    
    if (!intents || typeof intents !== 'object') {
      return res.status(400).json({ error: 'intents object is required' });
    }
    
    const config = await db.saveIntentConfig(req.tenantId, intents);
    
    res.json(config);
  } catch (error) {
    logger.error('Save intent config error', error);
    res.status(500).json({ error: error.message || 'Failed to save intent config' });
  }
});

export default router;
