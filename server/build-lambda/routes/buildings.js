import express from 'express';
import multer from 'multer';
import db from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadToS3, getPresignedUrl } from '../s3Service.js';
// import { deleteFromS3 } from '../s3Service.js'; // DISABLED: Delete operations not allowed
import { extractTenantId } from '../tenantMiddleware.js';
import { logger } from '../logger.js';

const router = express.Router();

logger.warn('sqlite.route.buildings.module_loaded', {
  file: 'routes/buildings.js',
});

router.use((req, res, next) => {
  const log = req.log || logger.child({
    requestId: req.headers['x-request-id'] || req.headers['X-Request-Id'],
    method: req.method,
    path: req.originalUrl,
    tenantId: req.headers['x-tenant-id'],
  });

  log.warn('sqlite.route.buildings.request', {
    hasAuthHeader: !!req.headers?.authorization,
    hasTenantHeader: !!req.headers?.['x-tenant-id'],
  });

  next();
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  },
});

// Get all buildings with area info
router.get('/', authenticateToken, (req, res) => {
  const log = req.log || logger;
  log.warn('sqlite.buildings.list.start');
  try {
    const buildings = db.prepare(`
      SELECT b.*, a.name as area_name 
      FROM buildings b 
      LEFT JOIN areas a ON b.area_id = a.id 
      ORDER BY b.created_at DESC
    `).all();
    log.warn('sqlite.buildings.list.end', { count: buildings?.length ?? 0 });
    res.json(buildings);
  } catch (error) {
    log.error('sqlite.buildings.list.error', {
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search buildings by name or customer name
router.get('/search', authenticateToken, (req, res) => {
  const { query } = req.query;
  const log = req.log || logger;

  if (!query) {
    log.warn('sqlite.buildings.search.missing_query');
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    log.warn('sqlite.buildings.search.start', { query: String(query) });
    const buildings = db.prepare(`
      SELECT b.*, a.name as area_name 
      FROM buildings b 
      LEFT JOIN areas a ON b.area_id = a.id 
      WHERE b.name LIKE ? OR b.customer_name LIKE ?
      ORDER BY b.created_at DESC
    `).all(`%${query}%`, `%${query}%`);

    log.warn('sqlite.buildings.search.end', { count: buildings?.length ?? 0 });
    res.json(buildings);
  } catch (error) {
    log.error('sqlite.buildings.search.error', {
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single building with documents
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const log = req.log || logger;

  try {
    log.warn('sqlite.buildings.get.start', { id });
    const building = db.prepare(`
      SELECT b.*, a.name as area_name 
      FROM buildings b 
      LEFT JOIN areas a ON b.area_id = a.id 
      WHERE b.id = ?
    `).get(id);

    if (!building) {
      log.warn('sqlite.buildings.get.not_found', { id });
      return res.status(404).json({ error: 'Building not found' });
    }

    const documents = db.prepare(`
      SELECT * FROM documents WHERE building_id = ? ORDER BY uploaded_at DESC
    `).all(id);

    // Generate pre-signed URLs for documents
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await getPresignedUrl(doc.s3_key),
      }))
    );

    log.warn('sqlite.buildings.get.end', {
      id,
      docCount: documents?.length ?? 0,
    });

    res.json({
      ...building,
      documents: documentsWithUrls,
    });
  } catch (error) {
    log.error('sqlite.buildings.get.error', {
      id,
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new building
router.post('/', authenticateToken, (req, res) => {
  const { name, area_id, customer_name } = req.body;
  const log = req.log || logger;

  if (!name || !area_id || !customer_name) {
    log.warn('sqlite.buildings.create.validation_error', {
      hasName: !!name,
      hasAreaId: !!area_id,
      hasCustomerName: !!customer_name,
    });
    return res.status(400).json({ error: 'Name, area, and customer name are required' });
  }

  try {
    log.warn('sqlite.buildings.create.start', { area_id });
    const result = db.prepare(
      'INSERT INTO buildings (name, area_id, customer_name) VALUES (?, ?, ?)'
    ).run(name, area_id, customer_name);

    const building = db.prepare(`
      SELECT b.*, a.name as area_name 
      FROM buildings b 
      LEFT JOIN areas a ON b.area_id = a.id 
      WHERE b.id = ?
    `).get(result.lastInsertRowid);

    log.warn('sqlite.buildings.create.end', { id: result.lastInsertRowid });

    res.status(201).json(building);
  } catch (error) {
    log.error('sqlite.buildings.create.error', {
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update building
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, area_id, customer_name } = req.body;
  const log = req.log || logger;

  if (!name || !area_id || !customer_name) {
    log.warn('sqlite.buildings.update.validation_error', {
      id,
      hasName: !!name,
      hasAreaId: !!area_id,
      hasCustomerName: !!customer_name,
    });
    return res.status(400).json({ error: 'Name, area, and customer name are required' });
  }

  try {
    log.warn('sqlite.buildings.update.start', { id, area_id });
    db.prepare(
      'UPDATE buildings SET name = ?, area_id = ?, customer_name = ? WHERE id = ?'
    ).run(name, area_id, customer_name, id);

    const building = db.prepare(`
      SELECT b.*, a.name as area_name 
      FROM buildings b 
      LEFT JOIN areas a ON b.area_id = a.id 
      WHERE b.id = ?
    `).get(id);

    if (!building) {
      log.warn('sqlite.buildings.update.not_found', { id });
      return res.status(404).json({ error: 'Building not found' });
    }

    log.warn('sqlite.buildings.update.end', { id });
    res.json(building);
  } catch (error) {
    log.error('sqlite.buildings.update.error', {
      id,
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete building - DISABLED: Delete operations are not allowed
// router.delete('/:id', authenticateToken, async (req, res) => {
//   res.status(403).json({ error: 'Delete operations are not allowed' });
// });

// Upload document for building
router.post('/:id/documents', authenticateToken, extractTenantId, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const log = req.log || logger;

  if (!req.file) {
    log.warn('sqlite.buildings.documents.upload.missing_file', { id });
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    log.warn('sqlite.buildings.documents.upload.start', {
      id,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
    // Check if building exists
    const building = db.prepare('SELECT id FROM buildings WHERE id = ?').get(id);
    if (!building) {
      log.warn('sqlite.buildings.documents.upload.building_not_found', { id });
      return res.status(404).json({ error: 'Building not found' });
    }

    // Upload to S3
    const { key } = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'buildings/documents',
      req.tenantId
    );

    // Save document info to database
    const result = db.prepare(`
      INSERT INTO documents (building_id, filename, original_filename, file_type, s3_key, file_size)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      key.split('/').pop(),
      req.file.originalname,
      req.file.mimetype,
      key,
      req.file.size
    );

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);

    log.warn('sqlite.buildings.documents.upload.end', {
      id,
      documentId: result.lastInsertRowid,
      s3Key: document?.s3_key,
    });

    res.status(201).json({
      ...document,
      url: await getPresignedUrl(document.s3_key),
    });
  } catch (error) {
    log.error('sqlite.buildings.documents.upload.error', {
      id,
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete document - DISABLED: Delete operations are not allowed
// router.delete('/:buildingId/documents/:documentId', authenticateToken, async (req, res) => {
//   res.status(403).json({ error: 'Delete operations are not allowed' });
// });

export default router;
