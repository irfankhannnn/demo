// Follow-up Agent Service - Express app (management API).

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

import { logger } from './utils/logger.js';
import jobRoutes from './routes/jobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3004;
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const apiBasePathPrefix = (process.env.API_BASE_PATH_PREFIX || '').replace(/^\/+|\/+$/g, '');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-tenant-id', 'x-api-key'],
  credentials: false,
}));
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - startTime,
      tenantId: req.headers['x-tenant-id'],
    });
  });
  next();
});

// Defensive second strip: lambda-api.js already normalises the event path, but
// a direct HTTP call carrying the base path (local dev) should work too.
if (apiBasePathPrefix) {
  app.use((req, res, next) => {
    const prefix = `/${apiBasePathPrefix}`;
    if (req.url === prefix) req.url = '/';
    else if (req.url.startsWith(`${prefix}/`)) req.url = req.url.slice(prefix.length);
    next();
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'followup-agent', timestamp: new Date().toISOString() });
});

app.use('/api/followup/jobs', jobRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err, { method: req.method, path: req.path });
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (!isLambda) {
  const { hydrateConfigFromSecrets } = await import('./config/secretsBootstrap.js');
  await hydrateConfigFromSecrets();
  app.listen(PORT, () => {
    console.log(`Follow-up Agent Service running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

export default app;
