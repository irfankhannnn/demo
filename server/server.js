import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDefaultAdmin } from './dynamodbService.js';
import { ensureRequestId } from './requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './expressError.js';
import { logger } from './logger.js';
import authRoutes from './routes/auth.js';
// import areasRoutes from './routes/areas.js'; // Commented out - areas are auto-created from properties
// import publicAreasRoutes from './routes/publicAreas.js'; // DISABLED: Areas/Buildings/Flats hierarchy removed
// import areasBuildings from './routes/areasBuildings.js'; // DISABLED: Areas/Buildings/Flats hierarchy removed
// import flatsRoutes from './routes/flats.js'; // DISABLED: Areas/Buildings/Flats hierarchy removed
import crmRoutes from './routes/crm.js';
import contactsRoutes from './routes/contacts.js';
import leadsRoutes from './routes/leads.js';
import buyersRoutes from './routes/buyers.js';
import enquiriesRoutes from './routes/enquiries.js';
import b2bLeadsRoutes from './routes/b2bLeads.js';
import khataRoutes from './routes/khata.js';
import notificationsRoutes from './routes/notifications.js';

// === [LAUNCH ROUTES IMPORTS] ===
// PR-F
import billingRoutes from './routes/billing.js';
import aiEmployeeStatusRoutes from './routes/aiEmployeeStatus.js';
// === [/LAUNCH ROUTES IMPORTS] ===
// import aiCallingInternalRoutes from './routes/aiCallingInternal.js'; // DISABLED: AI Calling removed
// import developersRoutes from './routes/developers.js'; // DISABLED: Developers/Projects/Areas removed
// import realEstateAreasRoutes from './routes/realEstateAreas.js'; // DISABLED: Developers/Projects/Areas removed
// import projectsRoutes from './routes/projects.js'; // DISABLED: Developers/Projects/Areas removed

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

logger.info('server.startup', {
  port: PORT,
  isLambda,
  nodeEnv: process.env.NODE_ENV,
});

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
logger.info('routes.mount', { basePath: '/api/auth', router: 'authRoutes' });
app.use('/api/auth', authRoutes);
logger.info('routes.mount', { basePath: '/api', router: 'b2bLeadsRoutes' });
app.use('/api', b2bLeadsRoutes); // Register b2b-leads BEFORE areasBuildings to avoid auth middleware conflict
// app.use('/api/areas', areasRoutes); // Commented out - areas are auto-created from properties, no manual management needed
// logger.info('routes.mount', { basePath: '/api/areas/public', router: 'publicAreasRoutes' }); // DISABLED
// app.use('/api/areas/public', publicAreasRoutes); // DISABLED
logger.info('routes.mount', { basePath: '/api/enquiries', router: 'enquiriesRoutes' });
app.use('/api/enquiries', enquiriesRoutes);
// logger.info('routes.mount', { basePath: '/api/flats', router: 'flatsRoutes' }); // DISABLED
// app.use('/api/flats', flatsRoutes); // DISABLED
logger.info('routes.mount', { basePath: '/api/crm', router: 'crmRoutes' });
app.use('/api/crm', crmRoutes);
logger.info('routes.mount', { basePath: '/api/crm/contacts', router: 'contactsRoutes' });
app.use('/api/crm/contacts', contactsRoutes);
logger.info('routes.mount', { basePath: '/api/crm/leads', router: 'leadsRoutes' });
app.use('/api/crm/leads', leadsRoutes);
logger.info('routes.mount', { basePath: '/api/crm/buyers', router: 'buyersRoutes' });
app.use('/api/crm/buyers', buyersRoutes);
// logger.info('routes.mount', { basePath: '/api/crm/developers', router: 'developersRoutes' }); // DISABLED
// app.use('/api/crm/developers', developersRoutes); // DISABLED
// logger.info('routes.mount', { basePath: '/api/crm/real-estate-areas', router: 'realEstateAreasRoutes' }); // DISABLED
// app.use('/api/crm/real-estate-areas', realEstateAreasRoutes); // DISABLED
// logger.info('routes.mount', { basePath: '/api/crm/projects', router: 'projectsRoutes' }); // DISABLED
// app.use('/api/crm/projects', projectsRoutes); // DISABLED
logger.info('routes.mount', { basePath: '/api/khata', router: 'khataRoutes' });
app.use('/api/khata', khataRoutes);
logger.info('routes.mount', { basePath: '/api/notifications', router: 'notificationsRoutes' });
app.use('/api/notifications', notificationsRoutes);
// logger.info('routes.mount', { basePath: '/api/internal', router: 'aiCallingInternalRoutes' }); // DISABLED
// app.use('/api/internal', aiCallingInternalRoutes); // DISABLED: Internal API for AI Calling Service
// logger.info('routes.mount', { basePath: '/api', router: 'areasBuildings' }); // DISABLED
// app.use('/api', areasBuildings); // DISABLED

// === [LAUNCH ROUTES MOUNTS] ===
// PR-F — billing webhook BEFORE any auth middleware
app.use('/api/billing', billingRoutes);
// PR-F — AI Employee status (after auth)
app.use('/api/ai-employee', aiEmployeeStatusRoutes);
// === [/LAUNCH ROUTES MOUNTS] ===

// Error handling middleware
app.use(errorHandler);

// Start server
if (!isLambda) {
  app.listen(PORT, () => {
    logger.info('server.listening', {
      port: PORT,
      healthCheck: `http://localhost:${PORT}/api/health`,
    });
  });
}

export default app;
