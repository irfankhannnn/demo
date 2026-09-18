// Job management routes — called by the CRM backend only (docs/agency-app/followup-agent/CONTRACTS.md §4).

import express from 'express';
import * as engine from '../domain/jobEngine.js';
import { CrmApiError } from '../services/crmApiService.js';
import { authenticateCrmCaller } from '../middleware/internalAuth.js';
import { JOB_SOURCE } from '../config/constants.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.use(authenticateCrmCaller);

function sendError(res, error, label) {
  if (error instanceof engine.SchedulingError) {
    return res.status(error.statusCode).json({ error: error.code, details: error.message });
  }
  if (error instanceof CrmApiError) {
    return res.status(502).json({ error: 'crm_unavailable', details: error.message });
  }
  logger.error(`${label} failed`, error);
  return res.status(500).json({ error: 'Internal server error', details: error.message });
}

// Create / schedule a job
router.post('/', async (req, res) => {
  try {
    const { leadId, jobType, dueAt, context, requestedBy } = req.body || {};
    const { job, duplicate } = await engine.scheduleJob({
      tenantId: req.tenantId,
      leadId,
      jobType,
      dueAt,
      context: context && typeof context === 'object' ? context : {},
      requestedBy: requestedBy || 'crm',
      source: req.body?.source === JOB_SOURCE.CRM_ADAPTER ? JOB_SOURCE.CRM_ADAPTER : JOB_SOURCE.API,
    });
    res.status(duplicate ? 200 : 201).json({ job, duplicate });
  } catch (error) {
    sendError(res, error, 'createJob');
  }
});

router.get('/', async (req, res) => {
  try {
    const { leadId, status, limit } = req.query;
    const jobs = await engine.listJobs(req.tenantId, { leadId, status, limit });
    res.json({ jobs });
  } catch (error) {
    sendError(res, error, 'listJobs');
  }
});

router.get('/:jobId', async (req, res) => {
  try {
    const result = await engine.getJobWithAttempts(req.tenantId, req.params.jobId);
    if (!result) return res.status(404).json({ error: 'job_not_found' });
    res.json(result);
  } catch (error) {
    sendError(res, error, 'getJob');
  }
});

router.post('/:jobId/cancel', async (req, res) => {
  try {
    const job = await engine.cancelJob(req.tenantId, req.params.jobId, req.body?.cancelledBy || 'crm');
    res.json({ job });
  } catch (error) {
    sendError(res, error, 'cancelJob');
  }
});

router.post('/:jobId/run-now', async (req, res) => {
  try {
    const job = await engine.runNow(req.tenantId, req.params.jobId);
    res.json({ job });
  } catch (error) {
    sendError(res, error, 'runNow');
  }
});

export default router;
