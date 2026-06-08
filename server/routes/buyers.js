import express from 'express';
import multer from 'multer';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import {
  createBuyer,
  getBuyers,
  getBuyer,
  updateBuyer,
  createBuyerNote,
  getBuyerNotes,
  findPersonByPhone,
} from '../crmDynamodbService.js';
import { uploadToS3, getSignedUrl as getS3SignedUrl } from '../s3Service.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all buyers with optional filters
router.get('/', validateToken, extractTenantId, async (req, res) => {
  try {
    const { status, priority, propertyType } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (propertyType) filters.propertyType = propertyType;

    const buyers = await getBuyers(req.tenantId, filters);
    res.json(buyers);
  } catch (error) {
    console.error('Get buyers error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single buyer
router.get('/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const buyer = await getBuyer(req.tenantId, req.params.id);
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }
    res.json(buyer);
  } catch (error) {
    console.error('Get buyer error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create buyer
router.post('/', validateToken, extractTenantId, async (req, res) => {
  try {
    const buyerData = {
      ...req.body,
      createdBy: req.user?.username || 'Admin',
    };
    
    // Check if person exists in other roles
    if (buyerData.phone) {
      const personLookup = await findPersonByPhone(req.tenantId, buyerData.phone);
      if (personLookup.found) {
        buyerData.linkedRoles = personLookup.roles.map(r => ({
          role: r.role,
          id: r.id,
          name: r.data.name
        }));
      }
    }
    
    const buyer = await createBuyer(req.tenantId, buyerData);
    
    // Return with cross-role info
    const response = {
      ...buyer,
      crossRoleInfo: buyer.linkedRoles.length > 0 ? {
        message: `This person also exists as: ${buyer.linkedRoles.map(r => r.role).join(', ')}`,
        roles: buyer.linkedRoles
      } : null
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Create buyer error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update buyer
router.put('/:id', validateToken, extractTenantId, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || 'Admin',
    };
    const buyer = await updateBuyer(req.tenantId, req.params.id, updateData);
    res.json(buyer);
  } catch (error) {
    console.error('Update buyer error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Lookup buyer by phone (for auto-fill and cross-role detection)
router.get('/lookup/by-phone', validateToken, extractTenantId, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const personLookup = await findPersonByPhone(req.tenantId, phone);
    res.json(personLookup);
  } catch (error) {
    console.error('Lookup buyer by phone error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get buyer notes
router.get('/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const notes = await getBuyerNotes(req.tenantId, req.params.id);
    res.json(notes);
  } catch (error) {
    console.error('Get buyer notes error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create buyer note
router.post('/:id/notes', validateToken, extractTenantId, async (req, res) => {
  try {
    const noteData = {
      ...req.body,
      createdBy: req.user?.username || 'Admin',
    };
    const note = await createBuyerNote(req.tenantId, req.params.id, noteData);
    res.status(201).json(note);
  } catch (error) {
    console.error('Create buyer note error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get buyer metrics
router.get('/metrics/summary', validateToken, extractTenantId, async (req, res) => {
  try {
    const buyers = await getBuyers(req.tenantId);
    
    const metrics = {
      total: buyers.length,
      byStatus: {},
      byPriority: {},
      byPropertyType: {},
      avgBudget: 0,
    };
    
    buyers.forEach(buyer => {
      // Count by status
      metrics.byStatus[buyer.status] = (metrics.byStatus[buyer.status] || 0) + 1;
      
      // Count by priority
      metrics.byPriority[buyer.priority] = (metrics.byPriority[buyer.priority] || 0) + 1;
      
      // Count by property type
      if (buyer.propertyType) {
        metrics.byPropertyType[buyer.propertyType] = (metrics.byPropertyType[buyer.propertyType] || 0) + 1;
      }
    });
    
    // Calculate average budget
    const buyersWithBudget = buyers.filter(b => b.budget > 0);
    if (buyersWithBudget.length > 0) {
      metrics.avgBudget = Math.round(
        buyersWithBudget.reduce((sum, b) => sum + b.budget, 0) / buyersWithBudget.length
      );
    }
    
    res.json(metrics);
  } catch (error) {
    console.error('Get buyer metrics error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============== Buyer Document Upload Routes ==============

// Upload buyer documents (photo, PAN, Aadhar)
router.post('/:id/documents', validateToken, extractTenantId, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'aadhar', maxCount: 1 }
]), async (req, res) => {
  try {
    const buyer = await getBuyer(req.tenantId, req.params.id);
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    const updateData = {};

    if (req.files) {
      if (req.files.photo?.[0]) {
        const s3Key = await uploadToS3(
          req.files.photo[0].buffer,
          req.files.photo[0].originalname,
          req.files.photo[0].mimetype,
          'crm/buyers/photos',
          req.tenantId
        );
        updateData.photoS3Key = s3Key;
      }
      if (req.files.pan?.[0]) {
        const s3Key = await uploadToS3(
          req.files.pan[0].buffer,
          req.files.pan[0].originalname,
          req.files.pan[0].mimetype,
          'crm/buyers/documents',
          req.tenantId
        );
        updateData.panDocS3Key = s3Key;
      }
      if (req.files.aadhar?.[0]) {
        const s3Key = await uploadToS3(
          req.files.aadhar[0].buffer,
          req.files.aadhar[0].originalname,
          req.files.aadhar[0].mimetype,
          'crm/buyers/documents',
          req.tenantId
        );
        updateData.aadharDocS3Key = s3Key;
      }
    }

    const updatedBuyer = await updateBuyer(req.tenantId, req.params.id, updateData);

    // Return with presigned URLs
    const buyerWithUrls = {
      ...updatedBuyer,
      photoUrl: updatedBuyer.photoS3Key ? await getS3SignedUrl(updatedBuyer.photoS3Key) : null,
      panDocUrl: updatedBuyer.panDocS3Key ? await getS3SignedUrl(updatedBuyer.panDocS3Key) : null,
      aadharDocUrl: updatedBuyer.aadharDocS3Key ? await getS3SignedUrl(updatedBuyer.aadharDocS3Key) : null,
    };

    res.json(buyerWithUrls);
  } catch (error) {
    console.error('Upload buyer documents error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get buyer with documents and presigned URLs
router.get('/:id/with-documents', validateToken, extractTenantId, async (req, res) => {
  try {
    const buyer = await getBuyer(req.tenantId, req.params.id);
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    const buyerWithUrls = {
      ...buyer,
      photoUrl: buyer.photoS3Key ? await getS3SignedUrl(buyer.photoS3Key) : null,
      panDocUrl: buyer.panDocS3Key ? await getS3SignedUrl(buyer.panDocS3Key) : null,
      aadharDocUrl: buyer.aadharDocS3Key ? await getS3SignedUrl(buyer.aadharDocS3Key) : null,
    };

    res.json(buyerWithUrls);
  } catch (error) {
    console.error('Get buyer with documents error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
