// The scheduled job. An EventBridge rule invokes the same Lambda every couple
// of minutes (see lambda.js); this walks every connected Instagram account and
// runs whichever jobs are due for it.
//
// Polling is what makes the product work in Meta Development Mode, where
// webhooks are not delivered. Once the app is Live, webhooks deliver DMs in
// seconds and this keeps running as the safety net that also fills in
// usernames, media, insights and token refreshes.
//
// Every job records its own clock on the account row, so a failing job is
// retried on its normal cadence rather than on every run, and the time budget
// stops one slow account from starving the rest.

import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import * as defaultDb from './dynamoService.js';
import { createInstagramService } from './instagramService.js';
import { ERROR_KIND } from './metaErrors.js';

const log = logger.child({ module: 'services/worker' });

const MINUTE_MS = 60 * 1000;

function isDue(lastAt, everyMinutes, now) {
  if (!lastAt) return true;
  const last = Date.parse(lastAt);
  return Number.isNaN(last) || now - last >= everyMinutes * MINUTE_MS;
}

/**
 * @param {object} [opts]
 * @param {{tenantId: string, igUserId: string}} [opts.onlyAccount] - run for one account (manual sync)
 * @param {boolean} [opts.force] - ignore job clocks
 * @param {string[]} [opts.jobNames] - run only these jobs
 * @param {number} [opts.timeBudgetMs] - stop starting jobs after this long (defaults to the worker's budget)
 */
export async function runScheduledJobs({
  db = defaultDb,
  service,
  clock = () => Date.now(),
  onlyAccount = null,
  force = false,
  jobNames = null,
  timeBudgetMs = null,
} = {}) {
  const cfg = getConfig();
  const budgetMs = timeBudgetMs ?? cfg.worker.timeBudgetMs;
  const started = clock();
  const summary = { accounts: 0, deferred: 0, jobs: {}, errors: [] };

  if (!cfg.instagramConfigured) {
    log.warn('worker.skipped_not_configured');
    return { ...summary, skipped: 'instagram_not_configured' };
  }

  const svc = service || createInstagramService({ db, clock });
  let refs = onlyAccount ? [onlyAccount] : await db.listRegisteredAccounts();
  // Rotate the starting point so a time-budget cut-off does not always starve
  // the same accounts at the end of the list.
  if (refs.length > 1) {
    const offset = Math.floor(started / MINUTE_MS) % refs.length;
    refs = [...refs.slice(offset), ...refs.slice(0, offset)];
  }

  const jobs = [
    { name: 'refresh', every: 12 * 60, clockField: 'lastTokenCheckAt', run: (a) => svc.refreshTokenIfDue(a) },
    { name: 'profile', every: cfg.worker.profileEveryMinutes, clockField: 'lastProfileSyncAt', run: (a) => svc.syncProfile(a) },
    { name: 'conversations', every: cfg.worker.conversationsEveryMinutes, clockField: 'lastConversationsSyncAt', run: (a) => svc.syncConversations(a) },
    { name: 'media', every: cfg.worker.mediaEveryMinutes, clockField: 'lastMediaSyncAt', run: (a) => svc.syncMedia(a) },
    { name: 'comments', every: cfg.worker.commentsEveryMinutes, clockField: 'lastCommentsSyncAt', run: (a) => svc.syncComments(a) },
    // Last, so it also scores threads that comments opened in this pass.
    { name: 'analysis', every: 0, clockField: null, run: (a) => svc.analysePendingThreads(a) },
  ];

  for (const ref of refs) {
    if (clock() - started > budgetMs) {
      summary.deferred += 1;
      continue;
    }

    let account = await db.getAccount(ref.tenantId, ref.igUserId);
    if (!account || account.status !== 'connected') continue;
    summary.accounts += 1;

    for (const job of jobs) {
      if (clock() - started > budgetMs) break;
      if (jobNames && !jobNames.includes(job.name)) continue;
      if (!force && job.clockField && !isDue(account[job.clockField], job.every, clock())) continue;

      try {
        const result = await job.run(account);
        summary.jobs[job.name] = (summary.jobs[job.name] || 0) + 1;
        if (job.clockField) {
          account = (await db.updateAccount(ref.tenantId, ref.igUserId, { [job.clockField]: new Date(clock()).toISOString() })) || account;
        }
        // A refreshed token changes the stored ciphertext; later jobs need it.
        if (job.name === 'refresh' && result?.refreshed) account = await db.getAccount(ref.tenantId, ref.igUserId);
      } catch (err) {
        const message = await svc.recordFailure(account, job.name, err);
        summary.errors.push({ igUserId: ref.igUserId, job: job.name, message });
        if (job.clockField) {
          await db.updateAccount(ref.tenantId, ref.igUserId, { [job.clockField]: new Date(clock()).toISOString() });
        }
        // Auth: nothing else will work. Rate limit: stop calling Meta for this
        // account until the next run rather than hammering it.
        if (err?.kind === ERROR_KIND.AUTH || err?.kind === ERROR_KIND.RATE_LIMIT || err?.status === 409) break;
      }
    }
  }

  log.info('worker.run_complete', { ...summary, errors: summary.errors.length, ms: clock() - started });
  return summary;
}

export default runScheduledJobs;
