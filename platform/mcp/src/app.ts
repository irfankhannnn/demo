import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { loadConfig } from './config/config';
import { errorHandler } from './middleware/errorHandler';
import mcpRoutes from './routes/mcp';
import oauthRoutes from './routes/oauth';
import healthRoutes from './routes/health';
import wellKnownRoutes from './routes/wellKnown';

export function createApp(options?: { injectTenantId?: string }): express.Application {
  const app = express();
  const config = loadConfig();
  app.locals.config = config;

  // --- Cross-cutting middleware ---
  app.use(cors({
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-tenant-id', 'x-user-id', 'x-client-id', 'x-scopes'],
  }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Configure EJS view engine for OAuth authorization page
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // --- Local dev: inject x-tenant-id from MCP_TENANT_ID (simulates API Gateway authorizer) ---
  // Must be registered BEFORE routes so middleware runs for all requests.
  if (options?.injectTenantId) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (!req.headers['x-tenant-id']) {
        req.headers['x-tenant-id'] = options.injectTenantId!;
      }
      next();
    });
  }

  // --- Health check (no auth required) ---
  app.use('/health', healthRoutes);

  // --- OAuth discovery metadata (RFC 8414) — no auth required ---
  app.use('/.well-known', wellKnownRoutes);

  // --- OAuth routes (public — /token and /revoke use client credentials) ---
  app.use('/oauth', oauthRoutes);

  // --- MCP routes (protected by API Gateway JWT authorizer in production) ---
  app.use('/', mcpRoutes);

  // --- 404 handler ---
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', message: 'Route not found' });
  });

  // --- Error handler ---
  app.use(errorHandler);

  return app;
}
