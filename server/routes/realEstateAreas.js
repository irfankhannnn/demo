import express from 'express';
import multer from 'multer';
import {
  createArea,
  getAreas,
  getArea,
  getAreaBySlug,
  getAreasByCity,
  updateArea,
  deleteArea,
  searchAreas,
  getAreaMetrics,
} from '../realEstateAreasDynamodbService.js';
import { getProjectsByArea } from '../projectsDynamodbService.js';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { uploadToS3, deleteFromS3, getSignedUrl } from '../s3Service.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 20
  }
});

// Apply auth middleware to all routes
router.use(validateToken);
router.use(extractTenantId);

/*
// ============== COMMENTED OUT: Real Estate Areas feature disabled ==============
// All routes below are commented out as part of removing developers/projects/areas functionality

/**
 * @route GET /api/crm/real-estate-areas
 * @desc Get all areas with optional filters
 * @access Private
 *\/
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const filters = {
      status: req.query.status,
      city: req.query.city,
      country: req.query.country,
      emirate: req.query.emirate,
      featured: req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined,
      visibility: req.query.visibility,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined,
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const areas = await getAreas(tenantId, filters);
    res.json({ success: true, data: areas, count: areas.length });
  } catch (error) {
    console.error('Error getting areas:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/real-estate-areas/metrics
 * @desc Get area metrics/statistics
 * @access Private
 */
router.get('/metrics', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const metrics = await getAreaMetrics(tenantId);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error getting area metrics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/real-estate-areas/search
 * @desc Search areas by name
 * @access Private
 */
router.get('/search', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const areas = await searchAreas(tenantId, q);
    res.json({ success: true, data: areas, count: areas.length });
  } catch (error) {
    console.error('Error searching areas:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/real-estate-areas/city/:city
 * @desc Get areas by city
 * @access Private
 */
router.get('/city/:city', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { country } = req.query;
    const areas = await getAreasByCity(tenantId, req.params.city, country);
    res.json({ success: true, data: areas, count: areas.length });
  } catch (error) {
    console.error('Error getting areas by city:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/real-estate-areas/slug/:slug
 * @desc Get area by slug
 * @access Private
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const area = await getAreaBySlug(tenantId, req.params.slug);
    if (!area) {
      return res.status(404).json({ success: false, message: 'Area not found' });
    }

    res.json({ success: true, data: area });
  } catch (error) {
    console.error('Error getting area by slug:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/real-estate-areas/:areaId
 * @desc Get area by ID
 * @access Private
 */
router.get('/:areaId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const area = await getArea(tenantId, req.params.areaId);
    if (!area) {
      return res.status(404).json({ success: false, message: 'Area not found' });
    }

    res.json({ success: true, data: area });
  } catch (error) {
    console.error('Error getting area:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/real-estate-areas/:areaId/projects
 * @desc Get all projects in an area
 * @access Private
 */
router.get('/:areaId/projects', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const projects = await getProjectsByArea(tenantId, req.params.areaId);
    res.json({ success: true, data: projects, count: projects.length });
  } catch (error) {
    console.error('Error getting area projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/crm/real-estate-areas
 * @desc Create a new area
 * @access Private
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const data = {
      ...req.body,
      createdBy: req.user?.userId || 'system',
    };

    const area = await createArea(tenantId, data);
    res.status(201).json({ success: true, data: area, message: 'Area created successfully' });
  } catch (error) {
    console.error('Error creating area:', error);
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    if (error.message.includes('required')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route PUT /api/crm/real-estate-areas/:areaId
 * @desc Update an area
 * @access Private
 */
router.put('/:areaId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const data = {
      ...req.body,
      updatedBy: req.user?.userId || 'system',
    };

    const area = await updateArea(tenantId, req.params.areaId, data);
    res.json({ success: true, data: area, message: 'Area updated successfully' });
  } catch (error) {
    console.error('Error updating area:', error);
    if (error.message === 'Area not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route DELETE /api/crm/real-estate-areas/:areaId
 * @desc Delete an area (soft delete by default)
 * @access Private
 */
router.delete('/:areaId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const hardDelete = req.query.hard === 'true';
    await deleteArea(tenantId, req.params.areaId, hardDelete);
    res.json({ success: true, message: 'Area deleted successfully' });
  } catch (error) {
    console.error('Error deleting area:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============== Media Upload Routes ==============

/**
 * @route POST /api/crm/real-estate-areas/:areaId/images
 * @desc Upload area images
 * @access Private
 */
router.post('/:areaId/images', upload.array('images', 20), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided' });
    }

    const area = await getArea(tenantId, req.params.areaId);
    if (!area) {
      return res.status(404).json({ success: false, message: 'Area not found' });
    }

    const uploadedImages = await Promise.all(
      req.files.map(async (file) => {
        const s3Key = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          'real-estate/areas/images',
          tenantId
        );
        return {
          url: await getSignedUrl(s3Key),
          s3Key,
          title: file.originalname,
          type: 'image',
        };
      })
    );

    const existingImages = area.images || [];
    const updatedImages = [...existingImages, ...uploadedImages];

    await updateArea(tenantId, req.params.areaId, {
      images: updatedImages,
    });

    res.json({ 
      success: true, 
      data: uploadedImages, 
      message: `${uploadedImages.length} image(s) uploaded successfully` 
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/crm/real-estate-areas/:areaId/videos
 * @desc Upload area videos
 * @access Private
 */
router.post('/:areaId/videos', upload.array('videos', 10), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No video files provided' });
    }

    const area = await getArea(tenantId, req.params.areaId);
    if (!area) {
      return res.status(404).json({ success: false, message: 'Area not found' });
    }

    const uploadedVideos = await Promise.all(
      req.files.map(async (file) => {
        const s3Key = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          'real-estate/areas/videos',
          tenantId
        );
        return {
          url: await getSignedUrl(s3Key),
          s3Key,
          title: file.originalname,
          type: 'video',
        };
      })
    );

    const existingVideos = area.videos || [];
    const updatedVideos = [...existingVideos, ...uploadedVideos];

    await updateArea(tenantId, req.params.areaId, {
      videos: updatedVideos,
    });

    res.json({ 
      success: true, 
      data: uploadedVideos, 
      message: `${uploadedVideos.length} video(s) uploaded successfully` 
    });
  } catch (error) {
    console.error('Error uploading videos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route DELETE /api/crm/real-estate-areas/:areaId/images
 * @desc Delete area image
 * @access Private
 */
router.delete('/:areaId/images', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { s3Key } = req.body;
    if (!s3Key) {
      return res.status(400).json({ success: false, message: 'S3 key is required' });
    }

    const area = await getArea(tenantId, req.params.areaId);
    if (!area) {
      return res.status(404).json({ success: false, message: 'Area not found' });
    }

    await deleteFromS3(s3Key);

    const updatedImages = (area.images || []).filter(img => img.s3Key !== s3Key);
    await updateArea(tenantId, req.params.areaId, {
      images: updatedImages,
    });

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route DELETE /api/crm/real-estate-areas/:areaId/videos
 * @desc Delete area video
 * @access Private
 */
router.delete('/:areaId/videos', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { s3Key } = req.body;
    if (!s3Key) {
      return res.status(400).json({ success: false, message: 'S3 key is required' });
    }

    const area = await getArea(tenantId, req.params.areaId);
    if (!area) {
      return res.status(404).json({ success: false, message: 'Area not found' });
    }

    await deleteFromS3(s3Key);

    const updatedVideos = (area.videos || []).filter(vid => vid.s3Key !== s3Key);
    await updateArea(tenantId, req.params.areaId, {
      videos: updatedVideos,
    });

    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
*/
    console.error('Error deleting video:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
