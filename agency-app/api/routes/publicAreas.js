import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAreas, getAreasByCity } from '../areasDynamodbService.js';
import { extractTenantIdOptional } from '../tenantMiddleware.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const areaImagesDir = path.join(__dirname, '..', 'public', 'area');

/*
// ============== COMMENTED OUT: Public Areas feature disabled ==============
// All routes below are commented out as part of removing flats/buildings/areas functionality

function toFileToken(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/_+/g, '_');
}

function findAreaImageFilename(city, areaName) {
  const baseName = `${toFileToken(city)}_${toFileToken(areaName)}`;
  const extensions = ['png', 'jpg', 'jpeg', 'webp'];

  for (const ext of extensions) {
    const filename = `${baseName}.${ext}`;
    const absPath = path.join(areaImagesDir, filename);
    if (fs.existsSync(absPath)) {
      return filename;
    }
  }

  return null;
}

async function handlePublicAreaBanners(req, res) {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const city = typeof req.query.city === 'string' ? req.query.city : undefined;
    const area = typeof req.query.area === 'string' ? req.query.area : undefined;

    const areas = city ? await getAreasByCity(req.tenantId, city) : await getAreas(req.tenantId);

    const rows = areas
      .filter((a) => {
        if (!area) return true;
        return String(a.areaName || '').toLowerCase() === area.toLowerCase();
      })
      .map((a) => {
        const filename = findAreaImageFilename(a.city, a.areaName);
        const photoUrl = filename ? `${req.protocol}://${req.get('host')}/public/area/${filename}` : null;

        return {
          area: a.areaName,
          city: a.city,
          count: typeof a.propertyCount === 'number' ? a.propertyCount : Number(a.propertyCount || 0),
          photoUrl,
        };
      })
      .sort((a, b) => {
        const cityCompare = String(a.city || '').localeCompare(String(b.city || ''));
        if (cityCompare !== 0) return cityCompare;
        return String(a.area || '').localeCompare(String(b.area || ''));
      });

    if (city && area) {
      return res.json(rows[0] || null);
    }

    res.json(rows);
  } catch (error) {
    console.error('Get public area banners error:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}

router.get('/banners', extractTenantIdOptional, handlePublicAreaBanners);

// Backwards-compatible alias: older builds may call /api/areas/public/list
router.get('/list', extractTenantIdOptional, handlePublicAreaBanners);
*/

export default router;
