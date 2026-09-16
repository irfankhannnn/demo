/**
 * Agency policy documents — the CRM-facing CRUD surface.
 *
 * These are the documents the voice agent quotes when a customer asks about
 * deposits, brokerage, paperwork or house rules. Writing them is an
 * administrative act with a blast radius beyond the CRM: whatever is saved
 * here is read aloud to customers on recorded calls, and is also served to the
 * WhatsApp and web chat agents. So writes require admin/manager, not any CRM
 * member.
 *
 * Reads are open to any CRM member — agents benefit from seeing their own
 * agency's policies, and it is the same text their customers already hear.
 */

import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireCrmMemberOrAbove, requireAdminOrManager } from '../middleware/requireRole.js';
import {
  getPolicies,
  replacePolicies,
  reindexPolicies,
  PolicyValidationError,
  MAX_POLICY_CHARS,
  MAX_POLICIES,
} from '../services/knowledge/policyStore.js';
import { POLICY_CATEGORIES } from '../services/knowledge/policyIngestionService.js';
import { logger } from '../logger.js';

const router = express.Router();

router.use(validateToken, extractTenantId);

/** Limits and categories, so the UI does not hardcode them separately. */
router.get('/meta', requireCrmMemberOrAbove, (_req, res) => {
  res.json({
    categories: POLICY_CATEGORIES,
    maxPolicyChars: MAX_POLICY_CHARS,
    maxPolicies: MAX_POLICIES,
  });
});

router.get('/', requireCrmMemberOrAbove, async (req, res) => {
  try {
    const policies = await getPolicies(req.tenantId);
    res.json({ policies, count: policies.length });
  } catch (error) {
    logger.error('agencyPolicies.get.error', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({ error: 'Failed to load policies', details: error.message });
  }
});

/**
 * Replace the whole policy set.
 *
 * Whole-set replace rather than per-document PATCH because the settings screen
 * edits them as one list, and because re-indexing needs to know which
 * documents disappeared in order to delete their passages. A per-document API
 * makes deletion detection the client's job, and a client that forgets leaves
 * the agent quoting a policy the agency retired.
 */
router.put('/', requireAdminOrManager, async (req, res) => {
  try {
    const result = await replacePolicies(req.tenantId, req.body?.policies);

    // 200 with an explicit indexingError, not 500: the documents were saved.
    // Reporting a failure here would push an admin to re-submit a save that
    // already succeeded.
    res.json({
      policies: result.policies,
      count: result.policies.length,
      indexing: result.indexing,
      indexingError: result.indexingError,
      warning: result.indexingError
        ? 'Policies were saved, but search indexing failed. The voice agent cannot quote them until indexing succeeds — retry with Reindex.'
        : undefined,
    });
  } catch (error) {
    if (error instanceof PolicyValidationError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('agencyPolicies.put.error', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({ error: 'Failed to save policies', details: error.message });
  }
});

/** Re-run indexing without editing. Recovery path for a failed save. */
router.post('/reindex', requireAdminOrManager, async (req, res) => {
  try {
    const result = await reindexPolicies(req.tenantId);
    res.json(result);
  } catch (error) {
    logger.error('agencyPolicies.reindex.error', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({ error: 'Failed to reindex policies', details: error.message });
  }
});

export default router;
