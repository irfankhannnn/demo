import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { loadConfig } from './config/config';
import authRoutes from './routes/auth';
import inviteRoutes from './routes/invites';
import userRoutes from './routes/users';
import phoneAuthRoutes from './routes/phoneAuth';
import googleAuthRoutes from './routes/googleAuth';

export function createApp(): express.Application {
  const app = express();
  
  // Load configuration
  const config = loadConfig();
  app.locals.config = config;

  // --- Cross-cutting middleware ---
  app.use(cors());
  app.use(express.json());

  // --- Health check (no auth required) ---
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'reality-flow-auth', timestamp: new Date().toISOString() });
  });

  // --- Routes ---
  app.use('/auth/google', googleAuthRoutes);
  app.use('/auth/phone', phoneAuthRoutes);
  app.use('/auth', authRoutes);
  app.use('/invites', inviteRoutes);
  app.use('/users', userRoutes);

  // --- 404 handler ---
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', message: 'Route not found' });
  });

  // --- Error handler ---
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  return app;
}
