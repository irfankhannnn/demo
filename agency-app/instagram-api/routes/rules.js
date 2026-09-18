// Keyword automation rules (JWT auth).
//
// Stored here; the scheduled worker and the comments webhook apply them (see
// instagramService.handleComment). Nothing in this router sends anything.

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'routes/rules' });

const MATCH_TYPES = new Set(['exact', 'contains', 'starts_with', 'regex']);

export function createRulesRouter({ db = defaultDb } = {}) {
  const router = express.Router();

  // GET /rules
  router.get('/', async (req, res) => {
    try {
      const rules = await db.listRules(req.tenantId);
      rules.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      return res.json({ rules });
    } catch (err) {
      log.error('rules.list.failed', { error: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to list rules' });
    }
  });

  // POST /rules — create or replace (the client sends ruleId to edit)
  router.post('/', async (req, res) => {
    const { ruleId, keyword, matchType, publicReply, dmMessage, mediaScope, enabled } = req.body || {};

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return res.status(400).json({ error: 'Bad Request', details: 'keyword is required' });
    }
    if (matchType && !MATCH_TYPES.has(matchType)) {
      return res.status(400).json({ error: 'Bad Request', details: `Unknown matchType: ${matchType}` });
    }
    if (!publicReply && !dmMessage) {
      // A rule with neither action would match comments forever and do nothing,
      // which reads as a broken integration rather than an empty rule.
      return res.status(400).json({ error: 'Bad Request', details: 'At least one of publicReply or dmMessage is required' });
    }

    if (matchType === 'regex') {
      // Compile now so a bad pattern fails at the desk of the person who typed
      // it, not silently inside the agent's comment loop hours later.
      try {
        new RegExp(keyword);
      } catch {
        return res.status(400).json({ error: 'Bad Request', details: 'keyword is not a valid regular expression' });
      }
    }

    try {
      const rule = await db.putRule(req.tenantId, {
        ruleId: ruleId || uuidv4(),
        keyword: keyword.trim(),
        matchType,
        publicReply,
        dmMessage,
        mediaScope,
        enabled,
      });

      await db.putAuditEvent(req.tenantId, { action: 'rule.saved', ruleId: rule.ruleId });
      return res.status(ruleId ? 200 : 201).json({ rule });
    } catch (err) {
      log.error('rules.save.failed', { error: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to save rule' });
    }
  });

  // DELETE /rules/:ruleId
  router.delete('/:ruleId', async (req, res) => {
    const { ruleId } = req.params;
    try {
      await db.deleteRule(req.tenantId, ruleId);
      await db.putAuditEvent(req.tenantId, { action: 'rule.deleted', ruleId });
      return res.json({ ok: true, ruleId });
    } catch (err) {
      log.error('rules.delete.failed', { error: err.message, ruleId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to delete rule' });
    }
  });

  return router;
}

export default createRulesRouter;
