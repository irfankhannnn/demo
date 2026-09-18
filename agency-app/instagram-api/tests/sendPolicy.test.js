// The messaging-window gate and keyword-rule matching. These are the two
// places where a bug gets an agency's Instagram account restricted, so their
// edges are asserted directly.

import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWindow, canSend, clampMessage, MAX_MESSAGE_CHARS } from '../services/windowPolicy.js';
import { matchesRule, findRule } from '../services/ruleMatcher.js';

const HOUR = 3600e3;
const now = Date.parse('2026-09-15T12:00:00.000Z');
const ago = (ms) => new Date(now - ms).toISOString();

test('a reply is allowed only inside 24 hours of their last message', () => {
  assert.equal(classifyWindow({ lastInboundAt: ago(23 * HOUR) }, now).state, 'STANDARD');
  assert.equal(canSend({ kind: 'dm', thread: { lastInboundAt: ago(23 * HOUR) } }, now).allowed, true);

  const late = canSend({ kind: 'dm', thread: { lastInboundAt: ago(24 * HOUR + 1) } }, now);
  assert.equal(late.allowed, false);
  assert.equal(late.state, 'CLOSED');

  assert.equal(canSend({ kind: 'dm', thread: {} }, now).allowed, false, 'no inbound message, no reply');
});

test('a comment opens only a private reply, never a free-form DM', () => {
  const thread = { lastCommentAt: ago(3 * 24 * HOUR) };
  assert.equal(classifyWindow(thread, now).state, 'COMMENT_REPLY');
  assert.equal(canSend({ kind: 'dm', thread }, now).allowed, false);
  assert.equal(canSend({ kind: 'private_reply', commentCreatedAt: ago(6 * 24 * HOUR) }, now).allowed, true);
  assert.equal(canSend({ kind: 'private_reply', commentCreatedAt: ago(7 * 24 * HOUR + 1) }, now).allowed, false);
  assert.equal(canSend({ kind: 'private_reply', commentCreatedAt: null }, now).allowed, false);
});

test('a public comment reply is not window-bound', () => {
  assert.equal(canSend({ kind: 'comment_reply' }, now).allowed, true);
});

test('when Meta closes a window, it stays closed until the person writes again', () => {
  const closed = { lastInboundAt: ago(2 * HOUR), windowClosedAt: ago(HOUR) };
  assert.equal(classifyWindow(closed, now).state, 'CLOSED');
  const reopened = { lastInboundAt: ago(10 * 60 * 1000), windowClosedAt: ago(HOUR) };
  assert.equal(classifyWindow(reopened, now).state, 'STANDARD');
});

test('messages are trimmed and capped at the Meta limit', () => {
  assert.equal(clampMessage('  hi  '), 'hi');
  assert.equal(clampMessage('x'.repeat(5000)).length, MAX_MESSAGE_CHARS);
  assert.equal(clampMessage(null), '');
});

test('contains matches the word, not a substring of another word', () => {
  const rule = { keyword: 'PRICE', matchType: 'contains' };
  assert.equal(matchesRule('price?', rule), true);
  assert.equal(matchesRule('Kya PRICE hai', rule), true);
  assert.equal(matchesRule('priceless view', rule), false);
});

test('starts_with works under both spellings, exact and regex behave', () => {
  assert.equal(matchesRule('rate kya hai', { keyword: 'rate', matchType: 'starts_with' }), true);
  assert.equal(matchesRule('rate kya hai', { keyword: 'rate', matchType: 'startswith' }), true);
  assert.equal(matchesRule('what rate', { keyword: 'rate', matchType: 'starts_with' }), false);
  assert.equal(matchesRule('Details', { keyword: 'details', matchType: 'exact' }), true);
  assert.equal(matchesRule('details pls', { keyword: 'details', matchType: 'exact' }), false);
  assert.equal(matchesRule('2bhk?', { keyword: '\\d\\s*bhk', matchType: 'regex' }), true);
  assert.equal(matchesRule('anything', { keyword: '([', matchType: 'regex' }), false, 'a broken regex never matches');
});

test('findRule skips paused rules, honours media scope and picks the oldest match', () => {
  const rules = [
    { ruleId: 'new', keyword: 'price', createdAt: '2026-09-02', enabled: true },
    { ruleId: 'paused', keyword: 'price', createdAt: '2026-08-01', enabled: false },
    { ruleId: 'scoped', keyword: 'price', createdAt: '2026-09-01', mediaScope: 'm2, m3' },
  ];
  assert.equal(findRule('price', 'm1', rules).ruleId, 'new');
  assert.equal(findRule('price', 'm3', rules).ruleId, 'scoped');
  assert.equal(findRule('hello', 'm1', rules), null);
});
