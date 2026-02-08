// AI Calling Service - Express Server

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

import { logger } from './utils/logger.js';
import callRoutes from './routes/calls.js';
import webhookRoutes from './routes/webhooks.js';
import knowledgeRoutes from './routes/knowledge.js';
import configRoutes from './routes/config.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3002;
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const apiBasePathPrefix = (process.env.API_BASE_PATH_PREFIX || '').replace(/^\/+|\/+$/g, '');

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-api-key'],
  credentials: false,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      tenantId: req.headers['x-tenant-id'],
    });
  });
  
  next();
});

// If this Lambda is behind an API Gateway custom domain base-path mapping,
// API Gateway may forward the base-path prefix as part of the request path.
// Example forwarded path: /devrealestateagencyai/api/ai-calling/config/agent
// But our Express routes are registered under /api/ai-calling/...
// This middleware strips the base-path prefix so route matching works.
if (apiBasePathPrefix) {
  app.use((req, res, next) => {
    const prefix = `/${apiBasePathPrefix}`;
    if (req.url === prefix) {
      req.url = '/';
    } else if (req.url.startsWith(`${prefix}/`)) {
      req.url = req.url.slice(prefix.length);
    }
    next();
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ai-calling',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/ai-calling/calls', callRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/ai-calling/knowledge', knowledgeRoutes);
app.use('/api/ai-calling/config', configRoutes);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server (for local development)
if (!isLambda) {
  app.listen(PORT, () => {
    console.log(`AI Calling Service running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

export default app;
