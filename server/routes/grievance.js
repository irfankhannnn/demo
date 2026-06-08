import express from 'express';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import validateToken from '../middleware/validateToken.js';
import {
  createGrievance,
  getGrievanceById,
  listGrievances,
  updateGrievance,
  GRIEVANCE_CATEGORIES,
  GRIEVANCE_STATUSES,
} from '../grievanceDynamodbService.js';
import { logger } from '../logger.js';

const router = express.Router();

const SLA_MESSAGE = 'Received. Expect a response within 7 working days.';
const GRIEVANCE_OFFICER_MAILBOX = process.env.GRIEVANCE_OFFICER_EMAIL || 'info@realestateflow.in';
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'no-reply@realestateflow.in';
const FROM_NAME = process.env.BREVO_FROM_NAME || 'RealEstateFlow';

// ============== PostHog server stub ==============
// PR-E will implement the real server/lib/posthog.js module. For now this is a
// no-op that simply logs, so the grievance funnel event has a call site.
async function serverTrack(distinctId, event, properties) {
  try {
    if (process.env.POSTHOG_KEY_SERVER) {
      // PR-E fills this in — for now just log.
      console.log('[PostHog stub]', event, { distinctId, ...properties });
    }
  } catch (err) {
    logger.warn('grievance.posthog_stub_failed', { error: err.message });
  }
}

// ============== Helpers ==============

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/;

/**
 * Validate + normalise the public grievance payload.
 * @returns {{ valid: true, data: object } | { valid: false, error: string }}
 */
function validateGrievancePayload(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (name.length < 1 || name.length > 100) {
    return { valid: false, error: 'Name must be between 1 and 100 characters.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { valid: false, error: 'A valid email address is required.' };
  }
  const phone = phoneRaw.replace(/[\s-]/g, '');
  if (phone && !PHONE_RE.test(phone)) {
    return { valid: false, error: 'Phone must be a 10-digit number.' };
  }
  if (!GRIEVANCE_CATEGORIES.includes(category)) {
    return { valid: false, error: 'Please select a valid category.' };
  }
  if (description.length < 10 || description.length > 2000) {
    return { valid: false, error: 'Description must be between 10 and 2000 characters.' };
  }

  return {
    valid: true,
    data: { name, email, phone: phone || null, category, description },
  };
}

/**
 * Verify an hCaptcha token. If no secret is configured (local/dev), verification
 * is skipped and treated as a pass so the flow stays testable.
 */
async function verifyHcaptcha(token, remoteip) {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) {
    logger.warn('grievance.hcaptcha_skipped', { reason: 'HCAPTCHA_SECRET_KEY not set' });
    return true;
  }
  if (!token) {
    return false;
  }
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteip) params.append('remoteip', remoteip);
    const { data } = await axios.post('https://hcaptcha.com/siteverify', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000,
    });
    return data && data.success === true;
  } catch (err) {
    logger.error('grievance.hcaptcha_error', { error: err.message });
    return false;
  }
}

/**
 * Send a transactional email via Brevo. Never throws — email failure must not
 * fail the grievance submission.
 */
async function sendBrevoEmail({ to, subject, htmlContent }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    logger.warn('grievance.brevo_skipped', { reason: 'BREVO_API_KEY not set', to });
    return;
  }
  try {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: Array.isArray(to) ? to : [{ email: to }],
        subject,
        htmlContent,
      },
      { headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }, timeout: 8000 },
    );
  } catch (err) {
    logger.error('grievance.brevo_error', { error: err.message, to });
  }
}

function ackEmailHtml({ name, trackingId, category }) {
  return `
    <p>Hi ${name},</p>
    <p>We have received your grievance and assigned it tracking ID <strong>${trackingId}</strong>.</p>
    <p>Category: <strong>${category}</strong></p>
    <p>As per the DPDP Act 2023, our Grievance Officer will respond within <strong>7 working days</strong>.</p>
    <p>Regards,<br/>${FROM_NAME} Grievance Team</p>
  `;
}

function notifyEmailHtml({ name, email, phone, category, description, trackingId }) {
  return `
    <p>New grievance submitted.</p>
    <ul>
      <li><strong>Tracking ID:</strong> ${trackingId}</li>
      <li><strong>Name:</strong> ${name}</li>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Phone:</strong> ${phone || '—'}</li>
      <li><strong>Category:</strong> ${category}</li>
    </ul>
    <p><strong>Description:</strong></p>
    <p>${description}</p>
  `;
}

// ============== Role gate (admin) ==============
const ADMIN_ROLES = new Set(['founder', 'admin', 'owner']);
function requireAdmin(req, res, next) {
  const role = (req.user?.role || '').toString().toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    return res.status(403).json({ error: 'Forbidden', details: 'Admin role required' });
  }
  return next();
}

// ============== Public POST /api/grievance ==============
const publicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests', details: 'Rate limit exceeded. Try again later.' });
  },
});

router.post('/grievance', publicLimiter, async (req, res) => {
  try {
    // Honeypot: bots fill hidden fields. Reject silently-ish with 400.
    if (req.body && typeof req.body.middle_name === 'string' && req.body.middle_name.trim() !== '') {
      logger.warn('grievance.honeypot_triggered', { ip: getClientIp(req) });
      return res.status(400).json({ error: 'Invalid submission.' });
    }

    const validation = validateGrievancePayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const captchaOk = await verifyHcaptcha(
      req.body?.hcaptchaToken || req.body?.['h-captcha-response'],
      getClientIp(req),
    );
    if (!captchaOk) {
      return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
    }

    const { name, email, phone, category, description } = validation.data;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    const { grievanceId, trackingId } = await createGrievance({
      name, email, phone, category, description, ip, userAgent,
    });

    // Fire-and-forget side effects — never block/fail the response on these.
    await Promise.allSettled([
      sendBrevoEmail({
        to: [{ email, name }],
        subject: `We received your grievance — ${trackingId}`,
        htmlContent: ackEmailHtml({ name, trackingId, category }),
      }),
      sendBrevoEmail({
        to: [{ email: GRIEVANCE_OFFICER_MAILBOX }],
        subject: `New grievance ${trackingId} (${category})`,
        htmlContent: notifyEmailHtml({ name, email, phone, category, description, trackingId }),
      }),
      serverTrack(grievanceId, 'grievance_received', { category, trackingId }),
    ]);

    return res.status(200).json({ trackingId, message: SLA_MESSAGE });
  } catch (error) {
    logger.error('grievance.create_failed', { error: error.message });
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============== Admin GET /api/admin/grievances ==============
router.get('/admin/grievances', validateToken, requireAdmin, async (req, res) => {
  try {
    const { status, category, fromDate, toDate, limit, lastEvaluatedKey } = req.query;

    if (status && !GRIEVANCE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }
    if (category && !GRIEVANCE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }

    let startKey;
    if (lastEvaluatedKey) {
      try {
        startKey = JSON.parse(lastEvaluatedKey);
      } catch {
        return res.status(400).json({ error: 'Invalid lastEvaluatedKey' });
      }
    }

    const result = await listGrievances({
      status, category, fromDate, toDate, limit, lastEvaluatedKey: startKey,
    });
    return res.json(result);
  } catch (error) {
    logger.error('grievance.list_failed', { error: error.message });
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============== Admin PATCH /api/admin/grievances/:id ==============
router.patch('/admin/grievances/:id', validateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, resolutionNotes, internalNotes, resolvedAt } = req.body || {};

    if (status && !GRIEVANCE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    const existing = await getGrievanceById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Grievance not found' });
    }

    const updated = await updateGrievance(id, { status, assignedTo, resolutionNotes, internalNotes, resolvedAt });
    return res.json(updated);
  } catch (error) {
    logger.error('grievance.update_failed', { error: error.message });
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
