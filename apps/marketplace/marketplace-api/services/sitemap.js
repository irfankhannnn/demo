/**
 * sitemap.xml and robots.txt for the marketplace.
 *
 * The URLs point at marketplace-web (the SPA) when MARKETPLACE_WEB_ORIGIN is
 * set, because that is where a searcher should land. Until the domain
 * exists they point at this API's own /share pages, which carry the OG tags
 * and redirect — so the sitemap is never a list of dead links.
 *
 * The CRM's /sitemap-entries is the source of truth for what is listed; it
 * is cached for an hour in crmClient.
 */

import { esc, webListingUrl } from './share.js';

export function buildSitemapXml({ entries, apiOrigin }) {
  const urls = (entries || []).slice(0, 50000).map((e) => {
    const loc = webListingUrl(e.agencySlug, e.propertyId, apiOrigin);
    const lastmod = e.updatedAt ? String(e.updatedAt).slice(0, 10) : null;
    return `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${esc(lastmod)}</lastmod>` : ''}<changefreq>daily</changefreq><priority>0.8</priority></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

export function buildRobotsTxt({ apiOrigin }) {
  return [
    'User-agent: *',
    // Share pages are for unfurlers; the SPA (or the share page as fallback)
    // is what should be indexed. Assets and consumer routes have nothing for
    // a crawler.
    'Allow: /share/',
    'Disallow: /me/',
    'Disallow: /internal/',
    'Disallow: /i/',
    'Disallow: /d/',
    'Disallow: /search/',
    '',
    `Sitemap: ${apiOrigin}/sitemap.xml`,
  ].join('\n');
}
