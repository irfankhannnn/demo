import express from 'express';
import { validateToken } from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { logger } from '../logger.js';

const router = express.Router();

// NOTE: Old JWT-based authentication endpoints (/login, /change-password) have been removed.
// Authentication is now handled by the reality-flow-authentication microservice using AWS Cognito.
// Users authenticate via Cognito Hosted UI with Google OAuth, and the CRM backend validates
// tokens by calling the auth microservice's /auth/me endpoint.

// === [LAUNCH ROUTES] ===
// PR-L: Post-registration hook — called by the frontend after successful signup
// Adds new trial user to Brevo "Trial Signups" list for onboarding emails
router.post('/post-registration', validateToken, extractTenantId, async (req, res) => {
  try {
    const { email, displayName, phone, utm_source, utm_campaign, utm_medium, tenantId: bodyTenantId } = req.body;
    const userEmail = email || req.user?.email;
    const userId = req.user?.sub || req.user?.userId || 'unknown';
    const tenantId = req.tenantId || bodyTenantId;

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

export default router;
