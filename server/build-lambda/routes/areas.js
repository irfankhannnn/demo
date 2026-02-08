import express from 'express';
import multer from 'multer';
import {
  createArea,
  getArea,
  getAreas,
  getAreasByCity,
  updateArea,
  getAreaByName,
} from '../areasDynamodbService.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadToS3, deleteFromS3, getSignedUrl } from '../s3Service.js';
import { extractTenantId, extractTenantIdOptional } from '../tenantMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ============== Public Area Routes ==============
// NOTE: These routes are commented out as areas are now auto-created from properties.
// The hierarchy view uses CRM properties directly for navigation.

/*
// Get all areas for public display (with banner URLs)
router.get('/public/list', extractTenantIdOptional, async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const { city } = req.query;
    let areas;

    if (city) {
      areas = await getAreasByCity(req.tenantId, city);
    } else {
      areas = await getAreas(req.tenantId);
    }

    // Generate signed URLs for banners
    const areasWithUrls = await Promise.all(
      areas.map(async (area) => {
        const bannerUrl = area.bannerS3Key ? await getSignedUrl(area.bannerS3Key) : null;
        return {
          areaId: area.areaId,
          areaName: area.areaName,
          city: area.city,
          description: area.description,
          bannerUrl,
          propertyCount: area.propertyCount || 0,
        };
      })
    );

    res.json(areasWithUrls);
  } catch (error) {
    console.error('Get public areas error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== CRM Area Routes ==============
// NOTE: CRM area management routes are commented out.
// Areas are auto-created when properties are added.

/*
// Get all areas for CRM
router.get('/', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const { city } = req.query;
    let areas;

    if (city) {
      areas = await getAreasByCity(req.tenantId, city);
    } else {
      areas = await getAreas(req.tenantId);
    }

    // Generate signed URLs for banners
    const areasWithUrls = await Promise.all(
      areas.map(async (area) => {
        const bannerUrl = area.bannerS3Key ? await getSignedUrl(area.bannerS3Key) : null;
        return {
          ...area,
          bannerUrl,
        };
      })
    );

    res.json(areasWithUrls);
  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single area
router.get('/:id', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const area = await getArea(req.tenantId, req.params.id);
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    const bannerUrl = area.bannerS3Key ? await getSignedUrl(area.bannerS3Key) : null;
    res.json({ ...area, bannerUrl });
  } catch (error) {
    console.error('Get area error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create area
router.post('/', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const { areaName, city, description } = req.body;

    if (!areaName || !city) {
      return res.status(400).json({ error: 'Area name and city are required' });
    }

    // Check if area already exists
    const existing = await getAreaByName(req.tenantId, areaName, city);
    if (existing) {
      return res.status(409).json({ error: 'Area already exists in this city' });
    }

    const area = await createArea(req.tenantId, {
      areaName,
      city,
      description,
    });

    res.status(201).json(area);
  } catch (error) {
    console.error('Create area error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update area
router.put('/:id', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const { areaName, city, description } = req.body;
    const updates = {};

    if (areaName !== undefined) updates.areaName = areaName;
    if (city !== undefined) updates.city = city;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const area = await updateArea(req.tenantId, req.params.id, updates);
    const bannerUrl = area.bannerS3Key ? await getSignedUrl(area.bannerS3Key) : null;
    
    res.json({ ...area, bannerUrl });
  } catch (error) {
    console.error('Update area error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Upload area banner image
router.post('/:id/banner', authenticateToken, extractTenantId, upload.single('banner'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No banner file provided' });
    }

    const area = await getArea(req.tenantId, req.params.id);
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    // Delete old banner if exists
    if (area.bannerS3Key) {
      await deleteFromS3(area.bannerS3Key);
    }

    // Upload new banner
    const s3Key = `tenants/${req.tenantId}/areas/${req.params.id}/banner-${Date.now()}.${req.file.mimetype.split('/')[1]}`;
    await uploadToS3(s3Key, req.file.buffer, req.file.mimetype);

    // Update area with new banner key
    const updatedArea = await updateArea(req.tenantId, req.params.id, {
      bannerS3Key: s3Key,
    });

    const bannerUrl = await getSignedUrl(s3Key);
    res.json({ ...updatedArea, bannerUrl });
  } catch (error) {
    console.error('Upload area banner error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete area banner
router.delete('/:id/banner', authenticateToken, extractTenantId, async (req, res) => {
  try {
    const area = await getArea(req.tenantId, req.params.id);
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    if (area.bannerS3Key) {
      await deleteFromS3(area.bannerS3Key);
      await updateArea(req.tenantId, req.params.id, {
        bannerS3Key: null,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete area banner error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
*/

export default router;
