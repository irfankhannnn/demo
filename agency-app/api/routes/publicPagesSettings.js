/**
 * Agency-facing settings for the public property pages.
 *
 * Authenticated CRM routes (unlike routes/publicPagesInternal.js, which is the
 * service-to-service door). This is what the CRM UI calls when an agency
 * claims its subdomain, sets its branding, or switches public pages on.
 *
 * Admin-only. The slug becomes a public hostname carrying the agency's name,
 * and turning public pages on exposes published listings to the open internet
 * — neither is a decision for an ordinary team member.
 */

import express from 'express';
import { z } from 'zod';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireAdmin } from '../middleware/requireRole.js';
import validateBody from '../middleware/validateBody.js';
import { getAgencyConfig, updateAgencyConfig } from '../agencyConfigService.js';
import {
  isValidAgencySlug,
  slugifyAgencyName,
  getTenantIdByAgencySlug,
  toPublicAgency,
  normaliseMarketplaceNotifications,
} from '../publicListingService.js';
import { syncTenantMarketplaceKeys, invalidateAgencyCache } from '../marketplaceIndexing.js';
import { notifyMarketplaceTenantState } from './marketplaceInbox.js';
import { logger } from '../logger.js';

const router = express.Router();

const settingsSchema = z.object({
  agencySlug: z.string().min(3).max(40).optional(),
  agencyName: z.string().min(1).max(120).optional(),
  brandPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex colour').optional(),
  publicPhone: z.string().max(20).optional().nullable(),
  publicEmail: z.string().email().max(200).optional().nullable(),
  publicAddress: z.string().max(300).optional().nullable(),
  publicAbout: z.string().max(1000).optional().nullable(),
  publicPagesEnabled: z.boolean().optional(),
  // Consumer marketplace opt-in + alert channels (stored top-level on
  // AgencyConfig; see publicListingService.normaliseMarketplaceNotifications).
  marketplaceEnabled: z.boolean().optional(),
  marketplaceNotifications: z.object({
    email: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
    push: z.boolean().optional(),
    extraEmails: z.array(z.string().email().max(200)).max(5).optional(),
    extraPhones: z.array(z.string().min(6).max(20)).max(5).optional(),
  }).optional(),
});

/** GET /api/crm/public-pages/settings */
router.get('/settings', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  try {
    const config = await getAgencyConfig(req.tenantId);
    const agency = toPublicAgency(config, req.tenantId);
    return res.json({
      settings: agency,
      // Suggest a slug so an agency setting this up for the first time is not
      // staring at an empty field wondering what the rules are.
      suggestedSlug: agency?.slug || slugifyAgencyName(config?.agencyName || ''),
    });
  } catch (error) {
    logger.error('publicPagesSettings.get_failed', { tenantId: req.tenantId, error: error.message });
    return res.status(500).json({ error: 'Failed to load settings' });
  }
});

/** PUT /api/crm/public-pages/settings */
router.put('/settings', validateToken, extractTenantId, requireAdmin, validateBody(settingsSchema), async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.agencySlug !== undefined) {
      const slug = String(updates.agencySlug).toLowerCase().trim();

      if (!isValidAgencySlug(slug)) {
        return res.status(400).json({
          error: 'Invalid subdomain',
          details: 'Use 3-40 characters: lowercase letters, numbers and single hyphens. Some names are reserved.',
        });
      }

      // A slug is a hostname, so it must be globally unique. Checked before the
      // write rather than enforced by a constraint, because DynamoDB has no
      // unique index — two agencies claiming the same slug concurrently is a
      // narrow race, and the loser simply gets an error on their next save.
      const owner = await getTenantIdByAgencySlug(slug);
      if (owner && owner !== req.tenantId) {
        return res.status(409).json({
          error: 'Subdomain already taken',
          details: 'Another agency is using this address. Please choose a different one.',
        });
      }

      updates.agencySlug = slug;
    }

    // Publishing requires an address to publish at. Enabling without a slug
    // would leave the agency switched "on" and unreachable, which reads as a
    // broken feature rather than an incomplete setup.
    if (updates.publicPagesEnabled === true) {
      const existing = await getAgencyConfig(req.tenantId);
      const effectiveSlug = updates.agencySlug ?? existing?.agencySlug;
      if (!effectiveSlug) {
        return res.status(400).json({
          error: 'Choose a subdomain first',
          details: 'Public pages need an address before they can be switched on.',
        });
      }
    }

    if (updates.marketplaceNotifications) {
      updates.marketplaceNotifications = normaliseMarketplaceNotifications(updates.marketplaceNotifications);
    }

    // Read before the write: whether the marketplace flag really flips decides
    // if buyer threads are closed or reopened below.
    const wasOnMarketplace = updates.marketplaceEnabled !== undefined
      ? (await getAgencyConfig(req.tenantId))?.marketplaceEnabled === true
      : null;

    const saved = await updateAgencyConfig(req.tenantId, updates);

    // Switching the marketplace on/off re-keys every property of the tenant so
    // the sparse marketplace indexes reflect the decision immediately. Runs
    // after the save (the rule reads the saved flag) and never fails the
    // request: the backfill script repairs anything a partial walk missed.
    if (updates.marketplaceEnabled !== undefined) {
      try {
        const stats = await syncTenantMarketplaceKeys(req.tenantId, { agency: saved });
        logger.info('publicPagesSettings.marketplace_synced', { tenantId: req.tenantId, enabled: updates.marketplaceEnabled, ...stats });
      } catch (err) {
        logger.error('publicPagesSettings.marketplace_sync_failed', { tenantId: req.tenantId, error: err.message });
      }
      // Only on a real change of the flag, not on every save that repeats it.
      if (wasOnMarketplace !== (updates.marketplaceEnabled === true)) {
        await notifyMarketplaceTenantState(req.tenantId, updates.marketplaceEnabled === true);
      }
    } else {
      invalidateAgencyCache(req.tenantId);
    }

    logger.info('publicPagesSettings.updated', {
      tenantId: req.tenantId,
      enabled: saved?.publicPagesEnabled === true,
      hasSlug: Boolean(saved?.agencySlug),
    });

    return res.json({ settings: toPublicAgency(saved, req.tenantId) });
  } catch (error) {
    logger.error('publicPagesSettings.update_failed', { tenantId: req.tenantId, error: error.message });
    return res.status(500).json({ error: 'Failed to save settings' });
  }
});

/** GET /api/crm/public-pages/slug-available?slug=foo */
router.get('/slug-available', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  try {
    const slug = String(req.query.slug || '').toLowerCase().trim();
    if (!isValidAgencySlug(slug)) {
      return res.json({ available: false, reason: 'invalid' });
    }
    const owner = await getTenantIdByAgencySlug(slug);
    if (owner && owner !== req.tenantId) {
      return res.json({ available: false, reason: 'taken' });
    }
    return res.json({ available: true });
  } catch (error) {
    logger.error('publicPagesSettings.slug_check_failed', { tenantId: req.tenantId, error: error.message });
    return res.status(500).json({ error: 'Check failed' });
  }
});

export default router;
