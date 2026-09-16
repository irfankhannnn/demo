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
import toolRoutes from './routes/tools.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3002;
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const apiBasePathPrefix = (process.env.API_BASE_PATH_PREFIX || '').replace(/^\/+|\/+$/g, '');

// Middleware
//
// ALLOWED_ORIGINS is a comma-separated allowlist set by the template. Left
// unset we fall back to '*', which is fine for the webhook and server-tool
// routes (they authenticate on their own) but should be set in any
// environment the CRM front-end talks to.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-tenant-id',
    'x-api-key',
    'x-lead-id',
    'x-call-session-id',
  ],
  credentials: false,
}));

// ElevenLabs computes its webhook signature over the exact bytes of the
// request body, so the raw buffer has to survive JSON parsing for
// verifyWebhookSignature to reproduce the HMAC. Capturing it here (rather
// than mounting a separate express.raw() handler on the webhook path) keeps
// req.body working normally for every route.
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));
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
// Called by the ElevenLabs agent mid-conversation; authenticated by
// SERVER_TOOL_API_KEY inside the router, not by the CRM's bearer token.
app.use('/api/ai-calling/tools', toolRoutes);

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

// Start server (for local development).
// Secrets hydration runs first so local runs against a real SECRETS_ARN
// behave like Lambda; with no SECRETS_ARN set it's a no-op and the .env
// values loaded above stand as-is.
if (!isLambda) {
  const { hydrateConfigFromSecrets } = await import('./config/secretsBootstrap.js');
  await hydrateConfigFromSecrets();
  app.listen(PORT, () => {
    console.log(`AI Calling Service running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

export default app;
