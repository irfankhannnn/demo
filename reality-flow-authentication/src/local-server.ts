import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { loadConfig } from './config/config';
import { localAuthMiddleware } from './middleware/authMiddleware';
import express from 'express';
import cors from 'cors';

const config = loadConfig();
const app = createApp();

// In local dev, insert auth middleware before route handlers
// This verifies Cognito JWT tokens manually (in prod, API Gateway does this)
const localApp = express();

// Add CORS for local development - handles both preflight and actual requests
localApp.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

localApp.use('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'reality-flow-auth', mode: 'local', timestamp: new Date().toISOString() });
});

// Skip auth middleware for public endpoints (they don't require auth)
localApp.use((req, res, next) => {
  const publicPaths = [
    '/auth/token',
    '/auth/refresh',
    '/auth/phone/start',
    '/auth/phone/confirm',
  ];
  if (publicPaths.includes(req.path)) {
    next();
  } else {
    localAuthMiddleware(req, res, next);
  }
});

localApp.use(app);

const PORT = config.PORT;

localApp.listen(PORT, () => {
  console.log(`🚀 Reality Flow Auth Service running locally`);
  console.log(`   Base URL:    http://localhost:${PORT}`);
  console.log(`   Health:      http://localhost:${PORT}/health`);
  console.log(`   Environment: ${config.ENV}`);
});
