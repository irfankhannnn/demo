import express from 'express';
import multer from 'multer';
import db from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadToS3, getPresignedUrl } from '../s3Service.js';
// import { deleteFromS3 } from '../s3Service.js'; // DISABLED: Delete operations not allowed
import { extractTenantId } from '../tenantMiddleware.js';

const router = express.Router();

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
  try {
    const buildings = db.prepare(`
      SELECT b.*, a.name as area_name 
      FROM buildings b 
      LEFT JOIN areas a ON b.area_id = a.id 
      ORDER BY b.created_at DESC
    `).all();
    res.json(buildings);
  } catch (error) {
    console.error('Get buildings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search buildings by name or customer name
router.get('/search', authenticateToken, (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const buildings = db.prepare(`
      SELECT b.*, a.name as area_name 
      FROM buildings b 
      LEFT JOIN areas a ON b.area_id = a.id 
      WHERE b.name LIKE ? OR b.customer_name LIKE ?
      ORDER BY b.created_at DESC
    `).all(`%${query}%`, `%${query}%`);
    
    res.json(buildings);
  } catch (error) {
    console.error('Search buildings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single building with documents
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const building = db.prepare(`
      SELECT b.*, a.name as area_name 
      FROM buildings b 
      LEFT JOIN areas a ON b.area_id = a.id 
      WHERE b.id = ?
    `).get(id);

    if (!building) {
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

    res.json({
      ...building,
      documents: documentsWithUrls,
    });
  } catch (error) {
    console.error('Get building error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new building
router.post('/', authenticateToken, (req, res) => {
  const { name, area_id, customer_name } = req.body;

  if (!name || !area_id || !customer_name) {
    return res.status(400).json({ error: 'Name, area, and customer name are required' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO buildings (name, area_id, customer_name) VALUES (?, ?, ?)'
    ).run(name, area_id, customer_name);

    const building = db.prepare(`
      SELECT b.*, a.name as area_name 
      FROM buildings b 
      LEFT JOIN areas a ON b.area_id = a.id 
      WHERE b.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(building);
  } catch (error) {
    console.error('Create building error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update building
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, area_id, customer_name } = req.body;

  if (!name || !area_id || !customer_name) {
    return res.status(400).json({ error: 'Name, area, and customer name are required' });
  }

  try {
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
      return res.status(404).json({ error: 'Building not found' });
    }

    res.json(building);
  } catch (error) {
    console.error('Update building error:', error);
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

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Check if building exists
    const building = db.prepare('SELECT id FROM buildings WHERE id = ?').get(id);
    if (!building) {
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

    res.status(201).json({
      ...document,
      url: await getPresignedUrl(document.s3_key),
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete document - DISABLED: Delete operations are not allowed
// router.delete('/:buildingId/documents/:documentId', authenticateToken, async (req, res) => {
//   res.status(403).json({ error: 'Delete operations are not allowed' });
// });

export default router;
