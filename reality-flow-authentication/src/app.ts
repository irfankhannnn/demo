import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import inviteRoutes from './routes/invites';
import userRoutes from './routes/users';

export function createApp(): express.Application {
  const app = express();

  // --- Cross-cutting middleware ---
  app.use(cors());
  app.use(express.json());

  // --- Health check (no auth required) ---
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'reality-flow-auth', timestamp: new Date().toISOString() });
  });

  // --- Routes ---
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
