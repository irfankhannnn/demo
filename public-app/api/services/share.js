/**
 * The share page: `GET /share/p/:slug/:propertyId`.
 *
 * marketplace-web is a SPA, and a SPA's index.html has one set of OG tags for
 * every URL — so a listing link pasted into WhatsApp previews as the generic
 * site card, which is the difference between a link that gets tapped and one
 * that does not. This tiny server-rendered page carries the listing's own
 * title, price and photo in its <head>, then meta-refreshes a real browser
 * to the SPA route. Crawlers and unfurlers read the head and stop; people
 * never see it.
 *
 * Every interpolated value passes through esc() or jsonScript(). The title
 * and description come from an agency's CRM, and an agency can type anything.
 */

import { config } from '../config/env.js';

/** HTML-escape for text nodes and attribute values. Ampersand first, always. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * JSON safe to embed inside <script type="application/ld+json">. `<` is
 * escaped so `</script>` inside a string cannot end the block early, and the
 * two JS line terminators that are valid JSON but break inline scripts are
 * escaped too.
 */
export function jsonScript(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u' + '2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u' + '2029');
}

export function formatPrice(amount, mode) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'Price on request';
  let s;
  if (n >= 1e7) s = `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  else if (n >= 1e5) s = `₹${(n / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`;
  else s = `₹${Math.round(n).toLocaleString('en-IN')}`;
  return mode === 'rent' ? `${s}/month` : s;
}

/** Where the SPA shows this listing. Falls back to the API's own share URL when the web origin is unset. */
export function webListingUrl(slug, propertyId, apiOrigin) {
  const path = `/p/${encodeURIComponent(slug)}/${encodeURIComponent(propertyId)}`;
  return config.webOrigin ? `${config.webOrigin}${path}` : `${apiOrigin}/share${path}`;
}

/**
 * @param {object} args
 * @param {object} args.listing   MarketplaceListing from the CRM
 * @param {string} args.slug      agency slug from the URL
 * @param {string} args.apiOrigin scheme + host this API is reached on (for the og:image redirect URL)
 */
export function renderShareHtml({ listing, slug, apiOrigin }) {
  const pid = listing.propertyId;
  const target = webListingUrl(slug, pid, apiOrigin);
  const imageUrl = Number(listing.imageCount) > 0
    ? `${apiOrigin}/i/${encodeURIComponent(slug)}/${encodeURIComponent(pid)}/0`
    : null;

  const price = formatPrice(listing.pricing?.amount, listing.pricing?.mode);
  const where = [listing.locality, listing.city].filter(Boolean).join(', ');
  const bits = [
    listing.bhk ? `${listing.bhk} BHK` : null,
    listing.propertyType || null,
    where || null,
    price,
  ].filter(Boolean);
  const title = listing.title || bits.slice(0, 2).join(' · ') || 'Property';
  const description = `${bits.join(' · ')}${listing.agency?.name ? ` · ${listing.agency.name}` : ''}`.slice(0, 200);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: title,
    description: listing.description ? String(listing.description).slice(0, 500) : description,
    url: target,
    ...(imageUrl ? { image: imageUrl } : {}),
    datePosted: listing.listedAt || listing.updatedAt || undefined,
    offers: {
      '@type': 'Offer',
      price: Number(listing.pricing?.amount) || 0,
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      ...(listing.pricing?.mode === 'rent' ? { businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut' } : {}),
    },
    ...(listing.agency?.name ? { provider: { '@type': 'RealEstateAgent', name: listing.agency.name } } : {}),
    ...(listing.city ? {
      address: { '@type': 'PostalAddress', addressLocality: listing.locality || undefined, addressRegion: listing.city, addressCountry: 'IN' },
    } : {}),
    ...(listing.latitude && listing.longitude ? {
      geo: { '@type': 'GeoCoordinates', latitude: listing.latitude, longitude: listing.longitude },
    } : {}),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(target)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(target)}">
${imageUrl ? `<meta property="og:image" content="${esc(imageUrl)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<script type="application/ld+json">${jsonScript(jsonLd)}</script>
<style>body{font-family:Manrope,Arial,sans-serif;background:#FBF2E4;color:#1C1512;padding:32px;text-align:center}a{color:#FF7A1A}</style>
</head>
<body>
<p>${esc(title)} — ${esc(price)}</p>
<p><a href="${esc(target)}">Continue to the listing</a></p>
</body>
</html>`;
}
