/**
 * Exotel click-to-call: CRM -> ai-calling-service proxy.
 *
 * Contract: docs/services/followup-agent-service/CONTRACTS.md sections 2.2 and 5;
 * design: docs/services/followup-agent-service/APPROVAL-PLAN.md section 3.6.
 *
 * TRUST BOUNDARY (same shape as routes/aiCalling.js):
 *
 *  - The browser sends *which* entity to call (`{ entityType, entityId }`),
 *    never a phone number. The callee number is resolved server-side under the
 *    session tenant, and the caller number comes from the authenticated user's
 *    profile (`/auth/me` -> `req.user.phoneNumber`).
 *  - Neither number is ever returned to the client, logged, or echoed back in
 *    an error message. Service error strings are scrubbed of digit runs before
 *    forwarding.
 *  - ai-calling-service trusts `x-tenant-id` because we hold
 *    CRM_CALLER_API_KEY, so we forward `req.tenantId` from the validated
 *    session only.
 *
 * Mounted at `/api/crm/calls`, giving `POST /api/crm/calls/click-to-call`.
 *
 * Dependency injection: `createClickToCallRouter(deps)` builds a router with
 * explicit collaborators so the route can be unit-tested with fakes under any
 * runner. The default export is the production router. The CRM data layer is
 * loaded lazily on first use so that importing this module stays cheap and
 * does not require the DynamoDB SDK at load time.
 */

import express from 'express';
import axios from 'axios';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireCrmMemberOrAbove } from '../middleware/requireRole.js';
import { logger } from '../logger.js';
import { getAiCallingServiceBaseUrl } from '../config/serviceUrls.js';

/** Accepted `entityType` values. `tenant` is an alias of `customer`. */
export const ENTITY_TYPES = ['lead', 'buyer', 'owner', 'customer', 'tenant', 'contact', 'property'];

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * Normalise an Indian phone number to E.164 (+91XXXXXXXXXX).
 *
 * Mirrors services/ai-calling-service/src/services/exotelService.js `toE164India`
 * (deliberately not imported across packages).
 *
 * @param {unknown} phone
 * @returns {{ valid: boolean, e164: string|null, reason?: string }}
 */
export function toE164India(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, e164: null, reason: 'phone number is empty' };
  }

  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0091')) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);
  else if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.slice(1);

  if (!INDIAN_MOBILE.test(cleaned)) {
    return { valid: false, e164: null, reason: 'not a valid Indian mobile number (expected 10 digits starting 6-9)' };
  }

  return { valid: true, e164: `+91${cleaned}` };
}

/**
 * Pick the raw phone string off a resolved entity. Properties carry the owner's
 * number (`ownerPhone` or `ownerSnapshot.phone`); everything else has `phone`
 * with a few legacy fallbacks.
 */
export function resolveEntityPhone(entityType, entity) {
  if (!entity || typeof entity !== 'object') return null;
  if (entityType === 'property') {
    return entity.ownerPhone || entity.ownerSnapshot?.phone || null;
  }
  return entity.phone || entity.mobile || entity.mobileNumber || entity.normalizedPhone || null;
}

function entityLabel(entity) {
  if (!entity || typeof entity !== 'object') return null;
  return entity.name || entity.title || entity.ownerName || entity.displayName || null;
}

/** Remove anything that looks like a phone number from a service-provided string. */
function scrubDigits(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\+?\d[\d\s\-().]{5,}\d/g, '[redacted]');
}

let crmModulePromise = null;
function loadCrmModule() {
  if (!crmModulePromise) {
    crmModulePromise = import('../crmDynamodbService.js');
  }
  return crmModulePromise;
}

/**
 * Build the router.
 *
 * @param {object} [deps]
 * @param {() => Promise<object>} [deps.crm]  async loader returning an object
 *   with getLead/getBuyer/getOwner/getCustomer/getContact/getProperty/
 *   logContactActivity (tenantId-first signatures, as in crmDynamodbService).
 * @param {Function} [deps.http]              axios-compatible request function
 * @param {Function[]} [deps.auth]            auth chain; defaults to
 *   [validateToken, extractTenantId, requireCrmMemberOrAbove]
 * @param {object} [deps.log]                 logger
 * @param {() => string|null} [deps.getServiceBaseUrl]
 */
export function createClickToCallRouter(deps = {}) {
  const crm = deps.crm || loadCrmModule;
  const http = deps.http || axios;
  const log = deps.log || logger;
  const getServiceBaseUrl = deps.getServiceBaseUrl || getAiCallingServiceBaseUrl;
  const auth = deps.auth || [validateToken, extractTenantId, requireCrmMemberOrAbove];

  const router = express.Router();

  // Resolved per request, not at import: ssmBootstrap hydrates process.env on
  // the Lambda cold start.
  function requireServiceConfigured(req, res, next) {
    let baseUrl;
    try {
      baseUrl = getServiceBaseUrl();
    } catch (configError) {
      log.error('clickToCall.misconfigured', { tenantId: req.tenantId, error: configError.message });
      return res.status(503).json({ error: 'click_to_call_not_configured', message: 'Calling service not configured' });
    }
    const apiKey = process.env.CRM_CALLER_API_KEY;
    if (!baseUrl || !apiKey) {
      log.warn('clickToCall.not_configured', {
        tenantId: req.tenantId,
        hasBaseUrl: Boolean(baseUrl),
        hasApiKey: Boolean(apiKey),
      });
      return res.status(503).json({ error: 'click_to_call_not_configured', message: 'Calling service not configured' });
    }
    req.aiCalling = { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
    next();
  }

  function callService(req, { method, path, data }) {
    const { baseUrl, apiKey } = req.aiCalling;
    return http({
      method,
      url: `${baseUrl}${path}`,
      data,
      headers: {
        'x-api-key': apiKey,
        'x-tenant-id': req.tenantId,
      },
      timeout: parseInt(process.env.AI_CALLING_SERVICE_TIMEOUT_MS || '10000', 10),
    });
  }

  async function getEntity(tenantId, entityType, entityId) {
    const m = await crm();
    switch (entityType) {
      case 'lead': return m.getLead(tenantId, entityId);
      case 'buyer': return m.getBuyer(tenantId, entityId);
      case 'owner': return m.getOwner(tenantId, entityId);
      case 'customer':
      case 'tenant': return m.getCustomer(tenantId, entityId);
      case 'contact': return m.getContact(tenantId, entityId);
      case 'property': return m.getProperty(tenantId, entityId);
      default: return null;
    }
  }

  router.post('/click-to-call', ...auth, requireServiceConfigured, async (req, res) => {
    const tenantId = req.tenantId;
    const body = req.body || {};
    const entityType = typeof body.entityType === 'string' ? body.entityType.trim().toLowerCase() : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';

    if (!ENTITY_TYPES.includes(entityType) || !entityId) {
      return res.status(400).json({
        error: 'invalid_entity',
        message: `entityType must be one of ${ENTITY_TYPES.join('|')} and entityId is required`,
      });
    }

    // Caller leg: the team member's own mobile, from the auth profile.
    const rawCaller = req.user?.phoneNumber || req.user?.phone;
    if (!rawCaller) {
      return res.status(400).json({
        error: 'caller_phone_missing',
        message: 'Add your mobile number to your profile to place calls',
      });
    }
    const caller = toE164India(String(rawCaller));
    if (!caller.valid) {
      return res.status(400).json({
        error: 'caller_phone_invalid',
        message: 'Your profile mobile number is not a valid Indian mobile number',
      });
    }

    try {
      const entity = await getEntity(tenantId, entityType, entityId);
      if (!entity) {
        return res.status(404).json({ error: 'entity_not_found', message: `${entityType} not found` });
      }

      const rawCallee = resolveEntityPhone(entityType, entity);
      if (!rawCallee) {
        return res.status(404).json({ error: 'entity_phone_missing', message: `${entityType} has no phone number` });
      }
      const callee = toE164India(String(rawCallee));
      if (!callee.valid) {
        return res.status(400).json({
          error: 'callee_phone_invalid',
          message: `${entityType} phone number is not a valid Indian mobile number`,
        });
      }

      const initiatedByName = req.user.displayName || req.user.name || null;

      let response;
      try {
        response = await callService(req, {
          method: 'post',
          path: '/calls/connect',
          data: {
            fromPhone: caller.e164,
            toPhone: callee.e164,
            entityType,
            entityId,
            initiatedByUserId: req.user.userId,
            initiatedByName,
          },
        });
      } catch (error) {
        const status = error.response?.status;
        log.error('clickToCall.connect.error', { tenantId, entityType, entityId, status, error: error.message });
        if (status === 503) {
          return res.status(503).json({
            error: 'click_to_call_not_configured',
            message: 'Click-to-call is not configured on the calling service',
          });
        }
        if (error.response) {
          return res.status(status || 502).json({
            error: scrubDigits(error.response.data?.error) || 'calling_service_error',
          });
        }
        return res.status(502).json({ error: 'calling_service_unreachable' });
      }

      const { callSessionId = null, callSid = null, status = 'initiated' } = response.data || {};

      log.info('clickToCall.initiated', {
        tenantId,
        userId: req.user.userId,
        entityType,
        entityId,
        callSessionId,
      });

      // Best-effort activity log. Never includes a phone number.
      try {
        const m = await crm();
        if (typeof m.logContactActivity === 'function') {
          await m.logContactActivity(tenantId, {
            activityType: 'click_to_call',
            subjectEntityType: entityType === 'tenant' ? 'customer' : entityType,
            subjectEntityId: entityId,
            title: 'Click-to-call',
            description: `Call placed to ${entityLabel(entity) || entityType} by ${initiatedByName || 'a team member'}`,
            performedBy: initiatedByName || req.user.userId,
            payload: { callSessionId, callSid },
          });
        }
      } catch (activityError) {
        log.warn('clickToCall.activity_log.failed', { tenantId, entityType, entityId, error: activityError.message });
      }

      return res.status(202).json({ callSessionId, callSid, status });
    } catch (error) {
      log.error('clickToCall.error', { tenantId, entityType, entityId, error: error.message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

export default createClickToCallRouter();
