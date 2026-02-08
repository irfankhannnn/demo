import express from 'express';
import multer from 'multer';
import {
  createDeveloper,
  getDevelopers,
  getDeveloper,
  getDeveloperBySlug,
  updateDeveloper,
  deleteDeveloper,
  searchDevelopers,
  getDeveloperMetrics,
  updateDeveloperProjectStats,
} from '../developersDynamodbService.js';
import { getProjectsByDeveloper } from '../projectsDynamodbService.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadToS3, deleteFromS3, getSignedUrl } from '../s3Service.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
    files: 20 // Max 20 files at once
  }
});

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/crm/developers
 * @desc Get all developers with optional filters
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const filters = {
      status: req.query.status,
      featured: req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined,
      verified: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined,
      visibility: req.query.visibility,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined,
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const developers = await getDevelopers(tenantId, filters);
    res.json({ success: true, data: developers, count: developers.length });
  } catch (error) {
    console.error('Error getting developers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/developers/metrics
 * @desc Get developer metrics/statistics
 * @access Private
 */
router.get('/metrics', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const metrics = await getDeveloperMetrics(tenantId);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error getting developer metrics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/developers/search
 * @desc Search developers by name
 * @access Private
 */
router.get('/search', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const developers = await searchDevelopers(tenantId, q);
    res.json({ success: true, data: developers, count: developers.length });
  } catch (error) {
    console.error('Error searching developers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/developers/slug/:slug
 * @desc Get developer by slug
 * @access Private
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const developer = await getDeveloperBySlug(tenantId, req.params.slug);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    res.json({ success: true, data: developer });
  } catch (error) {
    console.error('Error getting developer by slug:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/developers/:developerId
 * @desc Get developer by ID
 * @access Private
 */
router.get('/:developerId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const developer = await getDeveloper(tenantId, req.params.developerId);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    res.json({ success: true, data: developer });
  } catch (error) {
    console.error('Error getting developer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/developers/:developerId/projects
 * @desc Get all projects by developer
 * @access Private
 */
router.get('/:developerId/projects', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const projects = await getProjectsByDeveloper(tenantId, req.params.developerId);
    res.json({ success: true, data: projects, count: projects.length });
  } catch (error) {
    console.error('Error getting developer projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/crm/developers
 * @desc Create a new developer
 * @access Private
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const data = {
      ...req.body,
      createdBy: req.user?.userId || 'system',
    };

    const developer = await createDeveloper(tenantId, data);
    res.status(201).json({ success: true, data: developer, message: 'Developer created successfully' });
  } catch (error) {
    console.error('Error creating developer:', error);
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route PUT /api/crm/developers/:developerId
 * @desc Update a developer
 * @access Private
 */
router.put('/:developerId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const data = {
      ...req.body,
      updatedBy: req.user?.userId || 'system',
    };

    const developer = await updateDeveloper(tenantId, req.params.developerId, data);
    res.json({ success: true, data: developer, message: 'Developer updated successfully' });
  } catch (error) {
    console.error('Error updating developer:', error);
    if (error.message === 'Developer not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route PATCH /api/crm/developers/:developerId/stats
 * @desc Update developer project statistics
 * @access Private
 */
router.patch('/:developerId/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { totalProjects, completedProjects, ongoingProjects } = req.body;
    await updateDeveloperProjectStats(tenantId, req.params.developerId, {
      totalProjects,
      completedProjects,
      ongoingProjects,
    });

    const developer = await getDeveloper(tenantId, req.params.developerId);
    res.json({ success: true, data: developer, message: 'Developer stats updated successfully' });
  } catch (error) {
    console.error('Error updating developer stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route DELETE /api/crm/developers/:developerId
 * @desc Delete a developer (soft delete by default)
 * @access Private
 */
router.delete('/:developerId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const hardDelete = req.query.hard === 'true';
    await deleteDeveloper(tenantId, req.params.developerId, hardDelete);
    res.json({ success: true, message: 'Developer deleted successfully' });
  } catch (error) {
    console.error('Error deleting developer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============== Media Upload Routes ==============

/**
 * @route POST /api/crm/developers/:developerId/logo
 * @desc Upload developer logo
 * @access Private
 */
router.post('/:developerId/logo', upload.single('logo'), async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No logo file provided' });
    }

    const developer = await getDeveloper(tenantId, req.params.developerId);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    // Upload to S3
    const s3Key = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'real-estate/developers/logos',
      tenantId
    );

    // Delete old logo if exists
    if (developer.logoS3Key) {
      try {
        await deleteFromS3(developer.logoS3Key);
      } catch (err) {
        console.error('Error deleting old logo:', err);
      }
    }

    // Update developer with new logo
    const updatedDeveloper = await updateDeveloper(tenantId, req.params.developerId, {
      logoS3Key: s3Key,
      logoUrl: await getSignedUrl(s3Key),
    });

    res.json({ 
      success: true, 
      data: { 
        logoS3Key: s3Key,
        logoUrl: await getSignedUrl(s3Key)
      }, 
      message: 'Logo uploaded successfully' 
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/crm/developers/:developerId/images
 * @desc Upload developer images
 * @access Private
 */
router.post('/:developerId/images', upload.array('images', 20), async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided' });
    }

    const developer = await getDeveloper(tenantId, req.params.developerId);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    // Upload all images
    const uploadedImages = await Promise.all(
      req.files.map(async (file) => {
        const s3Key = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          'real-estate/developers/images',
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

    // Update developer images array
    const existingImages = developer.images || [];
    const updatedImages = [...existingImages, ...uploadedImages];

    await updateDeveloper(tenantId, req.params.developerId, {
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
 * @route POST /api/crm/developers/:developerId/videos
 * @desc Upload developer videos
 * @access Private
 */
router.post('/:developerId/videos', upload.array('videos', 10), async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No video files provided' });
    }

    const developer = await getDeveloper(tenantId, req.params.developerId);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    // Upload all videos
    const uploadedVideos = await Promise.all(
      req.files.map(async (file) => {
        const s3Key = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          'real-estate/developers/videos',
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

    // Update developer videos array
    const existingVideos = developer.videos || [];
    const updatedVideos = [...existingVideos, ...uploadedVideos];

    await updateDeveloper(tenantId, req.params.developerId, {
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
 * @route DELETE /api/crm/developers/:developerId/images/:s3Key
 * @desc Delete developer image
 * @access Private
 */
router.delete('/:developerId/images', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { s3Key } = req.body;
    if (!s3Key) {
      return res.status(400).json({ success: false, message: 'S3 key is required' });
    }

    const developer = await getDeveloper(tenantId, req.params.developerId);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    // Delete from S3
    await deleteFromS3(s3Key);

    // Remove from developer images array
    const updatedImages = (developer.images || []).filter(img => img.s3Key !== s3Key);
    await updateDeveloper(tenantId, req.params.developerId, {
      images: updatedImages,
    });

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route DELETE /api/crm/developers/:developerId/videos
 * @desc Delete developer video
 * @access Private
 */
router.delete('/:developerId/videos', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { s3Key } = req.body;
    if (!s3Key) {
      return res.status(400).json({ success: false, message: 'S3 key is required' });
    }

    const developer = await getDeveloper(tenantId, req.params.developerId);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    // Delete from S3
    await deleteFromS3(s3Key);

    // Remove from developer videos array
    const updatedVideos = (developer.videos || []).filter(vid => vid.s3Key !== s3Key);
    await updateDeveloper(tenantId, req.params.developerId, {
      videos: updatedVideos,
    });

    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
