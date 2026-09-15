// Connected Instagram accounts (JWT auth).
//
//   GET    /accounts                  the tenant's accounts, never a token
//   POST   /accounts/:igUserId/sync   pull DMs now instead of waiting for the worker
//   DELETE /accounts/:igUserId        disconnect (history is kept)

import express from 'express';
import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';
import { publicAccount, ServiceError } from '../services/instagramService.js';
import { runScheduledJobs } from '../services/worker.js';

const log = logger.child({ module: 'routes/accounts' });

function fail(res, err, fallback) {
  if (err instanceof ServiceError) return res.status(err.status).json({ error: err.error, details: err.details });
  log.error('accounts.failed', { error: err?.message });
  return res.status(500).json({ error: 'Internal Server Error', details: fallback });
}

export function createAccountsRouter({ db = defaultDb, service }) {
  const router = express.Router();

  router.get('/accounts', async (req, res) => {
    try {
      const cfg = getConfig();
      const accounts = await db.listAccounts(req.tenantId);
      const now = Date.now();
      return res.json({
        accounts: accounts
          .map((a) => publicAccount(a, now))
          .sort((a, b) => String(b.connectedAt || '').localeCompare(String(a.connectedAt || ''))),
        instagramConfigured: cfg.instagramConfigured,
        dryRunSends: cfg.sends.dryRun,
        killSwitch: cfg.killSwitch,
      });
    } catch (err) {
      return fail(res, err, 'Failed to list Instagram accounts');
    }
  });

  router.post('/accounts/:igUserId/sync', async (req, res) => {
    try {
      const account = await db.getAccount(req.tenantId, req.params.igUserId);
      if (!account) return res.status(404).json({ error: 'Not Found', details: 'Instagram account not found' });
      if (account.status !== 'connected') {
        return res.status(409).json({ error: 'Conflict', details: 'Reconnect this Instagram account before syncing' });
      }

      // API Gateway gives a request 29 seconds, so a manual sync runs the jobs
      // a person is waiting on. Media and comments stay with the worker.
      const summary = await runScheduledJobs({
        db,
        service,
        onlyAccount: { tenantId: req.tenantId, igUserId: account.igUserId },
        force: true,
        jobNames: account.lastProfileSyncAt ? ['conversations', 'analysis'] : ['profile', 'conversations', 'analysis'],
      });
      const fresh = await db.getAccount(req.tenantId, account.igUserId);
      return res.json({ account: publicAccount(fresh), summary });
    } catch (err) {
      return fail(res, err, 'Sync failed');
    }
  });

  router.delete('/accounts/:igUserId', async (req, res) => {
    try {
      const updated = await service.disconnect({
        tenantId: req.tenantId,
        igUserId: req.params.igUserId,
        userId: req.user?.userId || req.user?.email || null,
      });
      return res.json({ ok: true, account: publicAccount(updated) });
    } catch (err) {
      return fail(res, err, 'Failed to disconnect the account');
    }
  });

  return router;
}

export default createAccountsRouter;
