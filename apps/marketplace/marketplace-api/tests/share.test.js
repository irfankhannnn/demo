/**
 * Share-page escaping. Listing titles come from an agency's CRM, and an
 * agency can type anything — including a script tag. The HTML here is the
 * one place this service renders untrusted text into markup, so it gets the
 * same treatment the pages service gives its views.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.CRM_INTERNAL_API_DOMAIN_NAME = 'http://localhost:9999';
process.env.CRM_INTERNAL_API_BASE_PATH = '';
process.env.MARKETPLACE_WEB_ORIGIN = 'https://marketplace.example';

const { esc, jsonScript, formatPrice, renderShareHtml, webListingUrl } = await import('../services/share.js');
const { buildSitemapXml, buildRobotsTxt } = await import('../services/sitemap.js');

const HOSTILE = {
  propertyId: 'p1',
  title: '3BHK <script>alert("xss")</script> "Sea" View & More',
  description: 'Nice </script><script>alert(1)</script>',
  propertyType: 'apartment',
  bhk: 3,
  locality: 'Bandra',
  city: 'Mumbai',
  pricing: { mode: 'sale', amount: 45000000 },
  imageCount: 2,
  latitude: 19.05,
  longitude: 72.83,
  agency: { name: "Sharma's Realty" },
  listedAt: '2026-09-01T00:00:00.000Z',
};

describe('esc', () => {
  test('neutralises tags and both quote styles', () => {
    assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(esc('" onerror="x'), '&quot; onerror=&quot;x');
    assert.equal(esc("' onload='x"), '&#39; onload=&#39;x');
  });
  test('escapes ampersands first so entities cannot be smuggled', () => {
    assert.equal(esc('&lt;b&gt;'), '&amp;lt;b&amp;gt;');
  });
  test('renders empty for null and undefined rather than the words', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
    assert.equal(esc(0), '0');
  });
});

describe('jsonScript', () => {
  test('a closing script tag in the data cannot end the block early', () => {
    const out = jsonScript({ t: '</script><script>alert(1)</script>' });
    assert.ok(!out.includes('</script>'));
    assert.ok(out.includes('\\u003c'));
  });
  test('stays valid JSON after escaping', () => {
    const data = { t: 'A <b>bold</b> flat', p: 1 };
    assert.deepEqual(JSON.parse(jsonScript(data)), data);
  });
});

describe('renderShareHtml', () => {
  const html = renderShareHtml({ listing: HOSTILE, slug: 'sharma-realty', apiOrigin: 'https://api.example' });

  test('the raw script never survives anywhere in the page', () => {
    assert.ok(!html.includes('<script>alert'));
    assert.ok(!html.includes('</script><script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });

  test('OG tags are present, escaped, and og:image is absolute', () => {
    const title = html.match(/<meta property="og:title" content="([^"]*)"/)[1];
    assert.ok(title.includes('&lt;script&gt;'));
    assert.ok(title.includes('&quot;Sea&quot;'));
    assert.ok(!title.includes('"Sea"'));
    const img = html.match(/<meta property="og:image" content="([^"]*)"/)[1];
    assert.equal(img, 'https://api.example/i/sharma-realty/p1/0');
  });

  test('redirects to the web origin listing route', () => {
    assert.ok(html.includes('content="0;url=https://marketplace.example/p/sharma-realty/p1"'));
    assert.equal(webListingUrl('sharma-realty', 'p1', 'https://api.example'), 'https://marketplace.example/p/sharma-realty/p1');
  });

  test('JSON-LD parses and describes a RealEstateListing with the INR price', () => {
    const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    assert.ok(m);
    const data = JSON.parse(m[1]);
    assert.equal(data['@type'], 'RealEstateListing');
    assert.equal(data.offers.price, 45000000);
    assert.equal(data.offers.priceCurrency, 'INR');
    assert.equal(data.provider.name, "Sharma's Realty");
    assert.equal(data.geo.latitude, 19.05);
    assert.equal(data.description, HOSTILE.description);
  });

  test('a listing without images gets no og:image', () => {
    const noImg = renderShareHtml({ listing: { ...HOSTILE, imageCount: 0 }, slug: 's', apiOrigin: 'https://api.example' });
    assert.ok(!noImg.includes('og:image'));
    assert.ok(noImg.includes('twitter:card" content="summary"'));
  });
});

describe('formatPrice', () => {
  test('uses the lakh/crore convention Indian buyers read', () => {
    assert.equal(formatPrice(12500000), '₹1.25 Cr');
    assert.equal(formatPrice(10000000), '₹1 Cr');
    assert.equal(formatPrice(5000000), '₹50 L');
    assert.equal(formatPrice(35000, 'rent'), '₹35,000/month');
  });
  test('says "on request" rather than the misleading rupees-zero', () => {
    assert.equal(formatPrice(0), 'Price on request');
    assert.equal(formatPrice(null), 'Price on request');
  });
});

describe('sitemap and robots', () => {
  test('sitemap escapes and points at the web origin', () => {
    const xml = buildSitemapXml({
      entries: [{ agencySlug: 'a&b', propertyId: 'p<1', updatedAt: '2026-09-01T10:00:00Z' }],
      apiOrigin: 'https://api.example',
    });
    assert.ok(xml.includes('<urlset'));
    assert.ok(xml.includes('https://marketplace.example/p/a%26b/p%3C1'));
    assert.ok(xml.includes('<lastmod>2026-09-01</lastmod>'));
    assert.ok(!xml.includes('p<1'));
  });
  test('robots keeps crawlers out of consumer and asset routes', () => {
    const txt = buildRobotsTxt({ apiOrigin: 'https://api.example' });
    assert.ok(txt.includes('Disallow: /me/'));
    assert.ok(txt.includes('Disallow: /internal/'));
    assert.ok(txt.includes('Sitemap: https://api.example/sitemap.xml'));
  });
});
