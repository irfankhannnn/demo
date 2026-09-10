/**
 * The property detail page — the thing an agent actually shares.
 *
 * Two constraints drive the design:
 *
 *  1. It is almost always opened from a WhatsApp or Instagram link on a phone,
 *     so it is mobile-first and the booking CTA is always reachable without
 *     scrolling back up (see the sticky footer bar).
 *  2. It is a link that gets *pasted*, so the OG tags carry a real photo,
 *     title and price. That preview is what determines whether anyone taps it,
 *     and it is the single strongest argument for rendering this server-side.
 *
 * JSON-LD is emitted so Google can index the listing as a real estate offer
 * rather than a generic page.
 */

import { esc, attr, page, header, footer, formatPrice, formatArea } from './layout.js';

const TYPE_LABELS = {
  apartment: 'Apartment',
  house: 'House',
  villa: 'Villa',
  office: 'Office',
  plot: 'Plot',
  shop: 'Shop',
};

const FURNISHING_LABELS = {
  furnished: 'Furnished',
  'semi-furnished': 'Semi-furnished',
  unfurnished: 'Unfurnished',
};

function describe(property) {
  const bits = [];
  if (property.bhk) bits.push(`${property.bhk} BHK`);
  bits.push(TYPE_LABELS[property.propertyType] || 'Property');
  const where = [property.locality, property.city].filter(Boolean).join(', ');
  if (where) bits.push(`in ${where}`);
  return bits.join(' ');
}

/**
 * Meta description. Google truncates around 160 characters, so lead with the
 * facts a buyer scans for — price, size, locality — rather than prose.
 */
function metaDescription(property, agency) {
  const parts = [describe(property)];
  parts.push(formatPrice(property.pricing.amount));
  const area = formatArea(property.carpetArea || property.builtUpArea);
  if (area) parts.push(area);
  if (agency?.name) parts.push(`Listed by ${agency.name}`);
  let out = parts.join(' · ');
  if (out.length < 120 && property.description) {
    out += ` — ${String(property.description).replace(/\s+/g, ' ').slice(0, 160 - out.length)}`;
  }
  return out.slice(0, 300);
}

function gallery(property, imageUrlFor) {
  if (property.imageCount === 0) {
    return `<div class="card" style="aspect-ratio:16/9;display:grid;place-items:center;color:var(--muted)">
      No photos yet</div>`;
  }
  const main = `<img class="main" src="${attr(imageUrlFor(0))}" alt="${attr(property.title)}"
    width="800" height="600" fetchpriority="high" decoding="async">`;

  if (property.imageCount === 1) {
    return `<div class="card gallery single">${main}</div>`;
  }

  const sides = [1, 2]
    .filter((i) => i < property.imageCount)
    .map((i) => `<img class="side" src="${attr(imageUrlFor(i))}"
      alt="${attr(`${property.title} — photo ${i + 1}`)}" width="400" height="300"
      loading="lazy" decoding="async">`)
    .join('');

  return `<div class="card gallery">${main}${sides}</div>`;
}

function facts(property) {
  const items = [];
  if (property.bhk) items.push(['Configuration', `${property.bhk} BHK`]);
  const carpet = formatArea(property.carpetArea);
  if (carpet) items.push(['Carpet area', carpet]);
  const built = formatArea(property.builtUpArea);
  if (built) items.push(['Built-up area', built]);
  if (property.furnishing) {
    items.push(['Furnishing', FURNISHING_LABELS[property.furnishing] || property.furnishing]);
  }
  if (property.facing) {
    items.push(['Facing', property.facing.charAt(0).toUpperCase() + property.facing.slice(1)]);
  }
  items.push(['Type', TYPE_LABELS[property.propertyType] || 'Property']);
  if (property.pricing.mode === 'rent' && property.pricing.deposit) {
    items.push(['Deposit', formatPrice(property.pricing.deposit)]);
  }

  if (items.length === 0) return '';
  return `<ul class="facts">${items.map(([k, v]) =>
    `<li><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></li>`).join('')}</ul>`;
}

/**
 * Map embed.
 *
 * Only rendered with real coordinates — a map centred on a guessed locality is
 * worse than no map, because it implies a precision the data does not have.
 * Without an API key we fall back to a plain text location rather than an
 * embed that would render as a Google error tile.
 */
function map(property, mapsKey) {
  if (property.latitude === null || property.longitude === null) return '';
  const where = [property.locality, property.city].filter(Boolean).join(', ');

  if (!mapsKey) {
    return `<div class="section"><h2>Location</h2>
      <div class="card" style="padding:16px">
        <p style="margin:0">${esc(where || 'Location available on request')}</p>
        <p class="muted" style="margin:6px 0 0;font-size:14px">
          <a href="https://www.google.com/maps/search/?api=1&amp;query=${attr(`${property.latitude},${property.longitude}`)}"
             target="_blank" rel="noopener noreferrer">Open in Google Maps</a></p>
      </div></div>`;
  }

  const q = `${property.latitude},${property.longitude}`;
  return `<div class="section"><h2>Location</h2>
    <div class="card">
      <iframe class="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
        title="Map showing ${attr(where)}"
        src="https://www.google.com/maps/embed/v1/place?key=${attr(mapsKey)}&amp;q=${attr(q)}&amp;zoom=15"></iframe>
    </div>
    ${where ? `<p class="muted" style="margin:8px 0 0">${esc(where)}</p>` : ''}
  </div>`;
}

function documents(property, docUrlFor) {
  if (!property.documents || property.documents.length === 0) return '';
  const rows = property.documents.map((d, i) =>
    `<a class="doc-link" href="${attr(docUrlFor(i))}" target="_blank" rel="noopener noreferrer">
      <span aria-hidden="true">📄</span><span>${esc(d.label)}</span>
      <span class="muted" style="margin-left:auto;font-weight:600;font-size:13px">View</span>
    </a>`).join('');

  return `<div class="section"><h2>Documents</h2><div class="card">${rows}</div></div>`;
}

/** schema.org markup so the listing is eligible for rich results. */
function schemaFor(property, agency, canonical, ogImage) {
  const offer = {
    '@type': 'Offer',
    availability: 'https://schema.org/InStock',
    priceCurrency: 'INR',
  };
  if (property.pricing.amount) offer.price = property.pricing.amount;

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: String(property.description || describe(property)).slice(0, 500),
    url: canonical,
    ...(ogImage ? { image: [ogImage] } : {}),
    datePosted: property.updatedAt || undefined,
    offers: offer,
    ...(property.latitude !== null && property.longitude !== null ? {
      geo: { '@type': 'GeoCoordinates', latitude: property.latitude, longitude: property.longitude },
    } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.locality || undefined,
      addressRegion: property.city || undefined,
      addressCountry: 'IN',
    },
    ...(agency ? {
      provider: {
        '@type': 'RealEstateAgent',
        name: agency.name,
        ...(agency.publicPhone ? { telephone: agency.publicPhone } : {}),
      },
    } : {}),
  };
}

export function renderPropertyPage({ property, agency, origin, imageUrlFor, docUrlFor, mapsKey, visitHref, homeHref, nonce = '' }) {
  const canonical = `${origin}/property/${encodeURIComponent(property.slug)}/${encodeURIComponent(property.propertyId)}`;
  const ogImage = property.imageCount > 0 ? `${origin}${imageUrlFor(0)}` : null;
  const title = `${property.title} — ${formatPrice(property.pricing.amount)} | ${agency.name}`;
  const rentSuffix = property.pricing.mode === 'rent' ? '<span class="muted" style="font-size:15px;font-weight:600">/month</span>' : '';

  const body = `
${header(agency, { homeHref, cta: `<a class="btn btn-primary" href="${attr(visitHref)}">Schedule a visit</a>` })}
<main class="wrap">
  <div class="section">
    <p class="muted" style="margin:0 0 6px;font-size:14px">
      <a href="${attr(homeHref)}" style="text-decoration:none">← All listings</a>
    </p>
    <h1>${esc(property.title)}</h1>
    <p class="muted" style="margin:0 0 14px">${esc(describe(property))}</p>
    <p class="price" style="margin:0 0 16px">${esc(formatPrice(property.pricing.amount))}${rentSuffix}</p>
    ${gallery(property, imageUrlFor)}
  </div>

  <div class="section">${facts(property)}</div>

  ${property.description ? `<div class="section"><h2>About this property</h2>
    <div class="card" style="padding:16px">
      <p style="margin:0;white-space:pre-wrap">${esc(property.description)}</p>
    </div></div>` : ''}

  ${property.amenities.length ? `<div class="section"><h2>Amenities</h2>
    <ul class="amenities">${property.amenities.map((a) => `<li class="pill">${esc(a)}</li>`).join('')}</ul>
  </div>` : ''}

  ${map(property, mapsKey)}
  ${documents(property, docUrlFor)}

  <div class="section">
    <div class="card" style="padding:20px;text-align:center">
      <h2 style="margin-bottom:6px">Want to see it in person?</h2>
      <p class="muted" style="margin:0 0 16px">Pick a time that suits you. ${esc(agency.name)} will confirm.</p>
      <a class="btn btn-primary btn-block" href="${attr(visitHref)}">Schedule a visit</a>
    </div>
  </div>
</main>
${footer(agency)}
<div class="sticky-cta">
  <div>
    <div class="price">${esc(formatPrice(property.pricing.amount))}</div>
    <div class="muted" style="font-size:13px">${esc(property.locality || property.city || '')}</div>
  </div>
  <a class="btn btn-primary" href="${attr(visitHref)}">Schedule a visit</a>
</div>`;

  return page({
    title,
    description: metaDescription(property, agency),
    canonical,
    ogImage,
    agency,
    body,
    nonce,
    schema: schemaFor(property, agency, canonical, ogImage),
  });
}
