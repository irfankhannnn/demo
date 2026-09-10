/**
 * Works out which agency a request is for.
 *
 * Two addressing modes, deliberately both supported at once:
 *
 *   1. Subdomain — `sunrise-realty.pages.realestateflow.in`. The real one.
 *   2. Path      — `/t/sunrise-realty/...`. The fallback.
 *
 * The path fallback exists because the wildcard certificate and the BigRock
 * DNS records are manual, out-of-band steps. Without it the entire service
 * would be untestable until DNS propagated, which would mean shipping a large
 * feature that nobody had ever clicked through. With it, the same code path
 * is exercised on the raw CloudFront URL from the first deploy, and switching
 * to subdomains later changes only the generated links.
 *
 * `req.urlPrefix` is how that stays invisible to the views: they build every
 * href from it, so the same template emits `/property/…` on a subdomain and
 * `/t/slug/property/…` on the fallback host.
 */

import { config } from '../config/env.js';
import { resolveAgencyBySlug } from '../services/crmClient.js';
import { renderUnknownAgency } from '../views/errors.js';
import { logger } from '../logger.js';

/**
 * A slug must be a single DNS label. Validated here as well as in the CRM
 * because this value is about to be interpolated into a URL path and a cache
 * key, and re-checking at the boundary is cheaper than reasoning about which
 * upstream guarantees still hold.
 */
function isPlausibleSlug(slug) {
  return typeof slug === 'string'
    && slug.length >= 3 && slug.length <= 40
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug);
}

/**
 * Extract the tenant label from a Host header.
 *
 * Returns null when the host is not under the configured base domain, so a
 * request arriving on a CloudFront URL, an ALB health check, or someone else's
 * domain pointed at us never resolves a tenant by accident.
 */
export function slugFromHost(hostHeader) {
  if (!config.baseDomain) return null;
  if (typeof hostHeader !== 'string' || hostHeader.length === 0) return null;

  // Strip port, lowercase, drop a trailing dot from a fully-qualified name.
  const host = hostHeader.split(':')[0].trim().toLowerCase().replace(/\.$/, '');
  const suffix = `.${config.baseDomain}`;
  if (!host.endsWith(suffix)) return null;

  const label = host.slice(0, -suffix.length);
  // Exactly one label. `a.b.pages.example.com` is not a tenant, it is a
  // misconfiguration, and treating it as tenant "a.b" would be wrong.
  if (label.includes('.')) return null;

  return isPlausibleSlug(label) ? label : null;
}

/**
 * Express middleware. On success sets `req.agency`, `req.tenantId` and
 * `req.urlPrefix`; otherwise renders the unknown-agency page.
 */
export async function resolveTenant(req, res, next) {
  let slug = slugFromHost(req.headers.host);
  let urlPrefix = '';

  if (!slug && config.pathTenantFallback) {
    const match = req.path.match(/^\/t\/([a-z0-9-]{3,40})(?=\/|$)/);
    if (match) {
      slug = match[1];
      urlPrefix = `/t/${slug}`;
      // Rewrite so every downstream route can be written as if it were
      // mounted at the root.
      req.url = req.url.slice(urlPrefix.length) || '/';
    }
  }

  if (!slug || !isPlausibleSlug(slug)) {
    return res.status(404).type('html').send(renderUnknownAgency());
  }

  try {
    const agency = await resolveAgencyBySlug(slug);
    if (!agency) {
      // Same response for "no such agency" and "public pages switched off",
      // so neither can be distinguished from outside.
      return res.status(404).type('html').send(renderUnknownAgency());
    }

    req.agency = agency;
    req.tenantId = agency.tenantId;
    req.agencySlug = slug;
    req.urlPrefix = urlPrefix;
    // Absolute origin, needed for canonical URLs and og:image, which must be
    // absolute to be usable by a crawler or a chat app's link unfurler.
    req.pageOrigin = `${req.protocol}://${req.headers.host}${urlPrefix}`;
    return next();
  } catch (err) {
    logger.error('resolveTenant.failed', { slug, error: err.message });
    return next(err);
  }
}
