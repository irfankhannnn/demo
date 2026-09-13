/**
 * Test harness. Every test gets its own throwaway IG_AGENT_HOME so nothing ever
 * touches the developer's real ~/.ig-agent, and so tests cannot see each other's
 * state.
 *
 * IG_AGENT_HOME has to be set BEFORE any module that resolves a path is
 * imported, which is why the store modules are imported dynamically inside
 * makeCtx() rather than at the top of this file.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// File logging off for the whole test run. The logger holds one cached write
// stream for the process, so it would keep writing into the FIRST temp home
// after a later test moved IG_AGENT_HOME - and an async write landing after
// cleanup() removed that directory surfaces as an ENOENT uncaughtException
// attributed to whichever test happened to be running. Quiet also keeps the
// test output readable.
process.env.IG_AGENT_NO_FILE_LOG = '1';
process.env.IG_AGENT_QUIET = '1';

export function tempHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-agent-test-'));
  process.env.IG_AGENT_HOME = dir;
  process.env.IG_AGENT_CONFIG = path.join(dir, 'config.json');
  return dir;
}

export function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows sometimes holds the SQLite file briefly after close. A leftover
    // temp dir is harmless; failing the test over it would not be.
  }
}

/** A runtime context backed by a real temp SQLite DB, with no network. */
export async function makeCtx({ config = {} } = {}) {
  const home = tempHome();
  fs.writeFileSync(process.env.IG_AGENT_CONFIG, JSON.stringify({
    tokenProvider: 'devmode',
    meta: { appId: 'test-app', appSecret: 'test-secret', apiVersion: 'v23.0' },
    cloud: { domainName: 'example.invalid', basePath: 'devrealestateinsta' },
    console: { host: '127.0.0.1', port: 0 },
    ...config,
  }));

  const { closeDb } = await import('../src/store/db.js');
  const repos = await import('../src/store/repos.js');
  const { loadConfig } = await import('../src/util/config.js');

  const db = repos.openStore();
  return {
    home,
    db,
    config: loadConfig(),
    repos,
    graph: stubGraph(),
    close() {
      try { closeDb(); } catch { /* already closed */ }
      cleanup(home);
    },
  };
}

/**
 * A Graph client stub. Records every call and replays queued responses, so a
 * collector or the sender can be driven without touching the network.
 */
export function stubGraph(responses = []) {
  const queue = [...responses];
  const calls = [];
  const handler = (method) => async (path, opts = {}) => {
    calls.push({ method, path, ...opts });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next({ method, path, ...opts });
    return next ?? {};
  };
  return {
    calls,
    queue,
    push: (r) => queue.push(r),
    get: handler('GET'),
    post: handler('POST'),
    request: handler('REQUEST'),
    async *paginate(p, opts) { calls.push({ method: 'PAGINATE', path: p, ...opts }); yield queue.shift() ?? []; },
  };
}

/** Insert a conversation with a chosen window position. */
export function seedConversation(ctx, {
  conversationId = 'conv_1', igUserId = 'ig_1', lastInboundAt = null,
  lastCommentAt = null, humanAgentUntil = null, participantId = 'them_1',
  participantUsername = 'rahul.sharma',
} = {}) {
  ctx.repos.upsertAccount({ igUserId, username: 'rakeshproperties' }, ctx.db);
  ctx.repos.upsertConversation({
    conversationId, igUserId, participantId, participantUsername, firstSeenAt: Date.now(),
  }, ctx.db);
  ctx.db.prepare(
    'UPDATE conversations SET last_inbound_at = ?, last_comment_at = ?, human_agent_until = ? WHERE conversation_id = ?',
  ).run(lastInboundAt, lastCommentAt, humanAgentUntil, conversationId);
  return ctx.repos.getConversation(conversationId, ctx.db);
}
