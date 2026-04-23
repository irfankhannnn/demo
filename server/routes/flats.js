import express from 'express';
import multer from 'multer';
import * as dynamodb from '../dynamodbService.js';
import * as s3Service from '../s3Service.js';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// All routes require authentication
// router.use(validateToken);
// router.use(extractTenantId);

/*
// ============== COMMENTED OUT: Flats/Buildings/Areas hierarchy disabled ==============
// All routes below are commented out as part of removing flats/buildings/areas functionality

// ============== Flat CRUD ==============

// Get all flats in a building
router.get('/building/:buildingId', async (req, res) => {
  try {
    const flats = await dynamodb.getFlatsByBuilding(req.params.buildingId);
    res.json(flats);
  } catch (error) {
    console.error('Error getting flats:', error);
    res.status(500).json({ error: 'Failed to get flats' });
  }
});

// Get single flat with all details
router.get('/:flatId', async (req, res) => {
  try {
    const flat = await dynamodb.getFlat(req.params.flatId);
    if (!flat) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    // Get related data
    const [owner, tenant, agreements, verifications, documents] = await Promise.all([
      dynamodb.getOwner(req.params.flatId),
      dynamodb.getTenant(req.params.flatId),
      dynamodb.getAgreements(req.params.flatId),
      dynamodb.getVerifications(req.params.flatId),
      dynamodb.getDocuments(req.params.flatId),
    ]);

    // Generate presigned URLs for all documents
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: doc.s3Key ? await s3Service.getPresignedUrl(doc.s3Key) : null,
      }))
    );

    res.json({
      ...flat,
      owner: owner ? {
        ...owner,
        photoUrl: owner.photoS3Key ? await s3Service.getPresignedUrl(owner.photoS3Key) : null,
        panUrl: owner.panS3Key ? await s3Service.getPresignedUrl(owner.panS3Key) : null,
        aadharUrl: owner.aadharS3Key ? await s3Service.getPresignedUrl(owner.aadharS3Key) : null,
      } : null,
      tenant: tenant ? {
        ...tenant,
        photoUrl: tenant.photoS3Key ? await s3Service.getPresignedUrl(tenant.photoS3Key) : null,
        panUrl: tenant.panS3Key ? await s3Service.getPresignedUrl(tenant.panS3Key) : null,
        aadharUrl: tenant.aadharS3Key ? await s3Service.getPresignedUrl(tenant.aadharS3Key) : null,
      } : null,
      agreements: await Promise.all(agreements.map(async (agreement) => ({
        ...agreement,
        documentUrl: agreement.documentS3Key ? await s3Service.getPresignedUrl(agreement.documentS3Key) : null,
      }))),
      verifications: await Promise.all(verifications.map(async (verification) => ({
        ...verification,
        documentUrl: verification.documentS3Key ? await s3Service.getPresignedUrl(verification.documentS3Key) : null,
      }))),
      documents: documentsWithUrls,
    });
  } catch (error) {
    console.error('Error getting flat details:', error);
    res.status(500).json({ error: 'Failed to get flat details' });
  }
});

// Create flat
router.post('/', async (req, res) => {
  try {
    const { buildingId, flatNumber, floorNumber } = req.body;
    if (!buildingId || !flatNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const flat = await dynamodb.createFlat(buildingId, flatNumber, floorNumber || 0);
    res.json(flat);
  } catch (error) {
    console.error('Error creating flat:', error);
    res.status(500).json({ error: 'Failed to create flat' });
  }
});

// Update flat
router.put('/:flatId', async (req, res) => {
  try {
    const flat = await dynamodb.updateFlat(req.params.flatId, req.body);
    res.json(flat);
  } catch (error) {
    console.error('Error updating flat:', error);
    res.status(500).json({ error: 'Failed to update flat' });
  }
});

// Delete flat
router.delete('/:flatId', async (req, res) => {
  try {
    await dynamodb.deleteFlat(req.params.flatId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flat:', error);
    res.status(500).json({ error: 'Failed to delete flat' });
  }
});

// ============== Owner Operations ==============

// Create/Update owner
router.post('/:flatId/owner', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'aadhar', maxCount: 1 }
]), async (req, res) => {
  try {
    const flat = await dynamodb.getFlat(req.params.flatId);
    if (!flat) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    // Get building and area info for S3 folder structure
    const building = await dynamodb.getBuilding(flat.buildingId);
    const area = await dynamodb.getArea(building.areaId);

    const ownerData = JSON.parse(req.body.data || '{}');
    const folderStructure = {
      area: area.name,
      building: building.name,
      flatNo: flat.flatNumber
    };

    // Upload files to S3 if provided
    if (req.files) {
      if (req.files.photo?.[0]) {
        const s3Key = await s3Service.uploadToS3(
          req.files.photo[0].buffer,
          req.files.photo[0].originalname,
          req.files.photo[0].mimetype,
          folderStructure,
          req.tenantId
        );
        ownerData.photoS3Key = s3Key;
      }
      if (req.files.pan?.[0]) {
        const s3Key = await s3Service.uploadToS3(
          req.files.pan[0].buffer,
          req.files.pan[0].originalname,
          req.files.pan[0].mimetype,
          folderStructure,
          req.tenantId
        );
        ownerData.panS3Key = s3Key;
      }
      if (req.files.aadhar?.[0]) {
        const s3Key = await s3Service.uploadToS3(
          req.files.aadhar[0].buffer,
          req.files.aadhar[0].originalname,
          req.files.aadhar[0].mimetype,
          folderStructure,
          req.tenantId
        );
        ownerData.aadharS3Key = s3Key;
      }
    }

    // Check if owner exists
    const existingOwner = await dynamodb.getOwner(req.params.flatId);
    let owner;
    
    if (existingOwner) {
      owner = await dynamodb.updateOwner(req.params.flatId, existingOwner.ownerId, ownerData);
    } else {
      owner = await dynamodb.createOwner(req.params.flatId, ownerData);
    }

    res.json(owner);
  } catch (error) {
    console.error('Error saving owner:', error);
    res.status(500).json({ error: 'Failed to save owner' });
  }
});

// ============== Tenant Operations ==============

// Create/Update tenant
router.post('/:flatId/tenant', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'aadhar', maxCount: 1 }
]), async (req, res) => {
  try {
    const flat = await dynamodb.getFlat(req.params.flatId);
    if (!flat) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    // Get building and area info for S3 folder structure
    const building = await dynamodb.getBuilding(flat.buildingId);
    const area = await dynamodb.getArea(building.areaId);

    const tenantData = JSON.parse(req.body.data || '{}');
    const folderStructure = {
      area: area.name,
      building: building.name,
      flatNo: flat.flatNumber
    };

    // Upload files to S3 if provided
    if (req.files) {
      if (req.files.photo?.[0]) {
        const s3Key = await s3Service.uploadToS3(
          req.files.photo[0].buffer,
          req.files.photo[0].originalname,
          req.files.photo[0].mimetype,
          folderStructure,
          req.tenantId
        );
        tenantData.photoS3Key = s3Key;
      }
      if (req.files.pan?.[0]) {
        const s3Key = await s3Service.uploadToS3(
          req.files.pan[0].buffer,
          req.files.pan[0].originalname,
          req.files.pan[0].mimetype,
          folderStructure,
          req.tenantId
        );
        tenantData.panS3Key = s3Key;
      }
      if (req.files.aadhar?.[0]) {
        const s3Key = await s3Service.uploadToS3(
          req.files.aadhar[0].buffer,
          req.files.aadhar[0].originalname,
          req.files.aadhar[0].mimetype,
          folderStructure,
          req.tenantId
        );
        tenantData.aadharS3Key = s3Key;
      }
    }

    // Check if tenant exists
    const existingTenant = await dynamodb.getTenant(req.params.flatId);
    let tenant;
    
    if (existingTenant) {
      tenant = await dynamodb.updateTenant(req.params.flatId, existingTenant.tenantId, tenantData);
    } else {
      tenant = await dynamodb.createTenant(req.params.flatId, tenantData);
    }

    res.json(tenant);
  } catch (error) {
    console.error('Error saving tenant:', error);
    res.status(500).json({ error: 'Failed to save tenant' });
  }
});

// ============== Agreement Operations ==============

// Create agreement
router.post('/:flatId/agreement', upload.single('document'), async (req, res) => {
  try {
    const flat = await dynamodb.getFlat(req.params.flatId);
    if (!flat) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    const building = await dynamodb.getBuilding(flat.buildingId);
    const area = await dynamodb.getArea(building.areaId);

    const agreementData = JSON.parse(req.body.data || '{}');
    const folderStructure = {
      area: area.name,
      building: building.name,
      flatNo: flat.flatNumber
    };

    // Upload document if provided
    if (req.file) {
      const s3Key = await s3Service.uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folderStructure,
        req.tenantId
      );
      agreementData.documentS3Key = s3Key;
      agreementData.documentName = req.file.originalname;
    }

    const agreement = await dynamodb.createAgreement(req.params.flatId, agreementData);
    res.json(agreement);
  } catch (error) {
    console.error('Error creating agreement:', error);
    res.status(500).json({ error: 'Failed to create agreement' });
  }
});

// Update agreement
router.put('/:flatId/agreement/:agreementId', upload.single('document'), async (req, res) => {
  try {
    const agreementData = JSON.parse(req.body.data || '{}');

    // Upload new document if provided
    if (req.file) {
      const flat = await dynamodb.getFlat(req.params.flatId);
      const building = await dynamodb.getBuilding(flat.buildingId);
      const area = await dynamodb.getArea(building.areaId);

      const folderStructure = {
        area: area.name,
        building: building.name,
        flatNo: flat.flatNumber
      };

      const s3Key = await s3Service.uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folderStructure,
        req.tenantId
      );
      agreementData.documentS3Key = s3Key;
      agreementData.documentName = req.file.originalname;
    }

    await dynamodb.updateAgreement(req.params.flatId, req.params.agreementId, agreementData);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating agreement:', error);
    res.status(500).json({ error: 'Failed to update agreement' });
  }
});

// ============== Police Verification Operations ==============

// Create verification
router.post('/:flatId/verification', upload.single('document'), async (req, res) => {
  try {
    const flat = await dynamodb.getFlat(req.params.flatId);
    if (!flat) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    const building = await dynamodb.getBuilding(flat.buildingId);
    const area = await dynamodb.getArea(building.areaId);

    const verificationData = JSON.parse(req.body.data || '{}');
    const folderStructure = {
      area: area.name,
      building: building.name,
      flatNo: flat.flatNumber
    };

    // Upload document if provided
    if (req.file) {
      const s3Key = await s3Service.uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folderStructure,
        req.tenantId
      );
      verificationData.documentS3Key = s3Key;
      verificationData.documentName = req.file.originalname;
    }

    const verification = await dynamodb.createVerification(req.params.flatId, verificationData);
    res.json(verification);
  } catch (error) {
    console.error('Error creating verification:', error);
    res.status(500).json({ error: 'Failed to create verification' });
  }
});

// Update verification
router.put('/:flatId/verification/:verificationId', upload.single('document'), async (req, res) => {
  try {
    const verificationData = JSON.parse(req.body.data || '{}');

    // Upload new document if provided
    if (req.file) {
      const flat = await dynamodb.getFlat(req.params.flatId);
      const building = await dynamodb.getBuilding(flat.buildingId);
      const area = await dynamodb.getArea(building.areaId);

      const folderStructure = {
        area: area.name,
        building: building.name,
        flatNo: flat.flatNumber
      };

      const s3Key = await s3Service.uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folderStructure,
        req.tenantId
      );
      verificationData.documentS3Key = s3Key;
      verificationData.documentName = req.file.originalname;
    }

    await dynamodb.updateVerification(req.params.flatId, req.params.verificationId, verificationData);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating verification:', error);
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

// ============== General Document Operations ==============

// Upload flat document (images/videos)
router.post('/:flatId/documents', upload.single('file'), async (req, res) => {
  try {
    const flat = await dynamodb.getFlat(req.params.flatId);
    if (!flat) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const building = await dynamodb.getBuilding(flat.buildingId);
    const area = await dynamodb.getArea(building.areaId);

    const folderStructure = {
      area: area.name,
      building: building.name,
      flatNo: flat.flatNumber
    };

    const s3Key = await s3Service.uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folderStructure,
      req.tenantId
    );

    const documentData = {
      s3Key: s3Key,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      documentType: req.body.documentType || 'OTHER',
      description: req.body.description || '',
    };

    const document = await dynamodb.createDocument(
      req.params.flatId,
      documentData.documentType,
      documentData
    );

    res.json(document);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Delete document
router.delete('/:flatId/documents/:documentType/:documentId', async (req, res) => {
  try {
    const { flatId, documentType, documentId } = req.params;
    
    // Get document to retrieve S3 key
    const documents = await dynamodb.getDocuments(flatId, documentType);
    const document = documents.find(d => d.documentId === documentId);
    
    if (document && document.s3Key) {
      await s3Service.deleteFromS3(document.s3Key);
    }
    
    await dynamodb.deleteDocument(flatId, documentType, documentId);
    res.json({ success: true });
  } catch (error) {
*/
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
