/**
 * The Hinglish extractor. These cases come from how Indian property enquiries
 * are actually written, not from tidy English - "1.4 tak", "budget thoda tight",
 * a phone number typed with a space in the middle.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalisePhone, findPhones, parseBudget, detectIntent, extractName,
  scoreTemperature, looksLikeSpam, formatBracket,
} from '../src/extract/enquiry.js';

test('Indian mobile normalisation', async (t) => {
  await t.test('accepts the shapes people actually type', () => {
    for (const raw of [
      '9812345678', '+919812345678', '91 9812345678', '098 1234 5678',
      '+91-9812345678', '98123 45678', '(+91) 9812345678',
    ]) {
      assert.equal(normalisePhone(raw), '+919812345678', `failed on: ${raw}`);
    }
  });

  await t.test('rejects things that are not Indian mobiles', () => {
    // Landline prefix, too short, too long, and a price that happens to be
    // ten digits - the last one is why the 6-9 leading-digit rule exists.
    for (const raw of ['1234567890', '981234567', '5812345678', '2212345678', '', null]) {
      assert.equal(normalisePhone(raw), null, `should reject: ${raw}`);
    }
  });

  await t.test('finds numbers embedded in a sentence', () => {
    assert.deepEqual(
      findPhones('mera number 98123 45678 hai, whatsapp kar dena'),
      ['+919812345678'],
    );
  });

  await t.test('de-duplicates a number repeated in a thread', () => {
    assert.deepEqual(
      findPhones('9812345678 ... call me on +91 98123 45678'),
      ['+919812345678'],
    );
  });
});

test('Hinglish budget parsing', async (t) => {
  const cases = [
    ['budget 1.4 cr tak hai', null, 14000000],
    ['1 crore ke around', null, 10000000],
    ['50 lakh max', null, 5000000],
    ['budget 90 lakh', null, 9000000],
    ['around 45 lac', null, 4500000],
    ['1.5 crore', null, 15000000],
  ];
  for (const [text, min, max] of cases) {
    await t.test(text, () => {
      const b = parseBudget(text);
      assert.ok(b, `no budget parsed from: ${text}`);
      assert.equal(b.max, max);
      if (min != null) assert.equal(b.min, min);
    });
  }

  await t.test('a range gives both bounds', () => {
    const b = parseBudget('80L-1Cr me dekh raha hoon');
    assert.equal(b.min, 8000000);
    assert.equal(b.max, 10000000);
  });

  await t.test('an omitted unit inherits the other side of the range', () => {
    const b = parseBudget('80 to 90 lakh');
    assert.equal(b.min, 8000000);
    assert.equal(b.max, 9000000);
  });

  await t.test('a bare number needs a budget word nearby', () => {
    // "2 BHK" and "3rd floor" must never parse as prices.
    assert.equal(parseBudget('2 BHK chahiye'), null);
    assert.equal(parseBudget('3rd floor'), null);
    assert.ok(parseBudget('budget 80 hai'));
  });

  await t.test('the bare-number convention is crore for small, lakh for large', () => {
    assert.equal(parseBudget('budget 1.4').max, 14000000);
    assert.equal(parseBudget('budget 80').max, 8000000);
  });

  await t.test('brackets format the way a broker reads them', () => {
    assert.equal(formatBracket(8000000, 10000000), '80L-1Cr');
    assert.equal(formatBracket(null, 14000000), '<1.4Cr');
  });
});

test('intent detection', async (t) => {
  const cases = [
    ['2bhk kharidna hai', 'buy'],
    ['rent pe chahiye', 'rent'],
    ['kiraye ka flat', 'rent'],
    ['heavy deposit basis pe', 'heavy_deposit_ok'],
    ['apna flat bechna hai', 'sell'],
    ['hi', 'unknown'],
  ];
  for (const [text, expected] of cases) {
    await t.test(`${text} -> ${expected}`, () => assert.equal(detectIntent(text), expected));
  }

  await t.test('heavy deposit wins over rent when both appear', () => {
    // A heavy-deposit arrangement always mentions rent, and it is a materially
    // different product, so the more specific match has to win.
    assert.equal(detectIntent('rent ya heavy deposit dono chalega'), 'heavy_deposit_ok');
  });
});

test('name extraction', async (t) => {
  await t.test('reads a stated name', () => {
    assert.equal(extractName('Hi, my name is Rahul Sharma'), 'Rahul Sharma');
    assert.equal(extractName('mera naam Priya hai'), 'Priya');
  });
  await t.test('falls back to a tidied handle', () => {
    assert.equal(extractName(null, 'rakesh.properties99'), 'Rakesh Properties');
  });
  await t.test('returns null when there is nothing to use', () => {
    assert.equal(extractName(null, null), null);
  });
});

test('temperature scoring', async (t) => {
  await t.test('phone plus budget plus intent is hot', () => {
    const r = scoreTemperature({
      phone: '+919812345678', budget: { max: 14000000 }, intent: 'buy',
      area: 'Andheri West', messageCount: 4, askedSiteVisit: true,
    });
    assert.equal(r.temperature, 'hot');
  });

  await t.test('a bare hello is cold', () => {
    assert.equal(scoreTemperature({ messageCount: 1 }).temperature, 'cold');
  });

  await t.test('a phone number alone is not enough to be hot', () => {
    // A number with no stated requirement is a real lead but not a priority
    // one, and calling it hot wastes the owner's most expensive resource.
    assert.equal(scoreTemperature({ phone: '+919812345678', messageCount: 1 }).temperature, 'warm');
  });

  await t.test('the score never exceeds 100', () => {
    const r = scoreTemperature({
      phone: 'x', budget: { max: 1 }, intent: 'buy', area: 'a',
      messageCount: 99, askedSiteVisit: true,
    });
    assert.ok(r.score <= 100);
  });
});

test('spam filter', async (t) => {
  await t.test('catches the usual timepass', () => {
    assert.equal(looksLikeSpam('bhai job hai kya'), true);
    assert.equal(looksLikeSpam('I can get you 10k followers'), true);
  });
  await t.test('does not eat a real enquiry that mentions a loan or job', () => {
    assert.equal(looksLikeSpam('job change kar raha hoon, 2bhk flat chahiye'), false);
    assert.equal(looksLikeSpam('is flat ka rent kitna hai'), false);
  });
});
