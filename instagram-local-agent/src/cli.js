#!/usr/bin/env node
/**
 * Instagram Local Agent - command line entry point.
 *
 *   ig-agent connect            connect an Instagram professional account
 *   ig-agent pair <code>        pair this laptop with RealtyFlow
 *   ig-agent sync [collector]   run collectors (all, or one of profile|media|comments|dm)
 *   ig-agent console            open the local console on 127.0.0.1:7317
 *   ig-agent start              run the scheduler in the foreground
 *   ig-agent status             one-screen health summary
 *   ig-agent doctor             diagnose setup problems
 *   ig-agent dry-run on|off     toggle dry run (builds requests, sends nothing)
 *   ig-agent kill on|off        toggle the kill switch
 */
import process from 'node:process';
import os from 'node:os';
import { createContext } from './runtime/context.js';
import { loadConfig, saveConfig } from './util/config.js';
import { agentHome, dbPath, configPath } from './util/paths.js';
import { storeHealth, summary, listAccounts, listSyncState, listAudit } from './store/repos.js';
import { driverName } from './store/db.js';
import { connectAccount } from './auth/oauth.js';
import { tokenHealth } from './auth/vault.js';
import { UplinkClient, loadDevice, isPaired } from './uplink/client.js';
import { cloudConfigured, resolveCloudBaseUrl } from './util/serviceUrl.js';
import * as killSwitch from './runtime/killSwitch.js';
import { syncProfile } from './collectors/profile.js';
import { syncMedia } from './collectors/media.js';
import { syncComments } from './collectors/comments.js';
import { syncAllConversations } from './collectors/conversations.js';
import { draftAll } from './engine/drafter.js';
import { processOutbox } from './engine/sender.js';
import { extractAll } from './extract/enquiry.js';
import * as uplink from './uplink/queue.js';
import { startConsole } from './console/server.js';
import { logger } from './util/logger.js';

const log = logger('cli');
const VERSION = '0.1.0';

const out = (...a) => process.stdout.write(`${a.join(' ')}\n`);

function usage() {
  out(`
Instagram Local Agent v${VERSION}

  ig-agent connect              Connect an Instagram professional account
  ig-agent pair <code>          Pair this laptop with RealtyFlow (code from the web app)
  ig-agent sync [what]          Run collectors: all | profile | media | comments | dm
  ig-agent console              Open the local console (127.0.0.1:7317)
  ig-agent start                Run the scheduler in the foreground
  ig-agent status               Health summary
  ig-agent doctor               Diagnose setup problems
  ig-agent dry-run on|off       Toggle dry run - builds requests, sends nothing
  ig-agent kill on|off          Toggle the kill switch - stops all outbound actions

Home: ${agentHome()}
`);
}

// ---------------------------------------------------------------------------

async function cmdConnect() {
  out('Opening the Instagram consent screen in your browser...');
  const account = await connectAccount({});
  out(`\nConnected: @${account.username} (${account.igUserId})`);
  out('Token stored encrypted. It refreshes automatically before it expires.');
  out('\nNext: ig-agent pair <code>   (get the code from the web app, Devices page)');
}

async function cmdPair(code) {
  if (!code) {
    out('ERROR: a pairing code is required.  ig-agent pair ABCD2345');
    process.exitCode = 1;
    return;
  }
  const config = loadConfig();
  try {
    resolveCloudBaseUrl(config.cloud);
  } catch (err) {
    out(`ERROR: ${err.message}. Set cloud.domainName + cloud.basePath in ${configPath()}`);
    process.exitCode = 1;
    return;
  }

  const client = new UplinkClient({ config });
  const device = await client.register({
    pairingCode: code.trim().toUpperCase(),
    deviceName: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    agentVersion: VERSION,
  });
  out(`Paired. Device ${device.deviceId} is now linked to tenant ${device.tenantId}.`);
}

async function cmdSync(what = 'all') {
  const ctx = createContext();
  const accounts = listAccounts(ctx.db);
  if (!accounts.length) {
    out('No connected accounts. Run: ig-agent connect');
    process.exitCode = 1;
    return;
  }

  for (const acc of accounts) {
    const id = acc.ig_user_id;
    out(`\n@${acc.username ?? id}`);

    // Each collector is isolated: one failing (a removed metric, a permission
    // gap) must not stop the others from running.
    const steps = {
      profile: () => syncProfile(ctx, id),
      media: () => syncMedia(ctx, id),
      comments: () => syncComments(ctx, id),
      dm: () => syncAllConversations(ctx),
    };
    const chosen = what === 'all' ? Object.keys(steps) : [what];

    for (const step of chosen) {
      if (!steps[step]) {
        out(`  unknown collector: ${step}`);
        continue;
      }
      try {
        const r = await steps[step]();
        out(`  ${step.padEnd(10)} ok  ${JSON.stringify(r).slice(0, 120)}`);
      } catch (err) {
        out(`  ${step.padEnd(10)} FAILED  ${err.message}`);
        log.error('collector failed', { step, error: err.message });
      }
    }
  }

  if (what === 'all') {
    const ex = extractAll(ctx);
    out(`\n  enquiries  ${ex.extracted} extracted from ${ex.scanned} threads`);
    const d = await draftAll(ctx);
    out(`  drafts     ${d.drafted} created`);

    uplink.queueSnapshot(ctx);
    uplink.queueThreads(ctx);
    uplink.queueEnquiries(ctx);
    const f = await uplink.flush(ctx);
    out(`  uplink     sent=${f.sent} failed=${f.failed}${f.skipped ? ` (${f.skipped})` : ''}`);
  }
}

async function cmdStatus() {
  const ctx = createContext();
  const s = summary(ctx.db);
  const cfg = loadConfig();
  const device = loadDevice();

  out(`\nInstagram Local Agent v${VERSION}`);
  out(`Home        ${agentHome()}`);
  out(`Database    ${dbPath()}  (driver: ${driverName()})`);
  out(`Paired      ${device ? `yes - device ${device.deviceId}` : 'no'}`);
  out(`Kill switch ${killSwitch.isEngaged() ? 'ENGAGED' : 'off'}`);
  out(`Dry run     ${killSwitch.isDryRun() ? 'ON - nothing is sent' : 'off'}`);
  out(`Provider    ${cfg.tokenProvider}`);

  out('\nAccounts');
  for (const a of listAccounts(ctx.db)) {
    const h = tokenHealth(a.ig_user_id);
    out(`  @${(a.username ?? a.ig_user_id).padEnd(24)} followers=${String(a.followers_count ?? '-').padEnd(8)} token=${h?.state ?? 'unknown'}`);
  }

  out('\nData');
  for (const [k, v] of Object.entries(s)) out(`  ${k.padEnd(16)} ${v}`);

  out('\nCollectors');
  for (const st of listSyncState(ctx.db)) {
    const when = st.last_run_at ? new Date(st.last_run_at).toISOString() : 'never';
    out(`  ${String(st.collector).padEnd(16)} ${st.last_ok ? 'ok  ' : 'FAIL'} ${when}`);
  }
  out('');
}

async function cmdDoctor() {
  const ctx = createContext();
  const cfg = loadConfig();
  const problems = [];
  const ok = [];

  const check = (cond, good, bad) => (cond ? ok.push(good) : problems.push(bad));

  check(Number(process.versions.node.split('.')[0]) >= 20,
    `Node ${process.versions.node}`, `Node ${process.versions.node} is too old - 20+ required`);

  const health = storeHealth(ctx.db);
  check(health.ok !== false, `SQLite schema ok (driver: ${driverName()})`,
    `SQLite schema problem: ${JSON.stringify(health)}`);

  check(cfg.meta?.appId && !String(cfg.meta.appId).startsWith('REPLACE'),
    'Meta app id configured', `Meta app id missing - edit ${configPath()}`);
  check(cfg.meta?.appSecret && !String(cfg.meta.appSecret).startsWith('REPLACE'),
    'Meta app secret configured', `Meta app secret missing - edit ${configPath()}`);
  check(cloudConfigured(cfg.cloud) && Boolean(String(cfg.cloud.basePath ?? '').trim()),
    'Cloud API domain + base path configured', `cloud.domainName / cloud.basePath missing - edit ${configPath()}`);

  const accounts = listAccounts(ctx.db);
  check(accounts.length > 0, `${accounts.length} account(s) connected`,
    'No Instagram account connected - run: ig-agent connect');

  for (const a of accounts) {
    const h = tokenHealth(a.ig_user_id);
    check(h?.state === 'ok', `Token for @${a.username} is healthy`,
      `Token for @${a.username} is ${h?.state ?? 'unknown'} - run: ig-agent connect`);
  }

  check(isPaired(), 'Paired with RealtyFlow', 'Not paired - run: ig-agent pair <code>');

  out('\nChecks passed:');
  for (const o of ok) out(`  OK    ${o}`);
  if (problems.length) {
    out('\nProblems:');
    for (const p of problems) out(`  FAIL  ${p}`);
    process.exitCode = 1;
  } else {
    out('\nNo problems found.');
  }
  out('');
}

function cmdToggle(kind, value) {
  const on = value === 'on' || value === 'true';
  if (kind === 'dry-run') {
    killSwitch.setDryRun(on, 'human');
    out(`Dry run is now ${on ? 'ON - requests are built but never sent' : 'off'}.`);
  } else {
    if (on) killSwitch.engage('cli', 'human');
    else killSwitch.disengage('human');
    out(`Kill switch is now ${on ? 'ENGAGED - all outbound actions stop' : 'off'}.`);
  }
}

async function cmdConsole() {
  const cfg = loadConfig();
  const ctx = createContext({ config: cfg });
  const { url } = await startConsole(ctx);
  out(`Console running at ${url}`);
  out('Press Ctrl+C to stop.');
}

/**
 * Foreground scheduler. Deliberately a simple interval loop rather than a cron
 * daemon: the agent has to survive a laptop that sleeps, and setInterval plus a
 * "have we run recently enough" check behaves correctly across a suspend where
 * a fired-and-missed cron does not.
 */
async function cmdStart() {
  const ctx = createContext();
  const cfg = loadConfig();
  const iv = cfg.sync ?? {};
  const last = {};

  const due = (name, minutes) => {
    const ms = (minutes ?? 60) * 60 * 1000;
    if (!last[name] || Date.now() - last[name] >= ms) {
      last[name] = Date.now();
      return true;
    }
    return false;
  };

  out(`Agent started. Console: http://${cfg.console?.host ?? '127.0.0.1'}:${cfg.console?.port ?? 7317}`);
  await startConsole(ctx);

  const tick = async () => {
    try {
      const accounts = listAccounts(ctx.db);
      for (const a of accounts) {
        const id = a.ig_user_id;
        if (due(`profile:${id}`, iv.profileIntervalMinutes)) await syncProfile(ctx, id).catch((e) => log.error('profile', { e: e.message }));
        if (due(`media:${id}`, iv.mediaIntervalMinutes)) await syncMedia(ctx, id).catch((e) => log.error('media', { e: e.message }));
        if (due(`comments:${id}`, iv.commentsIntervalMinutes)) await syncComments(ctx, id).catch((e) => log.error('comments', { e: e.message }));
      }
      if (due('dm', iv.conversationsIntervalMinutes)) {
        await syncAllConversations(ctx).catch((e) => log.error('dm', { e: e.message }));
        extractAll(ctx);
        await draftAll(ctx);
      }
      await processOutbox(ctx).catch((e) => log.error('outbox', { e: e.message }));
      if (due('uplink', iv.uplinkIntervalMinutes)) {
        uplink.queueSnapshot(ctx);
        uplink.queueThreads(ctx);
        uplink.queueEnquiries(ctx);
        await uplink.flush(ctx).catch((e) => log.error('flush', { e: e.message }));
        await uplink.heartbeat(ctx).catch((e) => log.debug('heartbeat', { e: e.message }));
        await uplink.pullRules(ctx).catch((e) => log.debug('rules', { e: e.message }));
      }
    } catch (err) {
      log.error('tick failed', { error: err.message });
    }
  };

  await tick();
  setInterval(tick, 60 * 1000);
}

// ---------------------------------------------------------------------------

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'connect':  return cmdConnect();
    case 'pair':     return cmdPair(args[0]);
    case 'sync':     return cmdSync(args[0] ?? 'all');
    case 'console':  return cmdConsole();
    case 'start':    return cmdStart();
    case 'status':   return cmdStatus();
    case 'doctor':   return cmdDoctor();
    case 'dry-run':  return cmdToggle('dry-run', args[0]);
    case 'kill':     return cmdToggle('kill', args[0]);
    case 'version':  return out(VERSION);
    default:         return usage();
  }
}

main().catch((err) => {
  process.stderr.write(`\nERROR: ${err.message}\n`);
  if (process.env.IG_AGENT_DEBUG) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
