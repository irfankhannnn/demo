/**
 * Robustness tests for the Baileys disconnect/recovery work.
 * Covers:
 * - auth-state-utils (atomic backup + soft reset)
 * - health probe failure detection
 * - socket logger init-query timeout interception
 * - config validation for new constants
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  getAuthStateDir,
  isResettableFile,
  backupCredsJsonAtomically,
  softResetSession,
  restoreCredsFromBackup,
} from '../src/auth-state-utils.js';
import {
  isHealthProbeFailure,
  createSocketLogger,
  startHealthProbe,
  stopHealthProbe,
  healthProbeTimers,
} from '../src/baileysClient.js';

const TEST_TIMEOUT = 10000;

/**
 * Create a temporary directory for each test that exercises the filesystem.
 */
async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'baileys-robustness-'));
  return dir;
}

/**
 * Write a tiny test file atomically.
 */
async function writeTestFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Return a minimal valid Baileys credentials JSON string for tests.
 */
function getValidTestCreds(overrides = {}) {
  const creds = {
    noiseKey: { private: 'a', public: 'b' },
    signedIdentityKey: { private: 'c', public: 'd' },
    signedPreKey: { keyPair: { private: 'e', public: 'f' }, signature: 'g', keyId: 1 },
    registrationId: 123,
    advSecretKey: 'h',
    me: { id: '918291537522@s.whatsapp.net', name: 'Test' },
    ...overrides,
  };
  return JSON.stringify(creds);
}

/**
 * Stub logger that records calls so tests can assert.
 */
function createStubLogger() {
  const calls = {
    trace: [],
    debug: [],
    info: [],
    warn: [],
    error: [],
    fatal: [],
  };

  const target = {
    level: 'info',
    isLevelEnabled: () => true,
    child: function () {
      return this;
    },
    flush: () => Promise.resolve(),
    trace: (...args) => { calls.trace.push(args); return logger; },
    debug: (...args) => { calls.debug.push(args); return logger; },
    info: (...args) => { calls.info.push(args); return logger; },
    warn: (...args) => { calls.warn.push(args); return logger; },
    error: (...args) => { calls.error.push(args); return logger; },
    fatal: (...args) => { calls.fatal.push(args); return logger; },
  };

  const logger = new Proxy(target, {
    get(t, prop) {
      if (typeof t[prop] === 'function') {
        return t[prop].bind(t);
      }
      return t[prop];
    },
  });

  return { logger, calls };
}

describe('auth-state-utils', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('getAuthStateDir returns normalized phone subdirectory', () => {
    const dir = getAuthStateDir('+91 82915 37522', tempDir);
    expect(dir).toBe(path.join(tempDir, '918291537522'));
  });

  test('isResettableFile recognizes deletable prefixes', () => {
    expect(isResettableFile('session-123.456')).toBe(true);
    expect(isResettableFile('pre-key-1.json')).toBe(true);
    expect(isResettableFile('sender-key-foo')).toBe(true);
    expect(isResettableFile('sender-key-memory-bar')).toBe(true);
    expect(isResettableFile('app-state-sync-key-baz')).toBe(true);
  });

  test('isResettableFile protects creds and connection state', () => {
    expect(isResettableFile('creds.json')).toBe(false);
    expect(isResettableFile('connection-state.json')).toBe(false);
    expect(isResettableFile('random.json')).toBe(false);
  });

  test('backupCredsJsonAtomically creates a backup file', async () => {
    const phone = '918291537522';
    const credsPath = path.join(getAuthStateDir(phone, tempDir), 'creds.json');
    const creds = getValidTestCreds();
    await writeTestFile(credsPath, creds);

    const result = await backupCredsJsonAtomically(phone, tempDir);
    expect(result).toBe(true);

    const backupPath = `${credsPath}.bak`;
    const backupContent = await fs.readFile(backupPath, 'utf-8');
    expect(backupContent).toBe(creds);
  });

  test('backupCredsJsonAtomically returns false when creds missing', async () => {
    const result = await backupCredsJsonAtomically('000000000000', tempDir);
    expect(result).toBe(false);
  });

  test('softResetSession deletes only resettable files', async () => {
    const phone = '918291537522';
    const dir = getAuthStateDir(phone, tempDir);
    const files = {
      'creds.json': getValidTestCreds(),
      'connection-state.json': '{"state":"open"}',
      'session-1.0': 'sessiondata',
      'pre-key-1.json': 'prekeydata',
      'sender-key-abc': 'senderkeydata',
      'sender-key-memory-xyz': 'memorydata',
      'app-state-sync-key-123': 'syncdata',
      'random-file.txt': 'random',
    };

    for (const [name, content] of Object.entries(files)) {
      await writeTestFile(path.join(dir, name), content);
    }

    const result = await softResetSession(phone, tempDir);
    expect(result.error).toBeNull();
    expect(result.deleted.sort()).toEqual([
      'app-state-sync-key-123',
      'pre-key-1.json',
      'sender-key-abc',
      'sender-key-memory-xyz',
      'session-1.0',
    ]);
    expect(result.preserved.sort()).toEqual([
      'connection-state.json',
      'creds.json',
      'creds.json.bak',
      'random-file.txt',
    ]);

    // Verify the files on disk
    for (const file of result.deleted) {
      await expect(fs.access(path.join(dir, file))).rejects.toThrow();
    }
    for (const file of result.preserved) {
      await expect(fs.access(path.join(dir, file))).resolves.toBeUndefined();
    }
  });

  test('restoreCredsFromBackup restores when live creds are empty', async () => {
    const phone = '918291537522';
    const dir = getAuthStateDir(phone, tempDir);
    const credsPath = path.join(dir, 'creds.json');
    const backupPath = `${credsPath}.bak`;
    const backupCreds = getValidTestCreds({ me: { id: 'restored@s.whatsapp.net' } });
    await writeTestFile(credsPath, '');
    await writeTestFile(backupPath, backupCreds);

    const restored = await restoreCredsFromBackup(phone, tempDir);
    expect(restored).toBe(true);
    const content = await fs.readFile(credsPath, 'utf-8');
    expect(content).toBe(backupCreds);
  });

  test('restoreCredsFromBackup restores when live creds are structurally invalid', async () => {
    const phone = '918291537522';
    const dir = getAuthStateDir(phone, tempDir);
    const credsPath = path.join(dir, 'creds.json');
    const backupPath = `${credsPath}.bak`;
    const backupCreds = getValidTestCreds();
    await writeTestFile(credsPath, '{"live":true}');
    await writeTestFile(backupPath, backupCreds);

    const restored = await restoreCredsFromBackup(phone, tempDir);
    expect(restored).toBe(true);
    const content = await fs.readFile(credsPath, 'utf-8');
    expect(content).toBe(backupCreds);
  });

  test('restoreCredsFromBackup does nothing when live creds are valid', async () => {
    const phone = '918291537522';
    const credsPath = path.join(getAuthStateDir(phone, tempDir), 'creds.json');
    const liveCreds = getValidTestCreds();
    await writeTestFile(credsPath, liveCreds);

    const restored = await restoreCredsFromBackup(phone, tempDir);
    expect(restored).toBe(false);
  });

  test('softResetSession aborts when backup cannot be created', async () => {
    const phone = '918291537522';
    const dir = getAuthStateDir(phone, tempDir);
    await fs.mkdir(dir, { recursive: true });
    // No creds.json here, so backup fails.
    const result = await softResetSession(phone, tempDir);
    expect(result.error).toBe('backup_failed');
    expect(result.deleted).toHaveLength(0);
  });
});

describe('isHealthProbeFailure', () => {
  test('detects Bad MAC', () => {
    expect(isHealthProbeFailure(new Error('Bad MAC'))).toBe(true);
  });

  test('detects No matching session', () => {
    expect(isHealthProbeFailure(new Error('No matching sessions'))).toBe(true);
  });

  test('detects Invalid PreKey ID', () => {
    expect(isHealthProbeFailure(new Error('Invalid PreKey ID'))).toBe(true);
  });

  test('detects 408 status code', () => {
    const err = new Error('Timed Out');
    err.output = { statusCode: 408 };
    expect(isHealthProbeFailure(err)).toBe(true);
  });

  test('ignores generic errors', () => {
    expect(isHealthProbeFailure(new Error('Something went wrong'))).toBe(false);
    expect(isHealthProbeFailure(null)).toBe(false);
  });
});

describe('createSocketLogger', () => {
  test('intercepts init queries timeout and logs it without ending socket', () => {
    const { logger, calls } = createStubLogger();
    const ended = [];
    const session = {
      phone: '918291537522',
      connectionState: 'open',
      socket: {
        end: () => {
          ended.push('end');
        },
      },
    };

    const socketLogger = createSocketLogger(session, logger);
    const timeoutError = new Error('Timed Out');
    timeoutError.output = { statusCode: 408 };
    socketLogger.error({ err: timeoutError }, "unexpected error in 'init queries'");

    // The socket should NOT be ended; the health probe handles half-open detection.
    expect(ended).toHaveLength(0);
    expect(calls.error.length).toBe(1);
    expect(calls.error[0][1]).toContain('init queries');
  });

  test('passes through normal error logs without ending socket', () => {
    const { logger, calls } = createStubLogger();
    const ended = [];
    const session = {
      phone: '918291537522',
      connectionState: 'open',
      socket: {
        end: () => {
          ended.push('end');
        },
      },
    };

    const socketLogger = createSocketLogger(session, logger);
    socketLogger.error({ err: new Error('random failure') }, 'unexpected error in fetch blocklist');

    expect(ended).toHaveLength(0);
    expect(calls.error.length).toBe(1);
  });
});

describe('health probe lifecycle', () => {
  beforeEach(() => {
    // Clear any timers left over from other tests
    for (const [phone, timer] of healthProbeTimers.entries()) {
      clearInterval(timer);
      healthProbeTimers.delete(phone);
    }
  });

  afterEach(() => {
    for (const [phone, timer] of healthProbeTimers.entries()) {
      clearInterval(timer);
      healthProbeTimers.delete(phone);
    }
  });

  test('startHealthProbe registers an interval timer', () => {
    let presenceCalls = 0;
    const session = {
      phone: '918291537522',
      connectionState: 'open',
      socket: {
        user: { id: '918291537522@s.whatsapp.net' },
        sendPresenceUpdate: async () => {
          presenceCalls++;
          return undefined;
        },
      },
    };

    startHealthProbe(session);
    expect(healthProbeTimers.has('918291537522')).toBe(true);
    stopHealthProbe('918291537522');
    expect(healthProbeTimers.has('918291537522')).toBe(false);
  });
});

describe('config exports', () => {
  test('new robustness constants are exported from config.js', async () => {
    const config = await import('../src/config.js');
    expect(typeof config.HEALTH_PROBE_INTERVAL_MS).toBe('number');
    expect(typeof config.HEALTH_PROBE_TIMEOUT_MS).toBe('number');
    expect(typeof config.DEFAULT_QUERY_TIMEOUT_MS).toBe('number');
    expect(typeof config.PREKEY_ROTATION_INTERVAL_MS).toBe('number');
    expect(typeof config.SOFT_RESET_MAX_RETRIES).toBe('number');
  });
});
