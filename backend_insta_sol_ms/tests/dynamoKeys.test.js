// Key construction against contract section 3. No AWS: `keys`, `chunk` and the
// cursor codec are pure, which is exactly why they live outside the client.

import test from 'node:test';
import assert from 'node:assert/strict';
import { keys, chunk, encodeCursor, decodeCursor } from '../services/dynamoService.js';

const TENANT = 'tenant-abc';

test('partition key is TENANT#<tenantId>', () => {
  assert.equal(keys.tenantPk(TENANT), 'TENANT#tenant-abc');
});

test('a missing tenantId throws rather than silently building a cross-tenant key', () => {
  // This is the load-bearing assertion for multi-tenancy: an undefined tenantId
  // must never become the string "TENANT#undefined", which every tenant would
  // share.
  assert.throws(() => keys.tenantPk(undefined), /tenantId is required/);
  assert.throws(() => keys.tenantPk(''), /tenantId is required/);
  assert.throws(() => keys.tenantPk(null), /tenantId is required/);
  assert.throws(() => keys.gsiEnquiryPk(undefined), /tenantId is required/);
});

test('sort keys match the contract table', () => {
  assert.equal(keys.device('d1'), 'DEVICE#d1');
  assert.equal(keys.pairingCode('ab12cd34'), 'PAIRCODE#AB12CD34');
  assert.equal(keys.accountSnapshot('178414', '2026-03-04'), 'SNAP#ACCOUNT#178414#2026-03-04');
  assert.equal(keys.media('m1'), 'MEDIA#m1');
  assert.equal(keys.mediaSnapshot('m1', '2026-03-04'), 'SNAP#MEDIA#m1#2026-03-04');
  assert.equal(keys.enquiry('e1'), 'ENQ#e1');
  assert.equal(keys.thread('c1'), 'THREAD#c1');
  assert.equal(keys.rule('r1'), 'RULE#r1');
});

test('pairing codes are case-normalised so a typed lowercase code still pairs', () => {
  assert.equal(keys.pairingCode('abcd2345'), keys.pairingCode('ABCD2345'));
  assert.equal(keys.gsiPairingCode('abcd2345'), 'PAIRCODE#ABCD2345');
});

test('GSI1 keys support the two lookups that cannot be tenant-scoped', () => {
  assert.equal(keys.gsiDevice('d1'), 'DEVICE#d1');
  assert.equal(keys.gsiPairingCode('CODE1234'), 'PAIRCODE#CODE1234');
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
  // The trailing '#' is what stops account 1784140 leaking into 178414's range.
  assert.ok(!keys.accountSnapshot('1784140', '2026-03-04').startsWith(prefix));

  const mediaPrefix = keys.mediaSnapshotPrefix('m1');
  assert.ok(keys.mediaSnapshot('m1', '2026-03-04').startsWith(mediaPrefix));
  assert.ok(!keys.mediaSnapshot('m10', '2026-03-04').startsWith(mediaPrefix));
});

test('the media prefix does not swallow media snapshots', () => {
  // Both live under the same partition; MEDIA# must not match SNAP#MEDIA#.
  assert.ok(keys.media('m1').startsWith(keys.mediaPrefix()));
  assert.ok(!keys.mediaSnapshot('m1', '2026-03-04').startsWith(keys.mediaPrefix()));
});

test('audit keys carry the event id and the device nonce', () => {
  assert.equal(keys.auditEvent('2026-03-04T10:00:00.000Z', 'u1'), 'EVT#2026-03-04T10:00:00.000Z#u1');
  assert.equal(keys.nonce('d1', 'n1'), 'NONCE#d1#n1');
});

test('batch writes chunk at DynamoDB 25-item ceiling', () => {
  const items = Array.from({ length: 500 }, (_, i) => i);
  const groups = chunk(items);
  assert.equal(groups.length, 20);
  assert.ok(groups.every((g) => g.length <= 25));
  assert.equal(groups.flat().length, 500);

  assert.deepEqual(chunk([]), []);
  assert.equal(chunk([1, 2, 3]).length, 1);
  assert.equal(chunk(Array.from({ length: 26 }, (_, i) => i)).length, 2);
});

test('cursors round-trip and a corrupt one restarts the page', () => {
  const key = { pk: 'TENANT#t', sk: 'ENQ#e1', gsi1pk: 'TENANT#t#ENQ', gsi1sk: 'x' };
  const cursor = encodeCursor(key);
  assert.deepEqual(decodeCursor(cursor), key);

  assert.equal(encodeCursor(undefined), null);
  assert.equal(decodeCursor(undefined), undefined);
  // A stale cursor from before a redeploy must not 500 the dashboard.
  assert.equal(decodeCursor('!!!not-base64!!!'), undefined);
  assert.equal(decodeCursor(Buffer.from('42').toString('base64url')), undefined);
});
