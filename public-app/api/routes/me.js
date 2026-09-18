/**
 * Consumer routes — everything behind a Cognito bearer token.
 *
 * Mounted twice by server.js: the profile/saved/searches/threads surface at
 * `/me`, and the per-listing actions (`ping`, `availability`, `visit`) at
 * `/listings/:slug/:propertyId`, because the contract puts them there. Both
 * groups share the same rule set:
 *
 *   - identity is `req.user.userId` (the token's `sub`), never a body field
 *   - a write to an agency's CRM (enquiry, message, ping, visit) goes local
 *     first, CRM second, best-effort. The buyer's message is never lost
 *     because the CRM was slow; the agency still sees it in the inbox, which
 *     reads our table. What a failed CRM call loses is the lead/alert, and
 *     that is logged with the thread id so it can be replayed.
 *   - the CRM needs a name and a phone to make a lead, so any route that
 *     writes there refuses with `details: 'profile_incomplete'` until the
 *     profile has both.
 */

import express from 'express';
import * as crm from '../services/crmClient.js';
import { CrmUnavailableError } from '../services/crmClient.js';
import * as users from '../services/usersRepo.js';
import * as threads from '../services/threadsRepo.js';
import { authRequired } from '../middleware/auth.js';
import { buyerWriteGuard, rateLimitReject } from '../middleware/rateLimit.js';
import { getClientIp, checkPing, checkBookingAttempt, phoneHash } from '../services/abuseGuard.js';
import { logger } from '../logger.js';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;

function guarded(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      if (err instanceof CrmUnavailableError) {
        res.set('Retry-After', '15');
        return res.status(503).json({ error: 'Service temporarily unavailable', details: 'upstream_unavailable' });
      }
      return next(err);
    }
  };
}

function validListingParams(req, res) {
  if (!SLUG_RE.test(req.params.slug) || !ID_RE.test(req.params.propertyId)) {
    res.status(404).json({ error: 'Not found' });
    return false;
  }
  return true;
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Profile with name + phone, or a 400 already sent. */
async function contactableProfile(req, res) {
  const profile = await users.getOrCreateProfile(req.user);
  if (!profile.name || !profile.phone) {
    res.status(400).json({ error: 'Add your name and phone to your profile first', details: 'profile_incomplete' });
    return null;
  }
  return profile;
}

/** Listing that is live on the marketplace, or a 404 already sent. */
async function liveListing(req, res) {
  const listing = await crm.getListing(req.params.slug, req.params.propertyId);
  if (!listing) {
    res.status(404).json({ error: 'Listing not available', details: 'property_unavailable' });
    return null;
  }
  return listing;
}

/** Body the CRM wants for every buyer activity. */
function buyerFor(profile) {
  return { userId: profile.userId, name: profile.name, phone: profile.phone, email: profile.email || null };
}

/** Thread the buyer owns, or a 404 already sent. Never reveals other buyers' thread ids exist. */
async function ownThread(req, res) {
  if (!ID_RE.test(req.params.threadId)) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  const thread = await threads.getThread(req.params.threadId);
  if (!thread || thread.buyerUserId !== req.user.userId) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return thread;
}

// ═══════════════════════════════════════════════════════════════════════════
// /me
// ═══════════════════════════════════════════════════════════════════════════

export const meRouter = express.Router();
meRouter.use(authRequired);

meRouter.get('/', guarded(async (req, res) => {
  res.json({ user: await users.getOrCreateProfile(req.user) });
}));

meRouter.put('/', buyerWriteGuard, guarded(async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (body.name !== undefined) {
    const name = str(body.name, 120);
    if (!name) return res.status(400).json({ error: 'name must not be empty' });
    patch.name = name;
  }
  if (body.email !== undefined) {
    if (body.email === null || body.email === '') patch.email = null;
    else {
      const email = str(body.email, 200).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'email is invalid' });
      patch.email = email;
    }
  }
  if (body.preferredCities !== undefined) {
    if (!Array.isArray(body.preferredCities)) return res.status(400).json({ error: 'preferredCities must be an array' });
    patch.preferredCities = body.preferredCities
      .filter((c) => typeof c === 'string' && c.trim())
      .map((c) => c.trim().slice(0, 80))
      .slice(0, 10);
  }
  await users.getOrCreateProfile(req.user);
  return res.json({ user: await users.updateProfile(req.user.userId, patch) });
}));

// ── saved ──────────────────────────────────────────────────────────────────

meRouter.get('/saved', guarded(async (req, res) => {
  res.json({ items: await users.listSaved(req.user.userId) });
}));

meRouter.put('/saved/:slug/:propertyId', buyerWriteGuard, guarded(async (req, res) => {
  if (!validListingParams(req, res)) return undefined;
  const listing = await liveListing(req, res);
  if (!listing) return undefined;
  await users.saveListing(req.user.userId, {
    propertyId: listing.propertyId,
    tenantId: listing.tenantId,
    agencySlug: listing.agencySlug || req.params.slug,
    snapshot: users.listingSnapshot(listing),
  });
  return res.json({ ok: true });
}));

meRouter.delete('/saved/:slug/:propertyId', guarded(async (req, res) => {
  if (!validListingParams(req, res)) return undefined;
  await users.unsaveListing(req.user.userId, req.params.propertyId);
  res.json({ ok: true });
}));

// ── searches ───────────────────────────────────────────────────────────────

meRouter.get('/searches', guarded(async (req, res) => {
  res.json({ items: await users.listSearches(req.user.userId) });
}));

meRouter.post('/searches', buyerWriteGuard, guarded(async (req, res) => {
  const body = req.body || {};
  const query = str(body.query, 500);
  if (query.length < 2) return res.status(400).json({ error: 'query must be 2-500 characters' });
  const city = str(body.city, 80) || null;
  const filters = body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters) ? body.filters : {};
  // Filters are stored as given but bounded, so a saved search cannot be a
  // vehicle for stuffing kilobytes into the table.
  if (JSON.stringify(filters).length > 2000) return res.status(400).json({ error: 'filters too large' });
  res.json({ search: await users.createSearch(req.user.userId, { query, city, filters }) });
}));

meRouter.delete('/searches/:searchId', guarded(async (req, res) => {
  if (!ID_RE.test(req.params.searchId)) return res.status(404).json({ error: 'Not found' });
  await users.deleteSearch(req.user.userId, req.params.searchId);
  res.json({ ok: true });
}));

// ── threads ────────────────────────────────────────────────────────────────

meRouter.get('/threads', guarded(async (req, res) => {
  const page = await threads.listThreadsForUser(req.user.userId, {
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : null,
    limit: 25,
  });
  res.json({ items: page.items.map(threads.toThread), nextCursor: page.nextCursor });
}));

/**
 * Start (or continue) the conversation about a listing.
 * One thread per buyer + property: a second POST for the same listing lands
 * in the existing thread and is treated as a follow-up message.
 */
meRouter.post('/threads', buyerWriteGuard, guarded(async (req, res) => {
  const body = req.body || {};
  const text = str(body.text, 2000);
  const slug = str(body.slug, 40);
  const propertyId = str(body.propertyId, 80);
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!SLUG_RE.test(slug) || !ID_RE.test(propertyId)) return res.status(400).json({ error: 'slug and propertyId are required' });

  const profile = await contactableProfile(req, res);
  if (!profile) return undefined;
  req.params.slug = slug;
  req.params.propertyId = propertyId;
  const listing = await liveListing(req, res);
  if (!listing) return undefined;

  const { thread, created } = await threads.getOrCreateThread({ buyer: buyerFor(profile), listing });
  const { message, thread: updated } = await threads.appendMessage(thread.threadId, {
    senderType: 'buyer', senderId: profile.userId, senderName: profile.name, text, kind: 'text',
  });

  const args = {
    buyer: buyerFor(profile), propertyId: listing.propertyId, threadId: thread.threadId,
    messageId: message.messageId, text, dedupeKey: message.messageId,
  };
  try {
    const result = created
      ? await crm.postEnquiry(listing.tenantId, args)
      : await crm.postMessage(listing.tenantId, args);
    if (result?.ok && result.leadId) await threads.setLeadId(thread.threadId, result.leadId);
    if (result && !result.ok) logger.warn('me.crm_write_rejected', { threadId: thread.threadId, reason: result.reason });
  } catch (err) {
    logger.error('me.crm_write_failed', { threadId: thread.threadId, kind: created ? 'enquiry' : 'message', error: err.message });
  }

  return res.status(created ? 201 : 200).json({
    thread: threads.toThread({ ...updated, leadId: updated.leadId }),
    message: threads.toMessage(message),
  });
}));

meRouter.get('/threads/:threadId', guarded(async (req, res) => {
  const thread = await ownThread(req, res);
  if (!thread) return undefined;
  const since = typeof req.query.since === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(req.query.since) ? req.query.since : null;
  const messages = await threads.listMessages(thread.threadId, { since });
  return res.json({ thread: threads.toThread(thread), messages });
}));

meRouter.post('/threads/:threadId/messages', buyerWriteGuard, guarded(async (req, res) => {
  const thread = await ownThread(req, res);
  if (!thread) return undefined;
  const text = str(req.body?.text, 2000);
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (thread.status === 'agency_closed') {
    return res.status(409).json({ error: 'This agency is no longer on the marketplace', details: 'agency_closed' });
  }
  const profile = await contactableProfile(req, res);
  if (!profile) return undefined;

  const { message } = await threads.appendMessage(thread.threadId, {
    senderType: 'buyer', senderId: profile.userId, senderName: profile.name, text, kind: 'text',
  });
  try {
    await crm.postMessage(thread.tenantId, {
      buyer: buyerFor(profile), propertyId: thread.propertyId, threadId: thread.threadId,
      messageId: message.messageId, text, dedupeKey: message.messageId,
    });
  } catch (err) {
    logger.error('me.crm_write_failed', { threadId: thread.threadId, kind: 'message', error: err.message });
  }
  return res.status(201).json({ message: threads.toMessage(message) });
}));

meRouter.post('/threads/:threadId/read', guarded(async (req, res) => {
  const thread = await ownThread(req, res);
  if (!thread) return undefined;
  await threads.markRead(thread.threadId, 'buyer');
  return res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════════════════════════════
// /listings/:slug/:propertyId/{ping,availability,visit}
// ═══════════════════════════════════════════════════════════════════════════

export const listingActionsRouter = express.Router({ mergeParams: true });
listingActionsRouter.use(authRequired);

/** "I'm interested" — a lead alert without typing a message. One per property per day. */
listingActionsRouter.post('/ping', buyerWriteGuard, guarded(async (req, res) => {
  if (!validListingParams(req, res)) return undefined;
  const profile = await contactableProfile(req, res);
  if (!profile) return undefined;
  const listing = await liveListing(req, res);
  if (!listing) return undefined;

  const cooldown = await checkPing(profile.userId, listing.propertyId);
  if (!cooldown.allowed) {
    return rateLimitReject(res, { ...cooldown, scope: 'ping_cooldown' });
  }

  const { thread } = await threads.getOrCreateThread({ buyer: buyerFor(profile), listing });
  const { message, thread: updated } = await threads.appendMessage(thread.threadId, {
    senderType: 'system', senderId: profile.userId, senderName: profile.name,
    text: `${profile.name} is interested in this property`, kind: 'ping',
  });
  try {
    const result = await crm.postPing(listing.tenantId, {
      buyer: buyerFor(profile), propertyId: listing.propertyId, threadId: thread.threadId,
      messageId: message.messageId, dedupeKey: message.messageId,
    });
    if (result?.ok && result.leadId) await threads.setLeadId(thread.threadId, result.leadId);
  } catch (err) {
    logger.error('me.crm_write_failed', { threadId: thread.threadId, kind: 'ping', error: err.message });
  }
  return res.json({ ok: true, thread: threads.toThread(updated) });
}));

listingActionsRouter.get('/availability', guarded(async (req, res) => {
  if (!validListingParams(req, res)) return undefined;
  const listing = await liveListing(req, res);
  if (!listing) return undefined;
  const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 14, 1), 30);
  res.set('Cache-Control', 'private, max-age=60');
  return res.json(await crm.getAvailability(listing.tenantId, days));
}));

/** Book a site visit. The CRM owns the calendar; we record the request on the thread. */
listingActionsRouter.post('/visit', buyerWriteGuard, guarded(async (req, res) => {
  if (!validListingParams(req, res)) return undefined;
  const body = req.body || {};
  const date = str(body.date, 10);
  const time = str(body.time, 5);
  const message = str(body.message, 500) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Booking failed', details: 'invalid_date' });
  if (!/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: 'Booking failed', details: 'invalid_time' });

  const profile = await contactableProfile(req, res);
  if (!profile) return undefined;
  const listing = await liveListing(req, res);
  if (!listing) return undefined;

  const quota = await checkBookingAttempt({
    ip: getClientIp(req), phoneHash: phoneHash(profile.phone), tenantId: listing.tenantId,
  });
  if (!quota.allowed) {
    logger.warn('me.visit_quota', { tenantId: listing.tenantId, scope: quota.scope });
    return rateLimitReject(res, quota);
  }

  const { thread } = await threads.getOrCreateThread({ buyer: buyerFor(profile), listing });

  // CRM first here, unlike messages: a visit request without a confirmed
  // slot is not a request, it is a question — and the CRM is what knows
  // whether the slot exists.
  const result = await crm.postSiteVisit(listing.tenantId, {
    buyer: buyerFor(profile), propertyId: listing.propertyId, threadId: thread.threadId,
    meetingDate: date, meetingTime: time, message,
    dedupeKey: `${thread.threadId}:${date}:${time}`,
  });
  if (!result?.ok) {
    const fixable = new Set(['missing_name_or_phone', 'invalid_date', 'invalid_time', 'date_in_past', 'date_too_far', 'slot_unavailable', 'property_unavailable']);
    const reason = result?.reason || 'upstream_error';
    return res.status(fixable.has(reason) ? 400 : 502).json({ error: 'Booking failed', details: reason });
  }
  if (result.leadId) await threads.setLeadId(thread.threadId, result.leadId);

  const { thread: updated } = await threads.appendMessage(thread.threadId, {
    senderType: 'system', senderId: profile.userId, senderName: profile.name,
    text: message ? `Site visit requested for ${date} ${time} — ${message}` : `Site visit requested for ${date} ${time}`,
    kind: 'visit_request',
    meta: { meetingId: result.meetingId || null, meetingDate: result.meetingDate || date, meetingTime: result.meetingTime || time },
  });

  return res.json({
    ok: true,
    meetingId: result.meetingId || null,
    meetingDate: result.meetingDate || date,
    meetingTime: result.meetingTime || time,
    thread: threads.toThread(updated),
  });
}));
