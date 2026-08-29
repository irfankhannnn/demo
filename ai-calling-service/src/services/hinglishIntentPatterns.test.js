/**
 * Phase 5c — Hinglish voice-intent classification.
 *
 * Uses node:test / node:assert, which are built into Node 18+. This service
 * has no test framework and adding one days before launch to cover one module
 * would be a larger change than the module. Run with `npm test`.
 *
 * The collision cases matter more than the happy paths here. "chahiye" means
 * "I want" (availability) and "nahi chahiye" means "I don't" (end the call);
 * "dekhna hai" is a site visit but "detail batao" is a details request. Regex
 * classification lives or dies on those boundaries, so they are tested
 * explicitly rather than assumed.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HINGLISH_PATTERNS, withHinglishPatterns } from './hinglishIntentPatterns.js';

/** Mirrors the priority order in intentService.classifyIntent. */
const PRIORITY = [
  'HANDOFF_HUMAN',
  'CALL_END',
  'SCHEDULE_SITE_VISIT',
  'PROPERTY_DETAILS',
  'PROPERTY_AVAILABILITY',
  'PRICING_INFO',
  'FAQ_POLICY',
  'AGENCY_INFO',
];

/** Classify using the merged patterns, in the same order the service uses. */
function classify(transcript) {
  for (const intent of PRIORITY) {
    for (const pattern of HINGLISH_PATTERNS[intent] || []) {
      if (pattern.test(transcript)) return intent;
    }
  }
  return 'SMALL_TALK';
}

describe('Hinglish intent classification', () => {
  const cases = [
    // Pricing — the single most common inbound question.
    ['kiraya kitna hai?', 'PRICING_INFO'],
    ['rent kitna hai bhai', 'PRICING_INFO'],
    ['kitne ka hai ye flat', 'PRICING_INFO'],
    ['deposit kitna lagega', 'PRICING_INFO'],
    ['mahine ka kitna kiraya hai', 'PRICING_INFO'],

    // Availability.
    ['2 BHK flat chahiye', 'PROPERTY_AVAILABILITY'],
    ['koi ghar hai kya Kurla mein', 'PROPERTY_AVAILABILITY'],
    ['khali hai abhi?', 'PROPERTY_AVAILABILITY'],
    ['main flat dhoondh raha hoon', 'PROPERTY_AVAILABILITY'],
    ['kiraye pe chahiye', 'PROPERTY_AVAILABILITY'],

    // Site visit.
    ['flat dekhna hai', 'SCHEDULE_SITE_VISIT'],
    ['kab dekh sakte hain', 'SCHEDULE_SITE_VISIT'],
    ['visit karna hai kal', 'SCHEDULE_SITE_VISIT'],
    ['main dekhne aaunga', 'SCHEDULE_SITE_VISIT'],

    // Details.
    ['iske baare mein bataiye', 'PROPERTY_DETAILS'],
    ['kitne bedroom hain', 'PROPERTY_DETAILS'],
    ['amenities kya kya hain', 'PROPERTY_DETAILS'],

    // Policy.
    ['bachelor allowed hai kya', 'FAQ_POLICY'],
    ['agreement kitne saal ka hai', 'FAQ_POLICY'],
    ['maintenance kitna alag se', 'FAQ_POLICY'],

    // Handoff.
    ['kisi insaan se baat karao', 'HANDOFF_HUMAN'],
    ['agent se baat karni hai', 'HANDOFF_HUMAN'],

    // Call end.
    ['nahi chahiye', 'CALL_END'],
    ['bas itna hi', 'CALL_END'],
    ['shukriya', 'CALL_END'],
    ['main rakhta hoon', 'CALL_END'],

    // Agency.
    ['aap kaun ho', 'AGENCY_INFO'],
    ['office kahan hai aapka', 'AGENCY_INFO'],
  ];

  for (const [transcript, expected] of cases) {
    test(`"${transcript}" -> ${expected}`, () => {
      assert.equal(classify(transcript), expected);
    });
  }
});

describe('collision boundaries', () => {
  test('"chahiye" wants a property, "nahi chahiye" ends the call', () => {
    // Both contain "chahiye". CALL_END is checked first and requires the
    // negation, so the affirmative cannot be swallowed by it.
    assert.equal(classify('flat chahiye'), 'PROPERTY_AVAILABILITY');
    assert.equal(classify('nahi chahiye'), 'CALL_END');
    assert.equal(classify('mujhe kuch nahi chahiye'), 'CALL_END');
  });

  test('"dekhna" is a site visit, not a details request', () => {
    assert.equal(classify('ghar dekhna hai'), 'SCHEDULE_SITE_VISIT');
    assert.equal(classify('detail batao'), 'PROPERTY_DETAILS');
  });

  test('a bare greeting still falls through to small talk', () => {
    // The default must stay reachable — over-matching would answer "namaste"
    // with a pricing quote.
    assert.equal(classify('namaste'), 'SMALL_TALK');
    assert.equal(classify('hello ji'), 'SMALL_TALK');
  });

  test('Devanagari transcripts classify too', () => {
    assert.equal(classify('किराया क्या है'), 'PRICING_INFO');
    assert.equal(classify('किसी से बात कराओ'), 'HANDOFF_HUMAN');
  });
});

describe('withHinglishPatterns', () => {
  test('appends rather than replacing, so English matching is untouched', () => {
    const english = /^show me flats$/i;
    const merged = withHinglishPatterns([
      { intent: 'PROPERTY_AVAILABILITY', patterns: [english], confidence: 0.85 },
    ]);
    assert.equal(merged[0].patterns[0], english, 'English pattern must stay first');
    assert.ok(merged[0].patterns.length > 1, 'Hinglish patterns must be appended');
  });

  test('leaves an intent with no Hinglish patterns exactly as it was', () => {
    const entry = { intent: 'UNKNOWN', patterns: [/x/], confidence: 0.1 };
    assert.deepEqual(withHinglishPatterns([entry])[0], entry);
  });

  test('preserves intent order and confidence', () => {
    const input = [
      { intent: 'CALL_END', patterns: [/bye/i], confidence: 0.9 },
      { intent: 'PRICING_INFO', patterns: [/price/i], confidence: 0.85 },
    ];
    const merged = withHinglishPatterns(input);
    assert.deepEqual(merged.map((e) => e.intent), ['CALL_END', 'PRICING_INFO']);
    assert.deepEqual(merged.map((e) => e.confidence), [0.9, 0.85]);
  });
});
