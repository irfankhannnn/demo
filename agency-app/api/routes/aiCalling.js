/**
 * CRM -> ai-calling-service proxy for the AI Calling module in the CRM UI.
 *
 * TRUST BOUNDARY — read before changing anything here.
 *
 * The browser never talks to ai-calling-service directly (see
 * DISABLED_FEATURES.md). Its management API is protected by a shared secret
 * (`agency-app/ai-calling/src/middleware/internalAuth.js`) which authenticates
 * *this backend as a service* — not an end user — and it then trusts the
 * `x-tenant-id` header purely because the caller proved it holds the key.
 *
 * That makes this file the place where a real user session is turned into a
 * tenant claim. Every route runs `validateToken` -> `extractTenantId` ->
 * `requireCrmMemberOrAbove` first, and forwards `req.tenantId` — derived from
 * the validated session — never a tenant id supplied by the browser. Forwarding
 * a client-controlled tenant here would hand any caller every tenant's call
 * transcripts and lead phone numbers.
 *
 * CRM_CALLER_API_KEY is therefore a tenant-crossing credential: server-side
 * config only, never a browser bundle.
 *
 * This is the outbound direction. routes/aiCallingInternal.js is the inbound
 * one (ai-calling-service calling into the CRM); they use different secrets on
 * purpose, so one service's compromise does not grant the other's access.
 */

import express from 'express';
import axios from 'axios';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireCrmMemberOrAbove } from '../middleware/requireRole.js';
import { getLead } from '../crmDynamodbService.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { hasCreditForAiCall } from '../aiCallBilling.js';
import { logger } from '../logger.js';
import { getAiCallingServiceBaseUrl } from '../config/serviceUrls.js';

const router = express.Router();

/**
 * Resolve service config at request time, not module load.
 *
 * ssmBootstrap hydrates process.env from SSM during the Lambda cold start, so a
 * value captured at import would always be undefined in AWS.
 */
function requireServiceConfigured(req, res, next) {
  let baseUrl;
  try {
    // Custom domain + base path + /api/ai-calling; null when not configured.
    baseUrl = getAiCallingServiceBaseUrl();
  } catch (configError) {
    logger.error('aiCalling.misconfigured', { tenantId: req.tenantId, error: configError.message });
    return res.status(503).json({ error: 'AI calling service not configured' });
  }
  const apiKey = process.env.CRM_CALLER_API_KEY;

  if (!baseUrl || !apiKey) {
    // Log presence, never the value.
    logger.warn('aiCalling.not_configured', {
      tenantId: req.tenantId,
      hasBaseUrl: Boolean(baseUrl),
      hasApiKey: Boolean(apiKey),
    });
    return res.status(503).json({ error: 'AI calling service not configured' });
  }

  req.aiCalling = { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
  next();
}

const crmAuth = [validateToken, extractTenantId, requireCrmMemberOrAbove, requireServiceConfigured];

function callService(req, { method, path, data, params }) {
  const { baseUrl, apiKey } = req.aiCalling;
  return axios({
    method,
    url: `${baseUrl}${path}`,
    data,
    params,
    headers: {
      'x-api-key': apiKey,
      'x-tenant-id': req.tenantId,
    },
    timeout: parseInt(process.env.AI_CALLING_SERVICE_TIMEOUT_MS || '10000', 10),
  });
}

function handleServiceError(res, req, label, error) {
  logger.error(`aiCalling.${label}.error`, {
    tenantId: req.tenantId,
    error: error.message,
  });
  if (error.response) {
    return res.status(error.response.status || 502).json({
      error: error.response.data?.error || 'AI calling service error',
    });
  }
  return res.status(500).json({ error: error.message || 'Internal server error' });
}

/** Simple pass-through for read-only endpoints. */
function proxyGet(label, buildPath) {
  return async (req, res) => {
    try {
      const response = await callService(req, {
        method: 'get',
        path: buildPath(req),
        params: req.query,
      });
      res.json(response.data);
    } catch (error) {
      handleServiceError(res, req, label, error);
    }
  };
}

// --- Calls -----------------------------------------------------------------

// Start an AI call for a lead. Lead name/phone are resolved server-side from
// the lead id: the browser supplies which lead, never who to dial.
router.post('/calls/start', ...crmAuth, async (req, res) => {
  try {
    const { leadId, callPurpose } = req.body || {};
    if (!leadId) {
      return res.status(400).json({ error: 'leadId is required' });
    }

    const lead = await getLead(req.tenantId, leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!lead.phone) {
      return res.status(400).json({ error: 'Lead has no phone number to call' });
    }

    const agencyConfig = await getAgencyConfig(req.tenantId).catch(() => null);
    if (!agencyConfig?.aiEmployeeEnabled) {
      return res.status(409).json({ error: 'AI calling not enabled for this tenant' });
    }

    // Calls bill per started minute after they settle, so this is the only
    // point at which a call the tenant cannot pay for can be refused.
    const credit = await hasCreditForAiCall(req.tenantId);
    if (!credit.ok) {
      return res.status(402).json({
        error: 'insufficient_credits',
        balance: credit.balance,
        required: credit.required,
        message: 'Out of credits. Buy more to start an AI call.',
      });
    }

    const response = await callService(req, {
      method: 'post',
      path: '/calls/start',
      data: {
        leadId: lead.leadId,
        leadName: lead.name,
        leadPhone: lead.phone,
        callPurpose: callPurpose === 'lead_qualification' ? 'lead_qualification' : 'lead_followup',
      },
    });

    res.status(202).json(response.data);
  } catch (error) {
    handleServiceError(res, req, 'startCall', error);
  }
});

// Registered before '/calls/:callSessionId' so the literal path is never
// captured by the param route.
router.get('/calls/metrics/summary', ...crmAuth, proxyGet('metrics', () => '/calls/metrics/summary'));

router.get('/calls', ...crmAuth, proxyGet('listCalls', () => '/calls'));

router.get(
  '/calls/:callSessionId/transcript',
  ...crmAuth,
  proxyGet('transcript', (req) => `/calls/${encodeURIComponent(req.params.callSessionId)}/transcript`)
);

router.get(
  '/calls/:callSessionId/status',
  ...crmAuth,
  proxyGet('callStatus', (req) => `/calls/${encodeURIComponent(req.params.callSessionId)}/status`)
);

router.get(
  '/calls/:callSessionId',
  ...crmAuth,
  proxyGet('getCall', (req) => `/calls/${encodeURIComponent(req.params.callSessionId)}`)
);

router.post('/calls/:callSessionId/end', ...crmAuth, async (req, res) => {
  try {
    const response = await callService(req, {
      method: 'post',
      path: `/calls/${encodeURIComponent(req.params.callSessionId)}/end`,
      data: req.body || {},
    });
    res.json(response.data);
  } catch (error) {
    handleServiceError(res, req, 'endCall', error);
  }
});

// --- Agent configuration ---------------------------------------------------

router.get('/config/agent', ...crmAuth, proxyGet('getAgentConfig', () => '/config/agent'));

router.put('/config/agent', ...crmAuth, async (req, res) => {
  try {
    const response = await callService(req, {
      method: 'put',
      path: '/config/agent',
      data: req.body || {},
    });
    res.json(response.data);
  } catch (error) {
    handleServiceError(res, req, 'saveAgentConfig', error);
  }
});

export default router;
