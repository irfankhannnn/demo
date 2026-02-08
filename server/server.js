import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDefaultAdmin } from './dynamodbService.js';
import { ensureRequestId } from './requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './expressError.js';
import authRoutes from './routes/auth.js';
// import areasRoutes from './routes/areas.js'; // Commented out - areas are auto-created from properties
import publicAreasRoutes from './routes/publicAreas.js';
import areasBuildings from './routes/areasBuildings.js';
import flatsRoutes from './routes/flats.js';
import crmRoutes from './routes/crm.js';
import contactsRoutes from './routes/contacts.js';
import leadsRoutes from './routes/leads.js';
import buyersRoutes from './routes/buyers.js';
import enquiriesRoutes from './routes/enquiries.js';
import b2bLeadsRoutes from './routes/b2bLeads.js';
import khataRoutes from './routes/khata.js';
import notificationsRoutes from './routes/notifications.js';
import aiCallingInternalRoutes from './routes/aiCallingInternal.js';
import developersRoutes from './routes/developers.js';
import realEstateAreasRoutes from './routes/realEstateAreas.js';
import projectsRoutes from './routes/projects.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Middleware - Configure CORS to allow all origins and methods
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-tenant-id'],
  credentials: false,
  maxAge: 86400
}));
app.use(ensureRequestId);
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static public assets (e.g. /public/area/<city>_<area>.png)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Initialize DynamoDB default admin
createDefaultAdmin().catch(console.error);

// Health check (public - no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', b2bLeadsRoutes); // Register b2b-leads BEFORE areasBuildings to avoid auth middleware conflict
// app.use('/api/areas', areasRoutes); // Commented out - areas are auto-created from properties, no manual management needed
app.use('/api/areas/public', publicAreasRoutes);
app.use('/api/enquiries', enquiriesRoutes);
app.use('/api/flats', flatsRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/crm/contacts', contactsRoutes);
app.use('/api/crm/leads', leadsRoutes);
app.use('/api/crm/buyers', buyersRoutes);
app.use('/api/crm/developers', developersRoutes);
app.use('/api/crm/real-estate-areas', realEstateAreasRoutes);
app.use('/api/crm/projects', projectsRoutes);
app.use('/api/khata', khataRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/internal', aiCallingInternalRoutes); // Internal API for AI Calling Service
app.use('/api', areasBuildings);

// Error handling middleware
app.use(errorHandler);

// Start server
if (!isLambda) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

export default app;
