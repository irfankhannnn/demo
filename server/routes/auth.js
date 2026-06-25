import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { logger } from '../logger.js';
import { serverTrack } from '../lib/posthog.js';
import { getPairingQr, getConnectionStatus, disconnectWhatsApp, isBaileyEnabled, listWhatsAppSessions } from '../bailey.js';
import { requireAdmin } from '../middleware/requireRole.js';

const PHONE_REGEX = /^\+?\d{10,15}$/;

function validatePhone(phone) {
  const normalized = String(phone || '').replace(/\s/g, '');
  if (!PHONE_REGEX.test(normalized)) {
    throw new Error('Invalid phone number format');
  }
  return normalized;
}

const router = express.Router();

// NOTE: Old JWT-based authentication endpoints (/login, /change-password) have been removed.
// Authentication is now handled by the reality-flow-authentication microservice using AWS Cognito.
// Users authenticate via Cognito Hosted UI with Google OAuth, and the CRM backend validates
// tokens by calling the auth microservice's /auth/me endpoint.

// === [LAUNCH ROUTES] ===
// PR-L: Post-registration hook — called by the frontend after successful signup
// Adds new trial user to Brevo "Trial Signups" list for onboarding emails
// Also creates a trial subscription for the new tenant
router.post('/post-registration', validateToken, extractTenantId, async (req, res) => {
  try {
    const {
      email,
      displayName,
      phone,
      utm_source,
      utm_campaign,
      utm_medium,
      tenantId: bodyTenantId,
      consentAccepted,
    } = req.body;
    const userEmail = email || req.user?.email;
    const userId = req.user?.sub || req.user?.userId || 'unknown';
    const tenantId = req.tenantId; // Only trust server-derived tenantId

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID missing from token context' });
    }

    if (!consentAccepted) {
      return res.status(400).json({ error: 'consent_required', details: 'Terms and Privacy Policy consent is required' });
    }

    // Create trial subscription for new tenant
    try {
      await createTrialSubscription(tenantId, 'solo');
      logger.info('auth.postRegistration.subscription.created', { tenantId });
    } catch (subErr) {
      // If subscription already exists, that's fine
      if (!subErr.message?.includes('ConditionFailed')) {
        logger.warn('auth.postRegistration.subscription.error', { tenantId, error: subErr.message });
      }
    }

    await setConsentSignedAt(tenantId);

    await serverTrack(userId, 'signup_completed', {
      tenant_id: tenantId,
      role: 'admin',
      utm_source: utm_source || undefined,
      utm_campaign: utm_campaign || undefined,
      utm_medium: utm_medium || undefined,
    });

    // Brevo: Add contact to Trial Signups list
    if (process.env.BREVO_API_KEY && process.env.BREVO_TRIAL_LIST_ID) {
      try {
        const brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userEmail,
            firstName: displayName || undefined,
            phone: phone || undefined,
            listIds: [parseInt(process.env.BREVO_TRIAL_LIST_ID)],
            attributes: {
              SIGNUP_DATE: new Date().toISOString(),
              PLAN: 'trial',
              PHONE: phone || undefined,
              UTM_SOURCE: utm_source || undefined,
              UTM_CAMPAIGN: utm_campaign || undefined,
              UTM_MEDIUM: utm_medium || undefined,
            },
          }),
        });

        if (!brevoRes.ok) {
          const errText = await brevoRes.text();
          logger.warn('auth.brevo.addContact.failed', { status: brevoRes.status, error: errText });
        } else {
          logger.info('auth.brevo.addContact.success', { email: userEmail, tenantId });
        }
      } catch (brevoErr) {
        logger.error('auth.brevo.addContact.error', { error: brevoErr.message });
      }
    }

    logger.info('auth.postRegistration', { userId, tenantId, utm_source });

    res.json({ success: true });
  } catch (err) {
    logger.error('auth.postRegistration.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});
// === [/LAUNCH ROUTES] ===

// POST /api/auth/whatsapp/pairing-qr — Bailey WhatsApp pairing (optional, admin only)
// Body: { phone: string, forceNew?: boolean } — pass forceNew:true to wipe auth and start clean
router.post('/whatsapp/pairing-qr', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  try {
    if (!isBaileyEnabled()) {
      return res.json({ enabled: false, qrCode: null, sessionId: null });
    }
    const { phone, forceNew } = req.body;
    const result = await getPairingQr(phone, forceNew === true);
    res.json(result);
  } catch (err) {
    logger.error('auth.whatsapp.pairing.error', { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/whatsapp/status/:phone — poll Bailey connection status
router.get('/whatsapp/status/:phone', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  try {
    const phone = validatePhone(req.params.phone);
    const status = await getConnectionStatus(phone);
    res.json(status);
  } catch (err) {
    logger.error('auth.whatsapp.status.error', { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/whatsapp/disconnect/:phone — disconnect a Bailey session
// Body: { deleteAuthState?: boolean } — pass true to wipe auth files for a clean re-link
router.post('/whatsapp/disconnect/:phone', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  try {
    const phone = validatePhone(req.params.phone);
    const deleteAuthState = req.body?.deleteAuthState === true;
    const result = await disconnectWhatsApp(phone, deleteAuthState);
    res.json(result);
  } catch (err) {
    logger.error('auth.whatsapp.disconnect.error', { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/whatsapp/sessions — list all WhatsApp sessions for tenant
router.get('/whatsapp/sessions', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  try {
    const result = await listWhatsAppSessions();
    res.json(result);
  } catch (err) {
    logger.error('auth.whatsapp.sessions.error', { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

export default router;
