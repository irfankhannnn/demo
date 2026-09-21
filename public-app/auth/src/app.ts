import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadConfig } from './config/config';
import authRoutes from './routes/auth';
import phoneAuthRoutes from './routes/phoneAuth';
import googleAuthRoutes from './routes/googleAuth';
import internalRoutes from './routes/internal';
import { logger } from './utils/logger';

export const SERVICE_ID = 'marketplace-authentication';

export function createApp(): express.Application {
  const app = express();
  const config = loadConfig();
  app.locals.config = config;

  // Express's own cors() handles preflight too — API Gateway routes
  // OPTIONS to the Lambda via the {proxy+} ANY method.
  app.use(
    cors({
      origin: config.ALLOWED_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 600,
    })
  );

  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: SERVICE_ID });
  });

  app.use('/auth/phone', phoneAuthRoutes);
  app.use('/auth/google', googleAuthRoutes);
  app.use('/auth', authRoutes);
  app.use('/internal', internalRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', details: 'Route not found' });
  });

  app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
      res.status(err.status ?? 400).json({ error: 'bad_request', details: 'Invalid JSON body' });
      return;
    }
    logger.error('unhandled_error', { error: err });
    const isProd = config.ENV === 'prod';
    res.status(500).json({ error: 'internal_error', details: isProd ? 'An unexpected error occurred' : err.message });
  });

  return app;
}
