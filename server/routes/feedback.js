import express from 'express';
import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { logger } from '../logger.js';

const router = express.Router();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const docClient = DynamoDBDocumentClient.from(client);
const NPS_TABLE = process.env.NPS_TABLE || 'NPSResponses';
const NPS_HMAC_SECRET = process.env.NPS_HMAC_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FOUNDER_EMAIL = process.env.FOUNDER_NOTIFICATION_EMAIL || 'info@realestateflow.in';

function requireNpsSecret() {
  if (!NPS_HMAC_SECRET) {
    throw new Error('NPS_HMAC_SECRET environment variable is required');
  }
  return NPS_HMAC_SECRET;
}

// POST /api/feedback/nps — authenticated NPS submission
router.post('/nps', validateToken, extractTenantId, async (req, res) => {
  try {
    const { score, freeText, shareTestimonial } = req.body;

    // Validation
    if (score === undefined || score === null || typeof score !== 'number' || score < 0 || score > 10) {
      return res.status(400).json({ error: 'score must be 0-10' });
    }
    if (score <= 6 && (!freeText || freeText.trim().length < 20)) {
      return res.status(400).json({ error: 'Free text feedback required (min 20 chars) for scores ≤ 6' });
    }

    const now = new Date().toISOString();
    const responseId = `nps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userId = req.user?.sub || req.user?.userId || 'unknown';

    const item = {
      responseId,
      tenantId: req.tenantId,
      userId,
      score,
      freeText: freeText?.trim() || null,
      shareTestimonial: !!shareTestimonial,
      createdAt: now,
      source: 'in-app',
    };

    await docClient.send(new PutCommand({ TableName: NPS_TABLE, Item: item }));

    logger.info('nps.submitted', { tenantId: req.tenantId, score, responseId });

    // Side effect: alert founder for detractors (score ≤ 6)
    if (score <= 6 && BREVO_API_KEY) {
      try {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'RealEstateFlow NPS', email: 'noreply@realestateflow.in' },
            to: [{ email: FOUNDER_EMAIL }],
            subject: `⚠️ NPS Detractor Alert — Score ${score}`,
            htmlContent: `<p>Tenant: ${req.tenantId}</p><p>Score: ${score}/10</p><p>Feedback: ${freeText || 'N/A'}</p>`,
          }),
        });
      } catch (notifErr) {
        logger.warn('nps.founderNotif.failed', { error: notifErr.message });
      }
    }

    // Side effect: tag promoters in Brevo for testimonial outreach
    if (score >= 9 && shareTestimonial && BREVO_API_KEY) {
      // Brevo contact tag — done via API if we have contact email
      logger.info('nps.promoter.testimonial', { tenantId: req.tenantId, score });
    }

    res.json({ success: true, message: 'Thank you for your feedback.' });
  } catch (err) {
    logger.error('feedback.nps.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/nps — public email-link NPS validation
router.get('/', (req, res) => {
  const { score, token, userId } = req.query;

  if (!score || !token || !userId) {
    return res.status(400).json({ error: 'Missing required parameters: score, token, userId' });
  }

  const expectedToken = crypto
    .createHmac('sha256', requireNpsSecret())
    .update(`${userId}${score}`)
    .digest('hex');

  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  res.json({ validToken: true, userId, score: Number(score) });
});

export default router;
