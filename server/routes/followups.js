/**
 * CRM -> followup-agent-service proxy for follow-up jobs that are addressed
 * by job id rather than by lead (CONTRACTS.md section 5).
 *
 * Mounted at /api/crm/followups. The per-lead routes (schedule a call, list a
 * lead's jobs) live in routes/leads.js next to the other lead actions.
 *
 * Same trust boundary as routes/aiCalling.js: the tenant is the validated
 * session's, never a browser value, and the service scopes the job lookup to
 * it — a job id from another tenant is a 404 there, not a cancellation.
 * Responses never carry a phone number.
 *
 * Dependency injection: `createFollowupsRouter(deps)` takes the service
 * client and auth chain so the route can be unit-tested with fakes under any
 * runner; the default export is the production router.
 */

import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireCrmMemberOrAbove } from '../middleware/requireRole.js';
import { logger } from '../logger.js';
import followupService, { stripPhoneFields, FollowupServiceError } from '../services/followupService.js';

export function createFollowupsRouter(deps = {}) {
  const service = deps.service || followupService;
  const log = deps.log || logger;
  const auth = deps.auth || [validateToken, extractTenantId, requireCrmMemberOrAbove];

  const router = express.Router();

  function handleError(res, req, label, error) {
    if (error instanceof FollowupServiceError) {
      if (error.code === 'not_configured') {
        return res.status(503).json({ error: 'Follow-up service not configured' });
      }
      log.error(`followups.${label}.service_error`, { tenantId: req.tenantId, jobId: req.params.jobId, status: error.status, error: error.message });
      return res.status(error.status || 502).json({ error: error.message || 'Follow-up service error' });
    }
    log.error(`followups.${label}.error`, { tenantId: req.tenantId, jobId: req.params.jobId, error: error.message });
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }

  // Cancel a scheduled follow-up job.
  router.post('/:jobId/cancel', ...auth, async (req, res) => {
    try {
      const { job } = await service.cancelJob(req.tenantId, req.params.jobId);
      res.json({ job: stripPhoneFields(job) });
    } catch (error) {
      handleError(res, req, 'cancel', error);
    }
  });

  return router;
}

export default createFollowupsRouter();
