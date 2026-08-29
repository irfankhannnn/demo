import express from 'express';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import { sendEmail } from '../emailService.js';
import validateToken from '../middleware/validateToken.js';
import { requirePlatformOperator } from '../middleware/requirePlatformOperator.js';
import {
  createGrievance,
  getGrievanceById,
  listGrievances,
  updateGrievance,
  GRIEVANCE_CATEGORIES,
  GRIEVANCE_STATUSES,
} from '../grievanceDynamodbService.js';
import { logger } from '../logger.js';
import { serverTrack } from '../lib/posthog.js';

const router = express.Router();

const SLA_MESSAGE = 'Received. Expect a response within 7 working days.';

function getGrievanceOfficerMailbox() {
  return process.env.GRIEVANCE_OFFICER_EMAIL || null;
}

function getFromEmail() {
  return process.env.BREVO_FROM_EMAIL || null;
}

function getFromName() {
  return process.env.BREVO_FROM_NAME || 'RealtyFlow';
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

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidLastEvaluatedKey(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof key !== 'string') return false;
    if (typeof value !== 'string' && typeof value !== 'number') return false;
  }
  return true;
}

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
      timeout: parseInt(process.env.HCAPTCHA_VERIFY_TIMEOUT_MS || '5000', 10),
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
async function sendGrievanceEmail({ to, subject, htmlContent }) {
  const recipient = Array.isArray(to) ? to[0]?.email || to[0] : to;
  try {
    await sendEmail({ to: recipient, subject, html: htmlContent });
  } catch (err) {
    logger.error('grievance.email_error', { error: err.message, to: recipient });
  }
}

function ackEmailHtml({ name, trackingId, category }) {
  return `
    <p>Hi ${escapeHtml(name)},</p>
    <p>We have received your grievance and assigned it tracking ID <strong>${escapeHtml(trackingId)}</strong>.</p>
    <p>Category: <strong>${escapeHtml(category)}</strong></p>
    <p>As per the DPDP Act 2023, our Grievance Officer will respond within <strong>7 working days</strong>.</p>
    <p>Regards,<br/>${escapeHtml(getFromName())} Grievance Team</p>
  `;
}

function notifyEmailHtml({ name, email, phone, category, description, trackingId }) {
  return `
    <p>New grievance submitted.</p>
    <ul>
      <li><strong>Tracking ID:</strong> ${escapeHtml(trackingId)}</li>
      <li><strong>Name:</strong> ${escapeHtml(name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(phone) || '—'}</li>
      <li><strong>Category:</strong> ${escapeHtml(category)}</li>
    </ul>
    <p><strong>Description:</strong></p>
    <p>${escapeHtml(description).replace(/\n/g, '<br/>')}</p>
  `;
}

// ============== Public POST /api/grievance ==============
const publicLimiter = rateLimit({
  windowMs: Number(process.env.GRIEVANCE_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.GRIEVANCE_RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests', details: 'Rate limit exceeded. Try again later.' });
  },
});

router.post('/grievance', publicLimiter, async (req, res) => {
  try {
    const officerMailbox = getGrievanceOfficerMailbox();
    const fromEmail = getFromEmail();
    if (!officerMailbox || !fromEmail) {
      logger.error('grievance.config_missing', {
        hasOfficer: !!officerMailbox,
        hasFrom: !!fromEmail,
      });
      return res.status(503).json({ error: 'Grievance service is temporarily unavailable' });
    }

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

    await Promise.allSettled([
      sendGrievanceEmail({
        to: [{ email, name }],
        subject: `We received your grievance — ${trackingId}`,
        htmlContent: ackEmailHtml({ name, trackingId, category }),
      }),
      sendGrievanceEmail({
        to: [{ email: officerMailbox }],
        subject: `New grievance ${trackingId} (${category})`,
        htmlContent: notifyEmailHtml({ name, email, phone, category, description, trackingId }),
      }),
      serverTrack(grievanceId, 'grievance_received', { category, trackingId }),
    ]);

    return res.status(200).json({ trackingId, message: SLA_MESSAGE });
  } catch (error) {
    logger.error('grievance.create_failed', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Platform-operator only — grievances are platform-wide PII, not tenant-scoped
router.get('/admin/grievances', validateToken, requirePlatformOperator, async (req, res) => {
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
      if (!isValidLastEvaluatedKey(startKey)) {
        return res.status(400).json({ error: 'Invalid lastEvaluatedKey shape' });
      }
    }

    const result = await listGrievances({
      status, category, fromDate, toDate, limit, lastEvaluatedKey: startKey,
    });
    return res.json(result);
  } catch (error) {
    logger.error('grievance.list_failed', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/admin/grievances/:id', validateToken, requirePlatformOperator, async (req, res) => {
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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
