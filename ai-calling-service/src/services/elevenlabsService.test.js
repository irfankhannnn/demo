/**
 * Tests for the pure, security-critical helpers in elevenlabsService.
 *
 * These replace the deleted hinglishIntentPatterns tests: intent is now
 * classified by the agent's own model, so what's left worth pinning down is
 * webhook signature verification (a wrong answer here either lets forged call
 * outcomes through or silently rejects every real delivery) and the dynamic
 * variables / correlation parsing the whole call flow hangs off.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  verifyWebhookSignature,
  parseSignatureHeader,
  buildDynamicVariables,
  parsePostCallWebhook,
  normalizeTranscript,
  extractQualificationResult,
} from './elevenlabsService.js';

const SECRET = 'whsec_test_secret';

function sign(body, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v0=${digest}`;
}

test('parseSignatureHeader reads t and v0 in either order', () => {
  assert.deepEqual(parseSignatureHeader('t=123,v0=abc'), { timestamp: '123', signature: 'abc' });
  assert.deepEqual(parseSignatureHeader('v0=abc,t=123'), { timestamp: '123', signature: 'abc' });
  assert.deepEqual(parseSignatureHeader(' t=123 , v0=abc '), { timestamp: '123', signature: 'abc' });
});

test('verifyWebhookSignature accepts a correctly signed body', () => {
  const body = JSON.stringify({ type: 'post_call_transcription', data: {} });
  const result = verifyWebhookSignature(body, sign(body), SECRET);
  assert.equal(result.valid, true);
});

test('verifyWebhookSignature rejects a tampered body', () => {
  const body = JSON.stringify({ type: 'post_call_transcription', data: {} });
  const header = sign(body);
  const result = verifyWebhookSignature(body.replace('post_call', 'forged'), header, SECRET);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'signature mismatch');
});

test('verifyWebhookSignature rejects a signature made with the wrong secret', () => {
  const body = '{"a":1}';
  const result = verifyWebhookSignature(body, sign(body, 'wrong_secret'), SECRET);
  assert.equal(result.valid, false);
});

test('verifyWebhookSignature rejects a stale timestamp (replay)', () => {
  const body = '{"a":1}';
  const oldTs = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
  const result = verifyWebhookSignature(body, sign(body, SECRET, oldTs), SECRET);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'signature timestamp outside tolerance window');
});

test('verifyWebhookSignature fails closed on missing inputs', () => {
  const body = '{"a":1}';
  assert.equal(verifyWebhookSignature(body, sign(body), '').valid, false);
  assert.equal(verifyWebhookSignature(body, '', SECRET).valid, false);
  assert.equal(verifyWebhookSignature(body, 'garbage', SECRET).valid, false);
});

test('buildDynamicVariables leaves no null or undefined values', () => {
  // A sparse config is the realistic case — most leads have no context.
  const vars = buildDynamicVariables({ tenantId: 't1' });
  for (const [key, value] of Object.entries(vars)) {
    assert.equal(typeof value, 'string', `${key} must be a string`);
    assert.doesNotMatch(value, /^(null|undefined)$/, `${key} leaked a null-ish value`);
  }
  assert.match(vars.lead_context, /No previous interactions/);
});

test('buildDynamicVariables carries correlation ids under secret__ keys', () => {
  const vars = buildDynamicVariables({
    tenantId: 't1',
    leadId: 'l1',
    callSessionId: 'c1',
    agencyName: 'Cloudberry Estates',
  });
  assert.equal(vars.secret__tenant_id, 't1');
  assert.equal(vars.secret__lead_id, 'l1');
  assert.equal(vars.secret__call_session_id, 'c1');
  assert.equal(vars.agency_name, 'Cloudberry Estates');
});

test('parsePostCallWebhook extracts correlation ids from dynamic variables', () => {
  const parsed = parsePostCallWebhook({
    type: 'post_call_transcription',
    event_timestamp: 1234,
    data: {
      conversation_id: 'conv_1',
      conversation_initiation_client_data: {
        dynamic_variables: {
          secret__tenant_id: 't1',
          secret__lead_id: 'l1',
          secret__call_session_id: 'c1',
        },
      },
      metadata: { call_duration_secs: 42 },
      transcript: [{ role: 'agent', message: 'Hello' }],
    },
  });

  assert.equal(parsed.tenantId, 't1');
  assert.equal(parsed.leadId, 'l1');
  assert.equal(parsed.callSessionId, 'c1');
  assert.equal(parsed.conversationId, 'conv_1');
  assert.equal(parsed.callDurationSecs, 42);
});

test('normalizeTranscript maps roles and tolerates both message and text fields', () => {
  const turns = normalizeTranscript({
    transcript: [
      { role: 'agent', message: 'Namaste' },
      { role: 'user', text: 'Haan bataiye' },
      { role: 'user', message: '' },
    ],
  });

  assert.equal(turns.length, 2);
  assert.equal(turns[0].speaker, 'ai');
  assert.equal(turns[1].speaker, 'customer');
  assert.equal(turns[1].text, 'Haan bataiye');
});

test('extractQualificationResult finds the last valid marker', () => {
  const result = extractQualificationResult([
    { text: '[QUALIFICATION_RESULT: {"temperature":"COLD","reasons":["early"]}]' },
    { text: '[QUALIFICATION_RESULT: {"temperature":"HOT","reasons":["ready","named area"]}]' },
  ]);
  assert.equal(result.temperature, 'HOT');
  assert.equal(result.reasons, 'ready; named area');
});

test('extractQualificationResult returns null when absent or malformed', () => {
  assert.equal(extractQualificationResult([{ text: 'no marker here' }]), null);
  assert.equal(extractQualificationResult([{ text: '[QUALIFICATION_RESULT: {oops}]' }]), null);
  assert.equal(extractQualificationResult([{ text: '[QUALIFICATION_RESULT: {"temperature":"LUKEWARM"}]' }]), null);
  assert.equal(extractQualificationResult(null), null);
});
