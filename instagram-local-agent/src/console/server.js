/**
 * A12 - Local console.
 *
 * Binds to 127.0.0.1 only. Never 0.0.0.0: this UI can approve and send messages
 * as the agency's Instagram account and has no login of its own, so it must not
 * be reachable from the network. The bind address is asserted in the tests.
 *
 * Server-rendered HTML with no build step and no client framework - the agent
 * ships as a background tool, and a bundler in this path would be a maintenance
 * cost with no user-visible benefit.
 */
import express from 'express';
import {
  summary, listAccounts, listConversations, listMessages, listDrafts, listOutbox,
  listEnquiries, listRules, listAudit, listSyncState, leaderboard, uploadQueueDepth,
} from '../store/repos.js';
import { tokenHealth } from '../auth/vault.js';
import { approveDraft, processOutbox } from '../engine/sender.js';
import { classifyWindow } from '../engine/windowClassifier.js';
import * as killSwitch from '../runtime/killSwitch.js';
import { loadDevice } from '../uplink/client.js';
import { logger } from '../util/logger.js';

const log = logger('console');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString() : '-');

const WINDOW_COLOUR = {
  STANDARD: '#16a34a', COMMENT_REPLY: '#2563eb', HUMAN_AGENT: '#d97706', CLOSED: '#dc2626',
};

function layout(title, body, { killed, dryRun }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} - IG Agent</title>
<style>
  :root{--fg:#0f172a;--mut:#64748b;--line:#e2e8f0;--bg:#f8fafc;--pri:#2563eb}
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:var(--fg);background:var(--bg)}
  header{background:#fff;border-bottom:1px solid var(--line);padding:12px 20px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
  header b{font-size:15px}
  nav a{color:var(--mut);text-decoration:none;margin-right:14px}
  nav a:hover,nav a.on{color:var(--pri)}
  main{padding:20px;max-width:1100px;margin:0 auto}
  h2{font-size:16px;margin:22px 0 10px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}
  th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
  th{background:#f1f5f9;font-weight:600;font-size:12px;text-transform:uppercase;color:var(--mut)}
  tr:last-child td{border-bottom:none}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  .card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px}
  .card .n{font-size:22px;font-weight:600}
  .card .l{color:var(--mut);font-size:12px}
  .pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;color:#fff}
  .banner{padding:10px 20px;color:#fff;font-weight:600}
  button{background:var(--pri);color:#fff;border:0;padding:6px 12px;border-radius:6px;cursor:pointer}
  button.sec{background:#64748b}
  textarea{width:100%;min-height:64px;font:inherit;padding:6px;border:1px solid var(--line);border-radius:6px}
  .muted{color:var(--mut)}
  form{display:inline}
</style></head><body>
${killed ? '<div class="banner" style="background:#dc2626">KILL SWITCH ENGAGED - all outbound actions are stopped</div>' : ''}
${dryRun ? '<div class="banner" style="background:#d97706">DRY RUN - requests are built and logged, nothing is sent</div>' : ''}
<header>
  <b>Instagram Agent</b>
  <nav>
    <a href="/">Overview</a><a href="/inbox">Inbox</a><a href="/drafts">Drafts</a>
    <a href="/enquiries">Enquiries</a><a href="/reels">Reels</a><a href="/outbox">Outbox</a>
    <a href="/rules">Rules</a><a href="/audit">Audit</a>
  </nav>
  <span style="margin-left:auto">
    <form method="post" action="/toggle/kill"><button class="sec">${killed ? 'Release' : 'Kill switch'}</button></form>
    <form method="post" action="/toggle/dry"><button class="sec">${dryRun ? 'Dry run off' : 'Dry run on'}</button></form>
  </span>
</header>
<main>${body}</main></body></html>`;
}

export function createConsoleApp(ctx) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  const render = (res, title, body) => res.send(layout(title, body, {
    killed: killSwitch.isEngaged(), dryRun: killSwitch.isDryRun(),
  }));

  app.get('/', (req, res) => {
    const s = summary(ctx.db);
    const device = loadDevice();
    const cards = Object.entries(s)
      .map(([k, v]) => `<div class="card"><div class="n">${v}</div><div class="l">${esc(k)}</div></div>`)
      .join('');

    const accounts = listAccounts(ctx.db).map((a) => {
      const h = tokenHealth(a.ig_user_id);
      return `<tr><td>@${esc(a.username ?? a.ig_user_id)}</td><td>${a.followers_count ?? '-'}</td>
        <td>${esc(h?.state ?? 'unknown')}</td><td>${fmtTime(a.token_expires_at)}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="muted">No account connected. Run: ig-agent connect</td></tr>';

    const collectors = listSyncState(ctx.db).map((c) => `<tr><td>${esc(c.collector)}</td>
      <td>${c.last_ok ? 'ok' : 'FAILED'}</td><td>${fmtTime(c.last_run_at)}</td>
      <td class="muted">${esc(c.last_error ?? '')}</td></tr>`).join('')
      || '<tr><td colspan="4" class="muted">Nothing has run yet.</td></tr>';

    render(res, 'Overview', `
      <h2>At a glance</h2><div class="cards">${cards}</div>
      <h2>Accounts</h2><table><tr><th>Account</th><th>Followers</th><th>Token</th><th>Expires</th></tr>${accounts}</table>
      <h2>Collectors</h2><table><tr><th>Collector</th><th>Status</th><th>Last run</th><th>Error</th></tr>${collectors}</table>
      <h2>Cloud</h2><table><tr><th>Paired</th><th>Device</th><th>Pending uploads</th></tr>
        <tr><td>${device ? 'yes' : 'no'}</td><td>${esc(device?.deviceId ?? '-')}</td><td>${uploadQueueDepth(ctx.db)}</td></tr></table>`);
  });

  app.get('/inbox', (req, res) => {
    const rows = listConversations({ limit: 200 }, ctx.db).map((c) => {
      const w = classifyWindow(c);
      return `<tr>
        <td><a href="/thread/${encodeURIComponent(c.conversation_id)}">@${esc(c.participant_username ?? c.participant_id ?? '?')}</a></td>
        <td>${c.message_count}</td>
        <td>${c.unanswered ? '<b>unanswered</b>' : '-'}</td>
        <td><span class="pill" style="background:${WINDOW_COLOUR[w.state]}">${w.state}</span></td>
        <td class="muted">${fmtTime(c.last_inbound_at)}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="muted">No conversations yet. Run: ig-agent sync dm</td></tr>';

    render(res, 'Inbox', `<h2>Conversations</h2>
      <p class="muted">A CLOSED thread cannot be replied to by any API. Re-engage with a Story CTA asking them to reply.</p>
      <table><tr><th>Person</th><th>Messages</th><th>State</th><th>Window</th><th>Last inbound</th></tr>${rows}</table>`);
  });

  app.get('/thread/:id', (req, res) => {
    const msgs = listMessages(req.params.id, 200, ctx.db).map((m) => `<tr>
      <td>${m.direction === 'in' ? 'them' : 'us'}</td>
      <td>${esc(m.text)}</td><td class="muted">${fmtTime(m.created_at)}</td></tr>`).join('')
      || '<tr><td colspan="3" class="muted">No messages.</td></tr>';
    render(res, 'Thread', `<h2>Thread</h2><table><tr><th></th><th>Message</th><th>When</th></tr>${msgs}</table>`);
  });

  app.get('/drafts', (req, res) => {
    const rows = listDrafts({ status: 'pending', limit: 100 }, ctx.db).map((d) => `<tr>
      <td class="muted">${esc(d.category)}/${esc(d.language)}</td>
      <td><form method="post" action="/drafts/${encodeURIComponent(d.draft_id)}/approve">
        <textarea name="body">${esc(d.edited_body ?? d.body)}</textarea>
        <button>Approve and queue</button></form></td>
      <td class="muted">${d.auto_send_eligible ? 'auto-send eligible' : 'needs review'}</td></tr>`).join('')
      || '<tr><td colspan="3" class="muted">No pending drafts.</td></tr>';
    render(res, 'Drafts', `<h2>Drafts awaiting approval</h2>
      <p class="muted">Nothing is sent until you approve it, and approval still passes the window check.</p>
      <table><tr><th>Category</th><th>Reply</th><th></th></tr>${rows}</table>`);
  });

  app.post('/drafts/:id/approve', (req, res) => {
    try {
      approveDraft(ctx, req.params.id, { approvedBy: 'console', body: req.body.body });
    } catch (err) {
      log.error('approve failed', { error: err.message });
    }
    res.redirect('/drafts');
  });

  app.get('/enquiries', (req, res) => {
    const rows = listEnquiries({ limit: 200 }, ctx.db).map((e) => `<tr>
      <td>${esc(e.name ?? '-')}</td><td>${esc(e.phone ?? '-')}</td><td>${esc(e.intent)}</td>
      <td>${esc(e.budget_bracket ?? '-')}</td><td>${esc(e.preferred_area ?? '-')}</td>
      <td>${esc(e.temperature)} (${e.score})</td><td>${esc(e.status)}</td></tr>`).join('')
      || '<tr><td colspan="7" class="muted">No enquiries extracted yet.</td></tr>';
    render(res, 'Enquiries', `<h2>Enquiries</h2>
      <table><tr><th>Name</th><th>Phone</th><th>Intent</th><th>Budget</th><th>Area</th><th>Temp</th><th>Status</th></tr>${rows}</table>`);
  });

  app.get('/reels', (req, res) => {
    const rows = leaderboard(50, ctx.db).map((m) => `<tr>
      <td>${esc(String(m.caption ?? '').slice(0, 60))}</td><td>${m.views ?? '-'}</td>
      <td>${m.comment_count ?? 0}</td><td>${m.dm_count ?? 0}</td><td><b>${m.enquiry_count ?? 0}</b></td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">No media yet. Run: ig-agent sync media</td></tr>';
    render(res, 'Reels', `<h2>Reels by enquiries</h2>
      <p class="muted">Ranked by enquiries, not views. A high-view reel with no enquiries is a worse reel.</p>
      <table><tr><th>Caption</th><th>Views</th><th>Comments</th><th>DMs</th><th>Enquiries</th></tr>${rows}</table>`);
  });

  app.get('/outbox', async (req, res) => {
    const rows = listOutbox({ limit: 100 }, ctx.db).map((o) => `<tr>
      <td>${esc(o.kind)}</td><td>${esc(String(o.body).slice(0, 70))}</td>
      <td>${esc(o.status)}</td><td>${esc(o.window_state_at_send ?? o.window_state_at_queue ?? '-')}</td>
      <td class="muted">${esc(o.last_error ?? '')}</td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">Outbox is empty.</td></tr>';
    render(res, 'Outbox', `<h2>Outbox</h2>
      <form method="post" action="/outbox/process"><button>Process now</button></form>
      <table style="margin-top:10px"><tr><th>Kind</th><th>Body</th><th>Status</th><th>Window</th><th>Error</th></tr>${rows}</table>`);
  });

  app.post('/outbox/process', async (req, res) => {
    await processOutbox(ctx).catch((err) => log.error('process failed', { error: err.message }));
    res.redirect('/outbox');
  });

  app.get('/rules', (req, res) => {
    const rows = listRules(ctx.db).map((r) => `<tr>
      <td>${esc(r.keyword)}</td><td>${esc(r.match_type)}</td>
      <td>${esc(r.public_reply ?? '')}</td><td>${esc(String(r.dm_message ?? '').slice(0, 80))}</td>
      <td>${r.enabled ? 'on' : 'off'}</td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">No rules. They sync down from the web app.</td></tr>';
    render(res, 'Rules', `<h2>Keyword rules</h2>
      <p class="muted">Edit these in the RealtyFlow web app; the agent pulls them down each cycle.</p>
      <table><tr><th>Keyword</th><th>Match</th><th>Public reply</th><th>DM</th><th></th></tr>${rows}</table>`);
  });

  app.get('/audit', (req, res) => {
    const rows = listAudit({ limit: 300 }, ctx.db).map((a) => `<tr>
      <td class="muted">${fmtTime(a.created_at)}</td><td>${esc(a.scope)}</td><td>${esc(a.action)}</td>
      <td>${esc(a.outcome)}</td><td class="muted">${esc(a.detail ?? '')}</td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">Nothing logged yet.</td></tr>';
    render(res, 'Audit', `<h2>Audit log</h2>
      <p class="muted">Every API call and every message, kept locally. This is what answers "what did it do".</p>
      <table><tr><th>When</th><th>Scope</th><th>Action</th><th>Outcome</th><th>Detail</th></tr>${rows}</table>`);
  });

  app.post('/toggle/kill', (req, res) => {
    if (killSwitch.isEngaged()) killSwitch.disengage('human');
    else killSwitch.engage('console', 'human');
    res.redirect(req.get('referer') ?? '/');
  });

  app.post('/toggle/dry', (req, res) => {
    killSwitch.setDryRun(!killSwitch.isDryRun(), 'human');
    res.redirect(req.get('referer') ?? '/');
  });

  return app;
}

export function startConsole(ctx, { host, port } = {}) {
  const app = createConsoleApp(ctx);
  // Loopback only. Changing this exposes send-capable controls with no auth.
  const bindHost = host ?? ctx.config?.console?.host ?? '127.0.0.1';
  const bindPort = port ?? ctx.config?.console?.port ?? 7317;

  return new Promise((resolve, reject) => {
    const server = app.listen(bindPort, bindHost, () => {
      const url = `http://${bindHost}:${bindPort}`;
      log.info('console started', { url });
      resolve({ server, url, host: bindHost, port: bindPort });
    });
    server.on('error', reject);
  });
}

export default { createConsoleApp, startConsole };
