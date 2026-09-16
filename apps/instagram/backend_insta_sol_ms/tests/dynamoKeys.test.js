// Key construction. No AWS: `keys`, `chunk` and the cursor codec are pure,
// which is exactly why they live outside the client.

import test from 'node:test';
import assert from 'node:assert/strict';
import { keys, chunk, encodeCursor, decodeCursor } from '../services/dynamoService.js';

const TENANT = 'tenant-abc';

test('partition key is TENANT#<tenantId>', () => {
  assert.equal(keys.tenantPk(TENANT), 'TENANT#tenant-abc');
});

test('a missing tenantId throws rather than silently building a cross-tenant key', () => {
  // The load-bearing assertion for multi-tenancy: an undefined tenantId must
  // never become "TENANT#undefined", which every tenant would share.
  assert.throws(() => keys.tenantPk(undefined), /tenantId is required/);
  assert.throws(() => keys.tenantPk(''), /tenantId is required/);
  assert.throws(() => keys.tenantPk(null), /tenantId is required/);
  assert.throws(() => keys.gsiEnquiryPk(undefined), /tenantId is required/);
  assert.throws(() => keys.registryAccount(undefined, '1'), /tenantId is required/);
});

test('sort keys', () => {
  assert.equal(keys.account('178414'), 'IGACCOUNT#178414');
  assert.equal(keys.accountSnapshot('178414', '2026-03-04'), 'SNAP#ACCOUNT#178414#2026-03-04');
  assert.equal(keys.media('m1'), 'MEDIA#m1');
  assert.equal(keys.mediaSnapshot('m1', '2026-03-04'), 'SNAP#MEDIA#m1#2026-03-04');
  assert.equal(keys.enquiry('e1'), 'ENQ#e1');
  assert.equal(keys.thread('t1'), 'THREAD#t1');
  assert.equal(keys.message('t1', 'mid'), 'MSG#t1#mid');
  assert.equal(keys.comment('c1'), 'COMMENT#c1');
  assert.equal(keys.rule('r1'), 'RULE#r1');
  assert.equal(keys.registryId('999'), 'IGID#999');
});

test("a thread's message prefix does not swallow another thread's messages", () => {
  const prefix = keys.messagePrefix('acct_1');
  assert.ok(keys.message('acct_1', 'm').startsWith(prefix));
  assert.ok(!keys.message('acct_10', 'm').startsWith(prefix));
});

test('enquiry GSI keys sort by createdAt', () => {
  assert.equal(keys.gsiEnquiryPk(TENANT), 'TENANT#tenant-abc#ENQ');
  const older = keys.gsiEnquirySk('2026-03-01T10:00:00.000Z', 'e1');
  const newer = keys.gsiEnquirySk('2026-03-04T10:00:00.000Z', 'e2');
  assert.ok(older < newer, 'ISO timestamps must sort lexicographically');
});

test('snapshot prefixes bound a query to one account or one media item', () => {
  const prefix = keys.accountSnapshotPrefix('178414');
  assert.ok(keys.accountSnapshot('178414', '2026-03-04').startsWith(prefix));
  assert.ok(!keys.accountSnapshot('1784140', '2026-03-04').startsWith(prefix));

  const mediaPrefix = keys.mediaSnapshotPrefix('m1');
  assert.ok(keys.mediaSnapshot('m1', '2026-03-04').startsWith(mediaPrefix));
  assert.ok(!keys.mediaSnapshot('m10', '2026-03-04').startsWith(mediaPrefix));
});

test('the media prefix does not swallow media snapshots, the account prefix does not swallow snapshots', () => {
  assert.ok(!keys.mediaSnapshot('m1', '2026-03-04').startsWith(keys.mediaPrefix()));
  assert.ok(!keys.accountSnapshot('1', '2026-03-04').startsWith(keys.accountPrefix()));
});

test('batch writes chunk at the DynamoDB 25-item ceiling', () => {
  const groups = chunk(Array.from({ length: 500 }, (_, i) => i));
  assert.equal(groups.length, 20);
  assert.ok(groups.every((g) => g.length <= 25));
  assert.deepEqual(chunk([]), []);
  assert.equal(chunk(Array.from({ length: 26 }, (_, i) => i)).length, 2);
});

test('cursors round-trip and a corrupt one restarts the page', () => {
  const key = { pk: 'TENANT#t', sk: 'ENQ#e1', gsi1pk: 'TENANT#t#ENQ', gsi1sk: 'x' };
  assert.deepEqual(decodeCursor(encodeCursor(key)), key);
  assert.equal(encodeCursor(undefined), null);
  assert.equal(decodeCursor(undefined), undefined);
  assert.equal(decodeCursor('!!!not-base64!!!'), undefined);
  assert.equal(decodeCursor(Buffer.from('42').toString('base64url')), undefined);
});
