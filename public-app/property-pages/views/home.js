/**
 * The agency's public listings index — the link that goes in an Instagram bio.
 *
 * Cards carry only what a buyer scans for: photo, price, configuration,
 * locality. Everything else waits for the detail page, because this list is
 * usually loaded on mobile data and every extra field is another row of text
 * between the reader and the next photo.
 */

import { esc, attr, page, header, footer, formatPrice, formatArea } from './layout.js';

const TYPE_LABELS = {
  apartment: 'Apartment', house: 'House', villa: 'Villa',
  office: 'Office', plot: 'Plot', shop: 'Shop',
};

function card(property, { imageUrlFor, hrefFor }) {
  const href = hrefFor(property);
  const cover = property.imageCount > 0
    ? `<img src="${attr(imageUrlFor(property, 0))}" alt="${attr(property.title)}"
        width="520" height="360" loading="lazy" decoding="async"
        style="aspect-ratio:13/9;object-fit:cover;width:100%;background:var(--line)">`
    : `<div style="aspect-ratio:13/9;display:grid;place-items:center;background:var(--paper);color:var(--muted);font-size:14px">No photo</div>`;

  const meta = [
    property.bhk ? `${property.bhk} BHK` : null,
    TYPE_LABELS[property.propertyType] || null,
    formatArea(property.carpetArea || property.builtUpArea),
  ].filter(Boolean).join(' · ');

  const where = [property.locality, property.city].filter(Boolean).join(', ');
  const rentSuffix = property.pricing.mode === 'rent'
    ? '<span class="muted" style="font-size:13px;font-weight:600">/mo</span>' : '';

  return `<a class="card" href="${attr(href)}" style="text-decoration:none;display:block">
    ${cover}
    <div style="padding:14px 16px 16px">
      <p style="margin:0 0 4px;font-weight:800;font-size:19px;letter-spacing:-.02em">
        ${esc(formatPrice(property.pricing.amount))}${rentSuffix}</p>
      <p style="margin:0 0 6px;font-weight:700;line-height:1.35">${esc(property.title)}</p>
      ${meta ? `<p class="muted" style="margin:0;font-size:14px">${esc(meta)}</p>` : ''}
      ${where ? `<p class="muted" style="margin:4px 0 0;font-size:14px">${esc(where)}</p>` : ''}
    </div>
  </a>`;
}

export function renderHomePage({ agency, properties, nextCursor, origin, imageUrlFor, hrefFor, homeHref, nonce = '' }) {
  const canonical = `${origin}${homeHref}`;
  const count = properties.length;
  const title = `${agency.name} — Properties for sale and rent`;
  const description = agency.about
    ? String(agency.about).slice(0, 300)
    : `Browse ${count > 0 ? `${count} ` : ''}properties listed by ${agency.name}. View photos, prices and locations, and book a site visit online.`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: agency.name,
    url: canonical,
    ...(agency.publicPhone ? { telephone: agency.publicPhone } : {}),
    ...(agency.publicEmail ? { email: agency.publicEmail } : {}),
    ...(agency.publicAddress ? {
      address: { '@type': 'PostalAddress', streetAddress: agency.publicAddress, addressCountry: 'IN' },
    } : {}),
  };

  const body = `
${header(agency, { homeHref })}
<main class="wrap">
  <div class="section">
    <h1>${esc(agency.name)}</h1>
    ${agency.about
      ? `<p class="muted" style="margin:0;max-width:60ch">${esc(agency.about)}</p>`
      : `<p class="muted" style="margin:0">Properties for sale and rent${agency.publicAddress ? ` · ${esc(agency.publicAddress)}` : ''}</p>`}
  </div>

  ${count === 0
    ? `<div class="card empty">
        <p style="margin:0 0 6px;font-weight:700;color:var(--ink)">No listings published yet</p>
        <p style="margin:0">Please check back shortly${agency.publicPhone ? `, or call ${esc(agency.publicPhone)}` : ''}.</p>
      </div>`
    : `<div class="section">
        <h2>${count} propert${count === 1 ? 'y' : 'ies'} available</h2>
        <div class="grid">${properties.map((p) => card(p, { imageUrlFor, hrefFor })).join('')}</div>
        ${nextCursor
          ? `<p style="margin:24px 0 0;text-align:center">
              <a class="btn btn-ghost" href="${attr(`${homeHref}?cursor=${encodeURIComponent(nextCursor)}`)}">Show more</a>
            </p>`
          : ''}
      </div>`}
</main>
${footer(agency)}`;

  return page({
    title,
    description,
    canonical,
    agency,
    body,
    nonce,
    schema,
  });
}
