/**
 * Booking a property site visit from a public page.
 *
 * One visitor action produces two records that must both exist: a LEAD (so the
 * agency has someone to call) and a MEETING (so someone turns up). This module
 * is the only place that pairing is made, so the public pages microservice and
 * any future channel get identical behaviour.
 *
 * ── why it is not just ingestLead() ────────────────────────────────────────
 * `ingestLead()` is the right front door for the lead half and is reused
 * verbatim, including its one-person-one-lead phone dedupe. But it is
 * deliberately silent when the phone matches an existing lead — correct for a
 * repeat enquiry, wrong for a booking, because a calendar commitment has to
 * reach the agency even from someone already in the pipeline. So the meeting
 * and its notification are handled here, after ingestion, unconditionally.
 *
 * ── ordering, and what happens when a step fails ───────────────────────────
 * Lead first, then meeting. A meeting needs a `relatedEntityId` and the lead
 * is what it points at. If the meeting write fails we still keep the lead —
 * an agency with a contactable person and no calendar entry can recover; the
 * reverse is a meeting with nobody's phone number attached.
 *
 * Notifications and reminder-recipient resolution are best-effort by design:
 * both records are already durable by the time they run, and losing a booking
 * because an email service was briefly down would be the worse failure.
 */

import { ingestLead } from './leadIngestion.js';
import { createMeeting, getProperty } from './crmDynamodbService.js';
import { attachMeetingReminderRecipients } from './meetingReminderRecipients.js';
import { notifySiteVisitBooked } from './leadNotifications.js';
import { getAgencyConfig } from './agencyConfigService.js';
import { logger } from './logger.js';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_DAY_START = 10; // 10:00
const DEFAULT_DAY_END = 19;   // last slot starts 18:30
const SLOT_MINUTES = 30;
const VISIT_DURATION_MINUTES = 45;

/** How far ahead a visitor may book. Beyond this is almost always a typo or a bot. */
const MAX_DAYS_AHEAD = 30;

/**
 * "Today" in the agency's timezone, as YYYY-MM-DD.
 *
 * Lambda runs in UTC, so a naive `new Date().toISOString().slice(0,10)` is the
 * wrong date in India for five and a half hours every night — it would reject
 * a same-day booking made after 18:30 IST as being in the past.
 */
export function todayInTimezone(timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Current wall-clock minutes-since-midnight in the agency's timezone. */
function minutesNowInTimezone(timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  // Round-trip guards against 2026-02-31, which Date happily rolls forward.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isValidTimeString(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

/**
 * The bookable slots for one date.
 *
 * Exported because the page renders exactly this list and the API validates
 * against exactly this list — a visitor can only ever submit a slot the same
 * function produced, so "pick any time you like" spam is not possible.
 */
export function generateSlots(dateStr, { timeZone = DEFAULT_TIMEZONE, dayStart = DEFAULT_DAY_START, dayEnd = DEFAULT_DAY_END } = {}) {
  if (!isValidDateString(dateStr)) return [];

  const today = todayInTimezone(timeZone);
  if (dateStr < today) return [];

  const slots = [];
  const lastStart = dayEnd * 60 - SLOT_MINUTES;
  // Don't offer a slot that starts in the next few minutes — nobody can get
  // to a property that fast, and it reads as broken.
  const cutoff = dateStr === today ? minutesNowInTimezone(timeZone) + 90 : -1;

  for (let m = dayStart * 60; m <= lastStart; m += SLOT_MINUTES) {
    if (m <= cutoff) continue;
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

/**
 * The next `days` dates that have at least one bookable slot left, so the page
 * never offers a day it would then reject.
 */
export function availableDates(days = 14, opts = {}) {
  const timeZone = opts.timeZone || DEFAULT_TIMEZONE;
  const out = [];
  const today = new Date(`${todayInTimezone(timeZone)}T00:00:00Z`);

  for (let i = 0; i < days + 3 && out.length < days; i += 1) {
    const d = new Date(today.getTime() + i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const slots = generateSlots(dateStr, { ...opts, timeZone });
    if (slots.length > 0) out.push({ date: dateStr, slots });
  }
  return out;
}

/**
 * Per-agency booking window. Falls back to sane defaults — a tenant that never
 * configured business hours should still be bookable, not silently closed.
 */
async function resolveBookingWindow(tenantId) {
  try {
    const config = await getAgencyConfig(tenantId);
    const start = Number(config?.businessHoursStart);
    const end = Number(config?.businessHoursEnd);
    return {
      timeZone: config?.timezone || DEFAULT_TIMEZONE,
      dayStart: Number.isInteger(start) && start >= 0 && start < 24 ? start : DEFAULT_DAY_START,
      dayEnd: Number.isInteger(end) && end > 0 && end <= 24 ? end : DEFAULT_DAY_END,
    };
  } catch (err) {
    logger.warn('siteVisit.agency_config_failed', { tenantId, error: err.message });
    return { timeZone: DEFAULT_TIMEZONE, dayStart: DEFAULT_DAY_START, dayEnd: DEFAULT_DAY_END };
  }
}

export async function getAvailability(tenantId, days = 14) {
  const window = await resolveBookingWindow(tenantId);
  return { timeZone: window.timeZone, dates: availableDates(days, window) };
}

/**
 * Book a visit.
 *
 * @returns {Promise<{ok: boolean, reason?: string, meetingId?: string, leadId?: string}>}
 *
 * Returns a reason rather than throwing for anything a visitor could cause
 * (bad slot, unknown property); throws only on genuine server faults, so the
 * caller can map the two to 400 and 500 without inspecting error strings.
 */
export async function bookSiteVisit(tenantId, input = {}) {
  if (!tenantId) return { ok: false, reason: 'missing_tenant' };

  const name = String(input.name || '').trim().slice(0, 120);
  const phone = String(input.phone || '').trim().slice(0, 20);
  const { propertyId, meetingDate, meetingTime } = input;

  if (!name || !phone) return { ok: false, reason: 'missing_name_or_phone' };
  if (!isValidDateString(meetingDate)) return { ok: false, reason: 'invalid_date' };
  if (!isValidTimeString(meetingTime)) return { ok: false, reason: 'invalid_time' };

  const window = await resolveBookingWindow(tenantId);
  const today = todayInTimezone(window.timeZone);

  if (meetingDate < today) return { ok: false, reason: 'date_in_past' };

  const maxDate = new Date(new Date(`${today}T00:00:00Z`).getTime() + MAX_DAYS_AHEAD * 86400000)
    .toISOString().slice(0, 10);
  if (meetingDate > maxDate) return { ok: false, reason: 'date_too_far' };

  // The slot must be one this service actually offered. This is what stops a
  // scripted 03:00 booking, and it is checked server-side because the page's
  // dropdown is a convenience, not a control.
  const slots = generateSlots(meetingDate, window);
  if (!slots.includes(meetingTime)) return { ok: false, reason: 'slot_unavailable' };

  // The property must exist, belong to this tenant, and be published. Reusing
  // getProperty (tenant-scoped by key) means a propertyId from another agency
  // simply isn't found.
  let property = null;
  if (propertyId) {
    property = await getProperty(tenantId, propertyId);
    if (!property || property.publicVisibility !== 'public') {
      return { ok: false, reason: 'property_unavailable' };
    }
  }

  const propertyTitle = property?.title || null;
  const locality = [property?.area, property?.city].filter(Boolean).join(', ');

  const leadResult = await ingestLead(
    tenantId,
    {
      name,
      phone,
      // A site-visit request is a purchase-intent signal unless the listing is
      // explicitly a rental, in which case they are a tenant lead.
      leadType: property?.status === 'for-rent' ? 'tenant' : 'buyer',
      requirement: {
        requirement: property?.status === 'for-rent' ? 'rent' : 'buy',
        preferredArea: property?.area || input.preferredArea || undefined,
      },
      source: input.source || 'Website',
      sourceAdapter: 'website',
      externalRef: input.externalRef || null,
      createdBy: 'Public property page',
    },
    // Scoped to this specific booking rather than to the person, so a genuine
    // second visit is never swallowed as a duplicate while a double-submitted
    // form is.
    { dedupeKey: input.dedupeKey ? `sitevisit:${tenantId}:${input.dedupeKey}` : undefined },
  );

  if (!leadResult.ok || !leadResult.lead) {
    // A replayed request finds its lead already ingested and gets no lead back.
    // Treat it as success — the first request created both records, and the
    // meeting write below is guarded by the same key upstream.
    if (leadResult.duplicate) return { ok: true, duplicate: true };
    logger.warn('siteVisit.lead_ingest_failed', { tenantId, reason: leadResult.reason });
    return { ok: false, reason: leadResult.reason || 'lead_failed' };
  }

  const lead = leadResult.lead;

  const meeting = await createMeeting(tenantId, {
    title: propertyTitle ? `Site visit — ${propertyTitle}` : 'Site visit',
    description: [
      'Booked by the visitor from a public property page.',
      propertyTitle ? `Property: ${propertyTitle}` : null,
      input.message ? `Visitor note: ${String(input.message).slice(0, 500)}` : null,
    ].filter(Boolean).join('\n'),
    meetingDate,
    meetingTime,
    duration: VISIT_DURATION_MINUTES,
    location: locality || property?.buildingName || '',
    relatedEntityType: 'lead',
    relatedEntityId: lead.leadId,
    relatedEntityName: name,
    relatedEntityPhone: phone,
    attendeeName: name,
    attendeePhone: phone,
    createdBy: 'Public property page',
  });

  // Both records exist from here on. Everything below is best-effort.
  try {
    await attachMeetingReminderRecipients(tenantId, meeting);
  } catch (err) {
    logger.warn('siteVisit.reminder_recipients_failed', {
      tenantId, meetingId: meeting.meetingId, error: err.message,
    });
  }

  try {
    await notifySiteVisitBooked(tenantId, { lead, meeting, propertyTitle });
  } catch (err) {
    logger.warn('siteVisit.notify_failed', {
      tenantId, meetingId: meeting.meetingId, error: err.message,
    });
  }

  logger.info('siteVisit.booked', {
    tenantId,
    meetingId: meeting.meetingId,
    leadId: lead.leadId,
    propertyId: propertyId || null,
    leadCreated: Boolean(leadResult.created),
  });

  return {
    ok: true,
    meetingId: meeting.meetingId,
    leadId: lead.leadId,
    meetingDate,
    meetingTime,
    propertyTitle,
  };
}
