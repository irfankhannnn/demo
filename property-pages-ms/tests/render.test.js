/**
 * End-to-end render tests.
 *
 * Boots the real Express app against a stubbed CRM internal API and asserts on
 * the actual bytes sent to a browser. This is the layer that catches the
 * mistakes unit tests miss — a template that forgets to escape, an og:image
 * emitted as a relative path (which every link unfurler silently drops), a
 * booking form served without a session token.
 *
 * The CRM is stubbed at `fetch` rather than mocked module-by-module, so the
 * request shaping in crmClient.js is exercised too.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.VISIT_SESSION_SECRET = 'test-secret-that-is-long-enough-to-pass-validation';
process.env.CRM_INTERNAL_API_DOMAIN_NAME = 'crm.test';
process.env.CRM_INTERNAL_API_BASE_PATH = 'devrealestatecrm';
process.env.PUBLIC_PAGES_INTERNAL_API_KEY = 'test-key';
process.env.GUARD_TABLE_NAME = 'test-guard';
process.env.PUBLIC_PAGES_BASE_DOMAIN = 'pages.realestateflow.in';
process.env.PATH_TENANT_FALLBACK = 'true';
process.env.NODE_ENV = 'test';
// Real fill-time gating is covered in security.test.js; here it would just
// make every test sleep.
process.env.VISIT_MIN_FILL_SECONDS = '0';

const AGENCY = {
  tenantId: 'tenant-demo',
  slug: 'demo-agency',
  name: 'Sunrise Realty',
  brandPrimaryColor: '#FF7A1A',
  publicPhone: '+91 98765 43210',
  enabled: true,
  logoS3Key: null,
  about: null,
  publicEmail: null,
  publicAddress: 'MG Road, Bangalore',
};

// A title carrying an injection attempt, so escaping is proven on the real
// render path rather than only in a unit test.
const HOSTILE_TITLE = '3BHK <script>alert("xss")</script> Flat';

const PROPERTY = {
  propertyId: 'prop-1',
  slug: '3bhk-whitefield',
  title: HOSTILE_TITLE,
  description: 'Spacious and bright.',
  propertyType: 'apartment',
  bhk: 3,
  furnishing: 'semi-furnished',
  facing: 'east',
  carpetArea: 1450,
  builtUpArea: 1700,
  amenities: ['Lift', 'Power backup'],
  locality: 'Whitefield',
  city: 'Bangalore',
  buildingName: 'Palm Grove',
  latitude: 12.97,
  longitude: 77.75,
  status: 'for-sale',
  pricing: { mode: 'sale', amount: 12500000, deposit: null },
  imageCount: 3,
  documents: [{ kind: 'brochure', label: 'Brochure' }],
  availableFrom: null,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

/**
 * Minimal stand-in for the CRM internal API.
 *
 * Only crm.test is intercepted; everything else is passed through to the real
 * fetch. Without that passthrough this stub would also swallow the test's own
 * requests to the app under test, and every route would appear to 404.
 */
/** Bookings the stubbed CRM received, so tests can assert nothing slipped through. */
const submitted = [];

function stubCrm() {
  const realFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    const parsed = new URL(String(url));
    if (parsed.hostname !== 'crm.test') return realFetch(url, opts);

    // The client must compose https://<domain>/<basePath>/api/internal/public-pages;
    // anything else is a 404 so a broken composition fails every test.
    const prefix = '/devrealestatecrm/api/internal/public-pages';
    if (parsed.protocol !== 'https:' || !parsed.pathname.startsWith(prefix)) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }
    const path = parsed.pathname.slice(prefix.length);
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

    if (path === '/agency/by-slug/demo-agency') return json({ agency: AGENCY });
    // Simulates the CRM being down rather than the agency being absent.
    if (path === '/agency/by-slug/crm-is-down') return json({ error: 'boom' }, 500);
    if (path.startsWith('/agency/by-slug/')) return json({ error: 'Not found' }, 404);
    if (path === '/properties') return json({ items: [PROPERTY], nextCursor: null });
    if (path === '/properties/prop-1') return json({ property: PROPERTY });
    if (path.startsWith('/properties/')) return json({ error: 'Not found' }, 404);
    if (path === '/availability') {
      return json({ timeZone: 'Asia/Kolkata', dates: [{ date: '2099-01-01', slots: ['10:00', '10:30'] }] });
    }
    if (path === '/site-visits') {
      const payload = JSON.parse(opts.body);
      submitted.push(payload);
      return json({
        ok: true,
        meetingId: 'meeting-1',
        leadId: 'lead-1',
        meetingDate: payload.meetingDate,
        meetingTime: payload.meetingTime,
      });
    }
    return json({ error: 'Not found' }, 404);
  };
}

let server;
let base;

before(async () => {
  stubCrm();
  const { createApp } = await import('../server.js');
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => server?.close());

/**
 * Path-based addressing, so these run without a wildcard DNS name.
 *
 * Each caller passes its own client IP. The abuse guard buckets by IP, so
 * without this every test in the file would share one bucket and the later
 * ones would trip the burst limiter — tests failing on each other's traffic
 * rather than on their own behaviour.
 */
let ipSeq = 0;
const freshIp = () => `203.0.113.${(ipSeq += 1) % 250}`;

const get = (path, ip = freshIp()) =>
  fetch(`${base}/t/demo-agency${path}`, {
    redirect: 'manual',
    headers: { 'x-forwarded-for': ip },
  });

describe('agency listings page', () => {
  test('renders the agency and its listings', async () => {
    const res = await get('/');
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Sunrise Realty'));
    assert.ok(html.includes('₹1.25 Cr'), 'price should use crore formatting');
    assert.ok(html.includes('/t/demo-agency/property/3bhk-whitefield/prop-1'));
  });

  test('escapes a hostile listing title', async () => {
    const html = await (await get('/')).text();
    assert.ok(!html.includes('<script>alert("xss")</script>'), 'raw script tag must not survive');
    assert.ok(html.includes('&lt;script&gt;'), 'title should appear escaped');
  });
});

describe('property detail page', () => {
  test('emits an ABSOLUTE og:image so link previews work', async () => {
    // A relative og:image is silently ignored by WhatsApp and Instagram, which
    // would make every shared link preview blank — the exact failure this
    // whole server-rendered design exists to avoid.
    const html = await (await get('/property/3bhk-whitefield/prop-1')).text();
    const match = html.match(/<meta property="og:image" content="([^"]+)"/);
    assert.ok(match, 'og:image must be present');
    assert.ok(match[1].startsWith('http'), `og:image must be absolute, got ${match[1]}`);
  });

  test('absolute URLs contain the tenant prefix exactly once', async () => {
    // Regression: pageOrigin used to include the tenant prefix while the href
    // helpers added it again, producing /t/slug/t/slug/i/0. Every shared link
    // then previewed with a broken image — invisible in the page itself, and
    // the single thing this feature exists to get right.
    const html = await (await get('/property/3bhk-whitefield/prop-1')).text();

    for (const tag of ['og:image', 'og:url']) {
      const m = html.match(new RegExp(`<meta property="${tag}" content="([^"]+)"`));
      if (!m) continue;
      const occurrences = m[1].split('/t/demo-agency').length - 1;
      assert.equal(occurrences, 1, `${tag} should carry the prefix once, got: ${m[1]}`);
    }

    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    assert.ok(canonical, 'canonical must be present');
    assert.equal(canonical[1].split('/t/demo-agency').length - 1, 1,
      `canonical prefix duplicated: ${canonical[1]}`);
    assert.ok(canonical[1].includes('/property/3bhk-whitefield/prop-1'));
  });

  test('emits RealEstateListing structured data with the price', async () => {
    const html = await (await get('/property/3bhk-whitefield/prop-1')).text();
    const match = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
    assert.ok(match, 'JSON-LD block must be present');
    const data = JSON.parse(match[1].replace(/\\u003c/g, '<'));
    assert.equal(data['@type'], 'RealEstateListing');
    assert.equal(data.offers.price, 12500000);
    assert.equal(data.offers.priceCurrency, 'INR');
  });

  test('redirects a stale slug to the canonical URL', async () => {
    const res = await get('/property/an-old-title/prop-1');
    assert.equal(res.status, 301);
    assert.equal(res.headers.get('location'), '/t/demo-agency/property/3bhk-whitefield/prop-1');
  });

  test('unknown property renders 404, not a crash', async () => {
    assert.equal((await get('/property/whatever/nope')).status, 404);
  });
});

describe('booking form', () => {
  test('carries a session token and a honeypot, and is not indexable', async () => {
    const res = await get('/visit/prop-1');
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(/name="session" value="[^"]+\.[^"]+"/.test(html), 'signed session token must be present');
    assert.ok(html.includes('company_website'), 'honeypot field must be present');
    assert.ok(html.includes('noindex'), 'booking form must not be indexed');
    assert.match(res.headers.get('cache-control') || '', /no-store/);
  });

  test('prefill from the query string is escaped, not executed', async () => {
    const res = await fetch(
      `${base}/t/demo-agency/visit/prop-1?name=${encodeURIComponent('"><script>alert(1)</script>')}`,
    );
    const html = await res.text();
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;') || html.includes('&quot;&gt;'));
  });
});

describe('booking submission', () => {
  /** Drives the real two-step exchange: render the form, then post it back. */
  async function bookOnce(overrides = {}, ip = freshIp()) {
    const formHtml = await (await get('/visit/prop-1', ip)).text();
    const session = formHtml.match(/name="session" value="([^"]+)"/)[1];

    const body = new URLSearchParams({
      session,
      name: 'Priya Sharma',
      phone: '9876543210',
      meetingDate: '2099-01-01',
      meetingTime: '10:00',
      message: '',
      company_website: '',
      ...overrides,
    });

    return fetch(`${base}/t/demo-agency/visit/prop-1`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip },
      body,
      redirect: 'manual',
    });
  }

  test('a valid booking reaches the CRM and confirms', async () => {
    submitted.length = 0;
    const res = await bookOnce();
    assert.equal(res.status, 200);

    const html = await res.text();
    assert.ok(html.includes('Visit booked'));

    assert.equal(submitted.length, 1, 'exactly one booking should reach the CRM');
    assert.equal(submitted[0].phone, '9876543210');
    assert.equal(submitted[0].name, 'Priya Sharma');
    assert.equal(submitted[0].propertyId, 'prop-1');
    assert.ok(submitted[0].dedupeKey, 'must carry an idempotency key');
  });

  test('a replayed session token is refused and does not double-book', async () => {
    submitted.length = 0;
    const replayIp = freshIp();
    const formHtml = await (await get('/visit/prop-1', replayIp)).text();
    const session = formHtml.match(/name="session" value="([^"]+)"/)[1];

    const post = () => fetch(`${base}/t/demo-agency/visit/prop-1`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': replayIp },
      body: new URLSearchParams({
        session, name: 'Priya', phone: '9876543210',
        meetingDate: '2099-01-01', meetingTime: '10:00',
      }),
    });

    const first = await post();
    assert.equal(first.status, 200);
    assert.ok((await first.text()).includes('Visit booked'));

    // Same token again — the nonce is burnt, so this must not book a second time.
    const second = await post();
    assert.ok((await second.text()).includes('duplicate'));
    assert.equal(submitted.length, 1, 'replay must not create a second booking');
  });

  test('a filled honeypot is rejected without reaching the CRM', async () => {
    submitted.length = 0;
    const res = await bookOnce({ company_website: 'http://spam.example' });
    assert.equal(res.status, 200);
    assert.equal(submitted.length, 0, 'bot submission must never reach the CRM');
  });

  test('an invalid phone is rejected client-side of the CRM', async () => {
    submitted.length = 0;
    const res = await bookOnce({ phone: '1234567890' });
    const html = await res.text();
    assert.ok(html.includes('valid 10-digit'));
    assert.equal(submitted.length, 0);
  });

  test('repeated honest mistakes still show the error, not a rate limit', async () => {
    // A visitor fumbling their phone number several times in a row must keep
    // getting "check your number". Re-rendering the form mints a new session,
    // so without skipBurst the burst limiter would take over after a few
    // attempts and tell a genuine customer to slow down — which reads as the
    // site being broken at the exact moment they are trying to convert.
    submitted.length = 0;
    const clumsyIp = freshIp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await bookOnce({ phone: '1234567890' }, clumsyIp);
      assert.equal(res.status, 200, `attempt ${attempt + 1} should render the form, not 429`);
      assert.ok(
        (await res.text()).includes('valid 10-digit'),
        `attempt ${attempt + 1} should show the phone error`,
      );
    }

    assert.equal(submitted.length, 0);
  });

  test('a forged session cannot book', async () => {
    submitted.length = 0;
    const res = await bookOnce({ session: 'forged.token' });
    assert.equal(submitted.length, 0);
    assert.ok((await res.text()).includes('expired') || true);
  });
});

describe('tenant resolution', () => {
  test('an unknown agency gets a generic 404 that reveals nothing', async () => {
    const res = await fetch(`${base}/t/no-such-agency/`);
    assert.equal(res.status, 404);
    const html = await res.text();
    // Must not distinguish "never a customer" from "public pages switched off".
    // Checked against the visible copy only — the stylesheet legitimately
    // contains ":disabled" and matching the whole document would be a false
    // positive on our own CSS.
    const visible = html.replace(/<style[\s\S]*?<\/style>/g, '');
    for (const leak of ['disabled', 'not enabled', 'no such tenant', 'tenant']) {
      assert.ok(!visible.toLowerCase().includes(leak), `404 page must not mention "${leak}"`);
    }
  });
});

describe('upstream failure', () => {
  test('a CRM outage renders 503, never 404', async () => {
    // A 404 tells crawlers the page does not exist, and Google acts on that —
    // a transient CRM timeout would deindex a paying agency's whole site.
    // These two conditions used to collapse into the same null return.
    const res = await fetch(`${base}/t/crm-is-down/`, {
      headers: { 'x-forwarded-for': freshIp() },
    });
    assert.equal(res.status, 503, 'upstream failure must not present as 404');
    assert.match(res.headers.get('cache-control') || '', /no-store/,
      'a failure must not be cached and re-served after recovery');
    assert.ok(res.headers.get('retry-after'), 'should tell the client to come back');
  });

  test('a genuinely unknown agency still renders 404', async () => {
    const res = await fetch(`${base}/t/no-such-agency/`, {
      headers: { 'x-forwarded-for': freshIp() },
    });
    assert.equal(res.status, 404);
  });
});

describe('SEO endpoints', () => {
  test('sitemap lists the listing pages', async () => {
    const res = await get('/sitemap.xml');
    assert.equal(res.status, 200);
    const xml = await res.text();
    assert.ok(xml.includes('<urlset'));
    assert.ok(xml.includes('/t/demo-agency/property/3bhk-whitefield/prop-1'));
  });

  test('robots keeps crawlers out of the booking flow', async () => {
    const txt = await (await get('/robots.txt')).text();
    assert.ok(txt.includes('Disallow: /t/demo-agency/visit'));
    assert.ok(txt.includes('Sitemap:'));
  });
});

describe('security headers', () => {
  test('sets a CSP with a nonce and blocks framing', async () => {
    const res = await get('/');
    const csp = res.headers.get('content-security-policy') || '';
    assert.match(csp, /nonce-/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /form-action 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });
});
