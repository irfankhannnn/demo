import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadConfig } from './config/config';
import { requireAuth } from './middleware/requireAuth';
import authRoutes from './routes/auth';
import inviteRoutes from './routes/invites';
import userRoutes from './routes/users';
import phoneAuthRoutes from './routes/phoneAuth';
import googleAuthRoutes from './routes/googleAuth';
import internalRoutes from './routes/internal';
import { logger } from './utils/logger';

export function createApp(): express.Application {
  const app = express();
  
  // Load configuration
  const config = loadConfig();
  app.locals.config = config;

  // --- Cross-cutting middleware ---
  // CORS with restricted origins (CRIT-5 fix)
  app.use(cors({
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Access-Token'],
    exposedHeaders: ['Set-Cookie'],
  }));

  // Body parsing middleware
  app.use(express.json());
  
  // Cookie parsing middleware (required for httpOnly refresh token)
  app.use(cookieParser());

  // Security headers (CRIT-7 fix)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
    next();
  });

  // --- Health check (no auth required) ---
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'reality-flow-auth', timestamp: new Date().toISOString() });
  });

  // --- Routes ---
  // Public auth flows (no requireAuth — these are the entry points)
  app.use('/auth/google', googleAuthRoutes);
  app.use('/auth/phone', phoneAuthRoutes);
  app.use('/auth', authRoutes);  // /auth/token and /auth/refresh are public; protected routes have own middleware

  // Protected routes (require valid Cognito claims)

  // Internal service-to-service routes (no Cognito — API key only)
  app.use('/internal', internalRoutes);

  app.use('/invites', requireAuth, inviteRoutes);
  app.use('/users', requireAuth, userRoutes);

  // --- 404 handler ---
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', message: 'Route not found' });
  });

  // --- Error handler (CRIT-6 fix) ---
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    const isProd = process.env.NODE_ENV === 'production' || process.env.ENV === 'prod';
    res.status(500).json({
      error: 'Internal Server Error',
      message: isProd ? 'An unexpected error occurred' : err.message,
    });
  });

  return app;
}

