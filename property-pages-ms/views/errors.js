/**
 * Error pages.
 *
 * All of these are `noindex`. A 404 that Google indexes competes with the real
 * listing pages for the same site, and a rate-limit page has no business in
 * search results at all.
 *
 * The unknown-agency page deliberately does not say whether the subdomain
 * exists — an agency that has not enabled public pages and an agency that was
 * never a customer produce the identical response, so this cannot be used to
 * enumerate who our customers are.
 */

import { esc, page } from './layout.js';

function shell({ title, heading, message, status, extra = '' }) {
  const body = `<main class="wrap" style="max-width:520px">
  <div class="empty" style="padding-top:80px">
    <p class="muted" style="margin:0 0 8px;font-weight:700;letter-spacing:.08em;font-size:13px">
      ${esc(String(status))}</p>
    <h1 style="margin:0 0 10px">${esc(heading)}</h1>
    <p style="margin:0 0 20px">${esc(message)}</p>
    ${extra}
  </div>
</main>`;

  return page({
    title,
    description: message,
    canonical: '',
    noindex: true,
    agency: null,
    body,
  });
}

export function renderNotFound({ agency = null, homeHref = null } = {}) {
  return shell({
    status: 404,
    title: 'Page not found',
    heading: 'We could not find that page',
    message: agency
      ? 'This listing may have been removed or is no longer available.'
      : 'This link may be mistyped or no longer active.',
    extra: homeHref
      ? `<a class="btn btn-ghost" href="${esc(homeHref)}">View all listings</a>`
      : '',
  });
}

export function renderUnknownAgency() {
  return shell({
    status: 404,
    title: 'Site not found',
    heading: 'This address is not available',
    message: 'Please check the link you were given, or contact the agency directly.',
  });
}

export function renderRateLimited({ retryAfter = 60 } = {}) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return shell({
    status: 429,
    title: 'Too many requests',
    heading: 'Please slow down',
    message: `Too many attempts from your connection. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  });
}

export function renderServerError() {
  return shell({
    status: 500,
    title: 'Something went wrong',
    heading: 'Something went wrong',
    message: 'We hit a problem loading this page. Please try again in a moment.',
  });
}
