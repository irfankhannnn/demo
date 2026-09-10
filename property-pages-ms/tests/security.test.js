/**
 * Tests for the parts where being wrong is expensive.
 *
 * Deliberately not a rendering snapshot suite. These cover the escaping, the
 * session token, the phone normaliser and the host parser — the four places
 * where a subtle bug means XSS, a forgeable booking token, merged customer
 * records, or one tenant's page served under another tenant's name.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Config is read at module load by the units under test, so it has to be
// populated before they are imported.
process.env.VISIT_SESSION_SECRET = 'test-secret-that-is-long-enough-to-pass-validation';
process.env.CRM_INTERNAL_API_URL = 'http://localhost:9999';
process.env.PUBLIC_PAGES_INTERNAL_API_KEY = 'test-key';
process.env.GUARD_TABLE_NAME = 'test-guard';
process.env.PUBLIC_PAGES_BASE_DOMAIN = 'pages.realestateflow.in';
process.env.VISIT_MIN_FILL_SECONDS = '0';

const { esc, jsonScript, formatPrice } = await import('../views/layout.js');
const { issueSession, verifySession } = await import('../services/sessionToken.js');
const { slugFromHost } = await import('../middleware/resolveTenant.js');
const { normaliseIndianMobile } = await import('../routes/pages.js');

describe('esc', () => {
  test('neutralises a script tag in a property title', () => {
    const out = esc('<script>alert(1)</script>');
    assert.equal(out, '&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('escapes both quote styles so it is safe inside an attribute', () => {
    // A title containing a quote must not be able to break out of
    // value="..." and add its own onerror= handler.
    const out = esc('" onerror="alert(1)');
    assert.ok(!out.includes('"'));
    assert.ok(out.includes('&quot;'));
    assert.equal(esc("' onload='x"), '&#39; onload=&#39;x');
  });

  test('escapes ampersands first so entities cannot be smuggled', () => {
    // Naive ordering turns &lt; into &amp;lt; only if & is escaped first;
    // getting this backwards would let "&lt;script&gt;" survive as markup.
    assert.equal(esc('&lt;script&gt;'), '&amp;lt;script&amp;gt;');
  });

  test('renders empty for null and undefined rather than the words', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
    assert.equal(esc(0), '0');
  });
});

describe('jsonScript', () => {
  test('a closing script tag in the data cannot end the block early', () => {
    const out = jsonScript({ title: '</script><script>alert(1)</script>' });
    assert.ok(!out.includes('</script>'));
    assert.ok(out.includes('\\u003c'));
  });

  test('escapes the JS line terminators that would break the parse', () => {
    const out = jsonScript({ a: `x${String.fromCharCode(0x2028)}y${String.fromCharCode(0x2029)}z` });
    assert.ok(!out.includes(String.fromCharCode(0x2028)));
    assert.ok(!out.includes(String.fromCharCode(0x2029)));
    assert.ok(out.includes('\\u2028'));
  });

  test('stays valid JSON after escaping', () => {
    const data = { title: 'A <b>bold</b> flat', price: 12500000 };
    assert.deepEqual(JSON.parse(jsonScript(data).replace(/\\u003c/g, '<')), data);
  });
});

describe('session tokens', () => {
  const binding = { tenantId: 'tenant-a', propertyId: 'prop-1' };

  test('a freshly issued token verifies', () => {
    const { token } = issueSession(binding);
    assert.equal(verifySession(token, binding).valid, true);
  });

  test('a tampered payload is rejected', () => {
    const { token } = issueSession(binding);
    const [payload, sig] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    decoded.t = 'tenant-b';
    const forged = `${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${sig}`;
    assert.equal(verifySession(forged, { ...binding, tenantId: 'tenant-b' }).reason, 'bad_signature');
  });

  test('a token minted for one tenant cannot be replayed against another', () => {
    // Signature is valid here — this is the binding check, not the crypto.
    const { token } = issueSession(binding);
    const result = verifySession(token, { tenantId: 'tenant-b', propertyId: 'prop-1' });
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'wrong_tenant');
  });

  test('a token minted for one property cannot be replayed against another', () => {
    const { token } = issueSession(binding);
    const result = verifySession(token, { tenantId: 'tenant-a', propertyId: 'prop-2' });
    assert.equal(result.reason, 'wrong_property');
  });

  test('garbage and truncated tokens are rejected without throwing', () => {
    for (const bad of ['', 'nonsense', 'a.b', '....', null, undefined, 12345]) {
      const result = verifySession(bad, binding);
      assert.equal(result.valid, false);
    }
  });

  test('an expired token is rejected', () => {
    const { token } = issueSession(binding);
    const [payload] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    decoded.i = Math.floor(Date.now() / 1000) - 99999;
    // Re-sign so this tests expiry specifically rather than the signature.
    const newPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const sig = crypto.createHmac('sha256', process.env.VISIT_SESSION_SECRET)
      .update(newPayload).digest('base64url');
    assert.equal(verifySession(`${newPayload}.${sig}`, binding).reason, 'expired');
  });
});

describe('slugFromHost', () => {
  test('reads the tenant label from a subdomain', () => {
    assert.equal(slugFromHost('sunrise-realty.pages.realestateflow.in'), 'sunrise-realty');
  });

  test('ignores port and trailing dot', () => {
    assert.equal(slugFromHost('sunrise-realty.pages.realestateflow.in:443'), 'sunrise-realty');
    assert.equal(slugFromHost('sunrise-realty.pages.realestateflow.in.'), 'sunrise-realty');
  });

  test('refuses hosts outside the configured base domain', () => {
    // The important case: an attacker pointing their own DNS at our
    // distribution must not be able to name a tenant.
    assert.equal(slugFromHost('sunrise-realty.evil.example.com'), null);
    assert.equal(slugFromHost('pages.realestateflow.in.evil.com'), null);
  });

  test('refuses multi-label prefixes', () => {
    assert.equal(slugFromHost('a.b.pages.realestateflow.in'), null);
  });

  test('refuses the bare base domain and malformed input', () => {
    assert.equal(slugFromHost('pages.realestateflow.in'), null);
    assert.equal(slugFromHost(''), null);
    assert.equal(slugFromHost(undefined), null);
  });
});

describe('normaliseIndianMobile', () => {
  test('accepts the formats people actually type', () => {
    for (const input of ['9876543210', '+91 98765 43210', '098765-43210', '91 9876543210']) {
      assert.equal(normaliseIndianMobile(input), '9876543210', `failed on ${input}`);
    }
  });

  test('rejects numbers that are not Indian mobiles', () => {
    // Landlines and short numbers must return null rather than a best guess:
    // the CRM dedupes leads on this value, so a wrong normalisation merges
    // two unrelated people onto one lead.
    for (const input of ['1234567890', '12345', '', null, 'abcdefghij', '5876543210']) {
      assert.equal(normaliseIndianMobile(input), null, `should reject ${input}`);
    }
  });
});

describe('formatPrice', () => {
  test('uses the lakh/crore convention Indian buyers read', () => {
    assert.equal(formatPrice(12500000), '₹1.25 Cr');
    assert.equal(formatPrice(10000000), '₹1 Cr');
    assert.equal(formatPrice(5000000), '₹50 L');
    assert.equal(formatPrice(2500000), '₹25 L');
  });

  test('says "on request" rather than the misleading rupees-zero', () => {
    assert.equal(formatPrice(0), 'Price on request');
    assert.equal(formatPrice(null), 'Price on request');
  });
});
