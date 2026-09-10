/**
 * The site-visit booking form, and its success page.
 *
 * ── it is a plain form POST ────────────────────────────────────────────────
 * No fetch, no client-side rendering. This page is opened overwhelmingly from
 * the in-app browsers inside Instagram and WhatsApp, which are inconsistent
 * about JavaScript, third-party storage and history. A normal <form method=post>
 * that re-renders server-side works in every one of them. The client script is
 * strictly an enhancement — double-submit prevention and inline validation —
 * and the flow is completely functional with it removed.
 *
 * ── prefill is a hint, never an identity ───────────────────────────────────
 * `name`, `phone` and `ig` arrive in the query string from ManyChat merge
 * fields, which means they are attacker-controllable: anyone can hand-edit the
 * URL. They are echoed back into form values only, never trusted as proof of
 * who the visitor is, and every one is escaped on the way out. The booking is
 * only ever as trustworthy as the phone number the visitor actually submits.
 *
 * In practice ManyChat has no phone or email for an Instagram subscriber
 * unless it collected them in-flow, and often no real name either — only the
 * Instagram username is reliably populated. So the form is designed around
 * phone being empty and required, not around a happy path that rarely happens.
 *
 * ── the visible security affordances ───────────────────────────────────────
 * A honeypot field, a session token, and (adaptively) a captcha. The honeypot
 * is hidden with an off-screen class rather than `display:none` because some
 * bots skip display:none fields specifically to dodge this check. None of
 * these are the real defence — every one is re-checked server-side — they just
 * make the cheap attacks cheap to reject.
 */

import { esc, attr, page, header, footer, formatPrice } from './layout.js';

const REASONS = {
  missing_name_or_phone: 'Please enter your name and phone number.',
  invalid_phone: 'Please enter a valid 10-digit Indian mobile number.',
  invalid_date: 'Please choose a date for your visit.',
  invalid_time: 'Please choose a time for your visit.',
  date_in_past: 'That date has already passed. Please pick another.',
  date_too_far: 'Please pick a date within the next 30 days.',
  slot_unavailable: 'That time is no longer available. Please pick another.',
  property_unavailable: 'This property is no longer listed.',
  session_expired: 'This form was open for a while and expired. Please try again.',
  session_replayed: 'That looks like a duplicate submission. Please start again.',
  too_fast: 'That was submitted unusually fast. Please try again.',
  captcha_failed: 'Please complete the verification and try again.',
  rate_limited: 'Too many attempts from your connection. Please wait a few minutes.',
  upstream_error: 'Something went wrong on our side. Please try again shortly.',
};

export function reasonMessage(reason) {
  return REASONS[reason] || 'Something went wrong. Please try again.';
}

function dateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function timeLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function renderVisitForm({
  agency, property, availability, sessionToken, origin,
  prefill = {}, error = null, values = {}, captcha = null, actionHref, backHref, homeHref,
  nonce = '',
}) {
  const dates = availability.dates || [];
  const selectedDate = values.meetingDate || dates[0]?.date || '';
  const activeDay = dates.find((d) => d.date === selectedDate) || dates[0] || { slots: [] };

  const nameValue = values.name ?? prefill.name ?? '';
  const phoneValue = values.phone ?? prefill.phone ?? '';
  const messageValue = values.message ?? '';

  const title = property
    ? `Schedule a visit — ${property.title} | ${agency.name}`
    : `Schedule a visit | ${agency.name}`;

  const dateOptions = dates.map((d) =>
    `<option value="${attr(d.date)}"${d.date === selectedDate ? ' selected' : ''}>${esc(dateLabel(d.date))}</option>`,
  ).join('');

  const slotOptions = (activeDay.slots || []).map((s) =>
    `<option value="${attr(s)}"${s === values.meetingTime ? ' selected' : ''}>${esc(timeLabel(s))}</option>`,
  ).join('');

  // The whole schedule, so changing the date can repopulate times without a
  // round-trip. Read by the enhancement script; the <select> is already
  // correct for the chosen date without it.
  const slotData = Object.fromEntries(dates.map((d) => [d.date, d.slots]));

  const noSlots = dates.length === 0;

  const body = `
${header(agency, { homeHref })}
<main class="wrap" style="max-width:620px">
  <div class="section">
    <p class="muted" style="margin:0 0 6px;font-size:14px">
      <a href="${attr(backHref)}" style="text-decoration:none">← Back</a></p>
    <h1>Schedule a visit</h1>
    ${property ? `<p class="muted" style="margin:0">
      ${esc(property.title)} · ${esc(formatPrice(property.pricing.amount))}</p>` : ''}
  </div>

  ${error ? `<div class="alert alert-error" role="alert">${esc(reasonMessage(error))}</div>` : ''}

  ${noSlots
    ? `<div class="card empty">
        <p style="margin:0 0 6px;font-weight:700;color:var(--ink)">No visit slots available right now</p>
        <p style="margin:0">Please call ${agency.publicPhone ? esc(agency.publicPhone) : 'the agency'} to arrange a visit.</p>
      </div>`
    : `<form class="card" style="padding:20px" method="post" action="${attr(actionHref)}" id="visit-form" novalidate>
    <input type="hidden" name="session" value="${attr(sessionToken)}">

    <!-- Honeypot. Real people never see it; anything that fills it is rejected. -->
    <div class="hp" aria-hidden="true">
      <label for="company_website">Company website</label>
      <input type="text" id="company_website" name="company_website" tabindex="-1" autocomplete="off">
    </div>

    <div class="field">
      <label for="name">Your name</label>
      <input type="text" id="name" name="name" required maxlength="120"
        autocomplete="name" enterkeyhint="next" value="${attr(nameValue)}"
        placeholder="e.g. Priya Sharma">
    </div>

    <div class="field">
      <label for="phone">Mobile number</label>
      <input type="tel" id="phone" name="phone" required
        inputmode="numeric" autocomplete="tel" enterkeyhint="next"
        pattern="[6-9][0-9]{9}" maxlength="10" value="${attr(phoneValue)}"
        placeholder="10-digit mobile number">
      <p class="hint">${esc(agency.name)} will call this number to confirm your visit.</p>
    </div>

    <div class="row">
      <div class="field">
        <label for="meetingDate">Date</label>
        <select id="meetingDate" name="meetingDate" required>${dateOptions}</select>
      </div>
      <div class="field">
        <label for="meetingTime">Time</label>
        <select id="meetingTime" name="meetingTime" required>${slotOptions}</select>
      </div>
    </div>

    <div class="field">
      <label for="message">Anything we should know? <span class="muted" style="font-weight:600">(optional)</span></label>
      <textarea id="message" name="message" rows="3" maxlength="500"
        placeholder="e.g. I'd prefer a morning visit">${esc(messageValue)}</textarea>
    </div>

    ${captcha ? `<div class="field">
      <div class="h-captcha" data-sitekey="${attr(captcha.siteKey)}"></div>
      <p class="hint">Please complete this check so we know you're a person.</p>
    </div>
    <script src="https://js.hcaptcha.com/1/api.js" async defer></script>` : ''}

    <button class="btn btn-primary btn-block" type="submit" id="visit-submit">Confirm visit</button>
    <p class="hint" style="text-align:center;margin-top:12px">
      By booking, you agree to be contacted by ${esc(agency.name)} about this property.</p>
  </form>`}
</main>
${footer(agency)}`;

  const bodyEnd = noSlots ? '' : `<script${nonce ? ` nonce="${attr(nonce)}"` : ''}>
(function(){
  var slots = ${JSON.stringify(slotData).replace(/</g, '\\u003c')};
  var dateEl = document.getElementById('meetingDate');
  var timeEl = document.getElementById('meetingTime');
  var form = document.getElementById('visit-form');
  var btn = document.getElementById('visit-submit');

  if (dateEl && timeEl) {
    dateEl.addEventListener('change', function(){
      var list = slots[dateEl.value] || [];
      timeEl.innerHTML = list.map(function(s){
        var h = parseInt(s.slice(0,2),10), m = s.slice(3);
        var sfx = h < 12 ? 'AM' : 'PM', h12 = (h % 12) === 0 ? 12 : (h % 12);
        return '<option value="' + s + '">' + h12 + ':' + m + ' ' + sfx + '</option>';
      }).join('');
    });
  }

  if (form && btn) {
    // Single-flight: a double tap on a slow connection would otherwise post
    // twice. The server's single-use nonce is the real guard; this stops the
    // user seeing a confusing second attempt at all.
    form.addEventListener('submit', function(){
      setTimeout(function(){ btn.disabled = true; btn.textContent = 'Booking...'; }, 0);
    });
  }
})();
</script>`;

  return page({
    title,
    description: `Book a site visit for ${property ? property.title : 'this property'} with ${agency.name}.`,
    canonical: `${origin}${actionHref}`,
    // A booking form has no business in search results, and indexing it would
    // compete with the listing page it belongs to.
    noindex: true,
    agency,
    body,
    bodyEnd,
    nonce,
  });
}

export function renderVisitSuccess({ agency, booking, property, origin, homeHref, backHref }) {
  const when = `${dateLabel(booking.meetingDate)} at ${timeLabel(booking.meetingTime)}`;

  const body = `
${header(agency, { homeHref })}
<main class="wrap" style="max-width:620px">
  <div class="section" style="text-align:center">
    <div style="font-size:44px;line-height:1" aria-hidden="true">✅</div>
    <h1 style="margin-top:12px">Visit booked</h1>
    <p class="muted" style="margin:0">${esc(agency.name)} will call you to confirm.</p>
  </div>

  <div class="card" style="padding:20px">
    <ul class="facts">
      <li><span class="k">When</span><span class="v">${esc(when)}</span></li>
      ${property ? `<li><span class="k">Property</span><span class="v">${esc(property.title)}</span></li>` : ''}
      ${property && property.locality ? `<li><span class="k">Where</span><span class="v">${esc(property.locality)}</span></li>` : ''}
    </ul>
    ${agency.publicPhone ? `<p style="margin:18px 0 0;text-align:center">
      Need to change it? Call <a href="tel:${attr(agency.publicPhone)}"><strong>${esc(agency.publicPhone)}</strong></a>
    </p>` : ''}
  </div>

  <p style="margin:24px 0 0;text-align:center">
    <a class="btn btn-ghost" href="${attr(backHref)}">Back to property</a>
  </p>
</main>
${footer(agency)}`;

  return page({
    title: `Visit booked — ${agency.name}`,
    description: 'Your site visit has been booked.',
    canonical: `${origin}${homeHref}`,
    noindex: true,
    agency,
    body,
  });
}
