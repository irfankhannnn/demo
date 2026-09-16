// Server tool routes — called by the ElevenLabs agent mid-conversation.
//
// Every route is authenticated with SERVER_TOOL_API_KEY and scoped by headers
// ElevenLabs populates from `secret__` dynamic variables, never by values the
// model invents. See elevenlabs-agent-tools.md for the dashboard config that
// must match these paths and headers.

import express from 'express';
import * as tools from '../handlers/serverTools.js';
import { requireApiKey } from '../middleware/internalAuth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Establish tenant scope from the `secret__` headers ElevenLabs populates.
 *
 * Only ever mounted behind requireApiKey — the key proves the caller is our
 * configured agent, which is what makes these headers trustworthy.
 */
function establishToolScope(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }

  req.scope = {
    tenantId,
    leadId: req.headers['x-lead-id'] || null,
    callSessionId: req.headers['x-call-session-id'] || null,
  };
  next();
}

// Fails closed when SERVER_TOOL_API_KEY is unset — see internalAuth.js.
router.use(requireApiKey('SERVER_TOOL_API_KEY', 'server-tool'));
router.use(establishToolScope);

/**
 * Wrap a tool so a failure returns speakable text instead of an error the
 * agent would have to improvise around — a 500 mid-call is dead air.
 */
function toolRoute(name, handler) {
  return async (req, res) => {
    try {
      const result = await handler(req.scope, req.body || {});
      res.json(result);
    } catch (error) {
      logger.error(`Server tool ${name} failed`, error, {
        tenantId: req.scope?.tenantId,
        callSessionId: req.scope?.callSessionId,
      });
      res.status(200).json({
        speech:
          "I'm having trouble pulling that up right now. Would you like me to have one of our agents call you back?",
        error: 'tool_failed',
      });
    }
  };
}

router.post('/search-properties', toolRoute('search_properties', tools.searchProperties));
router.post('/property-details', toolRoute('get_property_details', tools.getPropertyDetails));
router.post('/schedule-site-visit', toolRoute('schedule_site_visit', tools.scheduleSiteVisit));
router.post('/policy-answer', toolRoute('answer_policy_question', tools.answerPolicyQuestion));
router.post('/qualification', toolRoute('submit_qualification', tools.submitQualification));
router.post('/human-handoff', toolRoute('request_human_handoff', tools.requestHumanHandoff));

// Follow-up agent tools (CONTRACTS.md 2.3).
router.post('/confirm-site-visit', toolRoute('confirm_site_visit', tools.confirmSiteVisit));
router.post('/visit-feedback', toolRoute('record_visit_feedback', tools.recordVisitFeedback));
router.post('/request-callback', toolRoute('request_callback', tools.requestCallback));

export default router;
