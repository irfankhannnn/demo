/**
 * Every public route: listings, detail, booking, assets, SEO files.
 *
 * The interesting part is the POST handler's ordering, which is deliberate —
 * see the comment there.
 */

import express from 'express';
import crypto from 'crypto';
import { config, captchaEnabled } from '../config/env.js';
import * as crm from '../services/crmClient.js';
import { issueSession, verifySession, consumeNonce } from '../services/sessionToken.js';
import { verifyCaptcha } from '../services/captcha.js';
import {
  getClientIp, checkPageView, checkSessionMint,
  checkBookingAttempt, recordFailure, captchaRequiredFor,
} from '../services/abuseGuard.js';
import { renderHomePage } from '../views/home.js';
import { renderPropertyPage } from '../views/property.js';
import { renderVisitForm, renderVisitSuccess } from '../views/visit.js';
import { renderNotFound, renderRateLimited } from '../views/errors.js';
import { logger } from '../logger.js';

const router = express.Router();

/**
 * Normalise an Indian mobile number to its 10 digits.
 *
 * Accepts what people actually type — spaces, hyphens, +91, a leading 0 — and
 * returns null for anything that is not a valid mobile. Returning null rather
 * than a best guess matters downstream: the CRM's lead dedupe keys on the
 * normalised phone, and a malformed number that normalises to something
 * plausible would merge two unrelated people onto one lead.
 */
export function normaliseIndianMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let local = digits;
  if (local.length === 12 && local.startsWith('91')) local = local.slice(2);
  else if (local.length === 11 && local.startsWith('0')) local = local.slice(1);
  if (local.length !== 10) return null;
  if (!/^[6-9]/.test(local)) return null;
  return local;
}

/** Phone is hashed before it reaches a rate-limit key so no counter row holds a real number. */
function phoneHash(phone) {
  return crypto.createHash('sha256')
    .update(`${config.sessionSecret}:${phone}`)
    .digest('base64url')
    .slice(0, 24);
}

function hrefs(req) {
  const p = req.urlPrefix || '';
  return {
    home: `${p}/`,
    property: (prop) => `${p}/property/${encodeURIComponent(prop.slug)}/${encodeURIComponent(prop.propertyId)}`,
    visit: (propertyId) => (propertyId ? `${p}/visit/${encodeURIComponent(propertyId)}` : `${p}/visit`),
    image: (propertyId, i) => `${p}/i/${encodeURIComponent(propertyId)}/${i}`,
    doc: (propertyId, i) => `${p}/d/${encodeURIComponent(propertyId)}/${i}`,
  };
}

/** Page-view throttle. Fails open, so a counter outage never dark-pages a tenant. */
async function pageViewGuard(req, res, next) {
  const result = await checkPageView(getClientIp(req));
  if (!result.allowed) {
    res.set('Retry-After', String(result.retryAfter));
    return res.status(429).type('html').send(renderRateLimited({ retryAfter: result.retryAfter }));
  }
  return next();
}

router.use(pageViewGuard);

// ── Agency listings ────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const h = hrefs(req);
    const { items, nextCursor } = await crm.listProperties(req.tenantId, {
      limit: 24,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : null,
    });

    res.set('Cache-Control', `public, max-age=0, s-maxage=${config.pageCacheSeconds}`);
    return res.type('html').send(renderHomePage({
      agency: req.agency,
      properties: items,
      nextCursor,
      origin: req.pageOrigin,
      imageUrlFor: (prop, i) => h.image(prop.propertyId, i),
      hrefFor: h.property,
      homeHref: h.home,
      nonce: res.locals.cspNonce,
    }));
  } catch (err) {
    return next(err);
  }
});

// ── Property detail ────────────────────────────────────────────────────────

router.get('/property/:slug/:propertyId', async (req, res, next) => {
  try {
    const h = hrefs(req);
    const property = await crm.getProperty(req.tenantId, req.params.propertyId);
    if (!property) {
      return res.status(404).type('html').send(renderNotFound({ agency: req.agency, homeHref: h.home }));
    }

    // The slug is cosmetic — the id is what identifies the listing. If the
    // listing has been retitled since the link was shared, redirect to the
    // current URL rather than serving the same page under two addresses,
    // which would split its search ranking.
    if (property.slug && req.params.slug !== property.slug) {
      return res.redirect(301, h.property(property));
    }

    res.set('Cache-Control', `public, max-age=0, s-maxage=${config.pageCacheSeconds}`);
    return res.type('html').send(renderPropertyPage({
      property,
      agency: req.agency,
      origin: req.pageOrigin,
      imageUrlFor: (i) => h.image(property.propertyId, i),
      docUrlFor: (i) => h.doc(property.propertyId, i),
      mapsKey: config.mapsEmbedApiKey,
      visitHref: h.visit(property.propertyId),
      homeHref: h.home,
      nonce: res.locals.cspNonce,
    }));
  } catch (err) {
    return next(err);
  }
});

// ── Assets ─────────────────────────────────────────────────────────────────

/**
 * Redirect to a freshly presigned S3 URL.
 *
 * The alternative — putting presigned URLs straight into the HTML — breaks as
 * soon as the page is cached for longer than the signature lives, which is
 * exactly what a CDN in front of it is for. Indirecting through a stable path
 * lets the HTML cache for minutes while each image request still gets a live
 * signature.
 */
async function serveAsset(req, res, next, kind) {
  try {
    const index = Number.parseInt(req.params.index, 10);
    if (!Number.isInteger(index) || index < 0 || index > 40) {
      return res.status(404).end();
    }

    const url = await crm.getAssetUrl(req.tenantId, req.params.propertyId, { kind, index });
    if (!url) return res.status(404).end();

    // Cached well below the 15-minute signature lifetime, so a cached redirect
    // can never outlive the URL it points at.
    res.set('Cache-Control', `public, max-age=${config.assetCacheSeconds}`);
    return res.redirect(302, url);
  } catch (err) {
    return next(err);
  }
}

router.get('/i/:propertyId/:index', (req, res, next) => serveAsset(req, res, next, 'image'));
router.get('/d/:propertyId/:index', (req, res, next) => serveAsset(req, res, next, 'document'));

// ── Booking ────────────────────────────────────────────────────────────────

/**
 * Prefill hints from the query string (ManyChat merge fields).
 *
 * Attacker-controllable by definition — anyone can edit a URL — so these are
 * only ever echoed into form fields, never treated as identity. The phone is
 * still validated on submit like any other, and the name is length-capped
 * here so a megabyte-long `?name=` cannot be reflected into the page.
 */
function prefillFrom(query) {
  const name = typeof query.name === 'string' ? query.name.trim().slice(0, 120) : '';
  const rawPhone = typeof query.phone === 'string' ? query.phone : '';
  const phone = normaliseIndianMobile(rawPhone) || '';
  return { name, phone };
}

/** External refs, so a lead can be traced back to the campaign that produced it. */
function externalRefFrom(query) {
  const pick = (key, max = 80) =>
    (typeof query[key] === 'string' && query[key].trim() ? query[key].trim().slice(0, max) : undefined);

  const ref = {
    igUsername: pick('ig'),
    manychatSubscriberId: pick('mc'),
    campaignRef: pick('ref'),
    sourceMediaId: pick('post'),
  };
  return Object.values(ref).some(Boolean) ? ref : null;
}

async function renderForm(req, res, { error = null, values = {} } = {}) {
  const h = hrefs(req);
  const propertyId = req.params.propertyId || null;

  const property = propertyId ? await crm.getProperty(req.tenantId, propertyId) : null;
  if (propertyId && !property) {
    return res.status(404).type('html').send(renderNotFound({ agency: req.agency, homeHref: h.home }));
  }

  const ip = getClientIp(req);
  const mint = await checkSessionMint(ip);
  if (!mint.allowed) {
    logger.warn('visit.session_rate_limited', { tenantId: req.tenantId, scope: mint.scope });
    res.set('Retry-After', String(mint.retryAfter));
    return res.status(429).type('html').send(renderRateLimited({ retryAfter: mint.retryAfter }));
  }

  const [availability, needsCaptcha] = await Promise.all([
    crm.getAvailability(req.tenantId, 14),
    captchaEnabled() ? captchaRequiredFor(ip) : Promise.resolve(false),
  ]);

  const { token } = issueSession({ tenantId: req.tenantId, propertyId });

  // A booking form must never be cached — the session token in it is
  // single-use, so a cached copy would hand every visitor a token that has
  // already been burned by whoever loaded it first.
  res.set('Cache-Control', 'no-store, private');
  return res.type('html').send(renderVisitForm({
    agency: req.agency,
    property,
    availability,
    sessionToken: token,
    origin: req.pageOrigin,
    prefill: prefillFrom(req.query),
    error,
    values,
    captcha: needsCaptcha ? { siteKey: config.hcaptchaSiteKey } : null,
    actionHref: h.visit(propertyId),
    backHref: property ? h.property(property) : h.home,
    homeHref: h.home,
    nonce: res.locals.cspNonce,
  }));
}

router.get('/visit', (req, res, next) => renderForm(req, res).catch(next));
router.get('/visit/:propertyId', (req, res, next) => renderForm(req, res).catch(next));

/**
 * Submit a booking.
 *
 * Check order is chosen so that the cheapest, most certain rejections happen
 * before anything expensive or stateful:
 *
 *   1. honeypot      — free, and a filled one is unambiguously a bot
 *   2. session       — signature/expiry/binding/fill-time, pure CPU, no I/O
 *   3. captcha       — a network call, only when adaptively required
 *   4. field shape   — cheap, and rejecting here must NOT count as abuse
 *   5. nonce burn    — first write; makes the token single-use
 *   6. quota checks  — per IP, per phone, per tenant
 *   7. CRM write     — the only expensive, billable step
 *
 * Only 1, 2 and 5 increment the failure counter that drives the adaptive
 * captcha. A visitor who mistypes their phone number is not an attacker, and
 * counting honest mistakes would put a captcha in front of the people most
 * likely to be real customers.
 */
async function submitBooking(req, res, next) {
  const h = hrefs(req);
  const ip = getClientIp(req);
  const propertyId = req.params.propertyId || null;
  const body = req.body || {};

  const values = {
    name: typeof body.name === 'string' ? body.name.slice(0, 120) : '',
    phone: typeof body.phone === 'string' ? body.phone.slice(0, 20) : '',
    meetingDate: typeof body.meetingDate === 'string' ? body.meetingDate.slice(0, 10) : '',
    meetingTime: typeof body.meetingTime === 'string' ? body.meetingTime.slice(0, 5) : '',
    message: typeof body.message === 'string' ? body.message.slice(0, 500) : '',
  };

  const reject = async (reason, { countAsAbuse = false } = {}) => {
    if (countAsAbuse) await recordFailure(ip);
    logger.info('visit.rejected', { tenantId: req.tenantId, reason, countAsAbuse });
    return renderForm(req, res, { error: reason, values });
  };

  try {
    // 1. Honeypot.
    if (typeof body.company_website === 'string' && body.company_website.trim() !== '') {
      return await reject('upstream_error', { countAsAbuse: true });
    }

    // 2. Session.
    const session = verifySession(body.session, { tenantId: req.tenantId, propertyId });
    if (!session.valid) {
      const suspicious = session.reason === 'bad_signature'
        || session.reason === 'too_fast'
        || session.reason === 'wrong_tenant'
        || session.reason === 'wrong_property';
      const shown = session.reason === 'too_fast' ? 'too_fast' : 'session_expired';
      return await reject(shown, { countAsAbuse: suspicious });
    }

    // 3. Captcha, only when this IP has already tripped the threshold.
    if (captchaEnabled() && await captchaRequiredFor(ip)) {
      const token = body['h-captcha-response'] || body.hcaptchaToken;
      if (!await verifyCaptcha(token, ip)) {
        return await reject('captcha_failed', { countAsAbuse: true });
      }
    }

    // 4. Field shape. Honest mistakes — never counted as abuse.
    const phone = normaliseIndianMobile(values.phone);
    if (!values.name.trim()) return await reject('missing_name_or_phone');
    if (!phone) return await reject('invalid_phone');
    if (!values.meetingDate) return await reject('invalid_date');
    if (!values.meetingTime) return await reject('invalid_time');

    // 5. Burn the nonce. Two concurrent submits race here and exactly one wins.
    const burn = await consumeNonce(session.nonce);
    if (!burn.ok) {
      return await reject(
        burn.reason === 'already_used' ? 'session_replayed' : 'upstream_error',
        { countAsAbuse: burn.reason === 'already_used' },
      );
    }

    // 6. Quotas. All fail closed — see abuseGuard.
    const quota = await checkBookingAttempt({ ip, phoneHash: phoneHash(phone), tenantId: req.tenantId });
    if (!quota.allowed) {
      logger.warn('visit.quota_exceeded', { tenantId: req.tenantId, scope: quota.scope });
      res.set('Retry-After', String(quota.retryAfter));
      return res.status(429).type('html').send(renderRateLimited({ retryAfter: quota.retryAfter }));
    }

    // 7. The write.
    const result = await crm.submitSiteVisit(req.tenantId, {
      name: values.name.trim(),
      phone,
      propertyId,
      meetingDate: values.meetingDate,
      meetingTime: values.meetingTime,
      message: values.message,
      source: 'Website',
      externalRef: externalRefFrom(req.query),
      // The burnt nonce doubles as the idempotency key, so a retry that
      // somehow reaches the CRM twice still produces one lead.
      dedupeKey: session.nonce,
    });

    if (!result.ok) {
      return await reject(result.reason || 'upstream_error');
    }

    const property = propertyId ? await crm.getProperty(req.tenantId, propertyId) : null;

    logger.info('visit.booked', {
      tenantId: req.tenantId, propertyId, meetingId: result.meetingId || null,
    });

    res.set('Cache-Control', 'no-store, private');
    return res.type('html').send(renderVisitSuccess({
      agency: req.agency,
      booking: { meetingDate: values.meetingDate, meetingTime: values.meetingTime },
      property,
      origin: req.pageOrigin,
      homeHref: h.home,
      backHref: property ? h.property(property) : h.home,
    }));
  } catch (err) {
    return next(err);
  }
}

router.post('/visit', submitBooking);
router.post('/visit/:propertyId', submitBooking);

// ── SEO ────────────────────────────────────────────────────────────────────

router.get('/robots.txt', (req, res) => {
  const p = req.urlPrefix || '';
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    // Booking pages are per-visitor and carry single-use tokens; there is
    // nothing there for a crawler and indexing them would compete with the
    // listing pages.
    `Disallow: ${p}/visit`,
    `Disallow: ${p}/i/`,
    `Disallow: ${p}/d/`,
    '',
    `Sitemap: ${req.protocol}://${req.headers.host}${p}/sitemap.xml`,
  ].join('\n'));
});

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const h = hrefs(req);
    const origin = `${req.protocol}://${req.headers.host}`;
    const { items } = await crm.listProperties(req.tenantId, { limit: 50 });

    const urls = [
      { loc: `${origin}${h.home}`, priority: '1.0' },
      ...items.map((p) => ({
        loc: `${origin}${h.property(p)}`,
        lastmod: p.updatedAt ? String(p.updatedAt).slice(0, 10) : null,
        priority: '0.8',
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

    res.set('Cache-Control', 'public, max-age=0, s-maxage=3600');
    return res.type('application/xml').send(xml);
  } catch (err) {
    return next(err);
  }
});

export default router;
