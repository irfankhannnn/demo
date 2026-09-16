import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireApiKey, extractTenantId, safeEqual } from './internalAuth.js';

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

test('safeEqual', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('', ''), false);
  assert.equal(safeEqual(undefined, 'x'), false);
});

test('requireApiKey fails closed when unset', () => {
  delete process.env.TEST_KEY;
  const res = fakeRes();
  let called = false;
  requireApiKey('TEST_KEY', 'test')({ headers: { 'x-api-key': 'x' }, path: '/' }, res, () => { called = true; });
  assert.equal(res.statusCode, 503);
  assert.equal(called, false);
});

test('requireApiKey rejects a wrong key and accepts the right one', () => {
  process.env.TEST_KEY = 'secret';
  const bad = fakeRes();
  requireApiKey('TEST_KEY', 'test')({ headers: { 'x-api-key': 'nope' }, path: '/', method: 'GET' }, bad, () => {});
  assert.equal(bad.statusCode, 401);

  let called = false;
  requireApiKey('TEST_KEY', 'test')({ headers: { 'x-api-key': 'secret' }, path: '/' }, fakeRes(), () => { called = true; });
  assert.equal(called, true);
});

test('extractTenantId requires the header', () => {
  const res = fakeRes();
  extractTenantId({ headers: {} }, res, () => {});
  assert.equal(res.statusCode, 400);
  const req = { headers: { 'x-tenant-id': 't-1' } };
  extractTenantId(req, fakeRes(), () => {});
  assert.equal(req.tenantId, 't-1');
});
