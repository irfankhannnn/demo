// Lead extraction and analysis.
//
// What these tests protect: a phone number is only ever the lead's own (never
// the agency's number from our messages, never one a model made up), Indian
// budget shorthand is read at the right scale, and an AI failure degrades to
// the rule-based result instead of losing the lead.

import test from 'node:test';
import assert from 'node:assert/strict';
import { withEnv } from './support.js';
import { findPhones, parseBudget, detectIntent, detectPropertyType, looksLikeSpam } from '../services/extract.js';
import { analyseConversation, analyseWithRules, toIntent } from '../services/leadAnalyst.js';

const at = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const lead = (text, h = 1) => ({ direction: 'in', text, createdAt: at(h) });
const us = (text, h = 1) => ({ direction: 'out', text, createdAt: at(h) });

test('finds Indian mobile numbers in the shapes people type', () => {
  assert.deepEqual(findPhones('call me 98765 43210'), ['+919876543210']);
  assert.deepEqual(findPhones('+91-9876543210 or 09123456789'), ['+919876543210', '+919123456789']);
  assert.deepEqual(findPhones('flat 1234567890 pincode 400070'), [], 'not starting 6-9, not a mobile');
});

test('reads budget shorthand at the right scale', () => {
  assert.deepEqual(parseBudget('budget 80L-1Cr'), { min: 8_000_000, max: 10_000_000 });
  assert.deepEqual(parseBudget('80-90 lakh'), { min: 8_000_000, max: 9_000_000 });
  assert.deepEqual(parseBudget('1.4 cr tak'), { min: null, max: 14_000_000 });
  assert.deepEqual(parseBudget('rent 45k'), { min: null, max: 45_000 });
  assert.deepEqual(parseBudget('budget 1.4'), { min: null, max: 14_000_000 });
  assert.equal(parseBudget('2 BHK on 3rd floor'), null);
});

test('intent and property type', () => {
  assert.equal(detectIntent('heavy deposit pe rent chahiye'), 'heavy_deposit_ok');
  assert.equal(detectIntent('2bhk kiraye pe'), 'rent');
  assert.equal(detectIntent('flat lena hai'), 'buy');
  assert.equal(detectIntent('apna flat bechna hai'), 'sell');
  assert.equal(detectPropertyType('need 2 BHK'), '2 BHK');
  assert.equal(detectPropertyType('1 rk chahiye'), '1 RK');
  assert.equal(toIntent('tenant', 'heavy_deposit'), 'heavy_deposit_ok');
  assert.equal(toIntent('landlord', ''), 'unknown');
});

test('a clear requirement with the lead\'s number is very hot and ready for the CRM', () => {
  const a = analyseWithRules({
    messages: [lead('Hi, looking for 2 BHK on rent in Kurla, budget 45k', 2), us('Sure, share your number?', 1.5), lead('call me on 98765 43210', 1)],
    participantUsername: 'rahul.sharma_22',
  });
  assert.equal(a.isLead, true);
  assert.equal(a.leadScore, 'very_hot');
  assert.equal(a.temperature, 'hot');
  assert.equal(a.leadType, 'tenant');
  assert.equal(a.intent, 'rent');
  assert.equal(a.phone, '+919876543210');
  assert.equal(a.propertyType, '2 BHK');
  assert.equal(a.locality, 'Kurla');
  assert.equal(a.name, 'Rahul Sharma');
  assert.equal(a.callRequested, true);
  assert.ok(a.suggestedReply.length > 20);
});

test('our own number in our messages is never recorded as the lead\'s', () => {
  const a = analyseWithRules({
    messages: [lead('2bhk rent andheri?', 2), us('Call us on 9594191916 for details', 1)],
  });
  assert.equal(a.phone, null);
  assert.notEqual(a.leadScore, 'very_hot');
});

test('spam and a thread with nothing inbound are not leads', () => {
  assert.equal(looksLikeSpam('We offer instagram followers promotion'), true);
  assert.equal(analyseWithRules({ messages: [lead('We offer instagram followers promotion')] }).isLead, false);
  assert.equal(analyseWithRules({ messages: [us('Hello')] }), null);
});

test('recency is part of the score: an old number is hot, not very hot', () => {
  const a = analyseWithRules({ messages: [lead('2 bhk rent kurla, my number 9876543210', 24 * 30)] });
  assert.equal(a.leadScore, 'hot');
});

function geminiStub(payload, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return {
      ok,
      status,
      json: async () => (ok ? { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] } : { error: { status: 'UNAVAILABLE' } }),
    };
  };
  return { calls, fetchImpl };
}

const GEMINI_ENV = { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-gemini-key' };

test('the Gemini analysis is used, with the key in a header and never in the URL', async () => {
  await withEnv(GEMINI_ENV, async () => {
    const { calls, fetchImpl } = geminiStub({
      lead_type: 'buyer',
      lead_score: 'hot',
      deal_type: 'buy',
      name: 'Priya',
      property_type: '3 BHK',
      locality: 'Powai',
      city: 'Mumbai',
      budget: '2.5 Cr',
      mobile_number: '',
      summary: 'Priya wants a 3 BHK in Powai around 2.5 Cr.',
      next_action: 'Ask for her number.',
      suggested_reply: 'Hi Priya! Powai me 3 BHK options hain. Number share karenge?',
      meeting_schedule: '',
      meeting_datetime: '',
      call_requested: 'no',
      needs_review: 'no',
      notes: '',
    });
    const a = await analyseConversation({ messages: [lead('3bhk powai buy 2.5cr, Powai Mumbai')] }, { fetchImpl });

    assert.equal(a.analyser, 'gemini');
    assert.equal(a.leadType, 'buyer');
    assert.equal(a.intent, 'buy');
    assert.equal(a.city, 'Mumbai');
    assert.equal(a.budgetBracket, '2Cr_5Cr');
    assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-gemini-key');
    assert.ok(!calls[0].url.includes('test-gemini-key'));
    assert.equal(calls[0].body.generationConfig.responseMimeType, 'application/json');
  });
});

test('a phone number the model invented is rejected and flagged for review', async () => {
  await withEnv(GEMINI_ENV, async () => {
    const { fetchImpl } = geminiStub({
      lead_type: 'tenant',
      lead_score: 'very_hot',
      deal_type: 'rent',
      mobile_number: '9999988888',
      summary: 's',
      next_action: 'n',
      suggested_reply: 'r',
      call_requested: 'yes',
      needs_review: 'no',
    });
    const a = await analyseConversation({ messages: [lead('1bhk rent thane'), us('call 9594191916')] }, { fetchImpl });
    assert.equal(a.phone, null);
    assert.equal(a.callRequested, false);
    assert.equal(a.needsReview, true);
  });
});

test('when Gemini fails, the rule-based result is returned and flagged', async () => {
  await withEnv(GEMINI_ENV, async () => {
    const { fetchImpl } = geminiStub({}, { ok: false, status: 503 });
    const a = await analyseConversation({ messages: [lead('2 bhk rent kurla 9876543210')] }, { fetchImpl });
    assert.equal(a.analyser, 'rules');
    assert.equal(a.phone, '+919876543210');
    assert.equal(a.needsReview, true);
  });
});

test('a clear requirement without a number is still an enquiry, so the score and the list agree', () => {
  const a = analyseWithRules({ messages: [lead('Is the 1bhk in Thane available?')] });
  assert.equal(a.leadScore, 'hot');
  assert.equal(a.isLead, true);
  assert.equal(a.phone, null);
});

test('the rupee budget travels with the analysis', () => {
  const a = analyseWithRules({ messages: [lead('2 bhk rent kurla budget 45k, 9876543210')] });
  assert.equal(a.budgetRupees, 45000);
});
