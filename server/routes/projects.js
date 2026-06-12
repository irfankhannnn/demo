import express from 'express';
import multer from 'multer';
import {
  createProject,
  getProjects,
  getProject,
  getProjectBySlug,
  getProjectsByDeveloper,
  getProjectsByArea,
  getProjectsByStatus,
  updateProject,
  deleteProject,
  updateProjectLifecycleStatus,
  updateProjectInventory,
  markUnitSold,
  incrementProjectViews,
  incrementProjectEnquiries,
  searchProjects,
  getProjectMetrics,
  getProjectDetailedMetrics,
} from '../projectsDynamodbService.js';
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
// ============== COMMENTED OUT: Projects feature disabled ==============
// All routes below are commented out as part of removing developers/projects/areas functionality

/**
 * @route GET /api/crm/projects
 * @desc Get all projects with optional filters
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
      developerId: req.query.developerId,
      areaId: req.query.areaId,
      projectType: req.query.projectType,
      propertyCategory: req.query.propertyCategory,
      constructionStatus: req.query.constructionStatus,
      handoverYear: req.query.handoverYear ? parseInt(req.query.handoverYear) : undefined,
      city: req.query.city,
      country: req.query.country,
      featured: req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined,
      trending: req.query.trending === 'true' ? true : req.query.trending === 'false' ? false : undefined,
      newLaunch: req.query.newLaunch === 'true' ? true : req.query.newLaunch === 'false' ? false : undefined,
      soldOut: req.query.soldOut === 'true' ? true : req.query.soldOut === 'false' ? false : undefined,
      visibility: req.query.visibility,
      priceMin: req.query.priceMin ? parseFloat(req.query.priceMin) : undefined,
      priceMax: req.query.priceMax ? parseFloat(req.query.priceMax) : undefined,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined,
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const projects = await getProjects(tenantId, filters);
    res.json({ success: true, data: projects, count: projects.length });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/projects/metrics
 * @desc Get project metrics/statistics
 * @access Private
 */
router.get('/metrics', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const metrics = await getProjectMetrics(tenantId);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error getting project metrics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/projects/search
 * @desc Search projects by name
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

    const projects = await searchProjects(tenantId, q);
    res.json({ success: true, data: projects, count: projects.length });
  } catch (error) {
    console.error('Error searching projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/projects/slug/:slug
 * @desc Get project by slug
 * @access Private
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const project = await getProjectBySlug(tenantId, req.params.slug);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Error getting project by slug:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/projects/developer/:developerId
 * @desc Get all projects by developer
 * @access Private
 */
router.get('/developer/:developerId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const projects = await getProjectsByDeveloper(tenantId, req.params.developerId);
    res.json({ success: true, data: projects, count: projects.length });
  } catch (error) {
    console.error('Error getting projects by developer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/projects/area/:areaId
 * @desc Get all projects by area
 * @access Private
 */
router.get('/area/:areaId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const projects = await getProjectsByArea(tenantId, req.params.areaId);
    res.json({ success: true, data: projects, count: projects.length });
  } catch (error) {
    console.error('Error getting projects by area:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/projects/status/:status
 * @desc Get all projects by status
 * @access Private
 */
router.get('/status/:status', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const projects = await getProjectsByStatus(tenantId, req.params.status);
    res.json({ success: true, data: projects, count: projects.length });
  } catch (error) {
    console.error('Error getting projects by status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/projects/:projectId
 * @desc Get project by ID
 * @access Private
 */
router.get('/:projectId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const project = await getProject(tenantId, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/crm/projects/:projectId/metrics
 * @desc Get detailed metrics for a project
 * @access Private
 */
router.get('/:projectId/metrics', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const metrics = await getProjectDetailedMetrics(tenantId, req.params.projectId);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error getting project metrics:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/crm/projects
 * @desc Create a new project
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

    const project = await createProject(tenantId, data);
    res.status(201).json({ success: true, data: project, message: 'Project created successfully' });
  } catch (error) {
    console.error('Error creating project:', error);
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('required')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route PUT /api/crm/projects/:projectId
 * @desc Update a project
 * @access Private
 */
router.put('/:projectId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const data = {
      ...req.body,
      updatedBy: req.user?.userId || 'system',
    };

    const project = await updateProject(tenantId, req.params.projectId, data);
    res.json({ success: true, data: project, message: 'Project updated successfully' });
  } catch (error) {
    console.error('Error updating project:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route PATCH /api/crm/projects/:projectId/status
 * @desc Update project lifecycle status
 * @access Private
 */
router.patch('/:projectId/status', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { status, notes, completionPercentage } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const project = await updateProjectLifecycleStatus(tenantId, req.params.projectId, status, {
      updatedBy: req.user?.userId || 'system',
      notes,
      completionPercentage,
    });

    res.json({ success: true, data: project, message: 'Project status updated successfully' });
  } catch (error) {
    console.error('Error updating project status:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('Invalid status')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route PATCH /api/crm/projects/:projectId/inventory
 * @desc Update project inventory
 * @access Private
 */
router.patch('/:projectId/inventory', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const project = await updateProjectInventory(tenantId, req.params.projectId, req.body);
    res.json({ success: true, data: project, message: 'Project inventory updated successfully' });
  } catch (error) {
    console.error('Error updating project inventory:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/crm/projects/:projectId/mark-sold
 * @desc Mark a unit as sold
 * @access Private
 */
router.post('/:projectId/mark-sold', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { unitType, quantity = 1 } = req.body;
    const project = await markUnitSold(tenantId, req.params.projectId, unitType, quantity);
    res.json({ success: true, data: project, message: 'Unit marked as sold' });
  } catch (error) {
    console.error('Error marking unit as sold:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/crm/projects/:projectId/view
 * @desc Increment project view count
 * @access Private
 */
router.post('/:projectId/view', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    await incrementProjectViews(tenantId, req.params.projectId);
    res.json({ success: true, message: 'View counted' });
  } catch (error) {
    console.error('Error incrementing project views:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/crm/projects/:projectId/enquiry
 * @desc Log a project enquiry (increment enquiry count)
 * @access Private
 */
router.post('/:projectId/enquiry', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    await incrementProjectEnquiries(tenantId, req.params.projectId);
    res.json({ success: true, message: 'Enquiry logged' });
  } catch (error) {
    console.error('Error logging project enquiry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route DELETE /api/crm/projects/:projectId
 * @desc Delete a project (soft delete by default)
 * @access Private
 */
router.delete('/:projectId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const hardDelete = req.query.hard === 'true';
    await deleteProject(tenantId, req.params.projectId, hardDelete);
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============== Media & Document Upload Routes ==============

/**
 * @route POST /api/crm/projects/:projectId/images
 * @desc Upload project images
 * @access Private
 */
router.post('/:projectId/images', upload.array('images', 20), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided' });
    }

    const project = await getProject(tenantId, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const uploadedImages = await Promise.all(
      req.files.map(async (file) => {
        const s3Key = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          'real-estate/projects/images',
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

    const existingImages = project.images || [];
    const updatedImages = [...existingImages, ...uploadedImages];

    await updateProject(tenantId, req.params.projectId, {
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
 * @route POST /api/crm/projects/:projectId/videos
 * @desc Upload project videos
 * @access Private
 */
router.post('/:projectId/videos', upload.array('videos', 10), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No video files provided' });
    }

    const project = await getProject(tenantId, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const uploadedVideos = await Promise.all(
      req.files.map(async (file) => {
        const s3Key = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          'real-estate/projects/videos',
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

    const existingVideos = project.videos || [];
    const updatedVideos = [...existingVideos, ...uploadedVideos];

    await updateProject(tenantId, req.params.projectId, {
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
 * @route POST /api/crm/projects/:projectId/brochure
 * @desc Upload project brochure PDF
 * @access Private
 */
router.post('/:projectId/brochure', upload.single('brochure'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No brochure file provided' });
    }

    const project = await getProject(tenantId, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const s3Key = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'real-estate/projects/brochures',
      tenantId
    );

    // Delete old brochure if exists
    if (project.documents?.brochure?.s3Key) {
      try {
        await deleteFromS3(project.documents.brochure.s3Key);
      } catch (err) {
        console.error('Error deleting old brochure:', err);
      }
    }

    const brochureData = {
      s3Key,
      url: await getSignedUrl(s3Key),
      name: req.file.originalname,
      uploadedAt: new Date().toISOString(),
    };

    await updateProject(tenantId, req.params.projectId, {
      documents: {
        ...project.documents,
        brochure: brochureData,
      },
      brochureS3Key: s3Key,
      brochureUrl: brochureData.url,
    });

    res.json({ 
      success: true, 
      data: brochureData, 
      message: 'Brochure uploaded successfully' 
    });
  } catch (error) {
    console.error('Error uploading brochure:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/crm/projects/:projectId/floor-plans
 * @desc Upload project floor plan PDFs
 * @access Private
 */
router.post('/:projectId/floor-plans', upload.array('floorPlans', 10), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No floor plan files provided' });
    }

    const project = await getProject(tenantId, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const uploadedPlans = await Promise.all(
      req.files.map(async (file) => {
        const s3Key = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          'real-estate/projects/floor-plans',
          tenantId
        );
        return {
          s3Key,
          url: await getSignedUrl(s3Key),
          name: file.originalname,
          uploadedAt: new Date().toISOString(),
        };
      })
    );

    const existingPlans = project.documents?.floorPlans || [];
    const updatedPlans = [...existingPlans, ...uploadedPlans];

    await updateProject(tenantId, req.params.projectId, {
      documents: {
        ...project.documents,
        floorPlans: updatedPlans,
      },
    });

    res.json({ 
      success: true, 
      data: uploadedPlans, 
      message: `${uploadedPlans.length} floor plan(s) uploaded successfully` 
    });
  } catch (error) {
    console.error('Error uploading floor plans:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route DELETE /api/crm/projects/:projectId/images
 * @desc Delete project image
 * @access Private
 */
router.delete('/:projectId/images', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { s3Key } = req.body;
    if (!s3Key) {
      return res.status(400).json({ success: false, message: 'S3 key is required' });
    }

    const project = await getProject(tenantId, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await deleteFromS3(s3Key);

    const updatedImages = (project.images || []).filter(img => img.s3Key !== s3Key);
    await updateProject(tenantId, req.params.projectId, {
      images: updatedImages,
    });

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route DELETE /api/crm/projects/:projectId/videos
 * @desc Delete project video
 * @access Private
 */
router.delete('/:projectId/videos', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { s3Key } = req.body;
    if (!s3Key) {
      return res.status(400).json({ success: false, message: 'S3 key is required' });
    }

    const project = await getProject(tenantId, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await deleteFromS3(s3Key);

    const updatedVideos = (project.videos || []).filter(vid => vid.s3Key !== s3Key);
    await updateProject(tenantId, req.params.projectId, {
      videos: updatedVideos,
    });

    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route DELETE /api/crm/projects/:projectId/floor-plans
 * @desc Delete project floor plan
 * @access Private
 */
router.delete('/:projectId/floor-plans', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { s3Key } = req.body;
    if (!s3Key) {
      return res.status(400).json({ success: false, message: 'S3 key is required' });
    }

    const project = await getProject(tenantId, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await deleteFromS3(s3Key);

    const updatedPlans = (project.documents?.floorPlans || []).filter(plan => plan.s3Key !== s3Key);
    await updateProject(tenantId, req.params.projectId, {
      documents: {
        ...project.documents,
        floorPlans: updatedPlans,
      },
    });

    res.json({ success: true, message: 'Floor plan deleted successfully' });
  } catch (error) {
*/
    console.error('Error deleting floor plan:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
